export interface AppSecurityHeader {
  readonly key: string;
  readonly value: string;
}

interface ContentSecurityPolicyOptions {
  readonly evidenceRoomUrl?: string;
  readonly development: boolean;
}

interface AppSecurityHeaderOptions extends ContentSecurityPolicyOptions {
  readonly allowCamera: boolean;
}

function evidenceRoomConnectSources(value: string | undefined): readonly string[] {
  if (value === undefined || value.trim().length === 0) {
    return [];
  }

  try {
    const url = new URL(value);
    if (
      !['http:', 'https:'].includes(url.protocol) ||
      url.username.length > 0 ||
      url.password.length > 0
    ) {
      return [];
    }
    const websocketUrl = new URL(url.origin);
    websocketUrl.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
    return [url.origin, websocketUrl.origin];
  } catch {
    return [];
  }
}

export function buildContentSecurityPolicy({
  evidenceRoomUrl,
  development,
}: ContentSecurityPolicyOptions): string {
  const connectSources = [
    "'self'",
    ...evidenceRoomConnectSources(evidenceRoomUrl),
    ...(development ? ['ws:'] : []),
  ];
  const directives = [
    "default-src 'self'",
    `script-src 'self' 'unsafe-inline'${development ? " 'unsafe-eval'" : ''}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' blob: data:",
    "media-src 'self' blob:",
    "font-src 'self' data:",
    `connect-src ${connectSources.join(' ')}`,
    "worker-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ];
  return `${directives.join('; ')};`;
}

export function buildAppSecurityHeaders({
  allowCamera,
  evidenceRoomUrl,
  development,
}: AppSecurityHeaderOptions): readonly AppSecurityHeader[] {
  return [
    {
      key: 'Content-Security-Policy',
      value: buildContentSecurityPolicy({
        ...(evidenceRoomUrl === undefined ? {} : { evidenceRoomUrl }),
        development,
      }),
    },
    {
      key: 'Permissions-Policy',
      value: `camera=${allowCamera ? '(self)' : '()'}, microphone=(), geolocation=(), payment=(), browsing-topics=()`,
    },
    { key: 'Referrer-Policy', value: 'no-referrer' },
    { key: 'X-Content-Type-Options', value: 'nosniff' },
  ];
}
