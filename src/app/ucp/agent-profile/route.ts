import { filmTheGapUcpPlatformProfile } from '@/lib/evidence-network/ucp-catalog';

export const runtime = 'nodejs';

export function GET(): Response {
  return Response.json(filmTheGapUcpPlatformProfile, {
    headers: {
      'Cache-Control': 'public, max-age=300, s-maxage=3600, stale-while-revalidate=86400',
      'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none'",
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
    },
  });
}
