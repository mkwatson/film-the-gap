import {
  shopifyCatalogSearchInputSchema,
  shopifyCatalogSearchResponseSchema,
  type ShopifyCatalogSearchInput,
  type ShopifyCatalogSearchResponse,
} from './ucp-catalog';

export async function discoverCatalogProducts(
  input: ShopifyCatalogSearchInput,
  signal?: AbortSignal,
): Promise<ShopifyCatalogSearchResponse> {
  const validatedInput = shopifyCatalogSearchInputSchema.parse(input);
  const response = await fetch('/api/catalog/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(validatedInput),
    ...(signal === undefined ? {} : { signal }),
  });
  if (!response.ok) {
    throw new Error(`UCP product discovery failed with HTTP ${response.status}.`);
  }
  return shopifyCatalogSearchResponseSchema.parse(await response.json());
}
