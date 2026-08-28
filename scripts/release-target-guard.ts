import { z } from 'zod';

const commitPattern = /^[0-9a-f]{40}$/i;
const slugPattern = /^[a-z0-9](?:[a-z0-9-]{0,98}[a-z0-9])?$/;
const d1DatabaseIdPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const emptyD1DatabaseId = '00000000-0000-0000-0000-000000000000';
const expectedWorkerName = 'webmcp-product-evidence';
const retiredVercelProjects = new Set(['webmcp-evidence-market']);

const vercelProjectLinkSchema = z.object({
  orgId: z.string().min(1),
  projectId: z.string().min(1),
  projectName: z.string().min(1),
});

export interface ReleaseTargetGuardInput {
  readonly expectedVercelScope: string;
  readonly expectedVercelProject: string;
  readonly appOrigin: string;
  readonly roomOrigin: string;
  readonly expectedCommit: string;
  readonly actualCommit: string;
  readonly gitStatus: string;
  readonly vercelProjectLink: unknown;
  readonly workerConfigText: string;
}

export interface ReleaseTargetGuardReport {
  readonly ok: true;
  readonly commit: string;
  readonly vercel: {
    readonly scope: string;
    readonly project: string;
    readonly appOrigin: string;
  };
  readonly cloudflare: {
    readonly worker: string;
    readonly roomOrigin: string;
    readonly d1Configured: true;
    readonly signedPlaybackOriginConfigured: true;
    readonly cpuLimitMilliseconds: 100;
  };
}

function requiredValue(value: string, label: string): string {
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    throw new Error(`${label} is required.`);
  }
  return trimmed;
}

function releaseSlug(value: string, label: string): string {
  const slug = requiredValue(value, label);
  if (!slugPattern.test(slug)) {
    throw new Error(`${label} must be an exact lowercase Vercel slug.`);
  }
  return slug;
}

function releaseOrigin(value: string, label: string): string {
  let url: URL;
  try {
    url = new URL(requiredValue(value, label));
  } catch {
    throw new Error(`${label} must be a credential-free HTTPS origin.`);
  }
  if (
    url.protocol !== 'https:' ||
    url.username.length > 0 ||
    url.password.length > 0 ||
    url.search.length > 0 ||
    url.hash.length > 0 ||
    (url.pathname !== '' && url.pathname !== '/')
  ) {
    throw new Error(`${label} must be a credential-free HTTPS origin.`);
  }
  if (url.hostname.toLowerCase().includes('vidably')) {
    throw new Error(`${label} must not carry unrelated Vidably branding.`);
  }
  return url.origin;
}

function configString(configText: string, key: string): string {
  const match = new RegExp(`"${key}"\\s*:\\s*"([^"]+)"`, 'u').exec(configText);
  const value = match?.[1]?.trim();
  if (value === undefined || value.length === 0) {
    throw new Error(`room-worker/wrangler.evidence.jsonc must declare ${key}.`);
  }
  return value;
}

function configuredD1Id(configText: string, key: string): string {
  const value = configString(configText, key);
  if (!d1DatabaseIdPattern.test(value) || value === emptyD1DatabaseId) {
    throw new Error(`${key} must be the dedicated non-placeholder D1 database UUID.`);
  }
  return value.toLowerCase();
}

function configuredNumber(configText: string, key: string): number {
  const match = new RegExp(`"${key}"\\s*:\\s*(\\d+)`, 'u').exec(configText);
  const value = Number(match?.[1]);
  if (!Number.isSafeInteger(value)) {
    throw new Error(`room-worker/wrangler.evidence.jsonc must declare numeric ${key}.`);
  }
  return value;
}

export function verifyReleaseTarget(input: ReleaseTargetGuardInput): ReleaseTargetGuardReport {
  const expectedVercelScope = releaseSlug(input.expectedVercelScope, 'WEBMCP_VERCEL_SCOPE');
  const expectedVercelProject = releaseSlug(input.expectedVercelProject, 'WEBMCP_VERCEL_PROJECT');
  if (
    retiredVercelProjects.has(expectedVercelProject) ||
    expectedVercelProject.includes('vidably')
  ) {
    throw new Error('WEBMCP_VERCEL_PROJECT must name the new standalone release project.');
  }

  const appOrigin = releaseOrigin(input.appOrigin, 'WEBMCP_APP_ORIGIN');
  const roomOrigin = releaseOrigin(input.roomOrigin, 'WEBMCP_ROOM_ORIGIN');
  if (appOrigin === roomOrigin) {
    throw new Error('The Vercel app and Cloudflare Worker origins must be distinct.');
  }

  const expectedCommit = requiredValue(input.expectedCommit, 'WEBMCP_RELEASE_COMMIT_SHA');
  const actualCommit = requiredValue(input.actualCommit, 'current Git commit');
  if (!commitPattern.test(expectedCommit) || !commitPattern.test(actualCommit)) {
    throw new Error('Release commits must be exact 40-character Git SHAs.');
  }
  if (expectedCommit.toLowerCase() !== actualCommit.toLowerCase()) {
    throw new Error('WEBMCP_RELEASE_COMMIT_SHA does not match the checked-out commit.');
  }
  if (input.gitStatus.trim().length > 0) {
    throw new Error(
      'The release worktree must be clean before any account mutation or deployment.',
    );
  }

  const projectLink = vercelProjectLinkSchema.safeParse(input.vercelProjectLink);
  if (!projectLink.success) {
    throw new Error('.vercel/project.json is missing or invalid.');
  }
  if (projectLink.data.projectName !== expectedVercelProject) {
    throw new Error(
      `.vercel/project.json links ${projectLink.data.projectName}, not ${expectedVercelProject}.`,
    );
  }

  const workerName = configString(input.workerConfigText, 'name');
  if (workerName !== expectedWorkerName) {
    throw new Error(`The release Worker must remain ${expectedWorkerName}.`);
  }
  const databaseId = configuredD1Id(input.workerConfigText, 'database_id');
  const previewDatabaseId = configuredD1Id(input.workerConfigText, 'preview_database_id');
  if (databaseId !== previewDatabaseId) {
    throw new Error(
      'database_id and preview_database_id must name the same dedicated D1 database.',
    );
  }
  const configuredPlaybackOrigin = releaseOrigin(
    configString(input.workerConfigText, 'PUBLIC_EVIDENCE_ORIGIN'),
    'PUBLIC_EVIDENCE_ORIGIN in room-worker/wrangler.evidence.jsonc',
  );
  if (configuredPlaybackOrigin !== roomOrigin) {
    throw new Error(
      'PUBLIC_EVIDENCE_ORIGIN in room-worker/wrangler.evidence.jsonc must match WEBMCP_ROOM_ORIGIN.',
    );
  }
  if (configuredNumber(input.workerConfigText, 'cpu_ms') !== 100) {
    throw new Error('The release Worker must retain its reviewed 100 ms CPU ceiling.');
  }

  return {
    ok: true,
    commit: actualCommit.toLowerCase(),
    vercel: {
      scope: expectedVercelScope,
      project: expectedVercelProject,
      appOrigin,
    },
    cloudflare: {
      worker: workerName,
      roomOrigin,
      d1Configured: true,
      signedPlaybackOriginConfigured: true,
      cpuLimitMilliseconds: 100,
    },
  };
}
