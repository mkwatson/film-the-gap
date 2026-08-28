import { notFound } from 'next/navigation';

import { ProductEvidenceNetwork } from '@/components/product-evidence-network';
import {
  parseEvidenceCaseHandoffSearchParams,
  type EvidenceCaseHandoffSearchParams,
} from '@/lib/evidence-network/case-handoff';

interface EvidenceCasePageProps {
  readonly searchParams: Promise<EvidenceCaseHandoffSearchParams>;
}

export default async function EvidenceCasePage({
  searchParams,
}: EvidenceCasePageProps): Promise<React.JSX.Element> {
  const handoff = parseEvidenceCaseHandoffSearchParams(await searchParams);
  if (handoff === null) {
    notFound();
  }
  return <ProductEvidenceNetwork initialHandoff={handoff} />;
}
