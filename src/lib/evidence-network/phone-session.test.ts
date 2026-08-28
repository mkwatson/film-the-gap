import { beforeEach, describe, expect, it } from 'vitest';

import { createDemoEvidenceNetworkState } from './model';
import {
  evidencePhoneSessionStorageKey,
  persistEvidencePhoneConnection,
  restoreEvidencePhoneConnection,
  type EvidencePhoneConnection,
} from './phone-session';

const serviceUrl = 'https://rooms.example';
const appUrl = 'https://evidence.example';
const expiresAt = Date.parse('2026-08-28T04:00:00.000Z');

function connection(): EvidencePhoneConnection {
  const contributorToken = 'c'.repeat(43);
  return {
    credentials: {
      protocolVersion: '1',
      caseId: 'BCDF2345',
      ownerToken: 'o'.repeat(43),
      contributorToken,
      expiresAt,
      state: createDemoEvidenceNetworkState(),
    },
    receipt: {
      caseId: 'BCDF2345',
      contributorUrl: `${appUrl}/contribute/BCDF2345#token=${contributorToken}`,
      expiresAt,
    },
  };
}

beforeEach(() => {
  window.sessionStorage.clear();
});

describe('evidence phone session', () => {
  it('restores an unexpired same-origin connection from session storage', () => {
    const expected = connection();

    expect(
      persistEvidencePhoneConnection(window.sessionStorage, serviceUrl, appUrl, expected),
    ).toBe(true);
    expect(
      restoreEvidencePhoneConnection(window.sessionStorage, serviceUrl, appUrl, expiresAt - 1),
    ).toEqual(expected);
  });

  it('deletes expired or origin-mismatched capabilities instead of reviving them', () => {
    persistEvidencePhoneConnection(window.sessionStorage, serviceUrl, appUrl, connection());

    expect(
      restoreEvidencePhoneConnection(window.sessionStorage, serviceUrl, appUrl, expiresAt),
    ).toBeNull();
    expect(window.sessionStorage.getItem(evidencePhoneSessionStorageKey)).toBeNull();

    persistEvidencePhoneConnection(window.sessionStorage, serviceUrl, appUrl, connection());
    expect(
      restoreEvidencePhoneConnection(
        window.sessionStorage,
        'https://different-rooms.example',
        appUrl,
        expiresAt - 1,
      ),
    ).toBeNull();
    expect(window.sessionStorage.getItem(evidencePhoneSessionStorageKey)).toBeNull();
  });

  it('rejects a contributor URL that does not match the stored capability', () => {
    persistEvidencePhoneConnection(window.sessionStorage, serviceUrl, appUrl, connection());
    const raw = window.sessionStorage.getItem(evidencePhoneSessionStorageKey);
    if (raw === null) throw new Error('Expected a stored phone session.');
    const stored = JSON.parse(raw) as Record<string, unknown>;
    const receipt = stored.receipt as Record<string, unknown>;
    receipt.contributorUrl = `${appUrl}/contribute/BCDF2345#token=${'x'.repeat(43)}`;
    window.sessionStorage.setItem(evidencePhoneSessionStorageKey, JSON.stringify(stored));

    expect(
      restoreEvidencePhoneConnection(window.sessionStorage, serviceUrl, appUrl, expiresAt - 1),
    ).toBeNull();
    expect(window.sessionStorage.getItem(evidencePhoneSessionStorageKey)).toBeNull();
  });
});
