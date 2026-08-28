import { z } from 'zod';

function privateOrReservedIpv4(hostname: string): boolean {
  const octets = hostname.split('.');
  if (octets.length !== 4 || octets.some((octet) => !/^\d{1,3}$/.test(octet))) {
    return false;
  }
  const values = octets.map(Number);
  if (values.some((value) => value > 255)) {
    return true;
  }
  const [first = 0, second = 0, third = 0] = values;
  return (
    first === 0 ||
    first === 10 ||
    first === 127 ||
    (first === 100 && second >= 64 && second <= 127) ||
    (first === 169 && second === 254) ||
    (first === 172 && second >= 16 && second <= 31) ||
    (first === 192 && second === 0 && third === 0) ||
    (first === 192 && second === 0 && third === 2) ||
    (first === 192 && second === 168) ||
    (first === 198 && (second === 18 || second === 19)) ||
    (first === 198 && second === 51 && third === 100) ||
    (first === 203 && second === 0 && third === 113) ||
    first >= 224
  );
}

export function isPublicHttpUrl(value: string): boolean {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }
  if (!['http:', 'https:'].includes(url.protocol) || url.username !== '' || url.password !== '') {
    return false;
  }
  const hostname = url.hostname.toLowerCase().replace(/\.+$/, '');
  return !(
    hostname.length === 0 ||
    hostname === 'localhost' ||
    hostname.endsWith('.localhost') ||
    hostname.endsWith('.local') ||
    hostname.endsWith('.internal') ||
    hostname.endsWith('.home.arpa') ||
    hostname.startsWith('[') ||
    privateOrReservedIpv4(hostname)
  );
}

export function canonicalizePublicDiscoveryUrl(value: string): string | null {
  if (!isPublicHttpUrl(value)) {
    return null;
  }
  const url = new URL(value);
  url.hostname = url.hostname.replace(/\.+$/, '');
  url.hash = '';
  for (const key of [...url.searchParams.keys()]) {
    const normalized = key.toLowerCase();
    if (normalized.startsWith('utm_') || ['fbclid', 'gclid'].includes(normalized)) {
      url.searchParams.delete(key);
    }
  }
  return url.toString();
}

export const publicHttpUrlSchema = z
  .url()
  .refine(isPublicHttpUrl, { message: 'Use a public HTTP or HTTPS URL without credentials.' });
