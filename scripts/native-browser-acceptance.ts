import {
  containsPrivateMaterial,
  isStringArray,
  NativeBrowserDriver,
  readAcceptanceConfig,
  recordAcceptanceStep,
  sameStringSet,
  sanitizeAcceptanceFailure,
  waitForBrowserValue,
  type AcceptanceStep,
  type AcceptanceTab,
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

const openPrivateHostScript = `(() => {
  const link = document.querySelector('a[href*="/host"]');
  if (!(link instanceof HTMLAnchorElement)) return false;
  return window.open(link.href, 'webmcp-private-host') !== null;
})()`;

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
    serialized.includes('"minLengthCm":154') &&
    serialized.includes('"maxLengthCm":158') &&
    !serialized.includes('$450');`,
);

const requestEvidenceScript = invokeToolScript(
  'request_host_evidence',
  { kind: 'repair_history' },
  `return parsedValues.some((value) => value.ok === true) &&
    serialized.includes('"status":"queued"') &&
    !serialized.includes('$450');`,
);

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

const hostPrivacyScript = `(() => {
  const text = document.body?.innerText ?? '';
  const html = document.documentElement?.innerHTML ?? '';
  return location.hash === '' &&
    !text.includes('$450') &&
    !html.includes('/cart/c/') &&
    !html.includes('token=');
})()`;

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

async function main(): Promise<void> {
  const config = readAcceptanceConfig(process.env);
  const steps: AcceptanceStep[] = [];
  const driver = new NativeBrowserDriver(config);
  let hostTab: AcceptanceTab = 't2';

  try {
    await recordAcceptanceStep(steps, 'open-clean-native-browser', () => {
      driver.open();
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
        'initial native inspection',
        inspectInitialScript,
        config.commandTimeoutMs,
      );
    });

    await recordAcceptanceStep(steps, 'link-private-host-surface', async () => {
      driver.newTab(config.appUrl);
      if (
        !isTrue(
          driver.eval(
            `(() => { window.name = 'webmcp-private-host'; return true; })()`,
            'name private host tab',
          ),
        )
      ) {
        throw new Error('Could not stage the private host surface.');
      }
      driver.switchTab('t1');
      if (!isTrue(driver.eval(openPrivateHostScript, 'navigate private host surface'))) {
        throw new Error('Could not navigate the private host surface.');
      }
      hostTab = driver.trySwitchTab('t3') ? 't3' : 't2';
      driver.switchTab(hostTab);
      await waitForTrue(
        driver,
        'host credential scrubbing',
        hostPrivacyScript,
        config.commandTimeoutMs,
      );
      await waitForTrue(
        driver,
        'linked seller surface',
        pageIncludesScript('Host evidence console', 'Buyer view linked', 'Never sent to the host'),
        config.commandTimeoutMs,
      );
      driver.switchTab('t1');
      await waitForTrue(
        driver,
        'buyer-to-host presence',
        pageIncludesScript('Host linked'),
        config.commandTimeoutMs,
      );
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
    });

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
      await waitForTrue(
        driver,
        'host privacy boundary after publication',
        hostPrivacyScript,
        config.commandTimeoutMs,
      );
      driver.switchTab('t1');
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
    });

    await recordAcceptanceStep(steps, 'create-exact-quote-hold', async () => {
      await waitForTrue(driver, 'exact-quote hold', reserveScript, config.commandTimeoutMs);
      await waitForTools(driver, 'held buyer Site Tools', heldBuyerTools, config.commandTimeoutMs);
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
    });

    await recordAcceptanceStep(steps, 'prove-host-never-received-private-material', async () => {
      driver.switchTab(hostTab);
      await waitForTrue(
        driver,
        'final host privacy boundary',
        hostPrivacyScript,
        config.commandTimeoutMs,
      );
      driver.switchTab('t1');
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
    console.log(serialized);
  } finally {
    driver.close();
  }
}

main().catch((error: unknown) => {
  console.error(JSON.stringify({ ok: false, error: sanitizeAcceptanceFailure(error) }));
  process.exitCode = 1;
});
