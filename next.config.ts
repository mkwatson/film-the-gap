import type { NextConfig } from 'next';

import { buildAppSecurityHeaders } from './src/lib/security-headers';

const allowedDevOrigins = process.env.ALLOWED_DEV_ORIGINS?.split(',')
  .map((origin) => origin.trim())
  .filter((origin) => origin.length > 0);
const evidenceRoomUrl = process.env.NEXT_PUBLIC_EVIDENCE_ROOM_URL?.trim();
const development = process.env.NODE_ENV === 'development';

const nextConfig: NextConfig = {
  ...(allowedDevOrigins && allowedDevOrigins.length > 0 ? { allowedDevOrigins } : {}),
  async headers() {
    const commonOptions = {
      ...(evidenceRoomUrl === undefined || evidenceRoomUrl.length === 0 ? {} : { evidenceRoomUrl }),
      development,
    } as const;
    return [
      {
        source: '/',
        headers: [
          ...buildAppSecurityHeaders({
            ...commonOptions,
            allowCamera: false,
            allowStreamPlayback: true,
          }),
        ],
      },
      {
        source: '/host',
        headers: [...buildAppSecurityHeaders({ ...commonOptions, allowCamera: true })],
      },
      {
        source: '/contribute/:path*',
        headers: [
          ...buildAppSecurityHeaders({
            ...commonOptions,
            allowCamera: true,
            allowCreatorUpload: true,
            allowStreamPlayback: true,
          }),
        ],
      },
    ];
  },
  reactStrictMode: true,
  typedRoutes: true,
};

export default nextConfig;
