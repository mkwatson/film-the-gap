import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

import {
  containsPrivateMaterial,
  findSingleNewTab,
  isStringArray,
  NativeBrowserDriver,
  readAcceptanceConfig,
  readAcceptanceArtifactConfig,
  recordAcceptanceStep,
  sameStringSet,
  sanitizeAcceptanceFailure,
  waitForBrowserValue,
  type AcceptanceStep,
  type AcceptanceTab,
  type AcceptanceArtifactConfig,
} from './native-browser-harness.ts';

const agentBrowserVersion = '0.35.1';
const initialBuyerTools = ['inspect_live_show', 'set_evidence_requirements'] as const;
const scopedBuyerTools = [
  'inspect_live_show',
  'set_evidence_requirements',
  'request_host_evidence',
] as const;
const queuedBuyerTools = ['inspect_live_show', 'set_evidence_requirements'] as const;
const evidenceReadyBuyerTools = [
  'inspect_live_show',
  'set_evidence_requirements',
  'reserve_current_lot',
] as const;
const heldBuyerTools = [
  'inspect_live_show',
  'release_current_lot',
  'prepare_merchant_cart',
] as const;
const cartActiveBuyerTools = ['inspect_live_show', 'cancel_merchant_cart'] as const;
const cartCancelledBuyerTools = ['inspect_live_show', 'release_current_lot'] as const;
const merchantActiveTools = ['inspect_merchant_cart', 'cancel_merchant_cart'] as const;
const merchantCancelledTools = ['inspect_merchant_cart'] as const;
const attendeeReadyTools = [
  'inspect_shared_evidence_demand',
  'join_shared_evidence_demand',
] as const;
const attendeeJoinedTools = ['inspect_shared_evidence_demand'] as const;

const toolNamesScript = `
(async () => {
  if (!document.modelContext?.getTools) return [];
  return (await document.modelContext.getTools()).map(({ name }) => name);
})()
`;

function pageIncludesScript(...needles: readonly string[]): string {
  return `(() => {
    const text = document.body?.innerText ?? '';
    return ${JSON.stringify(needles)}.every((needle) => text.includes(needle));
  })()`;
}

function clickExactButtonScript(label: string): string {
  return `(() => {
    const button = [...document.querySelectorAll('button')].find(
      (candidate) => candidate.textContent?.trim() === ${JSON.stringify(label)},
    );
    if (!(button instanceof HTMLButtonElement) || button.disabled) return false;
    button.click();
    return true;
  })()`;
}

const revealPrivateAttendeeInvitesScript = clickExactButtonScript(
  'Reveal 7 private attendee invites',
);

function invokeToolScript(
  name: string,
  input: Readonly<Record<string, unknown>>,
  assertionBody: string,
): string {
  return `
(async () => {
  const context = document.modelContext;
  if (!context?.getTools || !context.executeTool) return false;
  const tool = (await context.getTools()).find((candidate) => candidate.name === ${JSON.stringify(name)});
  if (!tool) return false;
  const output = await context.executeTool(tool, JSON.stringify(${JSON.stringify(input)}));
  let serialized = JSON.stringify(output) ?? 'null';
  const parsedValues = [];
  const pending = [output];
  const visited = new Set();
  while (pending.length > 0) {
    const value = pending.pop();
    if (typeof value === 'string') {
      const trimmed = value.trim();
      if ((trimmed.startsWith('{') && trimmed.endsWith('}')) || (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
        try { pending.push(JSON.parse(trimmed)); } catch { /* Text tool content need not be JSON. */ }
      }
      continue;
    }
    if (value === null || typeof value !== 'object' || visited.has(value)) continue;
    visited.add(value);
    parsedValues.push(value);
    if (Array.isArray(value)) pending.push(...value);
    else pending.push(...Object.values(value));
  }
  if (parsedValues.length > 0) serialized = JSON.stringify(parsedValues);
  const failed = parsedValues.some((value) => value.ok === false || value.isError === true);
  if (failed) return false;
  ${assertionBody}
})()
`;
}

const inspectInitialScript = invokeToolScript(
  'inspect_live_show',
  {},
  `return serialized.includes('"lengthCm":156') &&
    serialized.includes('"exactAllInQuote":423') &&
    serialized.includes('"outcome":"no-requirements"') &&
    serialized.includes('"protocol":"UCP"') &&
    !serialized.includes('$450');`,
);

const setRequirementsScript = invokeToolScript(
  'set_evidence_requirements',
  {
    minLengthCm: 154,
    maxLengthCm: 158,
    requireVisibleEdgeEvidence: true,
    forbidPriorBaseRepair: true,
  },
  `return parsedValues.some((value) => value.ok === true) &&
    serialized.includes('"evidenceOutcome":"unresolved"') &&
    serialized.includes('"action":"request_host_evidence"') &&
    !serialized.includes('$450');`,
);

const requestEvidenceScript = invokeToolScript(
  'request_host_evidence',
  { kind: 'repair_history' },
  `return parsedValues.some((value) => value.ok === true) &&
    serialized.includes('"status":"queued"') &&
    !serialized.includes('$450');`,
);

const rememberRequestEvidenceToolScript = `
(async () => {
  const context = document.modelContext;
  if (!context?.getTools) return false;
  const tool = (await context.getTools()).find(
    (candidate) => candidate.name === 'request_host_evidence',
  );
  if (!tool) return false;
  window.__webmcpStaleRequestTool = tool;
  return true;
})()
`;

const rejectStaleRequestToolScript = `
(async () => {
  const context = document.modelContext;
  const tool = window.__webmcpStaleRequestTool;
  delete window.__webmcpStaleRequestTool;
  if (!context?.executeTool || !tool) return false;
  try {
    await context.executeTool(tool, JSON.stringify({ kind: 'repair_history' }));
    return false;
  } catch {
    return true;
  }
})()
`;

const inspectReadyScript = invokeToolScript(
  'inspect_live_show',
  {},
  `return serialized.includes('"exactAllInQuote":423') &&
    serialized.includes('"outcome":"ready"') &&
    serialized.includes('"repairHistory":"none"') &&
    !serialized.includes('$450');`,
);

const reserveScript = invokeToolScript(
  'reserve_current_lot',
  { expectedAllInPrice: 423 },
  `return parsedValues.some((value) => value.ok === true) &&
    serialized.includes('"acceptedAllInPrice":423') &&
    !serialized.includes('$450');`,
);

function prepareAndNavigateScript(merchantOrigin: string): string {
  return invokeToolScript(
    'prepare_merchant_cart',
    {},
    `if (serialized.includes('$450')) return false;
    const continuations = new Set();
    const values = [output];
    const seen = new Set();
    while (values.length > 0) {
      const value = values.pop();
      if (typeof value === 'string') {
        try {
          const candidate = new URL(value);
          if (candidate.origin === ${JSON.stringify(merchantOrigin)} && /^\\/cart\\/c\\/[0-9a-f]{32}$/.test(candidate.pathname) && !candidate.search && !candidate.hash) {
            continuations.add(candidate.href);
          }
        } catch {
          const trimmed = value.trim();
          if ((trimmed.startsWith('{') && trimmed.endsWith('}')) || (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
            try { values.push(JSON.parse(trimmed)); } catch { /* Ignore non-JSON tool text. */ }
          }
        }
        continue;
      }
      if (value === null || typeof value !== 'object' || seen.has(value)) continue;
      seen.add(value);
      if (Array.isArray(value)) values.push(...value);
      else values.push(...Object.values(value));
    }
    if (!parsedValues.some((value) => value.ok === true) || continuations.size !== 1) return false;
    const [continuation] = continuations;
    setTimeout(() => location.assign(continuation), 0);
    return true;`,
  );
}

const inspectMerchantScript = invokeToolScript(
  'inspect_merchant_cart',
  {},
  `return serialized.includes('Evidence Market 156') &&
    serialized.includes('"unitPrice":37500') &&
    serialized.includes('"exactTotal":42300') &&
    serialized.includes('"status":"active"') &&
    serialized.includes('cannot create an order or accept payment') &&
    !serialized.includes('$450') &&
    !serialized.includes('/cart/c/');`,
);

const cancelAtMerchantScript = invokeToolScript(
  'cancel_merchant_cart',
  {},
  `return parsedValues.some((value) => value.ok === true) &&
    serialized.includes('"status":"cancelled"') &&
    serialized.includes('cannot create an order or accept payment') &&
    !serialized.includes('$450');`,
);

const cancelInRoomScript = invokeToolScript(
  'cancel_merchant_cart',
  {},
  `return parsedValues.some((value) => value.ok === true) &&
    serialized.includes('"cartStatus":"cancelled"') &&
    !serialized.includes('$450') &&
    !serialized.includes('/cart/c/');`,
);

const releaseScript = invokeToolScript(
  'release_current_lot',
  {},
  `return parsedValues.some((value) => value.ok === true) &&
    serialized.includes('"hold":null') &&
    serialized.includes('"cartStatus":"none"') &&
    !serialized.includes('$450');`,
);

const buyerPrivacyScript = `(() => {
  const keys = Object.keys(sessionStorage).sort();
  const html = document.documentElement?.innerHTML ?? '';
  return location.hash === '' &&
    keys.length === 1 &&
    keys[0] === 'webmcp.evidence-room.buyer.v1' &&
    !html.includes('$450') &&
    !html.includes('/cart/c/');
})()`;

const hostPrivacyScript = `(() => {
  const text = document.body?.innerText ?? '';
  const html = document.documentElement?.innerHTML ?? '';
  const keys = Object.keys(sessionStorage).sort();
  return location.hash === '' &&
    window.opener === null &&
    keys.length === 1 &&
    keys[0] === 'webmcp.evidence-room.host.v1' &&
    !text.includes('$450') &&
    !html.includes('/cart/c/') &&
    !html.includes('token=');
})()`;

const hostPrivacyDiagnosticScript = `(() => {
  const text = document.body?.innerText ?? '';
  const html = document.documentElement?.innerHTML ?? '';
  return {
    pathname: location.pathname,
    fragmentScrubbed: location.hash === '',
    openerDetached: window.opener === null,
    storageKeys: Object.keys(sessionStorage).sort(),
    ceilingAbsent: !text.includes('$450'),
    continuationAbsent: !html.includes('/cart/c/'),
    bearerMarkupAbsent: !html.includes('token='),
  };
})()`;

const attendeePrivacyScript = `(() => {
  const text = document.body?.innerText ?? '';
  const html = document.documentElement?.innerHTML ?? '';
  const keys = Object.keys(sessionStorage).sort();
  return location.hash === '' &&
    window.opener === null &&
    keys.length === 1 &&
    keys[0] === 'webmcp.evidence-room.attendee.v1' &&
    !text.includes('$450') &&
    !html.includes('/cart/c/') &&
    !html.includes('token=') &&
    !/attendee-[1-7]/.test(html);
})()`;

const attendeeLinkDiagnosticScript = `(() => {
  const text = document.body?.innerText ?? '';
  return {
    pathname: location.pathname,
    fragmentScrubbed: location.hash === '',
    storageKeys: Object.keys(sessionStorage).sort(),
    attendeeSurface: text.includes('Evidence attendee'),
    linked: text.includes('Evidence room linked'),
    authenticated: text.includes('Credential authenticated'),
    questionOpen: text.includes('One question is open'),
    waitingForPrimary: text.includes('Waiting for the primary agent'),
    leastAuthority: text.includes('least authority'),
  };
})()`;

const joinAttendeeScript = invokeToolScript(
  'join_shared_evidence_demand',
  {},
  `return parsedValues.some((value) => value.ok === true) &&
    serialized.includes('"thisAttendeeJoined":true') &&
    serialized.includes('"privateBuyerContext":"not collected"') &&
    !serialized.includes('$450') &&
    !serialized.includes('token=') &&
    !/attendee-[1-7]/.test(serialized);`,
);

const inspectAuthenticatedCrowdScript = invokeToolScript(
  'inspect_live_show',
  {},
  `return serialized.includes('"composition":{"live":8,"fixture":0,"total":8}') &&
    serialized.includes('"status":"queued"') &&
    !serialized.includes('$450') &&
    !serialized.includes('token=') &&
    !/attendee-[1-7]/.test(serialized);`,
);

function isTrue(value: unknown): value is true {
  return value === true;
}

function hasExactToolSet(expected: readonly string[]): (value: unknown) => boolean {
  return (value: unknown): boolean => isStringArray(value) && sameStringSet(value, expected);
}

async function waitForTrue(
  driver: NativeBrowserDriver,
  label: string,
  script: string,
  timeoutMs: number,
): Promise<void> {
  await waitForBrowserValue(driver, label, script, isTrue, timeoutMs);
}

async function waitForTools(
  driver: NativeBrowserDriver,
  label: string,
  expected: readonly string[],
  timeoutMs: number,
): Promise<void> {
  await waitForBrowserValue(driver, label, toolNamesScript, hasExactToolSet(expected), timeoutMs);
}

async function waitForNewTab(
  driver: NativeBrowserDriver,
  label: string,
  existingTabs: readonly AcceptanceTab[],
  timeoutMs: number,
): Promise<AcceptanceTab> {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    try {
      const addedTab = findSingleNewTab(existingTabs, driver.listTabs());
      if (addedTab !== null) {
        return addedTab;
      }
    } catch {
      throw new Error(`More than one browser tab appeared while waiting for ${label}.`);
    }
    await new Promise<void>((resolvePoll) => {
      setTimeout(resolvePoll, 100);
    });
  }
  throw new Error(`Timed out waiting for ${label}.`);
}

async function waitForHostPrivacy(
  driver: NativeBrowserDriver,
  label: string,
  timeoutMs: number,
): Promise<void> {
  try {
    await waitForTrue(driver, label, hostPrivacyScript, timeoutMs);
  } catch {
    const diagnostic = driver.eval(hostPrivacyDiagnosticScript, 'diagnose host privacy boundary');
    throw new Error(`Host privacy invariant failed: ${JSON.stringify(diagnostic)}`);
  }
}

async function waitForAttendeeLink(driver: NativeBrowserDriver, timeoutMs: number): Promise<void> {
  try {
    await waitForTrue(
      driver,
      'linked attendee surface',
      pageIncludesScript('Evidence attendee', 'Evidence room linked', 'One question is open'),
      timeoutMs,
    );
  } catch {
    const diagnostic = driver.eval(attendeeLinkDiagnosticScript, 'diagnose attendee link');
    throw new Error(`Attendee link invariant failed: ${JSON.stringify(diagnostic)}`);
  }
}

async function captureMilestone(
  driver: NativeBrowserDriver,
  artifacts: AcceptanceArtifactConfig,
  filename: string,
): Promise<void> {
  if (artifacts.directory === null) {
    return;
  }
  if (artifacts.pauseMs > 0) {
    await new Promise<void>((resolvePause) => {
      setTimeout(resolvePause, artifacts.pauseMs);
    });
  }
  driver.screenshot(join(artifacts.directory, filename));
}

function nameCurrentTab(driver: NativeBrowserDriver, name: string): void {
  if (
    !isTrue(
      driver.eval(
        `(() => { window.name = ${JSON.stringify(name)}; return window.name === ${JSON.stringify(name)}; })()`,
        'name acceptance tab',
      ),
    )
  ) {
    throw new Error('Could not name an acceptance tab.');
  }
}

function findNamedTab(driver: NativeBrowserDriver, name: string): AcceptanceTab {
  for (const tab of [...driver.listTabs()].reverse()) {
    if (
      driver.trySwitchTab(tab) &&
      isTrue(
        driver.eval(`window.name === ${JSON.stringify(name)}`, 'identify named acceptance tab'),
      )
    ) {
      return tab;
    }
  }
  throw new Error('Could not find a named acceptance tab.');
}

async function main(): Promise<void> {
  const config = readAcceptanceConfig(process.env);
  const artifacts = readAcceptanceArtifactConfig(process.env);
  const steps: AcceptanceStep[] = [];
  const driver = new NativeBrowserDriver(config);
  let buyerTab: AcceptanceTab = 't1';
  let hostTab: AcceptanceTab = 't2';
  let recording = false;

  if (artifacts.directory !== null) {
    mkdirSync(artifacts.directory, { recursive: true });
  }

  try {
    await recordAcceptanceStep(steps, 'open-clean-native-browser', () => {
      driver.open();
      if (artifacts.directory !== null) {
        driver.setViewport(1440, 900);
      }
      if (artifacts.directory !== null && artifacts.recordVideo) {
        driver.startRecording(join(artifacts.directory, 'buyer-state-journey.webm'));
        recording = true;
      }
      nameCurrentTab(driver, 'webmcp-private-buyer');
      buyerTab = findNamedTab(driver, 'webmcp-private-buyer');
    });

    await recordAcceptanceStep(steps, 'buyer-preflight-and-reset', async () => {
      await waitForTrue(
        driver,
        'authoritative buyer preflight',
        pageIncludesScript('Site Tools live', 'Durable Object live', 'Authoritative'),
        config.commandTimeoutMs,
      );
      await waitForTools(
        driver,
        'initial buyer Site Tools',
        initialBuyerTools,
        config.commandTimeoutMs,
      );
      if (!isTrue(driver.eval(clickExactButtonScript('Reset demo'), 'reset buyer journey'))) {
        throw new Error('Could not reset the buyer journey.');
      }
      await waitForTools(
        driver,
        'reset buyer Site Tools',
        initialBuyerTools,
        config.commandTimeoutMs,
      );
      await waitForTrue(
        driver,
        'buyer role credential isolation',
        buyerPrivacyScript,
        config.commandTimeoutMs,
      );
      await waitForTrue(
        driver,
        'initial native inspection',
        inspectInitialScript,
        config.commandTimeoutMs,
      );
      await captureMilestone(driver, artifacts, '01-buyer-private-start.png');
    });

    await recordAcceptanceStep(steps, 'link-private-host-surface', async () => {
      driver.switchTab(buyerTab);
      const existingTabs = driver.listTabs();
      driver.openLinkInNewTab('.phone-invite-control a', 'open private host surface');
      hostTab = await waitForNewTab(
        driver,
        'private host surface',
        existingTabs,
        config.commandTimeoutMs,
      );
      driver.switchTab(hostTab);
      await waitForHostPrivacy(driver, 'host credential scrubbing', config.commandTimeoutMs);
      await waitForTrue(
        driver,
        'linked seller surface',
        pageIncludesScript('Host evidence console', 'Buyer view linked', 'Never sent to the host'),
        config.commandTimeoutMs,
      );
      driver.switchTab(buyerTab);
      await waitForTrue(
        driver,
        'buyer-to-host presence',
        pageIncludesScript('Host linked'),
        config.commandTimeoutMs,
      );
      await captureMilestone(driver, artifacts, '02-buyer-host-linked.png');
    });

    await recordAcceptanceStep(steps, 'share-only-evidence-requirements', async () => {
      await waitForTrue(
        driver,
        'requirements mutation',
        setRequirementsScript,
        config.commandTimeoutMs,
      );
      await waitForTools(
        driver,
        'scoped buyer Site Tools',
        scopedBuyerTools,
        config.commandTimeoutMs,
      );
      await waitForTrue(
        driver,
        'capture soon-to-be-stale request tool',
        rememberRequestEvidenceToolScript,
        config.commandTimeoutMs,
      );
      await captureMilestone(driver, artifacts, '03-buyer-requirements-unresolved.png');
      await waitForTrue(
        driver,
        'normalized evidence request',
        requestEvidenceScript,
        config.commandTimeoutMs,
      );
      await waitForTools(
        driver,
        'queued buyer Site Tools',
        queuedBuyerTools,
        config.commandTimeoutMs,
      );
      await captureMilestone(driver, artifacts, '04-buyer-evidence-requested.png');
    });

    await recordAcceptanceStep(steps, 'reject-stale-tool-and-recover-reload', async () => {
      await waitForTrue(
        driver,
        'stale request tool rejection',
        rejectStaleRequestToolScript,
        config.commandTimeoutMs,
      );
      await waitForTools(
        driver,
        'unchanged queued buyer Site Tools',
        queuedBuyerTools,
        config.commandTimeoutMs,
      );
      driver.reload();
      await waitForTrue(
        driver,
        'buyer room recovery after reload',
        pageIncludesScript(
          'Site Tools live',
          'Durable Object live',
          'Authoritative',
          'Host linked',
        ),
        config.commandTimeoutMs,
      );
      await waitForTools(
        driver,
        'reloaded queued buyer Site Tools',
        queuedBuyerTools,
        config.commandTimeoutMs,
      );
      await waitForTrue(
        driver,
        'queued evidence survives reload',
        pageIncludesScript('8 private agents waiting', 'Show the base and disclose'),
        config.commandTimeoutMs,
      );
    });

    if (config.authenticatedCrowd) {
      await recordAcceptanceStep(steps, 'replace-fixtures-with-native-attendees', async () => {
        driver.switchTab(buyerTab);
        if (
          !isTrue(
            driver.eval(revealPrivateAttendeeInvitesScript, 'reveal private attendee invitations'),
          )
        ) {
          throw new Error('Could not reveal private attendee invitations.');
        }
        await waitForTrue(
          driver,
          'private attendee invitation panel',
          pageIncludesScript('Temporary bearer links', 'Open attendee 7'),
          config.commandTimeoutMs,
        );

        for (let index = 0; index < 7; index += 1) {
          driver.switchTab(buyerTab);
          const existingTabs = driver.listTabs();
          driver.openLinkInNewTab(
            `.crowd-invite-panel li:nth-child(${index + 1}) a`,
            'open private attendee surface',
          );
          const attendeeTab = await waitForNewTab(
            driver,
            'private attendee surface',
            existingTabs,
            config.commandTimeoutMs,
          );
          driver.switchTab(attendeeTab);
          await waitForTrue(
            driver,
            'attendee credential scrubbing and role isolation',
            attendeePrivacyScript,
            config.commandTimeoutMs,
          );
          await waitForAttendeeLink(driver, config.commandTimeoutMs);
          await waitForTools(
            driver,
            'joinable attendee Site Tools',
            attendeeReadyTools,
            config.commandTimeoutMs,
          );
          await waitForTrue(
            driver,
            'native attendee join',
            joinAttendeeScript,
            config.commandTimeoutMs,
          );
          await waitForTools(
            driver,
            'post-join attendee Site Tools',
            attendeeJoinedTools,
            config.commandTimeoutMs,
          );
        }

        driver.switchTab(buyerTab);
        await waitForTrue(
          driver,
          'authenticated crowd receipt',
          pageIncludesScript(
            'All seven fixtures replaced by authenticated sessions.',
            '8 live · 0 fixture',
          ),
          config.commandTimeoutMs,
        );
        await waitForTrue(
          driver,
          'buyer-native authenticated crowd inspection',
          inspectAuthenticatedCrowdScript,
          config.commandTimeoutMs,
        );
        await captureMilestone(driver, artifacts, '04b-buyer-authenticated-crowd.png');

        driver.switchTab(hostTab);
        await waitForTrue(
          driver,
          'host authenticated crowd receipt',
          pageIncludesScript('8 live · 0 fixture'),
          config.commandTimeoutMs,
        );
        await waitForHostPrivacy(
          driver,
          'host privacy boundary after attendee joins',
          config.commandTimeoutMs,
        );
        driver.switchTab(buyerTab);
      });
    }

    await recordAcceptanceStep(steps, 'publish-one-host-answer', async () => {
      driver.switchTab(hostTab);
      await waitForTrue(
        driver,
        'host evidence demand',
        pageIncludesScript(
          'private decisions need one fact',
          'Show the base and disclose whether it has ever been repaired.',
        ),
        config.commandTimeoutMs,
      );
      await captureMilestone(driver, artifacts, '05-host-aggregate-demand.png');
      if (
        !isTrue(
          driver.eval(
            clickExactButtonScript('Show base · no repair'),
            'publish deterministic host evidence',
          ),
        )
      ) {
        throw new Error('Could not publish the deterministic host evidence.');
      }
      await waitForTrue(
        driver,
        'host multicast receipt',
        pageIncludesScript('decisions updated', 'Never sent to the host'),
        config.commandTimeoutMs,
      );
      await waitForHostPrivacy(
        driver,
        'host privacy boundary after publication',
        config.commandTimeoutMs,
      );
      await captureMilestone(driver, artifacts, '06-host-one-answer.png');
      driver.switchTab(buyerTab);
      await waitForTools(
        driver,
        'evidence-ready buyer Site Tools',
        evidenceReadyBuyerTools,
        config.commandTimeoutMs,
      );
      await waitForTrue(
        driver,
        'evidence-ready native inspection',
        inspectReadyScript,
        config.commandTimeoutMs,
      );
      await captureMilestone(driver, artifacts, '07-buyer-evidence-ready.png');
    });

    await recordAcceptanceStep(steps, 'create-exact-quote-hold', async () => {
      await waitForTrue(driver, 'exact-quote hold', reserveScript, config.commandTimeoutMs);
      await waitForTools(driver, 'held buyer Site Tools', heldBuyerTools, config.commandTimeoutMs);
      await captureMilestone(driver, artifacts, '08-buyer-exact-hold.png');
    });

    await recordAcceptanceStep(steps, 'prepare-authoritative-ucp-cart', async () => {
      await waitForTrue(
        driver,
        'private merchant continuation navigation',
        prepareAndNavigateScript(config.merchantOrigin),
        config.commandTimeoutMs,
      );
      await waitForTrue(
        driver,
        'merchant continuation receipt',
        pageIncludesScript(
          'A reversible cart is ready.',
          'Evidence Market 156',
          'no checkout, payment handler, or order-creation capability',
        ),
        config.commandTimeoutMs,
      );
      await waitForTools(
        driver,
        'active merchant Site Tools',
        merchantActiveTools,
        config.commandTimeoutMs,
      );
      await waitForTrue(
        driver,
        'merchant-native cart inspection',
        inspectMerchantScript,
        config.commandTimeoutMs,
      );
      await captureMilestone(driver, artifacts, '09-merchant-authoritative-cart.png');
    });

    await recordAcceptanceStep(steps, 'cancel-at-merchant-and-reconcile-room', async () => {
      await waitForTrue(
        driver,
        'merchant-native cancellation',
        cancelAtMerchantScript,
        config.commandTimeoutMs,
      );
      await waitForTrue(
        driver,
        'cancelled merchant receipt',
        pageIncludesScript(
          'This cart was cancelled.',
          'Cart cancelled · inspect Site Tool remains live.',
        ),
        config.commandTimeoutMs,
      );
      await waitForTools(
        driver,
        'cancelled merchant Site Tools',
        merchantCancelledTools,
        config.commandTimeoutMs,
      );
      await captureMilestone(driver, artifacts, '10-merchant-cart-cancelled.png');

      driver.back();
      await waitForTools(
        driver,
        'reconnected buyer Site Tools',
        cartActiveBuyerTools,
        config.commandTimeoutMs,
      );
      await waitForTrue(
        driver,
        'room-side cart reconciliation',
        cancelInRoomScript,
        config.commandTimeoutMs,
      );
      await waitForTools(
        driver,
        'room-reconciled buyer Site Tools',
        cartCancelledBuyerTools,
        config.commandTimeoutMs,
      );
      await waitForTrue(driver, 'hold release', releaseScript, config.commandTimeoutMs);
      await waitForTools(
        driver,
        'released buyer Site Tools',
        evidenceReadyBuyerTools,
        config.commandTimeoutMs,
      );
      await captureMilestone(driver, artifacts, '11-buyer-released.png');
    });

    await recordAcceptanceStep(steps, 'prove-host-never-received-private-material', async () => {
      driver.switchTab(hostTab);
      await waitForHostPrivacy(driver, 'final host privacy boundary', config.commandTimeoutMs);
      await captureMilestone(driver, artifacts, '12-host-private-boundary.png');
      driver.switchTab(buyerTab);
      if (!isTrue(driver.eval(clickExactButtonScript('Reset demo'), 'clean acceptance room'))) {
        throw new Error('Could not clean the acceptance room.');
      }
      await waitForTools(
        driver,
        'clean final buyer state',
        initialBuyerTools,
        config.commandTimeoutMs,
      );
    });

    const report = { ok: true, agentBrowserVersion, steps } as const;
    const serialized = JSON.stringify(report);
    if (containsPrivateMaterial(serialized)) {
      throw new Error('Acceptance report unexpectedly contained private material.');
    }
    if (recording) {
      driver.stopRecording();
      recording = false;
    }
    console.log(serialized);
  } finally {
    if (recording) {
      try {
        driver.stopRecording();
      } catch {
        // Recording cleanup must not replace the actual acceptance result.
      }
    }
    driver.close();
  }
}

main().catch((error: unknown) => {
  console.error(JSON.stringify({ ok: false, error: sanitizeAcceptanceFailure(error) }));
  process.exitCode = 1;
});
