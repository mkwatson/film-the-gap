const commitPattern = /^[0-9a-f]{40}$/i;

function normalizedOrigin(value: string | undefined): string | null {
  if (value === undefined || value.trim().length === 0) {
    return null;
  }
  try {
    const url = new URL(value);
    if (
      !['http:', 'https:'].includes(url.protocol) ||
      url.username.length > 0 ||
      url.password.length > 0 ||
      url.search.length > 0 ||
      url.hash.length > 0 ||
      (url.pathname !== '' && url.pathname !== '/')
    ) {
      return null;
    }
    return url.origin;
  } catch {
    return null;
  }
}

function commitSha(value: string | undefined): string | null {
  const candidate = value?.trim();
  return candidate !== undefined && commitPattern.test(candidate) ? candidate.toLowerCase() : null;
}

export function GET(): Response {
  const evidenceRoomOrigin = normalizedOrigin(process.env.NEXT_PUBLIC_EVIDENCE_ROOM_URL);
  const commit = commitSha(
    process.env.VERCEL_GIT_COMMIT_SHA ?? process.env.WEBMCP_RELEASE_COMMIT_SHA,
  );
  return Response.json(
    {
      ok: true,
      service: 'webmcp-challenge-app',
      commit,
      evidenceRoomOrigin,
      evidenceRoomConfigured: evidenceRoomOrigin !== null,
    },
    {
      headers: {
        'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff',
      },
    },
  );
}
