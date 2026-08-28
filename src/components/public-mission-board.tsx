'use client';

import Link from 'next/link';
import { QRCodeSVG } from 'qrcode.react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { z } from 'zod';

import {
  claimPublicEvidenceMission,
  configuredEvidenceServiceUrl,
  contributorPath,
  listPublicEvidenceMissions,
} from '@/lib/evidence-network/remote-client';
import {
  publicEvidenceMissionIdPattern,
  type PublicEvidenceMission,
} from '@/lib/evidence-network/remote-protocol';
import { useDynamicSiteTools } from '@/lib/webmcp/use-dynamic-site-tools';

interface ClaimedMission {
  readonly mission: PublicEvidenceMission;
  readonly contributorUrl: string;
}

const emptyObjectSchema = z.strictObject({});
const missionSelectionSchema = z.strictObject({
  missionId: z.string().regex(publicEvidenceMissionIdPattern),
});

const emptyInputSchema = {
  type: 'object',
  properties: {},
  additionalProperties: false,
} as const;

const missionSelectionJsonSchema = {
  type: 'object',
  properties: {
    missionId: {
      type: 'string',
      pattern: publicEvidenceMissionIdPattern.source,
      description: 'Identifier from inspect_open_filming_missions.',
    },
  },
  required: ['missionId'],
  additionalProperties: false,
} as const;

function formatExpiry(expiresAt: string): string {
  return new Intl.DateTimeFormat(undefined, {
    hour: 'numeric',
    minute: '2-digit',
    month: 'short',
    day: 'numeric',
  }).format(new Date(expiresAt));
}

export function PublicMissionBoard(): React.JSX.Element {
  const serviceUrl = configuredEvidenceServiceUrl();
  const [missions, setMissions] = useState<readonly PublicEvidenceMission[]>([]);
  const [phase, setPhase] = useState<'loading' | 'ready' | 'error'>('loading');
  const [message, setMessage] = useState('Loading open evidence requests…');
  const [claimingId, setClaimingId] = useState<string | null>(null);
  const [claimError, setClaimError] = useState<{
    readonly missionId: string;
    readonly message: string;
  } | null>(null);
  const [claimed, setClaimed] = useState<ClaimedMission | null>(null);

  const loadMissions = useCallback(async (): Promise<readonly PublicEvidenceMission[]> => {
    if (serviceUrl === null) {
      setMissions([]);
      setPhase('error');
      setMessage('The public evidence service is not configured on this deployment.');
      return [];
    }
    try {
      const result = await listPublicEvidenceMissions(serviceUrl);
      setMissions(result.missions);
      setPhase('ready');
      setMessage(
        result.missions.length === 0
          ? 'No unanswered requests are public right now.'
          : `${result.missions.length} unanswered recording ${result.missions.length === 1 ? 'request' : 'requests'}.`,
      );
      return result.missions;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      setPhase('error');
      setMessage(errorMessage);
      throw error;
    }
  }, [serviceUrl]);

  const claimMission = useCallback(
    async (missionId: string): Promise<ClaimedMission> => {
      if (serviceUrl === null) {
        throw new Error('The public evidence service is unavailable.');
      }
      setClaimingId(missionId);
      setClaimError(null);
      try {
        const claim = await claimPublicEvidenceMission(serviceUrl, missionId);
        const result = {
          mission: claim.mission,
          contributorUrl: new URL(
            contributorPath(claim.mission.caseId, claim.contributorToken),
            window.location.origin,
          ).toString(),
        };
        setClaimed(result);
        return result;
      } catch (error: unknown) {
        setClaimError({
          missionId,
          message: error instanceof Error ? error.message : String(error),
        });
        throw error;
      } finally {
        setClaimingId(null);
      }
    },
    [serviceUrl],
  );

  useEffect(() => {
    let active = true;
    queueMicrotask(() => {
      if (active) {
        void loadMissions().catch(() => {
          // The visible error state is the recovery path.
        });
      }
    });
    return () => {
      active = false;
    };
  }, [loadMissions]);

  const createTools = useCallback(
    (): readonly WebMCP.ModelContextTool[] => [
      {
        name: 'inspect_open_filming_missions',
        title: 'Inspect open product filming requests',
        description:
          'List current public requests for short, question-specific product videos. Returns public product and filming fields only; no shopper identity, preferences, history, or budget.',
        inputSchema: emptyInputSchema,
        annotations: { readOnlyHint: true, untrustedContentHint: true },
        execute: async (input, options): Promise<object> => {
          options?.signal?.throwIfAborted();
          const parsed = emptyObjectSchema.safeParse(input);
          if (!parsed.success) {
            return { ok: false, error: 'invalid_input', issues: parsed.error.issues };
          }
          const current = await loadMissions();
          return {
            ok: true,
            missions: current,
            privacyReceipt: {
              included: ['public product', 'product question', 'filming recipe', 'expiry'],
              excluded: ['shopper identity', 'preferences', 'history', 'budget'],
            },
          };
        },
      },
      {
        name: 'open_filming_mission',
        title: 'Open a public filming mission',
        description:
          'Open the bounded, no-login phone recorder for one public request. This does not reserve the request or publish evidence; the contributor must still record, review, and explicitly publish.',
        inputSchema: missionSelectionJsonSchema,
        annotations: { readOnlyHint: true, untrustedContentHint: true },
        execute: async (input, options): Promise<object> => {
          options?.signal?.throwIfAborted();
          const parsed = missionSelectionSchema.safeParse(input);
          if (!parsed.success) {
            return { ok: false, error: 'invalid_input', issues: parsed.error.issues };
          }
          const result = await claimMission(parsed.data.missionId);
          return {
            ok: true,
            mission: result.mission,
            contributorUrl: result.contributorUrl,
            next: 'Open contributorUrl on a phone with the product. Recording remains unpublished until the contributor reviews and confirms it.',
          };
        },
      },
    ],
    [claimMission, loadMissions],
  );
  const toolStatus = useDynamicSiteTools(createTools, serviceUrl === null ? 'offline' : 'online');

  const missionCountLabel = useMemo(
    () => (missions.length === 1 ? '1 open request' : `${missions.length} open requests`),
    [missions.length],
  );

  return (
    <main className="mission-board-shell">
      <header className="evidence-topbar">
        <Link className="evidence-brand mission-board-brand" href="/">
          <span className="evidence-brand-mark" aria-hidden="true">
            ●
          </span>
          <span>
            <strong>Open evidence requests</strong>
            <small>Own the product? Film the missing fact.</small>
          </span>
        </Link>
        <div className="evidence-topbar-actions">
          <span className={`evidence-runtime runtime-${toolStatus.phase}`}>
            <span aria-hidden="true" />
            {toolStatus.phase === 'ready'
              ? `${toolStatus.registeredNames.length} Site Tools live`
              : toolStatus.phase === 'unsupported'
                ? 'Human controls ready'
                : toolStatus.phase === 'error'
                  ? 'Tools need attention'
                  : 'Connecting Site Tools'}
          </span>
          <Link className="evidence-quiet-link" href="/">
            Ask a product question
          </Link>
        </div>
      </header>

      <section className="mission-board-hero">
        <p className="evidence-eyebrow">No store partnership. No customer list. No guessing.</p>
        <h1>Turn unanswered product questions into tiny public filming jobs.</h1>
        <p>
          Shoppers publish only the product, the question, and exactly what must be recorded. Anyone
          who already owns that product can film the answer on a phone. Every clip stays unpublished
          until its contributor reviews what the AI observed.
        </p>
        <div className="mission-board-summary" aria-live="polite">
          <strong>{phase === 'loading' ? 'Checking…' : missionCountLabel}</strong>
          <span>{message}</span>
          <button
            className="evidence-quiet-button"
            type="button"
            disabled={phase === 'loading'}
            onClick={() => {
              void loadMissions().catch(() => {
                // The visible board error is the human recovery path.
              });
            }}
          >
            Refresh
          </button>
        </div>
      </section>

      {phase === 'error' ? (
        <section className="mission-board-empty" role="alert">
          <span aria-hidden="true">!</span>
          <h2>The request board could not load.</h2>
          <p>{message}</p>
        </section>
      ) : missions.length === 0 ? (
        <section className="mission-board-empty">
          <span aria-hidden="true">✓</span>
          <h2>Nothing needs filming right now.</h2>
          <p>
            Ask a new product question, search existing evidence, and publish only the missing shot.
          </p>
          <Link className="evidence-primary-link" href="/">
            Start a product question
          </Link>
        </section>
      ) : (
        <section className="mission-board-grid" aria-label="Open filming requests">
          {missions.map((mission) => {
            const selected = claimed?.mission.id === mission.id;
            return (
              <article
                className="public-mission-card"
                id={`mission-${mission.id}`}
                key={mission.id}
              >
                <div className="public-mission-card-head">
                  <span>OPEN</span>
                  <small>Until {formatExpiry(mission.expiresAt)}</small>
                </div>
                <h2>{mission.productName}</h2>
                <p className="public-mission-question">“{mission.question}”</p>
                <dl>
                  <div>
                    <dt>Record</dt>
                    <dd>{mission.instruction}</dd>
                  </div>
                  <div>
                    <dt>Proof check</dt>
                    <dd>{mission.successCriterion}</dd>
                  </div>
                  <div>
                    <dt>Take</dt>
                    <dd>
                      At least {mission.minimumSeconds}s
                      {mission.continuousTakeRequired ? ', continuous with no cuts' : ''}
                    </dd>
                  </div>
                </dl>
                {mission.productUrl === null ? null : (
                  <a href={mission.productUrl} target="_blank" rel="noreferrer">
                    Check the exact public product page ↗
                  </a>
                )}
                <button
                  className="evidence-primary-button"
                  type="button"
                  disabled={claimingId !== null}
                  onClick={() => {
                    void claimMission(mission.id).catch(() => {
                      // The visible claim error is the human recovery path.
                    });
                  }}
                >
                  {claimingId === mission.id ? 'Opening recorder…' : 'I have this product'}
                </button>
                {selected && claimed !== null ? (
                  <div className="public-mission-claim" role="status">
                    <div>
                      <QRCodeSVG
                        value={claimed.contributorUrl}
                        size={112}
                        bgColor="transparent"
                        fgColor="#ecf5ef"
                        level="M"
                        title="Public mission phone recorder QR code"
                      />
                    </div>
                    <span>
                      <strong>Open the bounded recorder.</strong>
                      <small>
                        No login. Review before publishing. Maximum two upload attempts.
                      </small>
                      <a href={claimed.contributorUrl}>Open on this device →</a>
                    </span>
                  </div>
                ) : null}
                {claimError?.missionId !== mission.id || claimingId === mission.id ? null : (
                  <p className="public-mission-error" role="alert">
                    {claimError.message}
                  </p>
                )}
              </article>
            );
          })}
        </section>
      )}

      <aside className="mission-board-privacy">
        <strong>Public request ≠ public shopper</strong>
        <p>
          This board never receives the shopper’s identity, budget, preferences, history, or ChatGPT
          conversation. A listing expires within 24 hours and its public recorder capability can be
          revoked independently of the private case link.
        </p>
      </aside>
    </main>
  );
}
