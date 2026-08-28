export interface AppSecurityHeader {
  readonly key: string;
  readonly value: string;
}

interface ContentSecurityPolicyOptions {
  readonly evidenceRoomUrl?: string;
  readonly development: boolean;
  readonly allowCreatorUpload?: boolean;
  readonly allowStreamPlayback?: boolean;
}

interface AppSecurityHeaderOptions extends ContentSecurityPolicyOptions {
  readonly allowCamera: boolean;
  readonly allowMicrophone: boolean;
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
  allowCreatorUpload = false,
  allowStreamPlayback = false,
}: ContentSecurityPolicyOptions): string {
  const connectSources = [
    "'self'",
    ...evidenceRoomConnectSources(evidenceRoomUrl),
    ...(allowCreatorUpload ? ['https://upload.videodelivery.net'] : []),
    ...(development ? ['ws:'] : []),
  ];
  const streamSource = 'https://*.cloudflarestream.com';
  const directives = [
    "default-src 'self'",
    `script-src 'self' 'unsafe-inline'${development ? " 'unsafe-eval'" : ''}`,
    "style-src 'self' 'unsafe-inline'",
    `img-src 'self' blob: data:${allowStreamPlayback ? ` ${streamSource}` : ''}`,
    `media-src 'self' blob:${allowStreamPlayback ? ` ${streamSource}` : ''}`,
    `frame-src 'self'${allowStreamPlayback ? ` ${streamSource}` : ''}`,
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
  allowMicrophone,
  allowCreatorUpload,
  allowStreamPlayback,
  evidenceRoomUrl,
  development,
}: AppSecurityHeaderOptions): readonly AppSecurityHeader[] {
  return [
    {
      key: 'Content-Security-Policy',
      value: buildContentSecurityPolicy({
        ...(evidenceRoomUrl === undefined ? {} : { evidenceRoomUrl }),
        development,
        ...(allowCreatorUpload === undefined ? {} : { allowCreatorUpload }),
        ...(allowStreamPlayback === undefined ? {} : { allowStreamPlayback }),
      }),
    },
    {
      key: 'Permissions-Policy',
      value: `camera=${allowCamera ? '(self)' : '()'}, microphone=${allowMicrophone ? '(self)' : '()'}, geolocation=(), payment=(), browsing-topics=()`,
    },
    { key: 'Referrer-Policy', value: 'no-referrer' },
    { key: 'X-Content-Type-Options', value: 'nosniff' },
  ];
}
