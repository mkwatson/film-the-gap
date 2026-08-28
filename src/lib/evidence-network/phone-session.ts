import { z } from 'zod';

import { contributorPath } from './remote-client';
import {
  remoteEvidenceCaseCredentialsSchema,
  remoteEvidenceCaseIdPattern,
  publicEvidenceMissionSchema,
  type PublicEvidenceMission,
  type RemoteEvidenceCaseCredentials,
} from './remote-protocol';

export interface EvidencePhoneCaptureReceipt {
  readonly caseId: string;
  readonly contributorUrl: string;
  readonly expiresAt: number;
}

export interface EvidencePhoneConnection {
  readonly credentials: RemoteEvidenceCaseCredentials;
  readonly receipt: EvidencePhoneCaptureReceipt;
  readonly publicMission?: PublicEvidenceMission;
}

export const evidencePhoneSessionStorageKey = 'product-evidence-phone-session:v1' as const;

const evidencePhoneCaptureReceiptSchema: z.ZodType<EvidencePhoneCaptureReceipt> = z.strictObject({
  caseId: z.string().regex(remoteEvidenceCaseIdPattern),
  contributorUrl: z.url(),
  expiresAt: z.number().int().positive(),
});

const storedEvidencePhoneSessionSchema = z.strictObject({
  version: z.literal(1),
  serviceOrigin: z.url(),
  appOrigin: z.url(),
  credentials: remoteEvidenceCaseCredentialsSchema,
  receipt: evidencePhoneCaptureReceiptSchema,
  publicMission: publicEvidenceMissionSchema.optional(),
});

function normalizedOrigin(value: string): string | null {
  try {
    const url = new URL(value);
    if (
      !['http:', 'https:'].includes(url.protocol) ||
      url.username.length > 0 ||
      url.password.length > 0
    ) {
      return null;
    }
    return url.origin;
  } catch {
    return null;
  }
}

function discard(storage: Pick<Storage, 'removeItem'>): void {
  try {
    storage.removeItem(evidencePhoneSessionStorageKey);
  } catch {
    // A blocked storage API should degrade to a non-persistent phone handoff.
  }
}

export function clearEvidencePhoneConnection(storage: Pick<Storage, 'removeItem'>): void {
  discard(storage);
}

export function persistEvidencePhoneConnection(
  storage: Pick<Storage, 'setItem'>,
  serviceUrl: string,
  appUrl: string,
  connection: EvidencePhoneConnection,
): boolean {
  const serviceOrigin = normalizedOrigin(serviceUrl);
  const appOrigin = normalizedOrigin(appUrl);
  if (serviceOrigin === null || appOrigin === null) {
    return false;
  }
  try {
    storage.setItem(
      evidencePhoneSessionStorageKey,
      JSON.stringify({
        version: 1,
        serviceOrigin,
        appOrigin,
        credentials: connection.credentials,
        receipt: connection.receipt,
        ...(connection.publicMission === undefined
          ? {}
          : { publicMission: connection.publicMission }),
      }),
    );
    return true;
  } catch {
    return false;
  }
}

export function restoreEvidencePhoneConnection(
  storage: Pick<Storage, 'getItem' | 'removeItem'>,
  serviceUrl: string,
  appUrl: string,
  now = Date.now(),
): EvidencePhoneConnection | null {
  let raw: string | null;
  try {
    raw = storage.getItem(evidencePhoneSessionStorageKey);
  } catch {
    return null;
  }
  if (raw === null) {
    return null;
  }
  let value: unknown;
  try {
    value = JSON.parse(raw) as unknown;
  } catch {
    discard(storage);
    return null;
  }
  const parsed = storedEvidencePhoneSessionSchema.safeParse(value);
  const serviceOrigin = normalizedOrigin(serviceUrl);
  const appOrigin = normalizedOrigin(appUrl);
  if (
    !parsed.success ||
    serviceOrigin === null ||
    appOrigin === null ||
    parsed.data.serviceOrigin !== serviceOrigin ||
    parsed.data.appOrigin !== appOrigin ||
    parsed.data.credentials.expiresAt <= now ||
    parsed.data.receipt.expiresAt !== parsed.data.credentials.expiresAt ||
    parsed.data.receipt.caseId !== parsed.data.credentials.caseId ||
    (parsed.data.publicMission !== undefined &&
      (parsed.data.publicMission.caseId !== parsed.data.credentials.caseId ||
        Date.parse(parsed.data.publicMission.expiresAt) > parsed.data.credentials.expiresAt))
  ) {
    discard(storage);
    return null;
  }
  const expectedContributorUrl = new URL(
    contributorPath(parsed.data.credentials.caseId, parsed.data.credentials.contributorToken),
    appOrigin,
  ).toString();
  if (parsed.data.receipt.contributorUrl !== expectedContributorUrl) {
    discard(storage);
    return null;
  }
  const publicMission =
    parsed.data.publicMission?.status === 'open' &&
    Date.parse(parsed.data.publicMission.expiresAt) <= now
      ? undefined
      : parsed.data.publicMission;
  return {
    credentials: parsed.data.credentials,
    receipt: parsed.data.receipt,
    ...(publicMission === undefined ? {} : { publicMission }),
  };
}
