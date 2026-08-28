import { describe, expect, it } from 'vitest';

import { canonicalizePublicDiscoveryUrl, isPublicHttpUrl } from './url-policy';

describe('public discovery URL policy', () => {
  it('accepts ordinary public HTTP and HTTPS URLs', () => {
    expect(isPublicHttpUrl('https://shop.example/products/item')).toBe(true);
    expect(isPublicHttpUrl('http://93.184.216.34/products/item')).toBe(true);
  });

  it.each([
    'https://user:secret@shop.example/product',
    'http://localhost/product',
    'http://localhost./product',
    'http://camera.local/product',
    'http://camera.local./product',
    'http://service.internal/product',
    'http://127.0.0.1/product',
    'http://10.0.0.4/product',
    'http://169.254.169.254/latest/meta-data',
    'http://192.168.1.20/product',
    'http://[::1]/product',
    'file:///tmp/product.html',
  ])('rejects credentials and local or non-web targets: %s', (url) => {
    expect(isPublicHttpUrl(url)).toBe(false);
    expect(canonicalizePublicDiscoveryUrl(url)).toBeNull();
  });

  it('removes fragments and tracking parameters without erasing product selectors', () => {
    expect(
      canonicalizePublicDiscoveryUrl(
        'https://shop.example/product?variant=blue&utm_source=demo&gclid=tracking#reviews',
      ),
    ).toBe('https://shop.example/product?variant=blue');
    expect(canonicalizePublicDiscoveryUrl('https://shop.example./product')).toBe(
      'https://shop.example/product',
    );
  });
});
