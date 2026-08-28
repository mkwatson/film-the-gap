import { createHash } from 'node:crypto';

import {
  evidenceDiscoveryInputSchema,
  type EvidenceDiscoveryInput,
  type ProductQuestionInput,
  type ReusableEvidenceSearchResponse,
} from '../model';
import { searchRemoteReusableEvidence } from '../remote-client';
import { canonicalizePublicDiscoveryUrl } from '../url-policy';
import { searchGatewayWebEvidence } from './gateway-web-search';
import { buildEvidenceSearchQuery, searchScrapeCreatorsEvidence } from './scrape-creators';

const cacheVersion = 'v2';
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

type ReusableEvidenceSearch = (
  input: ProductQuestionInput,
  signal?: AbortSignal,
) => Promise<ReusableEvidenceSearchResponse>;

interface PublicEvidenceSearchDependencies {
  readonly scrapeCreatorsApiKey: string | undefined;
  readonly gatewayApiKey: string | undefined;
  readonly evidenceServiceUrl?: string;
  readonly cache?: EvidenceDiscoveryCache;
  readonly searchSocial?: EvidenceSearch;
  readonly searchWeb?: EvidenceSearch;
  readonly searchNetwork?: ReusableEvidenceSearch;
}

function unavailableNetworkSearch(warning?: string): ReusableEvidenceSearchResponse {
  return {
    status: 'unavailable',
    records: [],
    warnings: warning === undefined ? [] : [warning],
  };
}

async function searchReusableNetwork(
  input: ProductQuestionInput,
  dependencies: PublicEvidenceSearchDependencies,
  signal?: AbortSignal,
): Promise<ReusableEvidenceSearchResponse> {
  try {
    if (dependencies.searchNetwork !== undefined) {
      return await dependencies.searchNetwork(input, signal);
    }
    if (dependencies.evidenceServiceUrl === undefined) {
      return unavailableNetworkSearch();
    }
    return await searchRemoteReusableEvidence(
      dependencies.evidenceServiceUrl,
      input,
      fetch,
      signal,
    );
  } catch {
    return unavailableNetworkSearch(
      'The reusable evidence index was temporarily unavailable; public discovery continued.',
    );
  }
}

function mergeReusableNetwork(
  publicResult: EvidenceDiscoveryInput,
  networkResult: ReusableEvidenceSearchResponse,
): EvidenceDiscoveryInput {
  const hasReusableEvidence = networkResult.records.length > 0;
  return evidenceDiscoveryInputSchema.parse({
    ...publicResult,
    status:
      hasReusableEvidence && publicResult.status === 'unavailable'
        ? 'partial'
        : publicResult.status,
    warnings: [...networkResult.warnings, ...publicResult.warnings].slice(0, 8),
    reviewedEvidence: networkResult.records,
  });
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
  const networkSearch = searchReusableNetwork(input, dependencies, signal);
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
    return mergeReusableNetwork(cached, await networkSearch);
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
  return mergeReusableNetwork(result, await networkSearch);
}

export const publicEvidenceSearchRuntime = {
  cacheVersion,
  cacheTtlSeconds,
} as const;
