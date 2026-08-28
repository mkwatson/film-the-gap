import { z } from 'zod';

import {
  productQuestionInputSchema,
  type EvidenceNetworkTransition,
  type ProductQuestionInput,
} from './model';
import {
  shopifyCatalogSearchInputSchema,
  type ShopifyCatalogProduct,
  type ShopifyCatalogSearchInput,
  type ShopifyCatalogSearchResponse,
} from './ucp-catalog';

const searchCatalogJsonSchema = {
  type: 'object',
  properties: {
    query: {
      type: 'string',
      minLength: 3,
      maxLength: 160,
      description:
        'A generic product category and only public characteristics the user wants sent to the catalog. Never include identity, budget, history, private preferences, or conversation text.',
    },
    country: {
      type: 'string',
      pattern: '^[A-Za-z]{2}$',
      description: 'Optional two-letter country code for merchant availability. Defaults to US.',
    },
  },
  required: ['query'],
  additionalProperties: false,
} as const;

const openCatalogQuestionJsonSchema = {
  type: 'object',
  properties: {
    variantId: {
      type: 'string',
      minLength: 1,
      maxLength: 240,
      description: 'Exact variantId from the current search_product_catalog result.',
    },
    question: {
      type: 'string',
      minLength: 8,
      maxLength: 280,
      description:
        'One public, concrete product question that observable video evidence could answer. Never include private shopper context.',
    },
  },
  required: ['variantId', 'question'],
  additionalProperties: false,
} as const;

const openCatalogQuestionSchema = z.strictObject({
  variantId: z.string().min(1).max(240),
  question: productQuestionInputSchema.shape.question,
});

export interface CatalogSiteToolRuntime {
  readonly readResult: () => ShopifyCatalogSearchResponse | null;
  readonly search: (
    input: ShopifyCatalogSearchInput,
    signal?: AbortSignal,
  ) => Promise<ShopifyCatalogSearchResponse>;
  readonly openQuestion: (input: ProductQuestionInput) => Promise<EvidenceNetworkTransition>;
}

interface ValidationIssue {
  readonly path: string;
  readonly message: string;
}

function validationFailure(error: z.ZodError): {
  readonly ok: false;
  readonly error: 'invalid_input';
  readonly issues: readonly ValidationIssue[];
} {
  return {
    ok: false,
    error: 'invalid_input',
    issues: error.issues.map((issue) => ({
      path: issue.path.join('.'),
      message: issue.message,
    })),
  };
}

function compactText(value: string, maximumCharacters: number): string {
  return value.length <= maximumCharacters
    ? value
    : `${value.slice(0, maximumCharacters - 1).trimEnd()}…`;
}

function publicProductName(product: ShopifyCatalogProduct): string {
  const normalizedVariant = product.variantTitle.trim().toLowerCase();
  const title = ['default', 'default title', product.title.trim().toLowerCase()].includes(
    normalizedVariant,
  )
    ? product.title
    : `${product.title} · ${product.variantTitle}`;
  return compactText(title.trim().length >= 2 ? title : `${title} product`, 120);
}

export function catalogProductQuestion(
  product: ShopifyCatalogProduct,
  question: string,
): ProductQuestionInput {
  return productQuestionInputSchema.parse({
    productName: publicProductName(product),
    ...(product.productUrl === undefined ? {} : { productUrl: product.productUrl }),
    question,
  });
}

export function catalogSearchSnapshot(result: ShopifyCatalogSearchResponse): object {
  const shown = result.products.slice(0, 3).map((product) => ({
    variantId: product.variantId,
    product: compactText(publicProductName(product), 100),
    seller: compactText(product.seller.name, 80),
    price: product.price,
    ...(product.condition[0] === undefined ? {} : { condition: product.condition[0] }),
    unverifiedCatalogContext: product.catalogClaims
      .slice(0, 1)
      .map(({ text }) => compactText(text, 90)),
  }));
  return {
    ok: result.status === 'complete',
    provider: 'Shopify Global Catalog',
    protocol: `UCP ${result.protocolVersion}`,
    query: result.query,
    status: result.status,
    products: shown,
    totalProductsOnPage: result.products.length,
    moreVisibleOnPage: result.products.length > shown.length,
    warnings: result.warnings.slice(0, 2),
    claimPolicy:
      'Catalog descriptions and inferred attributes are unverified discovery context, not product evidence.',
    privacyReceipt: {
      sent: 'catalog query and country only',
      excluded: 'identity, budget, history, preferences, conversation',
    },
    next:
      shown.length === 0
        ? 'Try a broader public product query.'
        : 'Choose one returned variantId and ask one observable question with open_catalog_product_question.',
  };
}

function transitionSnapshot(
  result: EvidenceNetworkTransition,
  product: ShopifyCatalogProduct,
): object {
  return {
    ok: result.ok,
    message: result.message,
    selected: {
      productId: product.productId,
      variantId: product.variantId,
      product: publicProductName(product),
      seller: product.seller.name,
    },
    revision: result.state.revision,
    privateShopperContext: 'not collected or transmitted',
    next: result.ok
      ? 'Use search_product_evidence to test the observable question against existing sources.'
      : 'Inspect the visible page state before retrying.',
  };
}

export function getCatalogToolNames(
  result: ShopifyCatalogSearchResponse | null,
): readonly string[] {
  return [
    'search_product_catalog',
    ...(result?.status === 'complete' && result.products.length > 0
      ? ['open_catalog_product_question']
      : []),
  ];
}

export function createCatalogSiteTools(
  runtime: CatalogSiteToolRuntime,
): readonly WebMCP.ModelContextTool[] {
  const tools: readonly WebMCP.ModelContextTool[] = [
    {
      name: 'search_product_catalog',
      title: 'Search real products with UCP',
      description:
        'Search new products across participating Shopify merchants through the Universal Commerce Protocol. This is read-only discovery: send only a generic product query and country. Returned catalog claims are unverified context, never evidence.',
      inputSchema: searchCatalogJsonSchema,
      annotations: {
        readOnlyHint: true,
        untrustedContentHint: true,
      },
      execute: async (input, options?: WebMCP.ToolExecuteCallbackOptions): Promise<object> => {
        options?.signal?.throwIfAborted();
        const parsed = shopifyCatalogSearchInputSchema.safeParse(input);
        if (!parsed.success) {
          return validationFailure(parsed.error);
        }
        const result = await runtime.search(parsed.data, options?.signal);
        options?.signal?.throwIfAborted();
        return catalogSearchSnapshot(result);
      },
    },
    {
      name: 'open_catalog_product_question',
      title: 'Ask what a catalog cannot prove',
      description:
        'Select one exact variant from the current UCP search and open a product-evidence case for one observable question. The merchant URL is retained as unverified context; catalog copy cannot affect the answer.',
      inputSchema: openCatalogQuestionJsonSchema,
      annotations: {
        readOnlyHint: false,
        untrustedContentHint: true,
      },
      execute: async (input, options?: WebMCP.ToolExecuteCallbackOptions): Promise<object> => {
        options?.signal?.throwIfAborted();
        const parsed = openCatalogQuestionSchema.safeParse(input);
        if (!parsed.success) {
          return validationFailure(parsed.error);
        }
        const current = runtime.readResult();
        const product = current?.products.find(
          ({ variantId }) => variantId === parsed.data.variantId,
        );
        if (current?.status !== 'complete' || product === undefined) {
          return {
            ok: false,
            error: 'stale_catalog_selection',
            message: 'That variant is not in the current visible UCP result. Search again.',
          };
        }
        const question = catalogProductQuestion(product, parsed.data.question);
        const transition = await runtime.openQuestion(question);
        return transitionSnapshot(transition, product);
      },
    },
  ];
  const available = new Set(getCatalogToolNames(runtime.readResult()));
  return tools.filter(({ name }) => available.has(name));
}
