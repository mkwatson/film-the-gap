import { createHash } from 'node:crypto';

import {
  evidenceDiscoveryInputSchema,
  type EvidenceDiscoveryInput,
  type ProductQuestionInput,
} from '../model';
import { canonicalizePublicDiscoveryUrl } from '../url-policy';
import { searchGatewayWebEvidence } from './gateway-web-search';
import { buildEvidenceSearchQuery, searchScrapeCreatorsEvidence } from './scrape-creators';

const cacheVersion = 'v1';
const cacheTtlSeconds = 15 * 60;

interface DiscoveryCacheSetOptions {
  readonly name?: string;
  readonly tags?: string[];
  readonly ttl?: number;
}

export interface EvidenceDiscoveryCache {
  readonly get: (key: string) => Promise<unknown | null>;
  readonly set: (key: string, value: unknown, options?: DiscoveryCacheSetOptions) => Promise<void>;
}

type EvidenceSearch = (
  input: ProductQuestionInput,
  signal?: AbortSignal,
) => Promise<EvidenceDiscoveryInput>;

interface PublicEvidenceSearchDependencies {
  readonly scrapeCreatorsApiKey: string | undefined;
  readonly gatewayApiKey: string | undefined;
  readonly cache?: EvidenceDiscoveryCache;
  readonly searchSocial?: EvidenceSearch;
  readonly searchWeb?: EvidenceSearch;
}

function suppliedPageLead(
  input: ProductQuestionInput,
): EvidenceDiscoveryInput['leads'][number] | null {
  if (input.productUrl === undefined) {
    return null;
  }
  const hostname = new URL(input.productUrl).hostname;
  return {
    platform: 'web',
    title: `${input.productName} · supplied product page`.slice(0, 240),
    url: input.productUrl,
    summary:
      'This page was supplied with the case as a place to inspect. Its copy and images are not treated as proof, and its contents have not been reviewed against the claim.',
    creatorLabel: `Supplied page · ${hostname}`.slice(0, 120),
  };
}

function uniqueLeads(
  leads: readonly EvidenceDiscoveryInput['leads'][number][],
): EvidenceDiscoveryInput['leads'] {
  const urls = new Set<string>();
  return leads.filter(({ url }) => {
    const key = canonicalizePublicDiscoveryUrl(url);
    if (key === null) {
      return false;
    }
    if (urls.has(key)) {
      return false;
    }
    urls.add(key);
    return true;
  });
}

function mergeDiscoveryResults(
  input: ProductQuestionInput,
  results: readonly EvidenceDiscoveryInput[],
): EvidenceDiscoveryInput {
  const suppliedLead = suppliedPageLead(input);
  const successfulResults = results.filter(({ status }) => status !== 'unavailable');
  const status = results.every(({ status: resultStatus }) => resultStatus === 'complete')
    ? 'complete'
    : successfulResults.length > 0 || suppliedLead !== null
      ? 'partial'
      : 'unavailable';
  const searchedPlatforms = [
    ...new Set(results.flatMap(({ searchedPlatforms: platforms }) => platforms)),
  ];
  const leads = uniqueLeads([
    ...(suppliedLead === null ? [] : [suppliedLead]),
    ...results.flatMap(({ leads: providerLeads }) => providerLeads),
  ]).slice(0, 12);

  return evidenceDiscoveryInputSchema.parse({
    provider: 'evidence_network',
    status,
    query: buildEvidenceSearchQuery(input),
    searchedPlatforms,
    warnings: results.flatMap(({ warnings }) => warnings).slice(0, 8),
    leads,
  });
}

function cacheKey(
  input: ProductQuestionInput,
  providers: { readonly social: boolean; readonly web: boolean },
): string {
  const digest = createHash('sha256')
    .update(
      JSON.stringify({
        version: cacheVersion,
        input,
        providers,
      }),
    )
    .digest('hex');
  return `search:${digest}`;
}

async function readCachedDiscovery(
  cache: EvidenceDiscoveryCache | undefined,
  key: string,
): Promise<EvidenceDiscoveryInput | null> {
  if (cache === undefined) {
    return null;
  }
  try {
    const parsed = evidenceDiscoveryInputSchema.safeParse(await cache.get(key));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

async function writeCachedDiscovery(
  cache: EvidenceDiscoveryCache | undefined,
  key: string,
  value: EvidenceDiscoveryInput,
): Promise<void> {
  if (cache === undefined) {
    return;
  }
  try {
    await cache.set(key, value, {
      ttl: cacheTtlSeconds,
      tags: ['product-evidence-discovery'],
      name: 'claim-aware public evidence search',
    });
  } catch {
    // Discovery still succeeds when the regional cache is unavailable.
  }
}

export async function searchPublicProductEvidence(
  input: ProductQuestionInput,
  dependencies: PublicEvidenceSearchDependencies,
  signal?: AbortSignal,
): Promise<EvidenceDiscoveryInput> {
  const providers = {
    social:
      dependencies.searchSocial !== undefined ||
      (dependencies.scrapeCreatorsApiKey?.trim().length ?? 0) > 0,
    web:
      dependencies.searchWeb !== undefined || (dependencies.gatewayApiKey?.trim().length ?? 0) > 0,
  } as const;
  const key = cacheKey(input, providers);
  const cached = await readCachedDiscovery(dependencies.cache, key);
  if (cached !== null) {
    return cached;
  }

  const socialSearch =
    dependencies.searchSocial ??
    ((searchInput: ProductQuestionInput, searchSignal?: AbortSignal) =>
      searchScrapeCreatorsEvidence(searchInput, {
        apiKey: dependencies.scrapeCreatorsApiKey,
        ...(searchSignal === undefined ? {} : { signal: searchSignal }),
      }));
  const webSearch =
    dependencies.searchWeb ??
    ((searchInput: ProductQuestionInput, searchSignal?: AbortSignal) =>
      searchGatewayWebEvidence(searchInput, { apiKey: dependencies.gatewayApiKey }, searchSignal));
  const providerResults = await Promise.all([
    socialSearch(input, signal),
    webSearch(input, signal),
  ]);
  const result = mergeDiscoveryResults(input, providerResults);
  const configuredResults = providerResults.filter((_, index) =>
    index === 0 ? providers.social : providers.web,
  );
  if (
    configuredResults.length > 0 &&
    configuredResults.every(({ status }) => status === 'complete')
  ) {
    await writeCachedDiscovery(dependencies.cache, key, result);
  }
  return result;
}

export const publicEvidenceSearchRuntime = {
  cacheVersion,
  cacheTtlSeconds,
} as const;
