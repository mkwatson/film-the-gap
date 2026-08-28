import { z } from 'zod';

import { publicHttpUrlSchema } from './url-policy';

const readableProductPageUrlSchema = publicHttpUrlSchema.refine(
  (value) => {
    const url = new URL(value);
    return url.protocol === 'https:' && (url.port === '' || url.port === '443');
  },
  { message: 'Product-page reading requires a public HTTPS URL on the default port.' },
);

export const knownPageReadRequestSchema = z.strictObject({
  url: readableProductPageUrlSchema,
});

const knownPageReadBaseSchema = z.strictObject({
  reader: z.literal('cloudflare_browser_run'),
  requestedUrl: readableProductPageUrlSchema,
});

export const knownPageReadResponseSchema = z.discriminatedUnion('status', [
  knownPageReadBaseSchema.extend({
    status: z.literal('complete'),
    finalUrl: readableProductPageUrlSchema,
    title: z.string().trim().min(1).max(240),
    excerpt: z.string().trim().min(1).max(320),
    contentSignal: z.string().trim().min(1).max(200).nullable(),
    browserMilliseconds: z.number().int().nonnegative().max(120_000).nullable(),
  }),
  knownPageReadBaseSchema.extend({
    status: z.literal('unavailable'),
    warning: z.string().trim().min(1).max(240),
  }),
]);

export type KnownPageReadRequest = z.infer<typeof knownPageReadRequestSchema>;
export type KnownPageReadResponse = z.infer<typeof knownPageReadResponseSchema>;

type KnownPageFetch = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

export interface RemoteKnownPageReaderOptions {
  readonly serviceUrl: string;
  readonly token: string;
  readonly fetchImpl?: KnownPageFetch;
  readonly signal?: AbortSignal;
}

function boundedSignal(signal: AbortSignal | undefined): AbortSignal {
  const timeout = AbortSignal.timeout(12_000);
  return signal === undefined ? timeout : AbortSignal.any([signal, timeout]);
}

export async function readRemoteKnownProductPage(
  request: KnownPageReadRequest,
  options: RemoteKnownPageReaderOptions,
): Promise<KnownPageReadResponse> {
  const parsedRequest = knownPageReadRequestSchema.parse(request);
  const endpoint = new URL('/product-page-reader', options.serviceUrl);
  const response = await (options.fetchImpl ?? fetch)(endpoint, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${options.token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(parsedRequest),
    signal: boundedSignal(options.signal),
  });
  if (!response.ok) {
    return {
      reader: 'cloudflare_browser_run',
      status: 'unavailable',
      requestedUrl: parsedRequest.url,
      warning:
        response.status === 429
          ? 'The bounded product-page reading allowance is currently exhausted.'
          : 'The product-page reader was temporarily unavailable.',
    };
  }
  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    return {
      reader: 'cloudflare_browser_run',
      status: 'unavailable',
      requestedUrl: parsedRequest.url,
      warning: 'The product-page reader returned an invalid receipt.',
    };
  }
  const parsedResponse = knownPageReadResponseSchema.safeParse(payload);
  return parsedResponse.success
    ? parsedResponse.data
    : {
        reader: 'cloudflare_browser_run',
        status: 'unavailable',
        requestedUrl: parsedRequest.url,
        warning: 'The product-page reader returned an invalid receipt.',
      };
}

export const knownPageReaderRuntime = {
  timeoutMilliseconds: 12_000,
} as const;
