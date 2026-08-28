import {
  evidenceDiscoveryInputSchema,
  productQuestionInputSchema,
} from '@/lib/evidence-network/model';
import { searchScrapeCreatorsEvidence } from '@/lib/evidence-network/server/scrape-creators';

export const runtime = 'nodejs';

function json(body: object, status = 200): Response {
  return Response.json(body, {
    status,
    headers: { 'Cache-Control': 'no-store' },
  });
}

export async function POST(request: Request): Promise<Response> {
  let input: unknown;
  try {
    input = await request.json();
  } catch {
    return json({ error: 'invalid_json' }, 400);
  }
  const parsed = productQuestionInputSchema.safeParse(input);
  if (!parsed.success) {
    return json({ error: 'invalid_product_question', issues: parsed.error.issues }, 400);
  }
  const result = await searchScrapeCreatorsEvidence(parsed.data, {
    apiKey: process.env.SCRAPECREATORS_API_KEY,
  });
  return json(evidenceDiscoveryInputSchema.parse(result));
}
