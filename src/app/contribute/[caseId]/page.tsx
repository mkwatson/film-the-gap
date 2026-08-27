import { EvidenceContributor } from '@/components/evidence-contributor';

interface ContributorPageProps {
  readonly params: Promise<{ readonly caseId: string }>;
}

export default async function ContributorPage({
  params,
}: ContributorPageProps): Promise<React.JSX.Element> {
  const { caseId } = await params;
  return <EvidenceContributor caseId={caseId} />;
}
