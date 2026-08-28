import {
  evidenceDiscoveryInputSchema,
  type EvidenceDiscoveryInput,
  type ProductQuestionInput,
} from './model';

export async function discoverProductEvidence(
  input: ProductQuestionInput,
  signal?: AbortSignal,
): Promise<EvidenceDiscoveryInput> {
  const response = await fetch('/api/evidence/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
    ...(signal === undefined ? {} : { signal }),
  });
  if (!response.ok) {
    throw new Error(`Public evidence search failed with HTTP ${response.status}.`);
  }
  return evidenceDiscoveryInputSchema.parse(await response.json());
}
