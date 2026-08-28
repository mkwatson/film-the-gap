import { createHash } from 'node:crypto';

import {
  evidenceDiscoveryInputSchema,
  type EvidenceDiscoveryInput,
  type ProductQuestionInput,
  type ReusableEvidenceSearchResponse,
} from '../model';
import { readRemoteKnownProductPage, type KnownPageReadResponse } from '../known-page-reader';
import { searchRemoteReusableEvidence } from '../remote-client';
import { canonicalizePublicDiscoveryUrl } from '../url-policy';
import { searchGatewayWebEvidence } from './gateway-web-search';
import { buildEvidenceSearchQuery, searchScrapeCreatorsEvidence } from './scrape-creators';

const cacheVersion = 'v3';
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

type KnownPageRead = (url: string, signal?: AbortSignal) => Promise<KnownPageReadResponse>;

interface PublicEvidenceSearchDependencies {
  readonly scrapeCreatorsApiKey: string | undefined;
  readonly gatewayApiKey: string | undefined;
  readonly gatewayOidcAvailable?: boolean;
  readonly evidenceServiceUrl?: string;
  readonly pageReaderToken?: string;
  readonly cache?: EvidenceDiscoveryCache;
  readonly searchSocial?: EvidenceSearch;
  readonly searchWeb?: EvidenceSearch;
  readonly searchNetwork?: ReusableEvidenceSearch;
  readonly readKnownPage?: KnownPageRead;
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

function reusableOnlyDiscovery(input: ProductQuestionInput): EvidenceDiscoveryInput {
  return evidenceDiscoveryInputSchema.parse({
    provider: 'evidence_network',
    status: 'complete',
    query: buildEvidenceSearchQuery(input),
    searchedPlatforms: [],
    warnings: [],
    leads: [],
  });
}

function suppliedPageLead(
  input: ProductQuestionInput,
  read: KnownPageReadResponse | null = null,
): EvidenceDiscoveryInput['leads'][number] | null {
  if (input.productUrl === undefined) {
    return null;
  }
  const hostname = new URL(input.productUrl).hostname;
  return {
    platform: 'web',
    title:
      `${read?.status === 'complete' ? read.title : input.productName} · supplied product page`.slice(
        0,
        240,
      ),
    url: input.productUrl,
    summary:
      read?.status === 'complete'
        ? `Untrusted product-page excerpt read by Cloudflare Browser Run: “${read.excerpt}”. Page copy remains a lead, never proof.${read.contentSignal === null ? '' : ` Origin content signal: ${read.contentSignal}.`}`.slice(
            0,
            360,
          )
        : 'This page was supplied with the case as a place to inspect. Its copy and images are not treated as proof, and its contents have not been read against the claim.',
    creatorLabel:
      read?.status === 'complete'
        ? 'Product page · Cloudflare Browser Run'
        : `Supplied page · ${hostname}`.slice(0, 120),
  };
}

async function readSuppliedProductPage(
  input: ProductQuestionInput,
  dependencies: PublicEvidenceSearchDependencies,
  signal?: AbortSignal,
): Promise<EvidenceDiscoveryInput | null> {
  if (input.productUrl === undefined) {
    return null;
  }
  const fallback = suppliedPageLead(input);
  if (fallback === null) {
    return null;
  }
  const token = dependencies.pageReaderToken?.trim();
  const configuredReader = dependencies.readKnownPage;
  if (
    configuredReader === undefined &&
    (dependencies.evidenceServiceUrl === undefined || token === undefined || token.length === 0)
  ) {
    return evidenceDiscoveryInputSchema.parse({
      provider: 'evidence_network',
      status: 'unavailable',
      query: buildEvidenceSearchQuery(input),
      searchedPlatforms: [],
      warnings: ['Live product-page reading is not configured on this deployment.'],
      leads: [fallback],
    });
  }
  let read: KnownPageReadResponse;
  try {
    read = await (
      configuredReader ??
      ((url, readSignal) =>
        readRemoteKnownProductPage(
          { url },
          {
            serviceUrl: dependencies.evidenceServiceUrl ?? '',
            token: token ?? '',
            ...(readSignal === undefined ? {} : { signal: readSignal }),
          },
        ))
    )(input.productUrl, signal);
  } catch {
    read = {
      reader: 'cloudflare_browser_run',
      status: 'unavailable',
      requestedUrl: input.productUrl,
      warning: 'The product-page reader was temporarily unreachable.',
    };
  }
  return evidenceDiscoveryInputSchema.parse({
    provider: 'evidence_network',
    status: read.status,
    query: buildEvidenceSearchQuery(input),
    searchedPlatforms: read.status === 'complete' ? ['web'] : [],
    warnings: read.status === 'complete' ? [] : [read.warning],
    leads: [suppliedPageLead(input, read) ?? fallback],
  });
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
  const successfulResults = results.filter(({ status }) => status !== 'unavailable');
  const status = results.every(({ status: resultStatus }) => resultStatus === 'complete')
    ? 'complete'
    : successfulResults.length > 0 || results.some(({ leads }) => leads.length > 0)
      ? 'partial'
      : 'unavailable';
  const searchedPlatforms = [
    ...new Set(results.flatMap(({ searchedPlatforms: platforms }) => platforms)),
  ];
  const leads = uniqueLeads([
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
  providers: { readonly page: boolean; readonly social: boolean; readonly web: boolean },
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
  const networkResult = await searchReusableNetwork(input, dependencies, signal);
  if (networkResult.records.length > 0) {
    return mergeReusableNetwork(reusableOnlyDiscovery(input), networkResult);
  }
  const providers = {
    page:
      input.productUrl !== undefined &&
      (dependencies.readKnownPage !== undefined ||
        (dependencies.evidenceServiceUrl !== undefined &&
          (dependencies.pageReaderToken?.trim().length ?? 0) > 0)),
    social:
      dependencies.searchSocial !== undefined ||
      (dependencies.scrapeCreatorsApiKey?.trim().length ?? 0) > 0,
    web:
      dependencies.searchWeb !== undefined ||
      (dependencies.gatewayApiKey?.trim().length ?? 0) > 0 ||
      dependencies.gatewayOidcAvailable === true,
  } as const;
  const key = cacheKey(input, providers);
  const cached = await readCachedDiscovery(dependencies.cache, key);
  if (cached !== null) {
    return mergeReusableNetwork(cached, networkResult);
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
      searchGatewayWebEvidence(
        searchInput,
        {
          apiKey: dependencies.gatewayApiKey,
          oidcAvailable: dependencies.gatewayOidcAvailable === true,
        },
        searchSignal,
      ));
  const pageSearch =
    input.productUrl === undefined ? null : readSuppliedProductPage(input, dependencies, signal);
  const [pageResult, socialResult, webResult] = await Promise.all([
    pageSearch,
    socialSearch(input, signal),
    webSearch(input, signal),
  ]);
  const providerResults = [...(pageResult === null ? [] : [pageResult]), socialResult, webResult];
  const result = mergeDiscoveryResults(input, providerResults);
  const configuredResults = [
    ...(pageResult !== null && providers.page ? [pageResult] : []),
    ...(providers.social ? [socialResult] : []),
    ...(providers.web ? [webResult] : []),
  ];
  if (
    configuredResults.length > 0 &&
    configuredResults.every(({ status }) => status === 'complete')
  ) {
    await writeCachedDiscovery(dependencies.cache, key, result);
  }
  return mergeReusableNetwork(result, networkResult);
}

export const publicEvidenceSearchRuntime = {
  cacheVersion,
  cacheTtlSeconds,
} as const;
