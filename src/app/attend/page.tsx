import type { Metadata } from 'next';

import { LiveMarketAttendee } from '@/components/live-market-attendee';

export const metadata: Metadata = {
  title: 'Evidence attendee · Agent-attended live market',
  description:
    'A least-authority WebMCP surface for joining one normalized live-commerce evidence request.',
};

export default function AttendPage(): React.JSX.Element {
  return <LiveMarketAttendee />;
}
