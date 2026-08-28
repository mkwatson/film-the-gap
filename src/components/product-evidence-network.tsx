'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { QRCodeSVG } from 'qrcode.react';

import { discoverProductEvidence } from '@/lib/evidence-network/discovery-client';
import {
  applyEvidenceNetworkCommand,
  createDemoEvidenceNetworkState,
  currentEvidenceAnswer,
  getEvidenceNetworkToolNames,
  initialEvidenceAnswer,
  type EvidenceAnswerStatus,
  type EvidenceNetworkCommand,
  type EvidenceNetworkState,
  type EvidenceNetworkTransition,
  type EvidenceResult,
  type EvidenceDiscoveryInput,
  type EvidenceDiscoveryPlatform,
  type ProductQuestionInput,
} from '@/lib/evidence-network/model';
import {
  configuredEvidenceServiceUrl,
  contributorPath,
  createRemoteEvidenceCase,
  remoteEvidenceWebSocketUrl,
} from '@/lib/evidence-network/remote-client';
import {
  parseRemoteEvidenceServerMessage,
  type CreateRemoteEvidenceCaseRequest,
} from '@/lib/evidence-network/remote-protocol';
import {
  clearEvidencePhoneConnection,
  persistEvidencePhoneConnection,
  restoreEvidencePhoneConnection,
  type EvidencePhoneConnection,
} from '@/lib/evidence-network/phone-session';
import { formatEvidenceTimestamp } from '@/lib/evidence-network/video-analysis';
import {
  createEvidenceSiteTools,
  type EvidencePhoneCaptureReceipt,
  type EvidenceSiteToolRuntime,
} from '@/lib/evidence-network/site-tools';
import { useDynamicSiteTools } from '@/lib/webmcp/use-dynamic-site-tools';

const defaultMission = {
  instruction: 'Fill the bottle, close the lid, and hold it upside down over dry paper.',
  successCriterion: 'Keep the closed lid and dry paper visible for the entire test.',
  minimumSeconds: 10,
  continuousTakeRequired: true,
} as const;

const agentStarter =
  'Use this page’s Site Tools. Inspect the active product question, search existing public product evidence, and treat every result as a lead—not proof. If the sources still do not prove the answer, create the smallest continuous filming mission, then create a phone capture link. Do not infer from marketing copy or predict the result. Wait for reviewed evidence, then inspect exactly how the answer changed.';

const answerLabels: Readonly<Record<EvidenceAnswerStatus, string>> = {
  insufficient: 'Not enough proof',
  supported: 'Supported',
  contradicted: 'Contradicted',
  mixed: 'Conflicting evidence',
};

function actorLabel(actor: string): string {
  if (actor === 'agent') {
    return 'ChatGPT';
  }
  return actor.charAt(0).toUpperCase() + actor.slice(1);
}

function citationSeconds(start: number | null, end: number | null, fallback: string): string {
  if (start === null || end === null) {
    return fallback;
  }
  return `Video ${formatEvidenceTimestamp(start)}–${formatEvidenceTimestamp(end)}`;
}

function parseJsonString(value: string): unknown {
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return null;
  }
}

function discoveryPlatformForUrl(url: string): EvidenceDiscoveryPlatform {
  const hostname = new URL(url).hostname.toLowerCase();
  if (hostname === 'tiktok.com' || hostname.endsWith('.tiktok.com')) {
    return 'tiktok';
  }
  if (hostname === 'instagram.com' || hostname.endsWith('.instagram.com')) {
    return 'instagram';
  }
  if (hostname === 'youtube.com' || hostname.endsWith('.youtube.com') || hostname === 'youtu.be') {
    return 'youtube';
  }
  return 'web';
}

function remoteDiscoveryForState(state: EvidenceNetworkState): EvidenceDiscoveryInput | undefined {
  const evidenceCase = state.activeCase;
  const discovery = evidenceCase?.discovery;
  if (
    evidenceCase === null ||
    evidenceCase === undefined ||
    discovery === null ||
    discovery === undefined
  ) {
    return undefined;
  }
  const sourceIds = new Set(discovery.sourceIds);
  const leads = evidenceCase.sources.flatMap((source) => {
    if (!sourceIds.has(source.id) || source.url === null) {
      return [];
    }
    const observation = evidenceCase.observations.find(
      ({ citation }) => citation.sourceId === source.id,
    );
    return [
      {
        platform: discoveryPlatformForUrl(source.url),
        title: source.title,
        url: source.url,
        summary:
          observation?.text ??
          'Public discovery lead; the source has not been reviewed against the question.',
        creatorLabel: source.contributorLabel,
      },
    ];
  });
  return {
    provider: discovery.provider,
    status: discovery.status,
    query: discovery.query,
    searchedPlatforms: [...discovery.searchedPlatforms],
    warnings: [...discovery.warnings],
    leads,
  };
}

function remoteRequestForState(state: EvidenceNetworkState): CreateRemoteEvidenceCaseRequest {
  const evidenceCase = state.activeCase;
  const mission = evidenceCase?.mission;
  if (evidenceCase === null || evidenceCase === undefined || mission?.status !== 'open') {
    throw new Error('Create an open filming mission before connecting a phone.');
  }
  const missionInput = {
    instruction: mission.instruction,
    successCriterion: mission.successCriterion,
    minimumSeconds: mission.minimumSeconds,
    continuousTakeRequired: mission.continuousTakeRequired,
  };
  const isDemoFixture =
    evidenceCase.product.name === 'Everyday insulated travel bottle' &&
    evidenceCase.sources.some(({ id }) => id === 'source-1');
  const discovery = remoteDiscoveryForState(state);
  return isDemoFixture
    ? { seed: 'travel_bottle', mission: missionInput }
    : {
        seed: 'empty',
        question: {
          productName: evidenceCase.product.name,
          ...(evidenceCase.product.suppliedUrl === null
            ? {}
            : { productUrl: evidenceCase.product.suppliedUrl }),
          question: evidenceCase.question.text,
        },
        ...(discovery === undefined ? {} : { discovery }),
        mission: missionInput,
      };
}

export function ProductEvidenceNetwork(): React.JSX.Element {
  const [state, setState] = useState<EvidenceNetworkState>(createDemoEvidenceNetworkState);
  const [lastMessage, setLastMessage] = useState(
    'One source was indexed. Its marketing claim does not prove the physical behavior.',
  );
  const [productName, setProductName] = useState('USB-C lavalier microphone');
  const [productUrl, setProductUrl] = useState('');
  const [question, setQuestion] = useState(
    'Can the phone charge while the receiver is connected and recording?',
  );
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copied' | 'error'>('idle');
  const [searchPhase, setSearchPhase] = useState<'idle' | 'searching' | 'complete' | 'error'>(
    'idle',
  );
  const [searchError, setSearchError] = useState<string | null>(null);
  const [phoneConnection, setPhoneConnection] = useState<EvidencePhoneConnection | null>(null);
  const [phonePhase, setPhonePhase] = useState<
    'idle' | 'connecting' | 'waiting' | 'complete' | 'error'
  >('idle');
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const serviceUrl = configuredEvidenceServiceUrl();
  const stateRef = useRef(state);
  const phoneConnectionRef = useRef(phoneConnection);

  const clearPhoneConnection = useCallback((): void => {
    clearEvidencePhoneConnection(window.sessionStorage);
    phoneConnectionRef.current = null;
    setPhoneConnection(null);
    setPhonePhase('idle');
    setPhoneError(null);
  }, []);

  const readState = useCallback((): EvidenceNetworkState => stateRef.current, []);
  const dispatch = useCallback(
    async (command: EvidenceNetworkCommand): Promise<EvidenceNetworkTransition> => {
      const result = applyEvidenceNetworkCommand(stateRef.current, command);
      if (result.ok && ['ask-product-question', 'create-filming-mission'].includes(command.kind)) {
        clearPhoneConnection();
      }
      stateRef.current = result.state;
      setState(result.state);
      setLastMessage(result.message);
      return result;
    },
    [clearPhoneConnection],
  );
  const createPhoneCapture = useCallback(async (): Promise<EvidencePhoneCaptureReceipt> => {
    const existing = phoneConnectionRef.current;
    if (existing !== null) {
      return existing.receipt;
    }
    if (serviceUrl === null) {
      throw new Error('The shared evidence service is not configured on this deployment.');
    }
    setPhonePhase('connecting');
    setPhoneError(null);
    try {
      const credentials = await createRemoteEvidenceCase(
        serviceUrl,
        remoteRequestForState(stateRef.current),
      );
      const contributorUrl = new URL(
        contributorPath(credentials.caseId, credentials.contributorToken),
        window.location.origin,
      ).toString();
      const receipt: EvidencePhoneCaptureReceipt = {
        caseId: credentials.caseId,
        contributorUrl,
        expiresAt: credentials.expiresAt,
      };
      const connection = { credentials, receipt };
      persistEvidencePhoneConnection(
        window.sessionStorage,
        serviceUrl,
        window.location.origin,
        connection,
      );
      phoneConnectionRef.current = connection;
      setPhoneConnection(connection);
      stateRef.current = credentials.state;
      setState(credentials.state);
      setLastMessage('Live case created. Waiting for reviewed video from the contributor phone.');
      setPhonePhase('waiting');
      return receipt;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      setPhoneError(message);
      setPhonePhase('error');
      throw error;
    }
  }, [serviceUrl]);

  useEffect(() => {
    if (serviceUrl === null || phoneConnectionRef.current !== null) {
      return;
    }
    const restored = restoreEvidencePhoneConnection(
      window.sessionStorage,
      serviceUrl,
      window.location.origin,
    );
    if (restored === null) {
      return;
    }
    let active = true;
    queueMicrotask(() => {
      if (!active || phoneConnectionRef.current !== null) {
        return;
      }
      phoneConnectionRef.current = restored;
      setPhoneConnection(restored);
      stateRef.current = restored.credentials.state;
      setState(restored.credentials.state);
      setLastMessage('Reconnected to the existing durable product-evidence case.');
      setPhonePhase(
        restored.credentials.state.activeCase?.mission?.status === 'fulfilled'
          ? 'complete'
          : 'waiting',
      );
    });
    return () => {
      active = false;
    };
  }, [serviceUrl]);
  const searchEvidence = useCallback(
    async (
      actor: Extract<EvidenceNetworkCommand, { kind: 'record-evidence-discovery' }>['actor'],
      signal?: AbortSignal,
    ): Promise<EvidenceNetworkTransition> => {
      const evidenceCase = stateRef.current.activeCase;
      if (evidenceCase === null) {
        throw new Error('Ask a product question before searching for evidence.');
      }
      const input: ProductQuestionInput = {
        productName: evidenceCase.product.name,
        ...(evidenceCase.product.suppliedUrl === null
          ? {}
          : { productUrl: evidenceCase.product.suppliedUrl }),
        question: evidenceCase.question.text,
      };
      setSearchPhase('searching');
      setSearchError(null);
      try {
        const discovery = await discoverProductEvidence(input, signal);
        const result = await dispatch({
          kind: 'record-evidence-discovery',
          actor,
          input: discovery,
        });
        setSearchPhase(result.ok ? 'complete' : 'error');
        if (!result.ok) {
          setSearchError(result.message);
        }
        return result;
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        setSearchPhase('error');
        setSearchError(message);
        throw error;
      }
    },
    [dispatch],
  );
  const evidenceSearchRuntime = useMemo(
    () => ({ run: (signal?: AbortSignal) => searchEvidence('agent', signal) }),
    [searchEvidence],
  );
  const phoneCaptureRuntime = useMemo(
    () => ({
      available: serviceUrl !== null,
      current: (): EvidencePhoneCaptureReceipt | null =>
        phoneConnectionRef.current?.receipt ?? null,
      create: createPhoneCapture,
    }),
    [createPhoneCapture, serviceUrl],
  );
  const siteToolRuntime = useMemo<EvidenceSiteToolRuntime>(
    () => ({
      readState,
      dispatch,
      evidenceSearch: evidenceSearchRuntime,
      phoneCapture: phoneCaptureRuntime,
    }),
    [dispatch, evidenceSearchRuntime, phoneCaptureRuntime, readState],
  );
  const createTools = useCallback(
    () => createEvidenceSiteTools(siteToolRuntime),
    [siteToolRuntime],
  );
  const availableToolNames = [...getEvidenceNetworkToolNames(state)];
  if (
    serviceUrl !== null &&
    phoneConnection === null &&
    state.activeCase?.mission?.status === 'open'
  ) {
    availableToolNames.push('create_phone_capture_link');
  }
  const siteToolStatus = useDynamicSiteTools(createTools, availableToolNames.join('|'));

  useEffect(() => {
    const connection = phoneConnection;
    if (serviceUrl === null || connection === null) {
      return;
    }
    const socket = new WebSocket(
      remoteEvidenceWebSocketUrl(serviceUrl, connection.credentials.caseId),
    );
    socket.addEventListener('open', () => setPhonePhase('waiting'));
    socket.addEventListener('message', (event: MessageEvent) => {
      const raw: unknown = typeof event.data === 'string' ? parseJsonString(event.data) : null;
      const message = parseRemoteEvidenceServerMessage(raw);
      if (message?.type === 'case-snapshot') {
        const currentConnection = phoneConnectionRef.current;
        if (currentConnection !== null) {
          const updatedConnection: EvidencePhoneConnection = {
            ...currentConnection,
            credentials: { ...currentConnection.credentials, state: message.state },
          };
          phoneConnectionRef.current = updatedConnection;
          persistEvidencePhoneConnection(
            window.sessionStorage,
            serviceUrl,
            window.location.origin,
            updatedConnection,
          );
        }
        stateRef.current = message.state;
        setState(message.state);
        setLastMessage(message.lastMessage);
        if (message.state.activeCase?.mission?.status === 'fulfilled') {
          setPhonePhase('complete');
        }
      } else if (message?.type === 'case-expired') {
        clearPhoneConnection();
        setPhoneError(message.message);
        setPhonePhase('error');
      }
    });
    socket.addEventListener('error', () => {
      setPhoneError('The live update connection was interrupted. The case remains durable.');
      setPhonePhase('error');
    });
    return () => socket.close(1000, 'Evidence page changed');
  }, [clearPhoneConnection, phoneConnection, serviceUrl]);

  const evidenceCase = state.activeCase;
  const answer = currentEvidenceAnswer(state);
  const beforeAnswer = initialEvidenceAnswer(state);
  const answerChanged = evidenceCase !== null && evidenceCase.answers.length > 1;
  const sources = evidenceCase?.sources ?? [];
  const allObservations = evidenceCase?.observations ?? [];
  const mission = evidenceCase?.mission ?? null;
  const isDemoCase =
    evidenceCase?.product.name === 'Everyday insulated travel bottle' &&
    evidenceCase.sources.some(({ id }) => id === 'source-1');

  async function copyAgentStarter(): Promise<void> {
    if (navigator.clipboard === undefined) {
      setCopyStatus('error');
      return;
    }
    try {
      await navigator.clipboard.writeText(agentStarter);
      setCopyStatus('copied');
    } catch {
      setCopyStatus('error');
    }
  }

  function resetDemo(): void {
    const nextState = createDemoEvidenceNetworkState();
    stateRef.current = nextState;
    setState(nextState);
    setLastMessage('Demo reset to one indexed source and one unresolved product question.');
    setCopyStatus('idle');
    setSearchPhase('idle');
    setSearchError(null);
    clearPhoneConnection();
    setSearchPhase('idle');
    setSearchError(null);
  }

  function submitQuestion(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    clearPhoneConnection();
    void dispatch({
      kind: 'ask-product-question',
      actor: 'human',
      input: {
        productName,
        ...(productUrl.trim().length === 0 ? {} : { productUrl: productUrl.trim() }),
        question,
      },
    });
  }

  function createMission(): void {
    const activeCase = stateRef.current.activeCase;
    const isBottleDemo = activeCase?.product.name === 'Everyday insulated travel bottle';
    void dispatch({
      kind: 'create-filming-mission',
      actor: 'human',
      input: isBottleDemo
        ? defaultMission
        : {
            instruction:
              `Record one continuous take that visibly answers: “${activeCase?.question.text ?? 'the product question'}”`.slice(
                0,
                280,
              ),
            successCriterion:
              'Keep the product, the relevant control or condition, and the observable result visible throughout.',
            minimumSeconds: 10,
            continuousTakeRequired: true,
          },
    });
  }

  function publishReplay(result: Extract<EvidenceResult, 'supports' | 'contradicts'>): void {
    const supports = result === 'supports';
    void dispatch({
      kind: 'publish-reviewed-evidence',
      actor: 'contributor',
      input: {
        result,
        observation: supports
          ? 'No water reached the paper during the continuous ten-second inversion.'
          : 'Water appeared on the paper below the lid during the continuous inversion.',
        contributorLabel: 'Clearly labeled replay contributor',
        durationSeconds: 10,
        citationStartSeconds: 0,
        citationEndSeconds: 10,
        confidence: 'high',
        continuity: 'continuous',
        rights: 'owned',
        provenance: 'demo_replay',
        capturedAt: new Date().toISOString(),
      },
    });
  }

  return (
    <main className="evidence-shell">
      <header className="evidence-topbar">
        <div className="evidence-brand">
          <span className="evidence-brand-mark" aria-hidden="true">
            ●
          </span>
          <span>
            <strong>Product evidence network</strong>
            <small>Ask the web. Film only what is missing.</small>
          </span>
        </div>
        <div className="evidence-topbar-actions">
          <span className={`evidence-runtime runtime-${siteToolStatus.phase}`}>
            <span aria-hidden="true" />
            {siteToolStatus.phase === 'ready'
              ? `${siteToolStatus.registeredNames.length} Site Tools live`
              : siteToolStatus.phase === 'unsupported'
                ? 'Human controls ready'
                : siteToolStatus.phase === 'error'
                  ? 'Tools need attention'
                  : 'Connecting Site Tools'}
          </span>
          <button className="evidence-quiet-button" type="button" onClick={resetDemo}>
            Reset proof loop
          </button>
        </div>
      </header>

      <section className="evidence-hero" aria-labelledby="evidence-page-title">
        <div>
          <p className="evidence-eyebrow">The missing layer between product claims and decisions</p>
          <h1 id="evidence-page-title">If the web cannot prove it, ask the product.</h1>
          <p className="evidence-hero-copy">
            ChatGPT searches public product videos for a shopper’s exact question. If none proves
            it, ChatGPT creates the smallest useful filming request; a person with the product
            records it, and the answer changes with a timestamped citation.
          </p>
        </div>
        <ol className="evidence-flow" aria-label="Complete product evidence loop">
          <li className="flow-complete">
            <span>1</span>
            <p>
              <strong>Ask</strong>
              Any product question
            </p>
          </li>
          <li className={evidenceCase?.discovery === null ? 'flow-current' : 'flow-complete'}>
            <span>2</span>
            <p>
              <strong>Find the gap</strong>
              Claims are not proof
            </p>
          </li>
          <li
            className={
              evidenceCase?.discovery === null
                ? 'flow-waiting'
                : evidenceCase?.mission === null
                  ? 'flow-current'
                  : 'flow-complete'
            }
          >
            <span>3</span>
            <p>
              <strong>Film</strong>
              One bounded mission
            </p>
          </li>
          <li className={answerChanged ? 'flow-complete' : 'flow-waiting'}>
            <span>4</span>
            <p>
              <strong>Update</strong>
              Evidence changes answer
            </p>
          </li>
        </ol>
      </section>

      <section className="evidence-agent-brief" aria-labelledby="agent-brief-title">
        <div>
          <small>Try the native agent path</small>
          <strong id="agent-brief-title">Let ChatGPT direct the missing proof.</strong>
          <p>{agentStarter}</p>
        </div>
        <button type="button" onClick={() => void copyAgentStarter()}>
          {copyStatus === 'copied' ? 'Prompt copied ✓' : 'Copy ChatGPT prompt'}
        </button>
        <span role="status" aria-live="polite">
          {copyStatus === 'error' ? 'Clipboard unavailable—select the prompt.' : null}
        </span>
      </section>

      <section className="evidence-main-grid" aria-label="Product evidence case">
        <article className="evidence-case-panel evidence-panel">
          <div className="evidence-section-heading">
            <span>
              <small>Active question</small>
              <strong>{evidenceCase?.product.name ?? 'No product selected'}</strong>
            </span>
            <em>revision {state.revision}</em>
          </div>
          <blockquote>{evidenceCase?.question.text ?? 'Ask a question to begin.'}</blockquote>

          <div className={`evidence-answer answer-${answer?.status ?? 'insufficient'}`}>
            <span aria-hidden="true">{answer?.status === 'supported' ? '✓' : '?'}</span>
            <div>
              <small>Current answer</small>
              <strong>{answer === null ? 'No answer yet' : answerLabels[answer.status]}</strong>
              <p>{answer?.summary}</p>
            </div>
          </div>

          {answerChanged ? (
            <div className="evidence-before-after" aria-label="Evidence-caused answer change">
              <span>
                <small>Before</small>
                <strong>
                  {beforeAnswer === null ? 'None' : answerLabels[beforeAnswer.status]}
                </strong>
              </span>
              <b aria-hidden="true">→</b>
              <span>
                <small>After reviewed video</small>
                <strong>{answer === null ? 'None' : answerLabels[answer.status]}</strong>
              </span>
            </div>
          ) : null}

          <section className="evidence-sources" aria-labelledby="sources-title">
            <div className="evidence-section-heading compact">
              <span>
                <small>Claim-aware index</small>
                <strong id="sources-title">What the current sources actually show</strong>
              </span>
              <em>{sources.length}</em>
            </div>
            {evidenceCase?.discovery === null ? (
              <div className="evidence-search-strip">
                <div>
                  <strong>Search public video before requesting new footage.</strong>
                  <p>TikTok, Instagram Reels, and YouTube results stay link-only until reviewed.</p>
                </div>
                <button
                  className="evidence-secondary-button"
                  type="button"
                  disabled={searchPhase === 'searching'}
                  onClick={() => void searchEvidence('human')}
                >
                  {searchPhase === 'searching'
                    ? 'Searching three platforms…'
                    : 'Search existing evidence'}
                </button>
              </div>
            ) : (
              <div className="evidence-search-receipt">
                <span>{evidenceCase?.discovery.status === 'unavailable' ? '○' : '✓'}</span>
                <p>
                  <strong>
                    {evidenceCase?.discovery.status === 'unavailable'
                      ? 'Live social search unavailable'
                      : `${evidenceCase?.discovery.searchedPlatforms.length ?? 0} public platforms searched`}
                  </strong>
                  <small>
                    {evidenceCase?.discovery.sourceIds.length ?? 0} discovered source
                    {(evidenceCase?.discovery.sourceIds.length ?? 0) === 1 ? '' : 's'} · public
                    leads never count as proof
                  </small>
                </p>
              </div>
            )}
            {searchError === null ? null : <p role="alert">{searchError}</p>}
            {sources.length === 0 ? (
              <p className="evidence-empty">
                No public source has been supplied for this case yet.
              </p>
            ) : (
              <ul>
                {sources.map((source) => {
                  const observations = allObservations.filter(
                    ({ citation }) => citation.sourceId === source.id,
                  );
                  return (
                    <li key={source.id}>
                      <div className="evidence-source-heading">
                        <span aria-hidden="true">{source.mediaType === 'video' ? '▶' : '↗'}</span>
                        <p>
                          <strong>{source.title}</strong>
                          <small>
                            {source.mediaType.replaceAll('_', ' ')} ·{' '}
                            {source.provenance.replaceAll('_', ' ')}
                          </small>
                        </p>
                        <em>{source.rights.replaceAll('_', ' ')}</em>
                      </div>
                      {observations.map((observation) => (
                        <div className="evidence-observation" key={observation.id}>
                          <span className={`observation-${observation.result}`}>
                            {observation.result}
                          </span>
                          <p>{observation.text}</p>
                          <code>
                            {citationSeconds(
                              observation.citation.startSeconds,
                              observation.citation.endSeconds,
                              observation.citation.label,
                            )}{' '}
                            · {observation.confidence} confidence
                          </code>
                        </div>
                      ))}
                      {source.url !== null || source.streamUid !== null ? (
                        <div className="evidence-source-media">
                          {source.url === null ? (
                            <span />
                          ) : (
                            <a href={source.url} target="_blank" rel="noreferrer">
                              Watch cited source ↗
                            </a>
                          )}
                          {source.streamUid === null ? null : (
                            <code>Cloudflare Stream {source.streamUid.slice(0, 12)}…</code>
                          )}
                        </div>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </article>

        <article className="evidence-mission-panel evidence-panel">
          <div className="evidence-section-heading">
            <span>
              <small>Human sensor handoff</small>
              <strong>Film the smallest missing fact</strong>
            </span>
            <em>{mission?.status ?? 'not created'}</em>
          </div>

          {mission === null && evidenceCase?.discovery === null ? (
            <div className="mission-empty">
              <span aria-hidden="true">⌕</span>
              <h2>First, search what the public web already shows.</h2>
              <p>
                If the best existing videos still cannot answer this exact question, the missing
                shot becomes obvious.
              </p>
              <button
                className="evidence-primary-button"
                type="button"
                disabled={searchPhase === 'searching'}
                onClick={() => void searchEvidence('human')}
              >
                {searchPhase === 'searching' ? 'Searching…' : 'Search before filming'}
              </button>
            </div>
          ) : mission === null ? (
            <div className="mission-empty">
              <span aria-hidden="true">◎</span>
              <h2>The current sources still do not show the answer.</h2>
              <p>
                ChatGPT can now create a bounded mission whose schema contains only the recording
                instruction and acceptance check.
              </p>
              <button className="evidence-primary-button" type="button" onClick={createMission}>
                Create claim-specific filming mission
              </button>
            </div>
          ) : (
            <div className="mission-card">
              <div className="mission-card-head">
                <span aria-hidden="true">REC</span>
                <p>
                  <small>Mission {mission.id}</small>
                  <strong>{mission.minimumSeconds}s continuous take</strong>
                </p>
              </div>
              <dl>
                <div>
                  <dt>Record</dt>
                  <dd>{mission.instruction}</dd>
                </div>
                <div>
                  <dt>Keep visible</dt>
                  <dd>{mission.successCriterion}</dd>
                </div>
                <div>
                  <dt>Cuts</dt>
                  <dd>
                    {mission.continuousTakeRequired
                      ? 'Not allowed for this claim'
                      : 'Allowed when disclosed'}
                  </dd>
                </div>
              </dl>

              {mission.status === 'open' ? (
                <div className="mission-open-paths">
                  {phoneConnection === null ? (
                    <div className="mission-phone-start">
                      <div>
                        <small>Real two-person path</small>
                        <strong>Put this exact mission on any phone.</strong>
                        <p>
                          Create a no-login QR link. The contributor records, uploads directly to
                          Cloudflare Stream, reviews what it shows, and this answer updates live.
                        </p>
                      </div>
                      <button
                        className="evidence-primary-button"
                        type="button"
                        disabled={serviceUrl === null || phonePhase === 'connecting'}
                        onClick={() => void createPhoneCapture()}
                      >
                        {phonePhase === 'connecting'
                          ? 'Creating shared case…'
                          : serviceUrl === null
                            ? 'Phone service not configured'
                            : 'Create phone capture link'}
                      </button>
                      {phoneError === null ? null : <p role="alert">{phoneError}</p>}
                    </div>
                  ) : (
                    <div className="mission-phone-live">
                      <div className="mission-phone-qr" aria-label="Contributor link QR code">
                        <QRCodeSVG
                          value={phoneConnection.receipt.contributorUrl}
                          size={132}
                          bgColor="transparent"
                          fgColor="#ecf5ef"
                          level="M"
                        />
                      </div>
                      <div>
                        <small>Live case {phoneConnection.receipt.caseId}</small>
                        <strong>Scan with a phone that has the product.</strong>
                        <p>
                          {phonePhase === 'complete'
                            ? 'Reviewed video arrived and changed the shared evidence state.'
                            : 'Waiting through a hibernating Cloudflare Durable Object. No account is required.'}
                        </p>
                        <a
                          href={phoneConnection.receipt.contributorUrl}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Open contributor link ↗
                        </a>
                      </div>
                    </div>
                  )}

                  {phoneConnection === null && isDemoCase ? (
                    <div className="mission-replay">
                      <div>
                        <small>Judge-safe fallback</small>
                        <strong>Replay a completed rights-clean mission</strong>
                        <p>
                          This deterministic lower rung is explicitly labeled and exercises the same
                          reviewed-evidence transition without a second device.
                        </p>
                      </div>
                      <div className="mission-replay-actions">
                        <button
                          className="evidence-primary-button"
                          type="button"
                          onClick={() => publishReplay('supports')}
                        >
                          Replay: test passed
                        </button>
                        <button
                          className="evidence-danger-button"
                          type="button"
                          onClick={() => publishReplay('contradicts')}
                        >
                          Replay: test failed
                        </button>
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : (
                <div className="mission-complete">
                  <span aria-hidden="true">✓</span>
                  <p>
                    <strong>Reviewed evidence published</strong>
                    {sources.at(-1)?.provenance === 'live_capture'
                      ? 'A real contributor video fulfilled the mission through the bounded phone capability.'
                      : 'The deterministic evidence is explicitly labeled as a replay rather than a live capture.'}
                  </p>
                </div>
              )}
            </div>
          )}

          <p className="evidence-result-message" role="status" aria-live="polite">
            {lastMessage}
          </p>
        </article>

        <aside className="evidence-tools-panel evidence-panel" aria-label="Live Site Tool contract">
          <div className="evidence-section-heading">
            <span>
              <small>Page-owned WebMCP contract</small>
              <strong>Tools available now</strong>
            </span>
            <em>{availableToolNames.length}</em>
          </div>
          <p className="evidence-tool-status">{siteToolStatus.message}</p>
          <ul className="evidence-tool-list">
            {availableToolNames.map((name) => (
              <li key={name}>
                <span aria-hidden="true">{name.startsWith('inspect') ? '○' : '◇'}</span>
                <code>{name}</code>
                <small>
                  {siteToolStatus.registeredNames.includes(name) ? 'registered' : 'page contract'}
                </small>
              </li>
            ))}
          </ul>
          <p className="evidence-contract-note">
            Mission creation disappears when its job is done. A bounded phone-link tool appears for
            an open mission; answer-diff inspection appears only after reviewed evidence arrives.
          </p>

          <section className="evidence-privacy" aria-labelledby="privacy-title">
            <small>Private-context membrane</small>
            <strong id="privacy-title">The page accepts only three public fields</strong>
            <p>Product name · optional product URL · observable product question</p>
            <ul>
              <li>No identity</li>
              <li>No budget</li>
              <li>No purchase history</li>
              <li>No private preference profile</li>
            </ul>
          </section>
        </aside>
      </section>

      <section className="evidence-try-panel evidence-panel" aria-labelledby="try-title">
        <div>
          <p className="evidence-eyebrow">Use anything nearby</p>
          <h2 id="try-title">Open a case for a product we have never seen.</h2>
          <p>
            This is data, not code: changing the product creates a new case with the same evidence
            and WebMCP contract.
          </p>
        </div>
        <form onSubmit={submitQuestion}>
          <label>
            Product
            <input
              required
              minLength={2}
              maxLength={120}
              value={productName}
              onChange={(event) => setProductName(event.currentTarget.value)}
            />
          </label>
          <label>
            Public product URL <small>optional</small>
            <input
              type="url"
              placeholder="https://…"
              value={productUrl}
              onChange={(event) => setProductUrl(event.currentTarget.value)}
            />
          </label>
          <label className="question-field">
            What do you need to know?
            <textarea
              required
              minLength={8}
              maxLength={280}
              value={question}
              onChange={(event) => setQuestion(event.currentTarget.value)}
            />
          </label>
          <button className="evidence-secondary-button" type="submit">
            Open new evidence case
          </button>
        </form>
      </section>

      <section className="evidence-activity evidence-panel" aria-labelledby="activity-title">
        <div className="evidence-section-heading compact">
          <span>
            <small>Shared, attributable state</small>
            <strong id="activity-title">What people and agents changed</strong>
          </span>
        </div>
        <ol>
          {[...state.activity].reverse().map((event) => (
            <li key={event.id}>
              <span>{actorLabel(event.actor)}</span>
              <p>
                <strong>{event.action.replaceAll('_', ' ')}</strong>
                {event.summary}
              </p>
              <small>r{event.id.split('-').at(-1)}</small>
            </li>
          ))}
        </ol>
      </section>
    </main>
  );
}
