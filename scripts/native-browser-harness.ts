import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

export interface AcceptanceConfig {
  readonly appUrl: string;
  readonly roomOrigin: string;
  readonly merchantOrigin: string;
  readonly browserExecutable: string;
  readonly commandTimeoutMs: number;
  readonly headed: boolean;
  readonly authenticatedCrowd: boolean;
}

export interface AcceptanceStep {
  readonly name: string;
  readonly durationMs: number;
}

export interface AcceptanceArtifactConfig {
  readonly directory: string | null;
  readonly pauseMs: number;
  readonly recordVideo: boolean;
}

export type AcceptanceTab = `t${number}`;

const defaultBrowserExecutable = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const minimumTimeoutMs = 5_000;
const maximumTimeoutMs = 120_000;
const maximumCapturePauseMs = 5_000;

function readOrigin(
  environment: Readonly<Record<string, string | undefined>>,
  key: string,
  options: { readonly defaultValue?: string; readonly requireHttps: boolean },
): string {
  const value = environment[key]?.trim() || options.defaultValue;
  if (value === undefined) {
    throw new Error(`${key} is required.`);
  }

  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error(`${key} must be an absolute URL.`);
  }

  const localHttp =
    parsed.protocol === 'http:' &&
    (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1');
  if (parsed.protocol !== 'https:' && !(localHttp && !options.requireHttps)) {
    throw new Error(`${key} must use HTTPS${options.requireHttps ? '' : ' or loopback HTTP'}.`);
  }
  if (
    parsed.username !== '' ||
    parsed.password !== '' ||
    parsed.search !== '' ||
    parsed.hash !== '' ||
    (parsed.pathname !== '' && parsed.pathname !== '/')
  ) {
    throw new Error(`${key} must be a credential-free origin.`);
  }
  return parsed.origin;
}

function readTimeout(environment: Readonly<Record<string, string | undefined>>): number {
  const value = environment.EVIDENCE_ACCEPTANCE_TIMEOUT_MS?.trim();
  if (value === undefined || value === '') {
    return 30_000;
  }
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < minimumTimeoutMs || parsed > maximumTimeoutMs) {
    throw new Error(
      `EVIDENCE_ACCEPTANCE_TIMEOUT_MS must be an integer from ${minimumTimeoutMs} to ${maximumTimeoutMs}.`,
    );
  }
  return parsed;
}

export function readAcceptanceConfig(
  environment: Readonly<Record<string, string | undefined>>,
): AcceptanceConfig {
  const browserExecutable =
    environment.EVIDENCE_ACCEPTANCE_BROWSER?.trim() || defaultBrowserExecutable;
  return {
    appUrl: readOrigin(environment, 'EVIDENCE_ACCEPTANCE_APP_URL', {
      defaultValue: 'http://127.0.0.1:3000',
      requireHttps: false,
    }),
    roomOrigin: readOrigin(environment, 'EVIDENCE_ACCEPTANCE_ROOM_ORIGIN', {
      requireHttps: true,
    }),
    merchantOrigin: readOrigin(environment, 'EVIDENCE_ACCEPTANCE_MERCHANT_ORIGIN', {
      requireHttps: true,
    }),
    browserExecutable,
    commandTimeoutMs: readTimeout(environment),
    headed: environment.EVIDENCE_ACCEPTANCE_HEADED === '1',
    authenticatedCrowd: environment.EVIDENCE_ACCEPTANCE_AUTHENTICATED_CROWD === '1',
  };
}

export function readAcceptanceArtifactConfig(
  environment: Readonly<Record<string, string | undefined>>,
): AcceptanceArtifactConfig {
  const rawDirectory = environment.EVIDENCE_ACCEPTANCE_ARTIFACT_DIR?.trim();
  const rawPause = environment.EVIDENCE_ACCEPTANCE_CAPTURE_PAUSE_MS?.trim();
  const pauseMs = rawPause === undefined || rawPause.length === 0 ? 0 : Number(rawPause);
  if (!Number.isSafeInteger(pauseMs) || pauseMs < 0 || pauseMs > maximumCapturePauseMs) {
    throw new Error(
      `EVIDENCE_ACCEPTANCE_CAPTURE_PAUSE_MS must be an integer from 0 to ${maximumCapturePauseMs}.`,
    );
  }
  if (
    environment.EVIDENCE_ACCEPTANCE_RECORD_VIDEO === '1' &&
    (rawDirectory === undefined || rawDirectory.length === 0)
  ) {
    throw new Error('EVIDENCE_ACCEPTANCE_ARTIFACT_DIR is required when recording video.');
  }
  return {
    directory:
      rawDirectory === undefined || rawDirectory.length === 0 ? null : resolve(rawDirectory),
    pauseMs,
    recordVideo: environment.EVIDENCE_ACCEPTANCE_RECORD_VIDEO === '1',
  };
}

export function parseBrowserJson(output: string): unknown {
  try {
    return JSON.parse(output.trim()) as unknown;
  } catch {
    throw new Error('Browser evaluation returned non-JSON output.');
  }
}

export function parseAcceptanceTabs(output: string): readonly AcceptanceTab[] {
  return [...output.matchAll(/\[t(\d+)\]/g)].map((match) => `t${match[1]}` as AcceptanceTab);
}

export function findSingleNewTab(
  existingTabs: readonly AcceptanceTab[],
  currentTabs: readonly AcceptanceTab[],
): AcceptanceTab | null {
  const existing = new Set(existingTabs);
  const added = currentTabs.filter((tab) => !existing.has(tab));
  if (added.length > 1) {
    throw new Error('More than one browser tab appeared.');
  }
  return added.at(0) ?? null;
}

export function containsPrivateMaterial(value: string): boolean {
  return /\$\s*450\b|(?:maximum|budget|ceiling)[^\n]{0,24}\b450\b|token=[A-Za-z0-9_-]{12,}|\/cart\/c\/[A-Za-z0-9_-]{12,}/i.test(
    value,
  );
}

export function isStringArray(value: unknown): value is readonly string[] {
  return Array.isArray(value) && value.every((candidate) => typeof candidate === 'string');
}

export function sameStringSet(actual: readonly string[], expected: readonly string[]): boolean {
  const sortedActual = [...actual].sort();
  const sortedExpected = [...expected].sort();
  return (
    sortedActual.length === sortedExpected.length &&
    sortedActual.every((value, index) => value === sortedExpected[index])
  );
}

export function sanitizeAcceptanceFailure(error: unknown): string {
  const message = error instanceof Error ? error.message : 'Unknown acceptance failure.';
  if (containsPrivateMaterial(message)) {
    return 'Acceptance failed; private material was suppressed.';
  }
  return message.replaceAll(/https?:\/\/[^\s"'<>]+/gi, '[origin suppressed]');
}

export class NativeBrowserDriver {
  private readonly config: AcceptanceConfig;
  private readonly session: string;

  constructor(config: AcceptanceConfig) {
    this.config = config;
    this.session = `webmcp-accept-${process.pid}-${Date.now().toString(36)}`;
  }

  open(): void {
    if (!existsSync(this.config.browserExecutable)) {
      throw new Error('The configured Chrome executable does not exist.');
    }
    const allowedDomains = [
      new URL(this.config.appUrl).hostname,
      new URL(this.config.roomOrigin).hostname,
      new URL(this.config.merchantOrigin).hostname,
    ];
    this.execute(
      'open clean browser',
      [
        '--executable-path',
        this.config.browserExecutable,
        '--args',
        '--enable-features=WebMCP',
        '--allowed-domains',
        [...new Set(allowedDomains)].join(','),
        ...(this.config.headed ? ['--headed'] : []),
        'open',
        this.config.appUrl,
      ],
      undefined,
    );
  }

  close(): void {
    try {
      this.execute('close browser', ['close'], undefined);
    } catch {
      // Cleanup must not replace the actual acceptance failure.
    }
  }

  eval(script: string, label = 'evaluate page assertion'): unknown {
    return parseBrowserJson(this.execute(label, ['eval', '--stdin'], script));
  }

  openLinkInNewTab(selector: string, label = 'open page link in new tab'): void {
    this.execute(label, ['click', selector, '--new-tab'], undefined);
  }

  back(): void {
    this.execute('return to evidence room', ['back'], undefined);
  }

  reload(): void {
    this.execute('reload current page', ['reload'], undefined);
  }

  setViewport(width: number, height: number): void {
    this.execute(
      'set capture viewport',
      ['set', 'viewport', String(width), String(height)],
      undefined,
    );
  }

  screenshot(path: string): void {
    this.execute('capture acceptance screenshot', ['screenshot', '--full', path], undefined);
  }

  startRecording(path: string): void {
    this.execute('start acceptance recording', ['record', 'start', path], undefined);
  }

  stopRecording(): void {
    this.execute('stop acceptance recording', ['record', 'stop'], undefined);
  }

  switchTab(tab: AcceptanceTab): void {
    this.execute('switch expected tab', ['tab', tab], undefined);
  }

  trySwitchTab(tab: AcceptanceTab): boolean {
    try {
      this.switchTab(tab);
      return true;
    } catch {
      return false;
    }
  }

  listTabs(): readonly AcceptanceTab[] {
    return parseAcceptanceTabs(this.execute('list browser tabs', ['tab', 'list'], undefined));
  }

  private execute(label: string, arguments_: readonly string[], input: string | undefined): string {
    const result = spawnSync('agent-browser', ['--session', this.session, ...arguments_], {
      encoding: 'utf8',
      env: { ...process.env, NO_COLOR: '1' },
      input,
      maxBuffer: 1_000_000,
      timeout: this.config.commandTimeoutMs,
    });
    if (result.error !== undefined || result.signal !== null || result.status !== 0) {
      const detail = result.stderr.trim();
      const safeDetail =
        detail.length === 0 ? '' : ` ${sanitizeAcceptanceFailure(new Error(detail))}`;
      throw new Error(`Native browser command failed: ${label}.${safeDetail}`);
    }
    return result.stdout;
  }
}

export async function waitForBrowserValue(
  driver: NativeBrowserDriver,
  label: string,
  script: string,
  predicate: (value: unknown) => boolean,
  timeoutMs: number,
): Promise<unknown> {
  const deadline = Date.now() + timeoutMs;
  let lastValue: unknown = null;
  while (Date.now() < deadline) {
    try {
      lastValue = driver.eval(script);
      if (predicate(lastValue)) {
        return lastValue;
      }
    } catch {
      // A navigation can briefly destroy the execution context; keep polling the bounded window.
    }
    await new Promise<void>((resolve) => {
      setTimeout(resolve, 150);
    });
  }
  void lastValue;
  throw new Error(`Timed out waiting for ${label}.`);
}

export async function recordAcceptanceStep(
  steps: AcceptanceStep[],
  name: string,
  action: () => Promise<void> | void,
): Promise<void> {
  const startedAt = performance.now();
  await action();
  steps.push({ name, durationMs: Math.round(performance.now() - startedAt) });
}
