'use client';

import { useEffect, useMemo, useState, type ChangeEvent } from 'react';

import { currentEvidenceAnswer, type EvidenceResult } from '@/lib/evidence-network/model';
import {
  configuredEvidenceServiceUrl,
  publishRemoteEvidence,
  readRemoteEvidenceCase,
  reserveRemoteEvidenceUpload,
  uploadEvidenceVideo,
} from '@/lib/evidence-network/remote-client';
import {
  maximumDirectUploadBytes,
  remoteEvidenceCaseIdPattern,
  type RemoteEvidenceCaseSnapshot,
  type ReservedEvidenceUpload,
} from '@/lib/evidence-network/remote-protocol';

type ContributorPhase =
  | 'loading'
  | 'ready'
  | 'hashing'
  | 'reserving'
  | 'uploading'
  | 'review'
  | 'publishing'
  | 'complete'
  | 'error';

interface EvidenceContributorProps {
  readonly caseId: string;
}

const resultCopy: Readonly<Record<EvidenceResult, string>> = {
  supports: 'The requested behavior was visible for the full continuous test.',
  contradicts: 'The requested behavior failed during the continuous test.',
  inconclusive: 'The recording did not keep every required detail visible.',
};

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

async function sha256File(file: File): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', await file.arrayBuffer());
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function fragmentToken(): string | null {
  const token = new URLSearchParams(window.location.hash.slice(1)).get('token');
  return token === null || token.length < 32 ? null : token;
}

export function EvidenceContributor({ caseId }: EvidenceContributorProps): React.JSX.Element {
  const serviceUrl = configuredEvidenceServiceUrl();
  const [phase, setPhase] = useState<ContributorPhase>('loading');
  const [snapshot, setSnapshot] = useState<RemoteEvidenceCaseSnapshot | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [localVideoUrl, setLocalVideoUrl] = useState<string | null>(null);
  const [durationSeconds, setDurationSeconds] = useState<number | null>(null);
  const [sha256, setSha256] = useState<string | null>(null);
  const [upload, setUpload] = useState<ReservedEvidenceUpload | null>(null);
  const [result, setResult] = useState<EvidenceResult>('supports');
  const [observation, setObservation] = useState(resultCopy.supports);
  const [contributorLabel, setContributorLabel] = useState('Product owner');
  const [rights, setRights] = useState<'owned' | 'authorized'>('owned');
  const [error, setError] = useState<string | null>(null);

  const evidenceCase = snapshot?.state.activeCase ?? null;
  const mission = evidenceCase?.mission ?? null;
  const answer = snapshot === null ? null : currentEvidenceAnswer(snapshot.state);
  const minimumSeconds = mission?.minimumSeconds ?? 1;
  const fileReady =
    file !== null &&
    sha256 !== null &&
    durationSeconds !== null &&
    durationSeconds >= minimumSeconds;

  useEffect(() => {
    let active = true;
    const fail = (message: string): void => {
      queueMicrotask(() => {
        if (active) {
          setError(message);
          setPhase('error');
        }
      });
    };
    if (!remoteEvidenceCaseIdPattern.test(caseId) || serviceUrl === null) {
      fail(
        serviceUrl === null
          ? 'The shared evidence service is not configured on this deployment.'
          : 'This evidence case link is invalid.',
      );
      return () => {
        active = false;
      };
    }
    const capability = fragmentToken();
    if (capability === null) {
      fail('This contribution link is missing its private one-time capability.');
      return () => {
        active = false;
      };
    }
    void readRemoteEvidenceCase(serviceUrl, caseId)
      .then((nextSnapshot) => {
        if (!active) {
          return;
        }
        setToken(capability);
        setSnapshot(nextSnapshot);
        setPhase(nextSnapshot.state.activeCase?.mission?.status === 'open' ? 'ready' : 'complete');
      })
      .catch((caught: unknown) => {
        if (active) {
          setError(errorMessage(caught));
          setPhase('error');
        }
      });
    return () => {
      active = false;
    };
  }, [caseId, serviceUrl]);

  useEffect(
    () => () => {
      if (localVideoUrl !== null) {
        URL.revokeObjectURL(localVideoUrl);
      }
    },
    [localVideoUrl],
  );

  const phaseLabel = useMemo((): string => {
    if (phase === 'hashing') return 'Fingerprinting on this phone';
    if (phase === 'reserving') return 'Creating one-time upload';
    if (phase === 'uploading') return 'Uploading directly to Cloudflare Stream';
    if (phase === 'review') return 'Your review is required';
    if (phase === 'publishing') return 'Publishing reviewed evidence';
    if (phase === 'complete') return 'Evidence published';
    if (phase === 'error') return 'Needs attention';
    return phase === 'ready' ? 'Ready to record' : 'Opening mission';
  }, [phase]);

  async function selectFile(event: ChangeEvent<HTMLInputElement>): Promise<void> {
    const selected = event.currentTarget.files?.[0] ?? null;
    if (selected === null) {
      return;
    }
    if (!selected.type.startsWith('video/')) {
      setError('Choose or record a video file.');
      return;
    }
    if (selected.size > maximumDirectUploadBytes) {
      setError('Keep this evidence clip under 200 MB.');
      return;
    }
    if (localVideoUrl !== null) {
      URL.revokeObjectURL(localVideoUrl);
    }
    setFile(selected);
    setLocalVideoUrl(URL.createObjectURL(selected));
    setDurationSeconds(null);
    setSha256(null);
    setError(null);
    setPhase('hashing');
    try {
      setSha256(await sha256File(selected));
      setPhase('ready');
    } catch (caught: unknown) {
      setError(`This phone could not fingerprint the clip: ${errorMessage(caught)}`);
      setPhase('error');
    }
  }

  async function uploadSelectedVideo(): Promise<void> {
    if (serviceUrl === null || token === null || snapshot === null || file === null || !fileReady) {
      return;
    }
    setError(null);
    setPhase('reserving');
    try {
      const reserved = await reserveRemoteEvidenceUpload(serviceUrl, caseId, {
        token,
        fileSizeBytes: file.size,
        maxDurationSeconds: Math.min(90, Math.max(30, Math.ceil(durationSeconds ?? 30))),
        mimeType: file.type,
      });
      setUpload(reserved);
      setPhase('uploading');
      await uploadEvidenceVideo(reserved.uploadUrl, file);
      setPhase('review');
    } catch (caught: unknown) {
      setError(errorMessage(caught));
      setPhase('error');
    }
  }

  function chooseResult(nextResult: EvidenceResult): void {
    setResult(nextResult);
    setObservation(resultCopy[nextResult]);
  }

  async function publishReview(): Promise<void> {
    if (
      serviceUrl === null ||
      token === null ||
      snapshot === null ||
      upload === null ||
      durationSeconds === null ||
      sha256 === null
    ) {
      return;
    }
    setError(null);
    setPhase('publishing');
    try {
      const nextSnapshot = await publishRemoteEvidence(serviceUrl, caseId, {
        token,
        commandId: crypto.randomUUID(),
        expectedRevision: snapshot.state.revision,
        uploadId: upload.uploadId,
        review: {
          result,
          observation,
          contributorLabel,
          durationSeconds: Math.max(1, Math.round(durationSeconds)),
          confidence: result === 'inconclusive' ? 'low' : 'high',
          rights,
          capturedAt: new Date(file?.lastModified ?? Date.now()).toISOString(),
          sha256,
        },
      });
      setSnapshot(nextSnapshot);
      setPhase('complete');
    } catch (caught: unknown) {
      setError(errorMessage(caught));
      setPhase('error');
    }
  }

  return (
    <main className="contributor-shell">
      <header className="contributor-header">
        <div className="evidence-brand">
          <span className="evidence-brand-mark" aria-hidden="true">
            ●
          </span>
          <span>
            <strong>Product evidence network</strong>
            <small>One question · one bounded recording</small>
          </span>
        </div>
        <span className={`contributor-phase phase-${phase}`}>{phaseLabel}</span>
      </header>

      {phase === 'loading' ? (
        <section className="contributor-loading" aria-live="polite">
          <span aria-hidden="true">◎</span>
          <p>Opening the exact fact someone needs you to film…</p>
        </section>
      ) : null}

      {error !== null ? (
        <section className="contributor-error" role="alert">
          <strong>We could not complete that step.</strong>
          <p>{error}</p>
          <button type="button" onClick={() => window.location.reload()}>
            Reload mission
          </button>
        </section>
      ) : null}

      {evidenceCase !== null && mission !== null ? (
        <>
          <section className="contributor-brief" aria-labelledby="contributor-question">
            <p className="evidence-eyebrow">A shopper needs observable proof</p>
            <small>{evidenceCase.product.name}</small>
            <h1 id="contributor-question">{evidenceCase.question.text}</h1>
            <div className="contributor-mission">
              <span>{mission.minimumSeconds}s</span>
              <p>
                <strong>{mission.instruction}</strong>
                {mission.successCriterion}
              </p>
            </div>
            <ul>
              <li>
                {mission.continuousTakeRequired
                  ? 'Record in one continuous take'
                  : 'Disclose any edits'}
              </li>
              <li>Keep the requested behavior visible</li>
              <li>You review the observation before it publishes</li>
            </ul>
          </section>

          {mission.status === 'open' && !['review', 'publishing'].includes(phase) ? (
            <section className="contributor-recorder" aria-labelledby="record-title">
              <div>
                <p className="evidence-eyebrow">No app or account required</p>
                <h2 id="record-title">Record or choose the evidence clip.</h2>
                <p>
                  The video stays on this phone until you choose upload. It then goes directly to a
                  one-time Cloudflare Stream URL.
                </p>
              </div>
              <label className="contributor-capture-button">
                <span aria-hidden="true">●</span>
                {file === null ? 'Open camera / choose video' : 'Replace video'}
                <input
                  aria-label="Record or choose evidence video"
                  type="file"
                  accept="video/*"
                  capture="environment"
                  onChange={(event) => void selectFile(event)}
                />
              </label>

              {localVideoUrl !== null ? (
                <div className="contributor-preview">
                  <video
                    controls
                    playsInline
                    src={localVideoUrl}
                    onLoadedMetadata={(event) => {
                      const duration = event.currentTarget.duration;
                      setDurationSeconds(Number.isFinite(duration) ? duration : null);
                    }}
                  />
                  <dl>
                    <div>
                      <dt>Duration</dt>
                      <dd>
                        {durationSeconds === null ? 'Reading…' : `${durationSeconds.toFixed(1)}s`}
                      </dd>
                    </div>
                    <div>
                      <dt>Required</dt>
                      <dd>≥ {mission.minimumSeconds}s</dd>
                    </div>
                    <div>
                      <dt>File fingerprint</dt>
                      <dd>{sha256 === null ? 'Computing…' : `${sha256.slice(0, 12)}…`}</dd>
                    </div>
                  </dl>
                  {durationSeconds !== null && durationSeconds < mission.minimumSeconds ? (
                    <p className="contributor-warning">
                      This clip is too short. Record at least {mission.minimumSeconds} continuous
                      seconds.
                    </p>
                  ) : null}
                  <button
                    className="evidence-primary-button"
                    type="button"
                    disabled={!fileReady || ['reserving', 'uploading'].includes(phase)}
                    onClick={() => void uploadSelectedVideo()}
                  >
                    {phase === 'reserving'
                      ? 'Creating one-time upload…'
                      : phase === 'uploading'
                        ? 'Uploading video…'
                        : 'Upload for review'}
                  </button>
                </div>
              ) : null}
            </section>
          ) : null}

          {['review', 'publishing'].includes(phase) ? (
            <section className="contributor-review" aria-labelledby="review-title">
              <p className="evidence-eyebrow">Human review gate</p>
              <h2 id="review-title">What does your video actually show?</h2>
              <p>Choose the result, correct the observation, and confirm your right to share it.</p>
              <div className="contributor-result-buttons" role="group" aria-label="Observed result">
                {(['supports', 'contradicts', 'inconclusive'] as const).map((candidate) => (
                  <button
                    type="button"
                    className={candidate === result ? 'selected' : ''}
                    aria-pressed={candidate === result}
                    key={candidate}
                    onClick={() => chooseResult(candidate)}
                  >
                    {candidate}
                  </button>
                ))}
              </div>
              <label>
                Reviewed observation
                <textarea
                  required
                  minLength={4}
                  maxLength={360}
                  value={observation}
                  onChange={(event) => setObservation(event.currentTarget.value)}
                />
              </label>
              <label>
                Public contributor label
                <input
                  required
                  minLength={2}
                  maxLength={80}
                  value={contributorLabel}
                  onChange={(event) => setContributorLabel(event.currentTarget.value)}
                />
              </label>
              <fieldset>
                <legend>Permission to publish this clip</legend>
                <label>
                  <input
                    type="radio"
                    name="rights"
                    checked={rights === 'owned'}
                    onChange={() => setRights('owned')}
                  />
                  I recorded and own it
                </label>
                <label>
                  <input
                    type="radio"
                    name="rights"
                    checked={rights === 'authorized'}
                    onChange={() => setRights('authorized')}
                  />
                  I am authorized to publish it
                </label>
              </fieldset>
              <button
                className="evidence-primary-button"
                type="button"
                disabled={phase === 'publishing' || observation.trim().length < 4}
                onClick={() => void publishReview()}
              >
                {phase === 'publishing' ? 'Publishing evidence…' : 'Publish reviewed evidence'}
              </button>
              <p className="contributor-fine-print">
                A file digest records which bytes were uploaded; it is provenance, not proof that a
                video is authentic. The visible continuous test and your review remain the evidence.
              </p>
            </section>
          ) : null}

          {phase === 'complete' ? (
            <section className="contributor-complete" aria-live="polite">
              <span aria-hidden="true">✓</span>
              <p>
                <small>The evidence case updated</small>
                <strong>
                  {answer?.status === 'supported'
                    ? 'Supported'
                    : answer?.status === 'contradicted'
                      ? 'Contradicted'
                      : 'More proof may be needed'}
                </strong>
                {snapshot?.lastMessage}
              </p>
              <p>You can close this page. The shopper and ChatGPT receive the same cited update.</p>
            </section>
          ) : null}
        </>
      ) : null}
    </main>
  );
}
