import {
  createRemoteEvidenceCaseRequestSchema,
  ownerEvidenceCommandRequestSchema,
  publishRemoteEvidenceRequestSchema,
  remoteEvidenceCaseCredentialsSchema,
  remoteEvidenceCaseSnapshotSchema,
  reserveEvidenceUploadRequestSchema,
  reservedEvidenceUploadSchema,
  type CreateRemoteEvidenceCaseRequest,
  type OwnerEvidenceCommandRequest,
  type PublishRemoteEvidenceRequest,
  type RemoteEvidenceCaseCredentials,
  type RemoteEvidenceCaseSnapshot,
  type ReserveEvidenceUploadRequest,
  type ReservedEvidenceUpload,
} from './remote-protocol';

export type EvidenceFetch = (
  input: string | URL | globalThis.Request,
  init?: RequestInit,
) => Promise<Response>;

export class RemoteEvidenceError extends Error {
  readonly status: number;
  readonly code: string;
  readonly response: unknown;

  constructor(status: number, code: string, message: string, response: unknown) {
    super(message);
    this.name = 'RemoteEvidenceError';
    this.status = status;
    this.code = code;
    this.response = response;
  }
}

function normalizeServiceUrl(value: string): string {
  const url = new URL(value);
  if (
    !['http:', 'https:'].includes(url.protocol) ||
    url.username.length > 0 ||
    url.password.length > 0
  ) {
    throw new Error('The evidence service must use a credential-free HTTP or HTTPS URL.');
  }
  return url.origin;
}

export function configuredEvidenceServiceUrl(): string | null {
  const value = process.env.NEXT_PUBLIC_EVIDENCE_ROOM_URL?.trim();
  if (value === undefined || value.length === 0) {
    return null;
  }
  try {
    return normalizeServiceUrl(value);
  } catch {
    return null;
  }
}

async function responseJson(response: Response): Promise<unknown> {
  const text = await response.text();
  if (text.length === 0) {
    return null;
  }
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new RemoteEvidenceError(
      response.status,
      'invalid_json',
      'The evidence service returned an unreadable response.',
      text,
    );
  }
}

function errorRecord(value: unknown): { readonly code: string; readonly message: string } {
  if (typeof value !== 'object' || value === null) {
    return { code: 'remote_error', message: 'The evidence service request failed.' };
  }
  const record = value as Record<string, unknown>;
  const code = typeof record.error === 'string' ? record.error : 'remote_error';
  const message =
    typeof record.message === 'string' ? record.message : `The evidence service returned ${code}.`;
  return { code, message };
}

async function checkedJson(response: Response): Promise<unknown> {
  const body = await responseJson(response);
  if (!response.ok) {
    const error = errorRecord(body);
    throw new RemoteEvidenceError(response.status, error.code, error.message, body);
  }
  return body;
}

function jsonRequest(body: object): RequestInit {
  return {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  };
}

export async function createRemoteEvidenceCase(
  serviceUrl: string,
  request: CreateRemoteEvidenceCaseRequest,
  evidenceFetch: EvidenceFetch = fetch,
): Promise<RemoteEvidenceCaseCredentials> {
  const input = createRemoteEvidenceCaseRequestSchema.parse(request);
  const response = await evidenceFetch(
    `${normalizeServiceUrl(serviceUrl)}/evidence-cases`,
    jsonRequest(input),
  );
  return remoteEvidenceCaseCredentialsSchema.parse(await checkedJson(response));
}

export async function readRemoteEvidenceCase(
  serviceUrl: string,
  caseId: string,
  evidenceFetch: EvidenceFetch = fetch,
): Promise<RemoteEvidenceCaseSnapshot> {
  const response = await evidenceFetch(
    `${normalizeServiceUrl(serviceUrl)}/evidence-cases/${encodeURIComponent(caseId)}/snapshot`,
  );
  return remoteEvidenceCaseSnapshotSchema.parse(await checkedJson(response));
}

export async function sendOwnerEvidenceCommand(
  serviceUrl: string,
  caseId: string,
  request: OwnerEvidenceCommandRequest,
  evidenceFetch: EvidenceFetch = fetch,
): Promise<RemoteEvidenceCaseSnapshot> {
  const input = ownerEvidenceCommandRequestSchema.parse(request);
  const response = await evidenceFetch(
    `${normalizeServiceUrl(serviceUrl)}/evidence-cases/${encodeURIComponent(caseId)}/commands`,
    jsonRequest(input),
  );
  const body = await checkedJson(response);
  if (typeof body !== 'object' || body === null || !('snapshot' in body)) {
    throw new RemoteEvidenceError(
      response.status,
      'missing_snapshot',
      'The evidence service did not return the updated case.',
      body,
    );
  }
  return remoteEvidenceCaseSnapshotSchema.parse(body.snapshot);
}

export async function reserveRemoteEvidenceUpload(
  serviceUrl: string,
  caseId: string,
  request: ReserveEvidenceUploadRequest,
  evidenceFetch: EvidenceFetch = fetch,
): Promise<ReservedEvidenceUpload> {
  const input = reserveEvidenceUploadRequestSchema.parse(request);
  const response = await evidenceFetch(
    `${normalizeServiceUrl(serviceUrl)}/evidence-cases/${encodeURIComponent(caseId)}/uploads`,
    jsonRequest(input),
  );
  return reservedEvidenceUploadSchema.parse(await checkedJson(response));
}

export async function uploadEvidenceVideo(
  uploadUrl: string,
  file: File,
  evidenceFetch: EvidenceFetch = fetch,
): Promise<void> {
  const url = new URL(uploadUrl);
  if (url.protocol !== 'https:' || url.hostname !== 'upload.videodelivery.net') {
    throw new Error('Refusing to upload evidence outside Cloudflare Stream.');
  }
  const form = new FormData();
  form.set('file', file);
  const response = await evidenceFetch(url, { method: 'POST', body: form });
  if (!response.ok) {
    throw new RemoteEvidenceError(
      response.status,
      'video_upload_failed',
      `Cloudflare Stream rejected the upload with ${response.status}.`,
      null,
    );
  }
}

export async function publishRemoteEvidence(
  serviceUrl: string,
  caseId: string,
  request: PublishRemoteEvidenceRequest,
  evidenceFetch: EvidenceFetch = fetch,
): Promise<RemoteEvidenceCaseSnapshot> {
  const input = publishRemoteEvidenceRequestSchema.parse(request);
  const response = await evidenceFetch(
    `${normalizeServiceUrl(serviceUrl)}/evidence-cases/${encodeURIComponent(caseId)}/evidence`,
    jsonRequest(input),
  );
  const body = await checkedJson(response);
  if (typeof body !== 'object' || body === null || !('snapshot' in body)) {
    throw new RemoteEvidenceError(
      response.status,
      'missing_snapshot',
      'The evidence service did not return the published case.',
      body,
    );
  }
  return remoteEvidenceCaseSnapshotSchema.parse(body.snapshot);
}

export function remoteEvidenceWebSocketUrl(serviceUrl: string, caseId: string): string {
  const url = new URL(normalizeServiceUrl(serviceUrl));
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
  url.pathname = `/evidence-cases/${encodeURIComponent(caseId)}/ws`;
  return url.toString();
}

export function contributorPath(caseId: string, token: string): string {
  const fragment = new URLSearchParams({ token }).toString();
  return `/contribute/${encodeURIComponent(caseId)}#${fragment}`;
}
