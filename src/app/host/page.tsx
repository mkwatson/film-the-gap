import type { Metadata } from 'next';

import { LiveMarketHost } from '@/components/live-market-host';

export const metadata: Metadata = {
  title: 'Host evidence console · Agent-attended live market',
  description: 'A synchronized host surface for aggregated, privacy-minimizing evidence demand.',
};

export default function HostPage(): React.JSX.Element {
  return <LiveMarketHost />;
}
