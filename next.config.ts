import type { NextConfig } from 'next';

import { evidenceRoomOriginForBuild } from './src/lib/evidence-network/deployment-config';
import { buildAppSecurityHeaders } from './src/lib/security-headers';

const allowedDevOrigins = process.env.ALLOWED_DEV_ORIGINS?.split(',')
  .map((origin) => origin.trim())
  .filter((origin) => origin.length > 0);
const evidenceRoomUrl = evidenceRoomOriginForBuild(process.env);
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
            allowMicrophone: false,
            allowStreamPlayback: true,
          }),
        ],
      },
      {
        source: '/contribute/:path*',
        headers: [
          ...buildAppSecurityHeaders({
            ...commonOptions,
            allowCamera: true,
            allowMicrophone: true,
            allowCreatorUpload: true,
            allowStreamPlayback: true,
          }),
        ],
      },
      {
        source: '/missions/:path*',
        headers: [
          ...buildAppSecurityHeaders({
            ...commonOptions,
            allowCamera: false,
            allowMicrophone: false,
          }),
        ],
      },
    ];
  },
  reactStrictMode: true,
  typedRoutes: true,
};

export default nextConfig;
