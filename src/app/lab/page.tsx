import type { Metadata } from 'next';

import { ProductEvidenceNetwork } from '@/components/product-evidence-network';

export const metadata: Metadata = {
  title: 'Film the Gap · Evidence lab',
  description: 'Inspect the complete WebMCP product-evidence workflow and its live contracts.',
};

export default function EvidenceLabPage(): React.JSX.Element {
  return <ProductEvidenceNetwork presentation="lab" />;
}
