'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { QRCodeSVG } from 'qrcode.react';

import { discoverProductEvidence } from '@/lib/evidence-network/discovery-client';
import {
  applyEvidenceNetworkCommand,
  attachDemoProductPageUrl,
  createDemoEvidenceQuestionState,
  currentEvidenceAnswer,
  getEvidenceNetworkToolNames,
  initialEvidenceAnswer,
  type EvidenceAnswerStatus,
  type EvidenceNetworkCommand,
  type EvidenceNetworkState,
  type EvidenceNetworkTransition,
  type EvidenceDiscoveryInput,
  type EvidenceDiscoveryPlatform,
  type EvidenceDiscoveryProvider,
  type FilmingMissionInput,
  type ProductQuestionInput,
  type ProductEvidenceCase,
} from '@/lib/evidence-network/model';
import {
  createEvidenceNetworkStateFromHandoff,
  evidenceCaseHandoffSource,
  type EvidenceCaseHandoff,
} from '@/lib/evidence-network/case-handoff';
import { demoProduct } from '@/lib/evidence-network/demo-product';
import {
  configuredEvidenceServiceUrl,
  contributorPath,
  createRemoteEvidenceCase,
  publishPublicEvidenceMission,
  remoteEvidenceWebSocketUrl,
  removePublicEvidenceMission,
} from '@/lib/evidence-network/remote-client';
import {
  parseRemoteEvidenceServerMessage,
  type CreateRemoteEvidenceCaseRequest,
  type PublicEvidenceMission,
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
import { isPublicHttpUrl } from '@/lib/evidence-network/url-policy';
import { useDynamicSiteTools } from '@/lib/webmcp/use-dynamic-site-tools';

const defaultMission = demoProduct.mission;

const agentStarter =
  'Use this page’s Site Tools. Inspect the active product question and search existing evidence. Treat ordinary web results as leads, never proof; only rights-cleared, human-reviewed network recordings may change the answer. If the sources still do not prove it, create the smallest continuous filming mission, inspect it, and refine it if its acceptance boundary is ambiguous. Then create a phone capture link and publish only that mission’s public product, question, and filming fields to the open request board. This is my explicit confirmation to publish those fields—never my identity, preferences, history, budget, or conversation. Do not infer the result. Stop before anyone records; after reviewed evidence arrives, inspect exactly how the answer changed.';

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

function discoveryProviderReceipt(
  provider: EvidenceDiscoveryProvider,
  platforms: readonly EvidenceDiscoveryPlatform[],
  warnings: readonly string[],
  hasSuppliedProductPage: boolean,
  reusableSourceCount: number,
  pageReaderUsed: boolean,
): string {
  if (provider === 'rights_clean_demo') {
    return 'Rights-clean demo fixture';
  }
  if (provider === 'scrapecreators') {
    return 'ScrapeCreators social search';
  }
  if (provider === 'vercel_ai_gateway') {
    return 'Exa through Vercel AI Gateway';
  }
  const providers: string[] = [];
  if (reusableSourceCount > 0) {
    providers.push('Cloudflare D1');
  }
  if (pageReaderUsed) {
    providers.push('Cloudflare Browser Run');
  }
  if (platforms.some((platform) => platform !== 'web')) {
    providers.push('ScrapeCreators');
  }
  const gatewayFailed = warnings.some((warning) => /gateway|broad web search/iu.test(warning));
  if (platforms.includes('web') && !gatewayFailed) {
    providers.push('Exa through Vercel AI Gateway');
  }
  if (providers.length === 1 && providers[0] === 'Cloudflare D1') {
    return 'Cloudflare D1 reusable evidence';
  }
  if (providers.length > 0) {
    return [...new Set(providers)].join(' + ');
  }
  return hasSuppliedProductPage ? 'Supplied product page retained' : 'No live provider completed';
}

function isRightsCleanBottleDemo(evidenceCase: ProductEvidenceCase | null | undefined): boolean {
  return (
    evidenceCase?.id === 'case-1' &&
    evidenceCase?.product.name === 'Everyday insulated travel bottle' &&
    evidenceCase.sources.some(
      ({ id, title, rights, provenance }) =>
        id === 'source-1' &&
        title === 'Rights-cleared demo product page' &&
        rights === 'owned' &&
        provenance === 'authored_fixture',
    )
  );
}

function attachCurrentDemoProductPage(
  state: EvidenceNetworkState,
  locationHref: string,
): EvidenceNetworkState {
  const demoProductUrl = new URL('/demo-product', locationHref);
  return demoProductUrl.protocol === 'https:' && isPublicHttpUrl(demoProductUrl.toString())
    ? attachDemoProductPageUrl(state, demoProductUrl.toString())
    : state;
}

interface MissionRefinementEditorProps {
  readonly mission: FilmingMissionInput;
  readonly refine: (input: FilmingMissionInput) => Promise<EvidenceNetworkTransition>;
}

function MissionRefinementEditor({
  mission,
  refine,
}: MissionRefinementEditorProps): React.JSX.Element {
  const [draft, setDraft] = useState<FilmingMissionInput>(() => ({
    instruction: mission.instruction,
    successCriterion: mission.successCriterion,
    minimumSeconds: mission.minimumSeconds,
    continuousTakeRequired: mission.continuousTakeRequired,
  }));
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const result = await refine(draft);
    if (!result.ok) {
      setError(result.message);
    }
  }

  return (
    <details className="mission-refinement">
      <summary>Refine this mission before sharing</summary>
      <form onSubmit={(event) => void submit(event)}>
        <label>
          Recording instruction
          <textarea
            required
            minLength={8}
            maxLength={280}
            value={draft.instruction}
            onChange={(event) => {
              const instruction = event.currentTarget.value;
              setDraft((current) => ({ ...current, instruction }));
            }}
          />
        </label>
        <label>
          Acceptance boundary
          <textarea
            required
            minLength={8}
            maxLength={280}
            value={draft.successCriterion}
            onChange={(event) => {
              const successCriterion = event.currentTarget.value;
              setDraft((current) => ({ ...current, successCriterion }));
            }}
          />
        </label>
        <div className="mission-refinement-row">
          <label>
            Minimum seconds
            <input
              type="number"
              min={2}
              max={60}
              value={draft.minimumSeconds}
              onChange={(event) => {
                const value = Number.parseInt(event.currentTarget.value, 10);
                if (!Number.isNaN(value)) {
                  setDraft((current) => ({ ...current, minimumSeconds: value }));
                }
              }}
            />
          </label>
          <label className="mission-refinement-check">
            <input
              type="checkbox"
              checked={draft.continuousTakeRequired}
              onChange={(event) => {
                const continuousTakeRequired = event.currentTarget.checked;
                setDraft((current) => ({ ...current, continuousTakeRequired }));
              }}
            />
            Require one continuous take
          </label>
        </div>
        <button className="evidence-secondary-button" type="submit">
          Save refined mission
        </button>
        {error === null ? null : <p role="alert">{error}</p>}
        <small>
          This remains local until a phone link is created. The random fresh-capture phrase stays
          unchanged.
        </small>
      </form>
    </details>
  );
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
  const isDemoFixture = isRightsCleanBottleDemo(evidenceCase);
  const discovery = remoteDiscoveryForState(state);
  return isDemoFixture
    ? {
        seed: 'travel_bottle',
        ...(discovery === undefined ? {} : { discovery }),
        mission: missionInput,
      }
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

function phoneConnectionMatchesHandoff(
  connection: EvidencePhoneConnection,
  handoff: EvidenceCaseHandoff,
): boolean {
  const evidenceCase = connection.credentials.state.activeCase;
  return (
    evidenceCase?.product.name === handoff.question.productName &&
    evidenceCase.product.suppliedUrl === (handoff.question.productUrl ?? null) &&
    evidenceCase.question.text === handoff.question.question
  );
}

interface ProductEvidenceNetworkProps {
  readonly initialHandoff?: EvidenceCaseHandoff;
}

export function ProductEvidenceNetwork({
  initialHandoff,
}: ProductEvidenceNetworkProps = {}): React.JSX.Element {
  const [state, setState] = useState<EvidenceNetworkState>(() =>
    initialHandoff === undefined
      ? createDemoEvidenceQuestionState()
      : createEvidenceNetworkStateFromHandoff(initialHandoff),
  );
  const [lastMessage, setLastMessage] = useState(
    initialHandoff === undefined
      ? 'One source was indexed. Its marketing claim does not prove the physical behavior.'
      : 'The product page opened this exact evidence question without carrying private shopping context.',
  );
  const [productName, setProductName] = useState(
    initialHandoff?.question.productName ?? 'USB-C lavalier microphone',
  );
  const [productUrl, setProductUrl] = useState(initialHandoff?.question.productUrl ?? '');
  const [question, setQuestion] = useState(
    initialHandoff?.question.question ??
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
  const [boardConsent, setBoardConsent] = useState(false);
  const [boardPhase, setBoardPhase] = useState<
    'idle' | 'publishing' | 'published' | 'removing' | 'removed' | 'error'
  >('idle');
  const [boardError, setBoardError] = useState<string | null>(null);
  const serviceUrl = configuredEvidenceServiceUrl();
  const stateRef = useRef(state);
  const phoneConnectionRef = useRef(phoneConnection);

  useEffect(() => {
    if (initialHandoff !== undefined) {
      return;
    }
    const nextState = attachCurrentDemoProductPage(stateRef.current, window.location.href);
    if (nextState === stateRef.current) {
      return;
    }
    stateRef.current = nextState;
    setState(nextState);
  }, [initialHandoff]);

  const clearPhoneConnection = useCallback((): void => {
    clearEvidencePhoneConnection(window.sessionStorage);
    phoneConnectionRef.current = null;
    setPhoneConnection(null);
    setPhonePhase('idle');
    setPhoneError(null);
    setBoardConsent(false);
    setBoardPhase('idle');
    setBoardError(null);
  }, []);

  const revokeOpenPublicMission = useCallback(async (): Promise<PublicEvidenceMission | null> => {
    const connection = phoneConnectionRef.current;
    const publicMission = connection?.publicMission;
    if (publicMission?.status !== 'open') {
      return null;
    }
    if (serviceUrl === null || connection === null) {
      throw new Error('The public filming request cannot be removed without its evidence service.');
    }
    setBoardPhase('removing');
    setBoardError(null);
    try {
      const removedMission = await removePublicEvidenceMission(serviceUrl, publicMission.id, {
        ownerToken: connection.credentials.ownerToken,
        confirmRemoval: true,
      });
      const updatedConnection: EvidencePhoneConnection = {
        ...connection,
        publicMission: removedMission,
      };
      phoneConnectionRef.current = updatedConnection;
      setPhoneConnection(updatedConnection);
      persistEvidencePhoneConnection(
        window.sessionStorage,
        serviceUrl,
        window.location.origin,
        updatedConnection,
      );
      setBoardPhase('removed');
      return removedMission;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      setBoardError(message);
      setBoardPhase('error');
      throw error;
    }
  }, [serviceUrl]);

  const readState = useCallback((): EvidenceNetworkState => stateRef.current, []);
  const dispatch = useCallback(
    async (command: EvidenceNetworkCommand): Promise<EvidenceNetworkTransition> => {
      let result = applyEvidenceNetworkCommand(stateRef.current, command);
      if (result.ok && command.kind === 'ask-product-question') {
        try {
          await revokeOpenPublicMission();
        } catch {
          const preserved = {
            ok: false,
            state: stateRef.current,
            message:
              'The existing public filming request could not be removed, so this case was preserved.',
          } satisfies EvidenceNetworkTransition;
          setLastMessage(preserved.message);
          return preserved;
        }
        // A contributor may have updated the durable case while public cleanup was in flight.
        // Reapply the new question to the freshest local snapshot instead of committing stale state.
        result = applyEvidenceNetworkCommand(stateRef.current, command);
      }
      if (result.ok && ['ask-product-question', 'create-filming-mission'].includes(command.kind)) {
        clearPhoneConnection();
      }
      if (result.ok && command.kind === 'ask-product-question' && initialHandoff !== undefined) {
        window.history.replaceState(window.history.state, '', '/');
      }
      stateRef.current = result.state;
      setState(result.state);
      setLastMessage(result.message);
      return result;
    },
    [clearPhoneConnection, initialHandoff, revokeOpenPublicMission],
  );
  const refineMission = useCallback(
    async (input: FilmingMissionInput): Promise<EvidenceNetworkTransition> => {
      if (phoneConnectionRef.current !== null) {
        return {
          ok: false,
          state: stateRef.current,
          message:
            'A contributor link already exists. The filming target is locked for this handoff.',
        };
      }
      return dispatch({
        kind: 'refine-filming-mission',
        actor: 'human',
        input: {
          ...input,
          expectedRevision: stateRef.current.revision,
        },
      });
    },
    [dispatch],
  );
  const createPhoneCapture = useCallback(async (): Promise<EvidencePhoneCaptureReceipt> => {
    const existing = phoneConnectionRef.current;
    if (existing !== null) {
      return existing.receipt;
    }
    if (serviceUrl === null) {
      throw new Error('The shared evidence service is not configured on this deployment.');
    }
    if (initialHandoff !== undefined) {
      const restored = restoreEvidencePhoneConnection(
        window.sessionStorage,
        serviceUrl,
        window.location.origin,
      );
      if (restored !== null) {
        if (!phoneConnectionMatchesHandoff(restored, initialHandoff)) {
          const message =
            'A different live evidence case is still connected in this tab. Return home and reset or finish it before replacing its private capability.';
          setPhoneError(message);
          setPhonePhase('error');
          throw new Error(message);
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
        return restored.receipt;
      }
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
  }, [initialHandoff, serviceUrl]);

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
    if (initialHandoff !== undefined && !phoneConnectionMatchesHandoff(restored, initialHandoff)) {
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
  }, [initialHandoff, serviceUrl]);
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
  const publishMissionToBoard = useCallback(async (): Promise<PublicEvidenceMission> => {
    const connection = phoneConnectionRef.current;
    if (serviceUrl === null || connection === null) {
      throw new Error('Create the bounded phone case before publishing its filming mission.');
    }
    if (connection.publicMission?.status === 'open') {
      return connection.publicMission;
    }
    setBoardPhase('publishing');
    setBoardError(null);
    try {
      const publicMission = await publishPublicEvidenceMission(serviceUrl, {
        missionId: crypto.randomUUID(),
        caseId: connection.credentials.caseId,
        ownerToken: connection.credentials.ownerToken,
        contributorToken: connection.credentials.contributorToken,
        confirmPublicListing: true,
      });
      const updatedConnection: EvidencePhoneConnection = { ...connection, publicMission };
      phoneConnectionRef.current = updatedConnection;
      setPhoneConnection(updatedConnection);
      persistEvidencePhoneConnection(
        window.sessionStorage,
        serviceUrl,
        window.location.origin,
        updatedConnection,
      );
      setBoardPhase('published');
      setBoardConsent(false);
      return publicMission;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      setBoardError(message);
      setBoardPhase('error');
      throw error;
    }
  }, [serviceUrl]);
  const removeMissionFromBoard = useCallback(async (): Promise<PublicEvidenceMission> => {
    const removedMission = await revokeOpenPublicMission();
    if (removedMission === null) {
      throw new Error('There is no active public filming mission to remove.');
    }
    return removedMission;
  }, [revokeOpenPublicMission]);
  const missionBoardRuntime = useMemo(
    () => ({
      available: serviceUrl !== null,
      current: (): PublicEvidenceMission | null => {
        const publicMission = phoneConnectionRef.current?.publicMission;
        return publicMission?.status === 'open' ? publicMission : null;
      },
      publish: publishMissionToBoard,
      remove: removeMissionFromBoard,
    }),
    [publishMissionToBoard, removeMissionFromBoard, serviceUrl],
  );
  const siteToolRuntime = useMemo<EvidenceSiteToolRuntime>(
    () => ({
      readState,
      dispatch,
      evidenceSearch: evidenceSearchRuntime,
      phoneCapture: phoneCaptureRuntime,
      missionBoard: missionBoardRuntime,
    }),
    [dispatch, evidenceSearchRuntime, missionBoardRuntime, phoneCaptureRuntime, readState],
  );
  const createTools = useCallback(
    () => createEvidenceSiteTools(siteToolRuntime),
    [siteToolRuntime],
  );
  const availableToolNames = [...getEvidenceNetworkToolNames(state)];
  if (phoneConnection === null && state.activeCase?.mission?.status === 'open') {
    availableToolNames.push('refine_filming_mission');
  }
  if (
    serviceUrl !== null &&
    phoneConnection === null &&
    state.activeCase?.mission?.status === 'open'
  ) {
    availableToolNames.push('create_phone_capture_link');
  }
  if (
    serviceUrl !== null &&
    phoneConnection !== null &&
    state.activeCase?.mission?.status === 'open'
  ) {
    if (phoneConnection.publicMission?.status === 'open') {
      availableToolNames.push('remove_public_filming_mission');
    } else {
      availableToolNames.push('publish_filming_mission');
    }
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
          const liveConnection = phoneConnectionRef.current;
          if (liveConnection?.publicMission?.status === 'open') {
            const completedConnection: EvidencePhoneConnection = {
              ...liveConnection,
              publicMission: {
                ...liveConnection.publicMission,
                status: 'fulfilled',
                fulfilledAt: new Date().toISOString(),
              },
            };
            phoneConnectionRef.current = completedConnection;
            setPhoneConnection(completedConnection);
            persistEvidencePhoneConnection(
              window.sessionStorage,
              serviceUrl,
              window.location.origin,
              completedConnection,
            );
          }
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
  const hasSuppliedProductPage =
    evidenceCase?.product.suppliedUrl !== null && evidenceCase?.product.suppliedUrl !== undefined;
  const discoveryCandidateCount =
    evidenceCase?.discovery?.sourceIds.length ?? (hasSuppliedProductPage ? 1 : 0);
  const reusableSourceCount = sources.filter(
    ({ reuseScope }) => reuseScope === 'public_network',
  ).length;
  const pageReaderUsed = allObservations.some(
    ({ reviewedBy }) => reviewedBy === 'Product page · Cloudflare Browser Run',
  );
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

  async function resetDemo(): Promise<void> {
    try {
      await revokeOpenPublicMission();
    } catch {
      setLastMessage(
        'Reset stopped because the current public filming request could not be removed. Try again or remove it explicitly.',
      );
      return;
    }
    const nextState = attachCurrentDemoProductPage(
      createDemoEvidenceQuestionState(),
      window.location.href,
    );
    stateRef.current = nextState;
    setState(nextState);
    setLastMessage('Demo reset to one indexed source and one unresolved product question.');
    setCopyStatus('idle');
    setSearchPhase('idle');
    setSearchError(null);
    clearPhoneConnection();
    if (initialHandoff !== undefined) {
      window.history.replaceState(window.history.state, '', '/');
    }
  }

  function submitQuestion(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
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
    const isBottleDemo =
      isRightsCleanBottleDemo(activeCase) ||
      (initialHandoff?.source === evidenceCaseHandoffSource &&
        activeCase?.product.name === demoProduct.name &&
        activeCase.question.text === demoProduct.question);
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

  return (
    <main className="evidence-shell">
      <header className="evidence-topbar">
        <div className="evidence-brand">
          <span className="evidence-brand-mark" aria-hidden="true">
            ●
          </span>
          <span>
            <strong>Film the Gap</strong>
            <small>Ask the web. Film only what is missing.</small>
          </span>
        </div>
        <div className="evidence-topbar-actions">
          <Link className="evidence-quiet-link" href="/missions">
            Open filming requests
          </Link>
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
          <button
            className="evidence-quiet-button"
            type="button"
            disabled={boardPhase === 'removing'}
            onClick={() => void resetDemo()}
          >
            {boardPhase === 'removing' ? 'Cleaning public request…' : 'Reset proof loop'}
          </button>
        </div>
      </header>

      <section className="evidence-hero" aria-labelledby="evidence-page-title">
        <div>
          <p className="evidence-eyebrow">The missing layer between product claims and decisions</p>
          <h1 id="evidence-page-title">
            If the web cannot prove it, ask someone with the product to film it.
          </h1>
          <p className="evidence-hero-copy">
            ChatGPT searches reviewed network evidence, product pages, public videos, and the open
            web for a shopper’s exact question. If none proves it, ChatGPT creates the smallest
            useful filming request; a person with the product records it, and the answer changes
            with a timestamped citation.
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
                : answerChanged
                  ? 'flow-complete'
                  : evidenceCase?.mission === null
                    ? 'flow-current'
                    : 'flow-complete'
            }
          >
            <span>3</span>
            <p>
              <strong>Find or film</strong>
              Record each fact once
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
                <small>Evidence found so far</small>
                <strong id="sources-title">What the current sources actually show</strong>
              </span>
              <em>{sources.length}</em>
            </div>
            {evidenceCase === null || evidenceCase.discovery === null ? (
              <div className="evidence-search-strip">
                <div>
                  <strong>Search existing sources before requesting new footage.</strong>
                  <p>
                    Product pages, public social video, and open-web results stay link-only until
                    reviewed.
                  </p>
                </div>
                <button
                  className="evidence-secondary-button"
                  type="button"
                  disabled={searchPhase === 'searching'}
                  onClick={() => void searchEvidence('human')}
                >
                  {searchPhase === 'searching'
                    ? 'Searching public sources…'
                    : 'Search existing evidence'}
                </button>
              </div>
            ) : (
              <div className="evidence-search-receipt">
                <span>
                  {evidenceCase.discovery.status === 'unavailable'
                    ? '○'
                    : evidenceCase.discovery.status === 'partial'
                      ? '◐'
                      : '✓'}
                </span>
                <p>
                  <strong>
                    {reusableSourceCount > 0
                      ? `${reusableSourceCount} reusable reviewed recording${reusableSourceCount === 1 ? '' : 's'} found`
                      : evidenceCase.discovery.status === 'unavailable'
                        ? 'Live public search unavailable'
                        : evidenceCase.discovery.status === 'partial'
                          ? evidenceCase.discovery.searchedPlatforms.length === 0 &&
                            hasSuppliedProductPage
                            ? 'Only the supplied product page is available'
                            : `${evidenceCase.discovery.searchedPlatforms.length} source ${evidenceCase.discovery.searchedPlatforms.length === 1 ? 'channel' : 'channels'} searched; others unavailable`
                          : `${evidenceCase.discovery.searchedPlatforms.length} public source ${evidenceCase.discovery.searchedPlatforms.length === 1 ? 'channel' : 'channels'} searched`}
                  </strong>
                  <small>
                    {discoveryProviderReceipt(
                      evidenceCase.discovery.provider,
                      evidenceCase.discovery.searchedPlatforms,
                      evidenceCase.discovery.warnings,
                      hasSuppliedProductPage,
                      reusableSourceCount,
                      pageReaderUsed,
                    )}{' '}
                    · {discoveryCandidateCount} candidate source
                    {discoveryCandidateCount === 1 ? '' : 's'} retained · unreviewed public leads
                    never count as proof
                  </small>
                  {evidenceCase.discovery.warnings.map((warning) => (
                    <small className="evidence-search-warning" key={warning}>
                      {warning}
                    </small>
                  ))}
                  {pageReaderUsed ? (
                    <small className="evidence-page-reader-receipt">
                      Cloudflare Browser Run read the supplied page as untrusted context; its copy
                      still cannot change the answer.
                    </small>
                  ) : null}
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
                            {source.provenance.replaceAll('_', ' ')} ·{' '}
                            {source.captureTiming.replaceAll('_', ' ')}
                            {source.reuseScope === 'public_network'
                              ? ' · reusable network evidence'
                              : ''}
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
                            · {observation.confidence} confidence · {observation.reviewedBy}
                          </code>
                        </div>
                      ))}
                      {source.url !== null || source.streamUid !== null ? (
                        <div className="evidence-source-media">
                          {source.url === null ? (
                            <span />
                          ) : (
                            <a
                              href={source.url}
                              target="_blank"
                              rel="noreferrer"
                              data-stream-uid={source.streamUid ?? undefined}
                            >
                              {source.mediaType === 'video'
                                ? 'Watch cited video ↗'
                                : 'Open source page ↗'}
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
              <small>Someone with the product</small>
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
          ) : mission === null && answer !== null && answer.status !== 'insufficient' ? (
            <div className="mission-empty mission-resolved">
              <span aria-hidden="true">✓</span>
              <h2>The evidence network already has a reviewed answer.</h2>
              <p>
                This recording was made once for the same product question. Its rights, human
                review, exact interval, and file receipt carried forward, so nobody needs to film it
                again.
              </p>
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
                <div>
                  <dt>Fresh-capture phrase</dt>
                  <dd>{mission.captureChallenge.phrase}</dd>
                </div>
              </dl>

              {mission.status === 'open' && phoneConnection === null ? (
                <MissionRefinementEditor
                  key={`${mission.id}:${state.revision}`}
                  mission={mission}
                  refine={refineMission}
                />
              ) : null}

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
                        onClick={() => {
                          void createPhoneCapture().catch(() => {
                            // The visible phone error is the human recovery path.
                          });
                        }}
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
                    <div className="mission-phone-stack">
                      <div className="mission-phone-live">
                        <div className="mission-phone-qr">
                          <QRCodeSVG
                            value={phoneConnection.receipt.contributorUrl}
                            size={132}
                            bgColor="transparent"
                            fgColor="#ecf5ef"
                            level="M"
                            title="Private contributor phone link QR code"
                          />
                        </div>
                        <div>
                          <small>Private live case {phoneConnection.receipt.caseId}</small>
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
                            Open private contributor link ↗
                          </a>
                        </div>
                      </div>

                      {phoneConnection.publicMission?.status === 'open' ? (
                        <div className="mission-board-receipt" role="status">
                          <div>
                            <small>Public request · expires automatically</small>
                            <strong>Anyone with this product can now record the answer.</strong>
                            <p>
                              Only the public product, question, and filming instructions are
                              listed. No shopper identity, preferences, history, or budget are
                              included.
                            </p>
                            <Link href={`/missions#mission-${phoneConnection.publicMission.id}`}>
                              View on open requests →
                            </Link>
                          </div>
                          <button
                            className="evidence-quiet-button"
                            type="button"
                            disabled={boardPhase === 'removing'}
                            onClick={() => {
                              void removeMissionFromBoard().catch(() => {
                                // The visible board error is the human recovery path.
                              });
                            }}
                          >
                            {boardPhase === 'removing' ? 'Removing…' : 'Remove public request'}
                          </button>
                        </div>
                      ) : mission.status === 'open' ? (
                        <div className="mission-board-opt-in">
                          <div>
                            <small>Do not know someone with the product?</small>
                            <strong>Ask the open evidence network.</strong>
                            <p>
                              Publish only this product question and filming recipe for up to 24
                              hours. A volunteer with the product can fulfill it from any phone.
                            </p>
                          </div>
                          <label>
                            <input
                              type="checkbox"
                              checked={boardConsent}
                              onChange={(event) => setBoardConsent(event.currentTarget.checked)}
                            />
                            I understand this product request will be public. No shopper context is
                            included.
                          </label>
                          <button
                            className="evidence-primary-button"
                            type="button"
                            disabled={!boardConsent || boardPhase === 'publishing'}
                            onClick={() => {
                              void publishMissionToBoard().catch(() => {
                                // The visible board error is the human recovery path.
                              });
                            }}
                          >
                            {boardPhase === 'publishing'
                              ? 'Publishing request…'
                              : 'Publish open filming request'}
                          </button>
                          {phoneConnection.publicMission?.status === 'removed' ? (
                            <p role="status">The previous public path was removed and revoked.</p>
                          ) : null}
                        </div>
                      ) : null}

                      {boardError === null ? null : <p role="alert">{boardError}</p>}
                    </div>
                  )}
                </div>
              ) : (
                <div className="mission-complete">
                  <span aria-hidden="true">✓</span>
                  <p>
                    <strong>Reviewed evidence published</strong>
                    {sources.at(-1)?.provenance === 'live_capture'
                      ? 'A real contributor video fulfilled the mission through the bounded phone capability.'
                      : 'The published source keeps its non-live provenance label.'}
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
              <small>Live WebMCP Site Tools</small>
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
            <small>Private context stays in ChatGPT</small>
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
