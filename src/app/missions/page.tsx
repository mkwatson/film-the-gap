import type { Metadata } from 'next';

import { PublicMissionBoard } from '@/components/public-mission-board';

export const metadata: Metadata = {
  title: 'Open filming requests · Film the Gap',
  description:
    'Open, privacy-safe requests for short product videos that answer a shopper’s exact question.',
};

export default function MissionsPage(): React.JSX.Element {
  return <PublicMissionBoard />;
}
