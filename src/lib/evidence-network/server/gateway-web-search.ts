import { createGateway, generateText } from 'ai';
import { z } from 'zod';

import type { EvidenceDiscoveryInput, ProductQuestionInput } from '../model';
import { canonicalizePublicDiscoveryUrl } from '../url-policy';
import { buildEvidenceSearchQuery } from './scrape-creators';

const gatewaySearchModel = 'openai/gpt-5.4-nano' as const;
const maximumWebLeads = 4;
const gatewayTimeoutMilliseconds = 20_000;
const gatewayMaximumOutputTokens = 1_024;
const excludedSocialDomains = ['tiktok.com', 'instagram.com', 'youtube.com', 'youtu.be'] as const;

const exaSearchOutputSchema = z.union([
  z.object({
    requestId: z.string().min(1),
    results: z.array(
      z.object({
        title: z.string().optional(),
        url: z.string(),
        highlights: z.array(z.string()).optional(),
        summary: z.string().optional(),
        text: z.string().optional(),
      }),
    ),
  }),
  z.object({
    error: z.string(),
    message: z.string(),
  }),
]);

const exaSearchInputReceiptSchema = z.object({ query: z.string() });

export interface GatewaySearchExecution {
  readonly input: unknown;
  readonly output: unknown;
}

export type GatewaySearchRunner = (
  query: string,
  signal: AbortSignal,
) => Promise<GatewaySearchExecution | null>;

interface GatewayWebSearchDependencies {
  readonly apiKey: string | undefined;
  readonly oidcAvailable?: boolean;
  readonly runSearch?: GatewaySearchRunner;
}

function boundedSignal(signal: AbortSignal | undefined): AbortSignal {
  const timeout = AbortSignal.timeout(gatewayTimeoutMilliseconds);
  return signal === undefined ? timeout : AbortSignal.any([signal, timeout]);
}

async function runGatewayExaSearch(
  query: string,
  apiKey: string | undefined,
  signal: AbortSignal,
): Promise<GatewaySearchExecution | null> {
  const provider = apiKey === undefined ? createGateway() : createGateway({ apiKey });
  const tools = {
    exa_search: provider.tools.exaSearch({
      type: 'instant',
      numResults: maximumWebLeads,
      userLocation: 'US',
      excludeDomains: [...excludedSocialDomains],
      contents: {
        highlights: { query, maxCharacters: 800 },
      },
    }),
  };
  const result = await generateText({
    model: provider(gatewaySearchModel),
    system:
      'Call exa_search exactly once. Copy the supplied query byte-for-byte into the query argument. Do not answer the question or add search terms.',
    prompt: `Exact query JSON string: ${JSON.stringify(query)}`,
    tools,
    toolChoice: { type: 'tool', toolName: 'exa_search' },
    maxOutputTokens: gatewayMaximumOutputTokens,
    maxRetries: 1,
    abortSignal: signal,
  });
  const toolResult = result.toolResults.find(({ toolName }) => toolName === 'exa_search');
  return toolResult === undefined ? null : { input: toolResult.input, output: toolResult.output };
}

function canonicalWebUrl(rawUrl: string): string | null {
  const canonical = canonicalizePublicDiscoveryUrl(rawUrl);
  if (canonical === null) {
    return null;
  }
  const url = new URL(canonical);
  const hostname = url.hostname.toLowerCase();
  if (
    excludedSocialDomains.some((domain) => hostname === domain || hostname.endsWith(`.${domain}`))
  ) {
    return null;
  }
  return url.toString();
}

function compactText(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function leadSummary(result: {
  readonly highlights?: readonly string[] | undefined;
  readonly summary?: string | undefined;
  readonly text?: string | undefined;
}): string {
  const excerpt = compactText(
    result.highlights?.join(' ') ??
      result.summary ??
      result.text ??
      'The search provider returned link metadata without a page excerpt.',
  ).slice(0, 205);
  return `Exa via Vercel AI Gateway returned this search excerpt: “${excerpt}”. Candidate only; the page has not been reviewed against the claim.`.slice(
    0,
    360,
  );
}

function warning(message: string): string {
  return compactText(message).slice(0, 240);
}

export async function searchGatewayWebEvidence(
  input: ProductQuestionInput,
  dependencies: GatewayWebSearchDependencies,
  signal?: AbortSignal,
): Promise<EvidenceDiscoveryInput> {
  const query = buildEvidenceSearchQuery(input);
  const apiKey = dependencies.apiKey?.trim();
  const oidcAvailable = dependencies.oidcAvailable === true;
  if ((apiKey === undefined || apiKey.length === 0) && !oidcAvailable) {
    return {
      provider: 'vercel_ai_gateway',
      status: 'unavailable',
      query,
      searchedPlatforms: [],
      warnings: ['Broad web search through Vercel AI Gateway is not configured.'],
      leads: [],
    };
  }

  let execution: GatewaySearchExecution | null;
  try {
    execution = await (
      dependencies.runSearch ??
      ((exactQuery, runSignal) =>
        runGatewayExaSearch(
          exactQuery,
          apiKey === undefined || apiKey.length === 0 ? undefined : apiKey,
          runSignal,
        ))
    )(query, boundedSignal(signal));
  } catch {
    return {
      provider: 'vercel_ai_gateway',
      status: 'unavailable',
      query,
      searchedPlatforms: [],
      warnings: ['Broad web search through Vercel AI Gateway was temporarily unreachable.'],
      leads: [],
    };
  }

  if (execution === null) {
    return {
      provider: 'vercel_ai_gateway',
      status: 'unavailable',
      query,
      searchedPlatforms: [],
      warnings: ['Vercel AI Gateway returned no Exa search receipt.'],
      leads: [],
    };
  }
  const inputReceipt = exaSearchInputReceiptSchema.safeParse(execution.input);
  if (!inputReceipt.success || inputReceipt.data.query !== query) {
    return {
      provider: 'vercel_ai_gateway',
      status: 'unavailable',
      query,
      searchedPlatforms: [],
      warnings: [
        'The gateway did not preserve the exact bounded query, so no web result was accepted.',
      ],
      leads: [],
    };
  }
  const parsed = exaSearchOutputSchema.safeParse(execution.output);
  if (!parsed.success) {
    return {
      provider: 'vercel_ai_gateway',
      status: 'unavailable',
      query,
      searchedPlatforms: [],
      warnings: ['Vercel AI Gateway returned an invalid Exa search receipt.'],
      leads: [],
    };
  }
  if ('error' in parsed.data) {
    return {
      provider: 'vercel_ai_gateway',
      status: 'unavailable',
      query,
      searchedPlatforms: [],
      warnings: [warning(`Broad web search failed: ${parsed.data.message}`)],
      leads: [],
    };
  }

  const seen = new Set<string>();
  const leads = parsed.data.results.flatMap((result) => {
    const url = canonicalWebUrl(result.url);
    if (url === null || seen.has(url)) {
      return [];
    }
    seen.add(url);
    const hostname = new URL(url).hostname;
    const returnedTitle = compactText(result.title ?? '');
    return [
      {
        platform: 'web' as const,
        title: (returnedTitle.length === 0 ? hostname : returnedTitle).slice(0, 240),
        url,
        summary: leadSummary(result),
        creatorLabel: 'Open web · Exa via Vercel AI Gateway',
      },
    ];
  });

  return {
    provider: 'vercel_ai_gateway',
    status: 'complete',
    query,
    searchedPlatforms: ['web'],
    warnings: [],
    leads: leads.slice(0, maximumWebLeads),
  };
}

export const gatewayWebSearchRuntime = {
  model: gatewaySearchModel,
  providerTool: 'gateway.exa_search',
  maximumLeads: maximumWebLeads,
  timeoutMilliseconds: gatewayTimeoutMilliseconds,
  maximumOutputTokens: gatewayMaximumOutputTokens,
} as const;
