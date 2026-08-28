import { spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

import {
  findSingleNewTab,
  isStringArray,
  NativeBrowserDriver,
  recordAcceptanceStep,
  sameStringSet,
  sanitizeAcceptanceFailure,
  waitForBrowserValue,
  type AcceptanceConfig,
  type AcceptanceStep,
  type AcceptanceTab,
} from './native-browser-harness.ts';

const defaultBrowserExecutable = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const missionCreationTools = [
  'inspect_product_evidence',
  'ask_product_question',
  'create_filming_mission',
] as const;
const searchTools = [
  'inspect_product_evidence',
  'ask_product_question',
  'search_product_evidence',
] as const;
const missionTools = [
  'inspect_product_evidence',
  'ask_product_question',
  'create_phone_capture_link',
] as const;
const publicMissionPublishTools = [
  'inspect_product_evidence',
  'ask_product_question',
  'publish_filming_mission',
] as const;
const publicMissionRemoveTools = [
  'inspect_product_evidence',
  'ask_product_question',
  'remove_public_filming_mission',
] as const;
const boardTools = ['inspect_open_filming_missions', 'open_filming_mission'] as const;
const finalTools = [
  'inspect_product_evidence',
  'ask_product_question',
  'inspect_answer_change',
] as const;
const correctedObservation =
  'A thin wet line becomes visible on the paper at 00:08 while the closed bottle remains inverted.';

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
      (candidate) => candidate.textContent?.trim().toLocaleLowerCase() === ${JSON.stringify(label.toLocaleLowerCase())},
    );
    if (!(button instanceof HTMLButtonElement) || button.disabled) return false;
    button.click();
    return true;
  })()`;
}

function fillHumanQuestion(
  driver: NativeBrowserDriver,
  productName: string,
  productUrl: string,
  productQuestion: string,
): void {
  driver.fill('.evidence-try-panel input:not([type="url"])', productName, 'fill product name');
  driver.fill('.evidence-try-panel input[type="url"]', productUrl, 'fill product URL');
  driver.fill('.evidence-try-panel textarea', productQuestion, 'fill product question');
}

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

function localOrigin(value: string, key: string): string {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`${key} must be an absolute loopback URL.`);
  }
  if (
    url.protocol !== 'http:' ||
    !['localhost', '127.0.0.1'].includes(url.hostname) ||
    url.username !== '' ||
    url.password !== '' ||
    url.search !== '' ||
    url.hash !== '' ||
    (url.pathname !== '' && url.pathname !== '/')
  ) {
    throw new Error(`${key} must be a credential-free loopback HTTP origin.`);
  }
  return url.origin;
}

function acceptanceConfig(
  environment: Readonly<Record<string, string | undefined>>,
): AcceptanceConfig {
  const appUrl = localOrigin(
    environment.EVIDENCE_ACCEPTANCE_APP_URL?.trim() || 'http://localhost:3000',
    'EVIDENCE_ACCEPTANCE_APP_URL',
  );
  const roomOrigin = localOrigin(
    environment.EVIDENCE_ACCEPTANCE_ROOM_ORIGIN?.trim() || 'http://localhost:8792',
    'EVIDENCE_ACCEPTANCE_ROOM_ORIGIN',
  );
  const timeoutValue = Number(environment.EVIDENCE_ACCEPTANCE_TIMEOUT_MS?.trim() || '30000');
  if (!Number.isSafeInteger(timeoutValue) || timeoutValue < 5_000 || timeoutValue > 120_000) {
    throw new Error('EVIDENCE_ACCEPTANCE_TIMEOUT_MS must be an integer from 5000 to 120000.');
  }
  return {
    appUrl,
    roomOrigin,
    browserExecutable: environment.EVIDENCE_ACCEPTANCE_BROWSER?.trim() || defaultBrowserExecutable,
    commandTimeoutMs: timeoutValue,
    headed: environment.EVIDENCE_ACCEPTANCE_HEADED === '1',
  };
}

function createFixtureVideo(): { readonly directory: string; readonly filePath: string } {
  const directory = mkdtempSync(join(tmpdir(), 'webmcp-evidence-acceptance-'));
  const filePath = join(directory, 'continuous-evidence.mp4');
  const result = spawnSync(
    'ffmpeg',
    [
      '-y',
      '-loglevel',
      'error',
      '-f',
      'lavfi',
      '-i',
      'color=c=0x123629:s=640x480:d=12:r=24',
      '-f',
      'lavfi',
      '-i',
      'sine=frequency=660:duration=12',
      '-shortest',
      '-c:v',
      'libx264',
      '-pix_fmt',
      'yuv420p',
      '-c:a',
      'aac',
      '-movflags',
      '+faststart',
      filePath,
    ],
    { encoding: 'utf8', timeout: 30_000 },
  );
  if (result.error !== undefined || result.signal !== null || result.status !== 0) {
    rmSync(directory, { recursive: true, force: true });
    throw new Error('Could not create the local rights-clean acceptance video with ffmpeg.');
  }
  return { directory, filePath };
}

async function waitForNewTab(
  driver: NativeBrowserDriver,
  existing: readonly AcceptanceTab[],
  timeoutMs: number,
): Promise<AcceptanceTab> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const added = findSingleNewTab(existing, driver.listTabs());
    if (added !== null) {
      return added;
    }
    await new Promise<void>((resolveWait) => setTimeout(resolveWait, 150));
  }
  throw new Error('Timed out waiting for the contributor tab.');
}

function artifactDirectory(
  environment: Readonly<Record<string, string | undefined>>,
): string | null {
  const value = environment.EVIDENCE_ACCEPTANCE_ARTIFACT_DIR?.trim();
  if (value === undefined || value.length === 0) {
    return null;
  }
  const directory = resolve(value);
  mkdirSync(directory, { recursive: true });
  return directory;
}

async function run(): Promise<void> {
  const config = acceptanceConfig(process.env);
  const humanControls = process.env.EVIDENCE_ACCEPTANCE_HUMAN_CONTROLS === '1';
  const artifacts = artifactDirectory(process.env);
  const fixture = createFixtureVideo();
  const runId = randomUUID().replaceAll('-', '').slice(0, 12);
  const productName = `Acceptance travel bottle ${runId}`;
  const productUrl = `https://example.com/products/acceptance-travel-bottle-${runId}`;
  const productQuestion =
    'Does the closed bottle stay leak-free while upside down for ten seconds?';
  const driver = new NativeBrowserDriver(config, { webMcpEnabled: !humanControls });
  const steps: AcceptanceStep[] = [];
  let buyerTab: AcceptanceTab | null = null;
  try {
    await recordAcceptanceStep(steps, 'open generic product evidence case', async () => {
      driver.open();
      buyerTab = driver.listTabs().at(0) ?? null;
      if (buyerTab === null) throw new Error('The buyer tab did not open.');
      if (humanControls) {
        await waitForBrowserValue(
          driver,
          'ordinary-browser controls',
          `(() => document.modelContext === undefined && ${pageIncludesScript(
            'Human controls ready',
            'Ordinary browser mode. Every human control remains usable.',
          )})()`,
          (value) => value === true,
          config.commandTimeoutMs,
        );
        fillHumanQuestion(driver, productName, productUrl, productQuestion);
        if (driver.eval(clickExactButtonScript('Open new evidence case')) !== true) {
          throw new Error('The ordinary-browser case form could not submit.');
        }
        await waitForBrowserValue(
          driver,
          'ordinary-browser generic case',
          pageIncludesScript(
            productName,
            productQuestion,
            'Not enough proof',
            'Search existing evidence',
          ),
          (value) => value === true,
          config.commandTimeoutMs,
        );
        if (artifacts !== null) driver.screenshot(join(artifacts, '01-before.png'));
        return;
      }
      await waitForBrowserValue(
        driver,
        'initial generic Site Tools',
        toolNamesScript,
        (value) => isStringArray(value) && sameStringSet(value, searchTools),
        config.commandTimeoutMs,
      );
      const inspected = driver.eval(
        invokeToolScript(
          'inspect_product_evidence',
          {},
          `return serialized.includes('"status":"insufficient"') &&
            serialized.includes('"rights":"owned"') &&
            serialized.includes('"privateShopperContext"') === false;`,
        ),
        'invoke inspect_product_evidence',
      );
      if (inspected !== true) throw new Error('Initial evidence inspection did not fail closed.');
      if (artifacts !== null) driver.screenshot(join(artifacts, '01-before.png'));
    });

    await recordAcceptanceStep(
      steps,
      humanControls
        ? 'open and search an arbitrary product through human controls'
        : 'open and search an arbitrary product through WebMCP',
      async () => {
        if (humanControls) {
          if (driver.eval(clickExactButtonScript('Search existing evidence')) !== true) {
            throw new Error('The ordinary-browser public search could not start.');
          }
          await waitForBrowserValue(
            driver,
            'truthful ordinary-browser discovery receipt',
            pageIncludesScript(
              '1 source channel searched; others unavailable',
              'Cloudflare Browser Run read the supplied page as untrusted context',
              '1 candidate source retained',
              'public leads never count as proof',
              'Create claim-specific filming mission',
            ),
            (value) => value === true,
            config.commandTimeoutMs,
          );
          if (artifacts !== null) driver.screenshot(join(artifacts, '02-search.png'));
          return;
        }
        const asked = driver.eval(
          invokeToolScript(
            'ask_product_question',
            {
              productName,
              productUrl,
              question: productQuestion,
            },
            `return parsedValues.some((value) => value.ok === true) &&
            serialized.includes('"answerStatus":"insufficient"') &&
            serialized.includes('"search_product_evidence"');`,
          ),
          'invoke ask_product_question',
        );
        if (asked !== true) throw new Error('WebMCP did not open the arbitrary product case.');
        await waitForBrowserValue(
          driver,
          'claim-aware search tool',
          toolNamesScript,
          (value) => isStringArray(value) && sameStringSet(value, searchTools),
          config.commandTimeoutMs,
        );
        const searched = driver.eval(
          invokeToolScript(
            'search_product_evidence',
            {},
            `return parsedValues.some((value) => value.ok === true) &&
            serialized.includes('"answerStatus":"insufficient"') &&
            serialized.includes('"create_filming_mission"');`,
          ),
          'invoke search_product_evidence',
        );
        if (searched !== true) throw new Error('WebMCP did not complete bounded public discovery.');
        await waitForBrowserValue(
          driver,
          'post-search mission frontier',
          toolNamesScript,
          (value) => isStringArray(value) && sameStringSet(value, missionCreationTools),
          config.commandTimeoutMs,
        );
        await waitForBrowserValue(
          driver,
          'truthful supplied-page receipt',
          pageIncludesScript(
            '1 source channel searched; others unavailable',
            'Cloudflare Browser Run read the supplied page as untrusted context',
            '1 candidate source retained',
            'public leads never count as proof',
          ),
          (value) => value === true,
          config.commandTimeoutMs,
        );
        const inspected = driver.eval(
          invokeToolScript(
            'inspect_product_evidence',
            {},
            `return serialized.includes('"provider":"evidence_network"') &&
            serialized.includes('"status":"partial"') &&
            serialized.includes('"rights":"link_only"') &&
            serialized.includes('Cloudflare Browser Run') &&
            serialized.includes('"privateShopperContext"') === false;`,
          ),
          'inspect bounded public discovery',
        );
        if (inspected !== true) {
          throw new Error('Public discovery was not preserved as an inconclusive link-only lead.');
        }
        if (artifacts !== null) driver.screenshot(join(artifacts, '02-search.png'));
      },
    );

    await recordAcceptanceStep(
      steps,
      humanControls
        ? 'create and publish a bounded mission through human controls'
        : 'create bounded mission through WebMCP',
      async () => {
        if (humanControls) {
          if (
            driver.eval(clickExactButtonScript('Create claim-specific filming mission')) !== true
          ) {
            throw new Error('The ordinary-browser mission could not be created.');
          }
          await waitForBrowserValue(
            driver,
            'ordinary-browser phone handoff frontier',
            pageIncludesScript('Put this exact mission on any phone.', 'Create phone capture link'),
            (value) => value === true,
            config.commandTimeoutMs,
          );
          if (driver.eval(clickExactButtonScript('Create phone capture link')) !== true) {
            throw new Error('The ordinary-browser phone case could not be created.');
          }
          try {
            await waitForBrowserValue(
              driver,
              'ordinary-browser private handoff',
              pageIncludesScript(
                'Scan with a phone that has the product.',
                'Open private contributor link',
                'Publish open filming request',
              ),
              (value) => value === true,
              config.commandTimeoutMs,
            );
          } catch (error: unknown) {
            const visibleState = driver.eval(`(() => ({
              hasScanPrompt: (document.body?.innerText ?? '').includes('Scan with a phone that has the product.'),
              hasPrivateLink: (document.body?.innerText ?? '').includes('Open private contributor link'),
              hasPublishButton: [...document.querySelectorAll('button')].some(
                (button) => button.textContent?.trim() === 'Publish open filming request',
              ),
              alert: document.querySelector('[role="alert"]')?.textContent?.trim() ?? null,
            }))()`);
            const detail = error instanceof Error ? error.message : 'Unknown handoff failure.';
            throw new Error(`${detail} Visible state: ${JSON.stringify(visibleState)}.`);
          }
          const consented = driver.eval(`(() => {
            const checkbox = document.querySelector('.mission-board-opt-in input[type="checkbox"]');
            if (!(checkbox instanceof HTMLInputElement)) return false;
            checkbox.click();
            return checkbox.checked;
          })()`);
          if (consented !== true) {
            throw new Error('The public-request disclosure could not be accepted.');
          }
          if (driver.eval(clickExactButtonScript('Publish open filming request')) !== true) {
            throw new Error('The ordinary-browser public request could not publish.');
          }
          await waitForBrowserValue(
            driver,
            'ordinary-browser public mission receipt',
            pageIncludesScript(
              'Anyone with this product can now record the answer.',
              'No shopper identity, preferences, history, or budget are included.',
            ),
            (value) => value === true,
            config.commandTimeoutMs,
          );
          if (artifacts !== null) driver.screenshot(join(artifacts, '03-mission.png'));
          return;
        }
        const created = driver.eval(
          invokeToolScript(
            'create_filming_mission',
            {
              instruction:
                'Fill the bottle, close the lid, and hold it upside down over dry paper.',
              successCriterion: 'Keep the closed lid and dry paper visible for the entire test.',
              minimumSeconds: 10,
              continuousTakeRequired: true,
            },
            `return parsedValues.some((value) => value.ok === true) &&
            serialized.includes('"missionStatus":"open"');`,
          ),
          'invoke create_filming_mission',
        );
        if (created !== true) throw new Error('WebMCP did not create the bounded mission.');
        await waitForBrowserValue(
          driver,
          'phone capture tool',
          toolNamesScript,
          (value) => isStringArray(value) && sameStringSet(value, missionTools),
          config.commandTimeoutMs,
        );
        const linked = driver.eval(
          invokeToolScript(
            'create_phone_capture_link',
            {},
            `return parsedValues.some((value) => value.ok === true) &&
            serialized.includes('bounded contributor link');`,
          ),
          'invoke create_phone_capture_link',
        );
        if (linked !== true) throw new Error('WebMCP did not create the phone handoff.');
        await waitForBrowserValue(
          driver,
          'private contributor handoff',
          pageIncludesScript(
            'Scan with a phone that has the product.',
            'Open private contributor link',
          ),
          (value) => value === true,
          config.commandTimeoutMs,
        );
        await waitForBrowserValue(
          driver,
          'public mission publication frontier',
          toolNamesScript,
          (value) => isStringArray(value) && sameStringSet(value, publicMissionPublishTools),
          config.commandTimeoutMs,
        );
        const published = driver.eval(
          invokeToolScript(
            'publish_filming_mission',
            { confirmPublicListing: true },
            `return parsedValues.some((value) => value.ok === true) &&
            serialized.includes(${JSON.stringify(productName)}) &&
            serialized.includes(${JSON.stringify(productQuestion)}) &&
            serialized.includes('"privateShopperContext":"not collected"');`,
          ),
          'publish filming mission to public board',
        );
        if (published !== true) {
          throw new Error('WebMCP did not publish the privacy-bounded public mission.');
        }
        await waitForBrowserValue(
          driver,
          'public mission removal frontier',
          toolNamesScript,
          (value) => isStringArray(value) && sameStringSet(value, publicMissionRemoveTools),
          config.commandTimeoutMs,
        );
        await waitForBrowserValue(
          driver,
          'public mission receipt',
          pageIncludesScript(
            'Anyone with this product can now record the answer.',
            'No shopper identity, preferences, history, or budget are included.',
          ),
          (value) => value === true,
          config.commandTimeoutMs,
        );
        if (artifacts !== null) driver.screenshot(join(artifacts, '03-mission.png'));
      },
    );

    const buyerAndExistingTabs = driver.listTabs();
    driver.openLinkInNewTab('a[href="/missions"]');
    const boardTab = await waitForNewTab(driver, buyerAndExistingTabs, config.commandTimeoutMs);
    driver.switchTab(boardTab);
    let publicMissionId: string | null = null;

    await recordAcceptanceStep(
      steps,
      'discover and claim the mission without a customer list',
      async () => {
        if (!humanControls) {
          await waitForBrowserValue(
            driver,
            'public mission board tools',
            toolNamesScript,
            (value) => isStringArray(value) && sameStringSet(value, boardTools),
            config.commandTimeoutMs,
          );
        }
        await waitForBrowserValue(
          driver,
          'public mission board listing',
          pageIncludesScript(productName, productQuestion, 'I have this product'),
          (value) => value === true,
          config.commandTimeoutMs,
        );
        if (!humanControls) {
          const inspected = driver.eval(
            invokeToolScript(
              'inspect_open_filming_missions',
              {},
              `return serialized.includes(${JSON.stringify(productName)}) &&
                serialized.includes(${JSON.stringify(productQuestion)}) &&
                serialized.includes('"contributorToken"') === false &&
                serialized.includes('"ownerToken"') === false;`,
            ),
            'inspect public filming missions',
          );
          if (inspected !== true) {
            throw new Error(
              'The public mission listing exposed private data or omitted the request.',
            );
          }
        }
        const missionId = driver.eval(`(() => {
          const article = [...document.querySelectorAll('article[id^="mission-"]')].find((candidate) => {
            const text = candidate.textContent ?? '';
            return text.includes(${JSON.stringify(productName)}) &&
              text.includes(${JSON.stringify(productQuestion)});
          });
          return article?.id.slice('mission-'.length) ?? null;
        })()`);
        if (typeof missionId !== 'string' || !/^[a-f0-9-]{36}$/u.test(missionId)) {
          throw new Error('The public mission identifier was not rendered.');
        }
        publicMissionId = missionId;
        if (humanControls) {
          const claimed = driver.eval(`(() => {
            const article = document.getElementById(${JSON.stringify(`mission-${missionId}`)});
            const button = [...(article?.querySelectorAll('button') ?? [])].find(
              (candidate) => candidate.textContent?.trim() === 'I have this product',
            );
            if (!(button instanceof HTMLButtonElement) || button.disabled) return false;
            button.click();
            return true;
          })()`);
          if (claimed !== true) {
            throw new Error('The ordinary-browser public mission could not be claimed.');
          }
        } else {
          const opened = driver.eval(
            invokeToolScript(
              'open_filming_mission',
              { missionId },
              `return parsedValues.some((value) => value.ok === true) &&
                serialized.includes('/contribute/') &&
                serialized.includes('#token=');`,
            ),
            'open public filming mission',
          );
          if (opened !== true) {
            throw new Error('WebMCP did not open the bounded public contributor path.');
          }
        }
        await waitForBrowserValue(
          driver,
          'public contributor handoff',
          pageIncludesScript('Open the bounded recorder.', 'Review before publishing.'),
          (value) => value === true,
          config.commandTimeoutMs,
        );
        if (artifacts !== null) driver.screenshot(join(artifacts, '04-open-board.png'));
      },
    );

    if (publicMissionId === null) {
      throw new Error('The public mission was not selected.');
    }
    const existingTabs = driver.listTabs();
    driver.openLinkInNewTab(
      `article[id="mission-${publicMissionId}"] a[href*="/contribute/"]`,
      'open selected public contributor path',
    );
    const contributorTab = await waitForNewTab(driver, existingTabs, config.commandTimeoutMs);
    driver.switchTab(contributorTab);

    await recordAcceptanceStep(steps, 'scrub and recover phone capability', async () => {
      const readyScript = `(() => {
        const hasStoredCapability = Object.keys(sessionStorage).some((key) =>
          key.startsWith('product-evidence-contributor:'),
        );
        const text = (document.body?.innerText ?? '').toLowerCase();
        return location.hash === '' && hasStoredCapability &&
          text.includes('record or choose the evidence clip.') &&
          text.includes('optional fresh-capture check');
      })()`;
      await waitForBrowserValue(
        driver,
        'scrubbed contributor capability',
        readyScript,
        (value) => value === true,
        config.commandTimeoutMs,
      );
      driver.reload();
      await waitForBrowserValue(
        driver,
        'session-scoped contributor recovery',
        readyScript,
        (value) => value === true,
        config.commandTimeoutMs,
      );
    });

    await recordAcceptanceStep(steps, 'upload and review bounded video', async () => {
      const intercepted = driver.eval(`(() => {
        const originalFetch = window.fetch.bind(window);
        window.fetch = async (input, init) => {
          const url = input instanceof Request ? input.url : input instanceof URL ? input.href : String(input);
          if (url === 'https://upload.videodelivery.net/acceptancevideo0000000000000001') {
            return new Response(null, { status: 204 });
          }
          return originalFetch(input, init);
        };
        return true;
      })()`);
      if (intercepted !== true) throw new Error('The local upload boundary was not installed.');
      driver.upload('input[type="file"]', fixture.filePath);
      await waitForBrowserValue(
        driver,
        'video fingerprint and metadata',
        `(() => {
          const button = [...document.querySelectorAll('button')].find(
            (candidate) => candidate.textContent?.trim() === 'Upload + draft evidence',
          );
          return button instanceof HTMLButtonElement && !button.disabled;
        })()`,
        (value) => value === true,
        config.commandTimeoutMs,
      );
      if (driver.eval(clickExactButtonScript('Upload + draft evidence')) !== true) {
        throw new Error('The contributor upload could not start.');
      }
      await waitForBrowserValue(
        driver,
        'claim-scoped proposal',
        pageIncludesScript('What does your video actually show?'),
        (value) => value === true,
        config.commandTimeoutMs,
      );
      const proposalReceipt = driver.eval(`(() => {
        const text = document.body?.innerText ?? '';
        const normalized = text.toLowerCase();
        return {
          model: text.includes('google/gemini-3.7-flash'),
          citation: text.includes('Proposed citation 00:01–00:11'),
          reviewBoundary: normalized.includes('ai draft · untrusted until you review it'),
          reviewVideo: document.querySelector('video[aria-label="Review uploaded evidence video"]')?.getAttribute('src')?.startsWith('blob:') === true,
          honestChallengeFallback: text.includes(
            'Fresh-capture check: The synthetic fixture does not contain the mission phrase',
          ),
        };
      })()`);
      if (
        typeof proposalReceipt !== 'object' ||
        proposalReceipt === null ||
        !Object.values(proposalReceipt).every((value) => value === true)
      ) {
        throw new Error(
          `The claim-scoped proposal omitted required review metadata: ${JSON.stringify(proposalReceipt)}.`,
        );
      }
      if (driver.eval(clickExactButtonScript('Contradicts')) !== true) {
        throw new Error('The contributor could not correct the proposed result.');
      }
      driver.fill('textarea', correctedObservation);
      const reviewed = driver.eval(`(() => {
        const confidence = document.querySelector('input[name="confidence"]:checked');
        const continuity = document.querySelector('input[name="continuity"]:checked');
        const [start, end] = document.querySelectorAll('.contributor-time-range input');
        return confidence?.parentElement?.textContent?.includes('medium') === true &&
          continuity?.parentElement?.textContent?.includes('continuous') === true &&
          start instanceof HTMLInputElement && start.value === '1' &&
          end instanceof HTMLInputElement && end.value === '11';
      })()`);
      if (reviewed !== true) throw new Error('The reviewed evidence fields did not stay bounded.');
      const liveCaptureAttested = driver.eval(`(() => {
        const radio = [...document.querySelectorAll('input[name="provenance"]')].find(
          (candidate) => candidate.parentElement?.textContent?.includes('I recorded it now for this mission'),
        );
        if (!(radio instanceof HTMLInputElement)) return false;
        radio.click();
        return radio.checked;
      })()`);
      if (liveCaptureAttested !== true) {
        throw new Error('The contributor could not attest the clip provenance.');
      }
      const unconfirmedBlocked = driver.eval(`(() => {
        const button = [...document.querySelectorAll('button')].find(
          (candidate) => candidate.textContent?.trim() === 'Publish reviewed evidence',
        );
        return button instanceof HTMLButtonElement && button.disabled;
      })()`);
      if (unconfirmedBlocked !== true) {
        throw new Error('Evidence publication did not wait for rights and final confirmation.');
      }
      const rightsSelected = driver.eval(`(() => {
        const radio = [...document.querySelectorAll('input[name="rights"]')].find(
          (candidate) => candidate.parentElement?.textContent?.includes('I recorded and own it'),
        );
        if (!(radio instanceof HTMLInputElement)) return false;
        radio.click();
        return radio.checked;
      })()`);
      if (rightsSelected !== true) {
        throw new Error('The contributor could not deliberately select publishing rights.');
      }
      const publicReuseSelected = driver.eval(`(() => {
        const radio = [...document.querySelectorAll('input[name="reuse-scope"]')].find(
          (candidate) => candidate.parentElement?.textContent?.includes('Future matching product questions too'),
        );
        if (!(radio instanceof HTMLInputElement)) return false;
        radio.click();
        return radio.checked;
      })()`);
      if (publicReuseSelected !== true) {
        throw new Error('The contributor could not explicitly opt into bounded network reuse.');
      }
      const reviewConfirmed = driver.eval(`(() => {
        const checkbox = document.querySelector('.contributor-review-confirmation input[type="checkbox"]');
        if (!(checkbox instanceof HTMLInputElement)) return false;
        checkbox.click();
        const button = [...document.querySelectorAll('button')].find(
          (candidate) => candidate.textContent?.trim() === 'Publish reviewed evidence',
        );
        return checkbox.checked && button instanceof HTMLButtonElement && !button.disabled;
      })()`);
      if (reviewConfirmed !== true) {
        throw new Error('The contributor could not explicitly confirm the final reviewed state.');
      }
      if (artifacts !== null) driver.screenshot(join(artifacts, '05-human-review.png'));
      if (driver.eval(clickExactButtonScript('Publish reviewed evidence')) !== true) {
        throw new Error('The reviewed evidence could not publish.');
      }
      await waitForBrowserValue(
        driver,
        'contributor publication receipt',
        pageIncludesScript(
          'The evidence case updated',
          'Contradicted',
          'For up to 30 days',
          'future shopper asks the same product question',
        ),
        (value) => value === true,
        config.commandTimeoutMs,
      );
    });

    await recordAcceptanceStep(steps, 'consume the evidence-caused answer change', async () => {
      if (buyerTab === null) throw new Error('The buyer tab was lost.');
      driver.switchTab(buyerTab);
      await waitForBrowserValue(
        driver,
        'buyer answer update',
        pageIncludesScript('Reviewed evidence published', 'Contradicted', 'Video 00:01–00:11'),
        (value) => value === true,
        config.commandTimeoutMs,
      );
      const playbackBound = driver.eval(`(() => {
        const link = document.querySelector(
          'a[data-stream-uid="acceptancevideo0000000000000001"]',
        );
        return link instanceof HTMLAnchorElement &&
          link.href === 'https://customer-acceptance.cloudflarestream.com/acceptancevideo0000000000000001/watch' &&
          link.textContent?.includes('Watch cited video') === true &&
          link.rel.includes('noreferrer');
      })()`);
      if (playbackBound !== true) {
        throw new Error('The reviewed citation was not bound to its Stream playback source.');
      }
      if (!humanControls) {
        await waitForBrowserValue(
          driver,
          'answer-change Site Tool',
          toolNamesScript,
          (value) => isStringArray(value) && sameStringSet(value, finalTools),
          config.commandTimeoutMs,
        );
        const diff = driver.eval(
          invokeToolScript(
            'inspect_answer_change',
            {},
            `return serialized.includes('"changed":true') &&
              serialized.includes('"status":"insufficient"') &&
              serialized.includes('"status":"contradicted"') &&
              serialized.includes('"timestamp":"00:01–00:11"') &&
              serialized.includes('"captureTiming":"contributor_attested"') &&
              serialized.includes(${JSON.stringify(correctedObservation)});`,
          ),
          'invoke inspect_answer_change',
        );
        if (diff !== true) throw new Error('WebMCP did not expose the causal answer difference.');
      }
      driver.reload();
      await waitForBrowserValue(
        driver,
        'buyer Durable Object recovery',
        pageIncludesScript('Contradicted', '00:01–00:11'),
        (value) => value === true,
        config.commandTimeoutMs,
      );
      if (artifacts !== null) driver.screenshot(join(artifacts, '06-after.png'));
    });

    await recordAcceptanceStep(
      steps,
      humanControls
        ? 'reuse the reviewed recording in a fresh ordinary-browser case'
        : 'reuse the reviewed recording in a fresh WebMCP case',
      async () => {
        if (humanControls) {
          fillHumanQuestion(driver, productName, productUrl, productQuestion);
          if (driver.eval(clickExactButtonScript('Open new evidence case')) !== true) {
            throw new Error('The second ordinary-browser case could not open.');
          }
          await waitForBrowserValue(
            driver,
            'second ordinary-browser case search frontier',
            pageIncludesScript(productName, productQuestion, 'Search existing evidence'),
            (value) => value === true,
            config.commandTimeoutMs,
          );
          if (driver.eval(clickExactButtonScript('Search existing evidence')) !== true) {
            throw new Error('The second ordinary-browser search could not start.');
          }
          await waitForBrowserValue(
            driver,
            'ordinary-browser reusable evidence receipt',
            pageIncludesScript(
              '1 reusable reviewed recording found',
              'Cloudflare D1 reusable evidence',
              'The evidence network already has a reviewed answer.',
              'reusable network evidence',
              'Video 00:01–00:11',
            ),
            (value) => value === true,
            config.commandTimeoutMs,
          );
          const noRedundantMission = driver.eval(`(() => {
            const buttons = [...document.querySelectorAll('button')];
            return !buttons.some(
              (button) => button.textContent?.trim() === 'Create claim-specific filming mission',
            );
          })()`);
          if (noRedundantMission !== true) {
            throw new Error('The reused evidence still exposed a redundant filming mission.');
          }
          if (artifacts !== null) driver.screenshot(join(artifacts, '07-reused.png'));
          return;
        }
        const asked = driver.eval(
          invokeToolScript(
            'ask_product_question',
            { productName, productUrl, question: productQuestion },
            `return parsedValues.some((value) => value.ok === true) &&
              serialized.includes('"answerStatus":"insufficient"') &&
              serialized.includes('"search_product_evidence"');`,
          ),
          'open second matching product case',
        );
        if (asked !== true) throw new Error('WebMCP did not open the second matching case.');
        await waitForBrowserValue(
          driver,
          'second-case search tool',
          toolNamesScript,
          (value) => isStringArray(value) && sameStringSet(value, searchTools),
          config.commandTimeoutMs,
        );
        const searched = driver.eval(
          invokeToolScript(
            'search_product_evidence',
            {},
            `return parsedValues.some((value) => value.ok === true) &&
              serialized.includes('"answerStatus":"contradicted"') &&
              serialized.includes('"inspect_answer_change"') &&
              serialized.includes('"create_filming_mission"') === false;`,
          ),
          'reuse network evidence in second case',
        );
        if (searched !== true) {
          throw new Error('A fresh case did not reuse the reviewed evidence through WebMCP.');
        }
        await waitForBrowserValue(
          driver,
          'second-case resolved tool frontier',
          toolNamesScript,
          (value) => isStringArray(value) && sameStringSet(value, finalTools),
          config.commandTimeoutMs,
        );
        await waitForBrowserValue(
          driver,
          'reusable evidence receipt',
          pageIncludesScript(
            '1 reusable reviewed recording found',
            'Cloudflare D1 reusable evidence',
            'The evidence network already has a reviewed answer.',
            'reusable network evidence',
            'Video 00:01–00:11',
          ),
          (value) => value === true,
          config.commandTimeoutMs,
        );
        const inspected = driver.eval(
          invokeToolScript(
            'inspect_product_evidence',
            {},
            `return serialized.includes('"status":"contradicted"') &&
              serialized.includes('"reuseScope":"public_network"') &&
              serialized.includes('"captureTiming":"contributor_attested"') &&
              serialized.includes('"medium":"video"') &&
              serialized.includes('acceptancevideo0000000000000001') &&
              serialized.includes(${JSON.stringify(correctedObservation)}) &&
              serialized.includes('"mission":null') &&
              serialized.includes('"privateShopperContext"') === false;`,
          ),
          'inspect reused network evidence',
        );
        if (inspected !== true) {
          throw new Error('The second case did not expose the reusable evidence receipt safely.');
        }
        const diff = driver.eval(
          invokeToolScript(
            'inspect_answer_change',
            {},
            `return serialized.includes('"changed":true') &&
              serialized.includes('"status":"insufficient"') &&
              serialized.includes('"status":"contradicted"') &&
              serialized.includes('"timestamp":"00:01–00:11"');`,
          ),
          'inspect second-case answer change',
        );
        if (diff !== true)
          throw new Error('The reused evidence did not cause a visible answer change.');
        if (artifacts !== null) driver.screenshot(join(artifacts, '07-reused.png'));
      },
    );

    process.stdout.write(`${JSON.stringify({ ok: true, steps })}\n`);
  } finally {
    driver.close();
    rmSync(fixture.directory, { recursive: true, force: true });
  }
}

void run().catch((error: unknown) => {
  process.stderr.write(`${sanitizeAcceptanceFailure(error)}\n`);
  process.exitCode = 1;
});
