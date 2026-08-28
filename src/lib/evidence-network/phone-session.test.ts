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

function connectionWithPublicMission(): EvidencePhoneConnection {
  return {
    ...connection(),
    publicMission: {
      id: '123e4567-e89b-42d3-a456-426614174000',
      caseId: 'BCDF2345',
      productName: 'Everyday insulated travel bottle',
      productUrl: null,
      question: 'Does the filled bottle stay leak-free when held upside down for 10 seconds?',
      instruction: 'Fill the bottle, close the lid, and hold it upside down over dry paper.',
      successCriterion: 'Keep the closed lid and dry paper visible for the entire test.',
      minimumSeconds: 10,
      continuousTakeRequired: true,
      status: 'open',
      createdAt: '2026-08-27T04:00:00.000Z',
      expiresAt: new Date(expiresAt).toISOString(),
      fulfilledAt: null,
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

  it('restores a same-case public board receipt without exposing it in the contributor URL', () => {
    const expected = connectionWithPublicMission();

    expect(
      persistEvidencePhoneConnection(window.sessionStorage, serviceUrl, appUrl, expected),
    ).toBe(true);
    expect(
      restoreEvidencePhoneConnection(window.sessionStorage, serviceUrl, appUrl, expiresAt - 1),
    ).toEqual(expected);
    expect(expected.receipt.contributorUrl).not.toContain(expected.publicMission?.id ?? 'missing');
  });

  it('allows the public board capability to expire before the private case', () => {
    const expected = connectionWithPublicMission();
    const publicMission = expected.publicMission;
    if (publicMission === undefined) throw new Error('Expected a public mission.');
    const publicExpiresAt = expiresAt - 10_000;
    const shorter: EvidencePhoneConnection = {
      ...expected,
      publicMission: {
        ...publicMission,
        expiresAt: new Date(publicExpiresAt).toISOString(),
      },
    };
    persistEvidencePhoneConnection(window.sessionStorage, serviceUrl, appUrl, shorter);

    expect(
      restoreEvidencePhoneConnection(
        window.sessionStorage,
        serviceUrl,
        appUrl,
        publicExpiresAt - 1,
      ),
    ).toEqual(shorter);
    expect(
      restoreEvidencePhoneConnection(window.sessionStorage, serviceUrl, appUrl, publicExpiresAt),
    ).toEqual({ credentials: shorter.credentials, receipt: shorter.receipt });
  });

  it('deletes a public mission receipt bound to another case', () => {
    const mismatched = connectionWithPublicMission();
    const publicMission = mismatched.publicMission;
    if (publicMission === undefined) throw new Error('Expected a public mission.');
    const invalid: EvidencePhoneConnection = {
      ...mismatched,
      publicMission: { ...publicMission, caseId: 'CDFG3456' },
    };
    persistEvidencePhoneConnection(window.sessionStorage, serviceUrl, appUrl, invalid);

    expect(
      restoreEvidencePhoneConnection(window.sessionStorage, serviceUrl, appUrl, expiresAt - 1),
    ).toBeNull();
  });
});
