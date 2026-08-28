function firstHeaderValue(value: string | null): string | null {
  const first = value?.split(',')[0]?.trim();
  return first === undefined || first.length === 0 ? null : first;
}

function effectiveRequestOrigins(request: Request): readonly string[] {
  let requestUrl: URL;
  try {
    requestUrl = new URL(request.url);
  } catch {
    return [];
  }
  const origins = new Set([requestUrl.origin]);
  const host = firstHeaderValue(request.headers.get('Host'));
  if (host === null) {
    return [...origins];
  }
  const forwardedProtocol = firstHeaderValue(request.headers.get('X-Forwarded-Proto'));
  const protocols = new Set([
    requestUrl.protocol.slice(0, -1),
    ...(forwardedProtocol === null ? [] : [forwardedProtocol.toLowerCase()]),
  ]);
  for (const protocol of protocols) {
    if (!['http', 'https'].includes(protocol)) {
      continue;
    }
    try {
      origins.add(new URL(`${protocol}://${host}`).origin);
    } catch {
      // A malformed Host header is never accepted as an effective origin.
    }
  }
  return [...origins];
}

export function isSameOriginJsonRequest(request: Request): boolean {
  const contentType = request.headers.get('Content-Type')?.toLowerCase() ?? '';
  if (!contentType.startsWith('application/json')) {
    return false;
  }
  const origin = request.headers.get('Origin');
  if (origin === null) {
    return true;
  }
  let normalizedOrigin: string;
  try {
    normalizedOrigin = new URL(origin).origin;
  } catch {
    return false;
  }
  return effectiveRequestOrigins(request).includes(normalizedOrigin);
}
