export interface EvidenceBuildEnvironment {
  readonly NEXT_PUBLIC_EVIDENCE_ROOM_URL?: string;
  readonly UCP_AGENT_PROFILE_URL?: string;
  readonly VERCEL?: string;
}

const localHostnames = new Set(['localhost', '127.0.0.1', '::1']);

function parseEvidenceRoomOrigin(value: string): URL {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error('NEXT_PUBLIC_EVIDENCE_ROOM_URL must be an absolute HTTP or HTTPS origin.');
  }
  if (
    !['http:', 'https:'].includes(url.protocol) ||
    url.username.length > 0 ||
    url.password.length > 0 ||
    url.search.length > 0 ||
    url.hash.length > 0 ||
    (url.pathname !== '' && url.pathname !== '/')
  ) {
    throw new Error(
      'NEXT_PUBLIC_EVIDENCE_ROOM_URL must be a credential-free HTTP or HTTPS origin.',
    );
  }
  return url;
}

export function evidenceRoomOriginForBuild(
  environment: EvidenceBuildEnvironment,
): string | undefined {
  const value = environment.NEXT_PUBLIC_EVIDENCE_ROOM_URL?.trim();
  const vercelBuild = environment.VERCEL === '1';
  if (value === undefined || value.length === 0) {
    if (vercelBuild) {
      throw new Error('NEXT_PUBLIC_EVIDENCE_ROOM_URL is required for every Vercel build.');
    }
    return undefined;
  }

  const url = parseEvidenceRoomOrigin(value);
  if (vercelBuild && (url.protocol !== 'https:' || localHostnames.has(url.hostname))) {
    throw new Error(
      'NEXT_PUBLIC_EVIDENCE_ROOM_URL must be a public HTTPS origin for every Vercel build.',
    );
  }
  return url.origin;
}

export function ucpAgentProfileUrlForBuild(
  environment: EvidenceBuildEnvironment,
): string | undefined {
  const value = environment.UCP_AGENT_PROFILE_URL?.trim();
  const vercelBuild = environment.VERCEL === '1';
  if (value === undefined || value.length === 0) {
    if (vercelBuild) {
      throw new Error('UCP_AGENT_PROFILE_URL is required for every Vercel build.');
    }
    return undefined;
  }
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error('UCP_AGENT_PROFILE_URL must be an absolute HTTPS profile URL.');
  }
  if (
    url.protocol !== 'https:' ||
    url.username.length > 0 ||
    url.password.length > 0 ||
    url.search.length > 0 ||
    url.hash.length > 0 ||
    url.pathname !== '/ucp/agent-profile'
  ) {
    throw new Error(
      'UCP_AGENT_PROFILE_URL must be a credential-free HTTPS URL ending at /ucp/agent-profile.',
    );
  }
  if (vercelBuild && localHostnames.has(url.hostname)) {
    throw new Error('UCP_AGENT_PROFILE_URL must be public for every Vercel build.');
  }
  return url.toString();
}
