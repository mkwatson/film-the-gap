import { webMcpPlatformProfile } from '@/lib/ucp/profile';

export function GET(): Response {
  return Response.json(webMcpPlatformProfile, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'public, max-age=60, stale-while-revalidate=300',
    },
  });
}
