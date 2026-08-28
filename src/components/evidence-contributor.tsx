'use client';

import { useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';

import {
  currentEvidenceAnswer,
  publicNetworkEvidenceRetentionDays,
  qualifiesForPublicNetworkReuse,
  type EvidenceConfidence,
  type EvidenceResult,
} from '@/lib/evidence-network/model';
import {
  analyzeRemoteEvidenceVideo,
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
import {
  formatEvidenceTimestamp,
  type VideoEvidenceAnalysisResponse,
  type VideoEvidenceContinuity,
  type VideoEvidenceSegmentRole,
  type VideoEvidenceSegmentTransition,
} from '@/lib/evidence-network/video-analysis';

type ContributorPhase =
  | 'loading'
  | 'ready'
  | 'hashing'
  | 'reserving'
  | 'uploading'
  | 'processing'
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

const segmentRoleCopy: Readonly<Record<VideoEvidenceSegmentRole, string>> = {
  setup: 'setup',
  claim_evidence: 'claim evidence',
  context: 'context',
  unrelated: 'unrelated',
};

const segmentTransitionCopy: Readonly<Record<VideoEvidenceSegmentTransition, string>> = {
  video_start: 'video starts',
  continuous: 'same take',
  visible_cut: 'visible cut',
  unclear: 'transition unclear',
};

function wait(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

async function sha256File(file: File): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', await file.arrayBuffer());
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function contributorTokenStorageKey(caseId: string): string {
  return `product-evidence-contributor:${caseId}`;
}

function validContributorToken(value: string | null): value is string {
  return value !== null && value.length >= 32 && value.length <= 256;
}

function contributorToken(caseId: string): string | null {
  const token = new URLSearchParams(window.location.hash.slice(1)).get('token');
  if (validContributorToken(token)) {
    window.sessionStorage.setItem(contributorTokenStorageKey(caseId), token);
    window.history.replaceState(
      window.history.state,
      '',
      `${window.location.pathname}${window.location.search}`,
    );
    return token;
  }
  const stored = window.sessionStorage.getItem(contributorTokenStorageKey(caseId));
  return validContributorToken(stored) ? stored : null;
}

export function EvidenceContributor({ caseId }: EvidenceContributorProps): React.JSX.Element {
  const serviceUrl = configuredEvidenceServiceUrl();
  const reviewVideoRef = useRef<HTMLVideoElement>(null);
  const [phase, setPhase] = useState<ContributorPhase>('loading');
  const [snapshot, setSnapshot] = useState<RemoteEvidenceCaseSnapshot | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [selectedAt, setSelectedAt] = useState<string | null>(null);
  const [localVideoUrl, setLocalVideoUrl] = useState<string | null>(null);
  const [durationSeconds, setDurationSeconds] = useState<number | null>(null);
  const [sha256, setSha256] = useState<string | null>(null);
  const [upload, setUpload] = useState<ReservedEvidenceUpload | null>(null);
  const [analysis, setAnalysis] = useState<VideoEvidenceAnalysisResponse | null>(null);
  const [result, setResult] = useState<EvidenceResult>('inconclusive');
  const [observation, setObservation] = useState(resultCopy.inconclusive);
  const [confidence, setConfidence] = useState<EvidenceConfidence>('low');
  const [continuity, setContinuity] = useState<VideoEvidenceContinuity>('unknown');
  const [citationStartSeconds, setCitationStartSeconds] = useState(0);
  const [citationEndSeconds, setCitationEndSeconds] = useState(1);
  const [contributorLabel, setContributorLabel] = useState('Anonymous contributor');
  const [provenance, setProvenance] = useState<'live_capture' | 'authorized_import' | null>(null);
  const [rights, setRights] = useState<'owned' | 'authorized' | null>(null);
  const [reuseScope, setReuseScope] = useState<'case_only' | 'public_network'>('case_only');
  const [analysisRightsConfirmed, setAnalysisRightsConfirmed] = useState(false);
  const [reviewConfirmed, setReviewConfirmed] = useState(false);
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
  const networkReuseEligible = qualifiesForPublicNetworkReuse({
    result,
    confidence,
    continuity,
  });

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
    const capability = contributorToken(caseId);
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
    if (phase === 'processing') return 'Finding the exact proof interval';
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
      setError('Keep this evidence clip under 95 MB.');
      return;
    }
    if (localVideoUrl !== null) {
      URL.revokeObjectURL(localVideoUrl);
    }
    setFile(selected);
    setSelectedAt(new Date().toISOString());
    setLocalVideoUrl(URL.createObjectURL(selected));
    setDurationSeconds(null);
    setSha256(null);
    setAnalysis(null);
    setProvenance(null);
    setRights(null);
    setReuseScope('case_only');
    setAnalysisRightsConfirmed(false);
    setReviewConfirmed(false);
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
    if (
      serviceUrl === null ||
      token === null ||
      snapshot === null ||
      file === null ||
      !fileReady ||
      !analysisRightsConfirmed
    ) {
      return;
    }
    setError(null);
    setReviewConfirmed(false);
    setPhase('reserving');
    try {
      const reserved = await reserveRemoteEvidenceUpload(serviceUrl, caseId, {
        token,
        confirmRightsForUpload: true,
        fileSizeBytes: file.size,
        maxDurationSeconds: Math.min(
          90,
          Math.max(minimumSeconds, Math.ceil(durationSeconds ?? minimumSeconds)) + 5,
        ),
        mimeType: file.type,
      });
      setUpload(reserved);
      setPhase('uploading');
      await uploadEvidenceVideo(reserved.uploadUrl, file);
      setPhase('processing');
      const roundedDuration = Math.max(1, Math.round(durationSeconds ?? 1));
      setCitationStartSeconds(0);
      setCitationEndSeconds(roundedDuration);
      let completedAnalysis: VideoEvidenceAnalysisResponse | null = null;
      try {
        for (let attempt = 0; attempt < 60; attempt += 1) {
          const response = await analyzeRemoteEvidenceVideo(serviceUrl, caseId, reserved.uploadId, {
            token,
            confirmRightsForAnalysis: true,
          });
          setAnalysis(response);
          if (response.kind !== 'processing') {
            completedAnalysis = response;
            break;
          }
          await wait(1_250);
        }
        if (completedAnalysis === null) {
          completedAnalysis = {
            kind: 'manual-review-required',
            uploadId: reserved.uploadId,
            reason: 'gateway-unavailable',
            message:
              'The bounded AI draft did not finish in time. Review the exact uploaded recording manually.',
          };
          setAnalysis(completedAnalysis);
        }
      } catch {
        completedAnalysis = {
          kind: 'manual-review-required',
          uploadId: reserved.uploadId,
          reason: 'gateway-unavailable',
          message:
            'The AI draft could not be retrieved. Review the exact uploaded recording manually.',
        };
        setAnalysis(completedAnalysis);
      }
      if (completedAnalysis?.kind === 'proposal') {
        setResult(completedAnalysis.finding.result);
        setObservation(completedAnalysis.finding.observation);
        setConfidence(completedAnalysis.finding.confidence);
        setContinuity(completedAnalysis.finding.continuity);
        setCitationStartSeconds(completedAnalysis.finding.startSeconds);
        setCitationEndSeconds(completedAnalysis.finding.endSeconds);
      } else {
        setResult('inconclusive');
        setObservation(resultCopy.inconclusive);
        setConfidence('low');
        setContinuity('unknown');
      }
      setPhase('review');
    } catch (caught: unknown) {
      setError(errorMessage(caught));
      setPhase('error');
    }
  }

  function chooseResult(nextResult: EvidenceResult): void {
    setResult(nextResult);
    setObservation(resultCopy[nextResult]);
    setConfidence(nextResult === 'inconclusive' ? 'low' : 'medium');
    setReviewConfirmed(false);
    if (nextResult === 'inconclusive') {
      setReuseScope('case_only');
    }
  }

  function chooseConfidence(nextConfidence: EvidenceConfidence): void {
    setConfidence(nextConfidence);
    setReviewConfirmed(false);
    if (nextConfidence === 'low') {
      setReuseScope('case_only');
    }
  }

  function chooseContinuity(nextContinuity: VideoEvidenceContinuity): void {
    setContinuity(nextContinuity);
    setReviewConfirmed(false);
    if (nextContinuity !== 'continuous') {
      setReuseScope('case_only');
    }
  }

  function seekReviewVideo(seconds: number): void {
    const video = reviewVideoRef.current;
    if (video === null) {
      return;
    }
    video.currentTime = seconds;
    video.focus();
  }

  async function publishReview(): Promise<void> {
    if (
      serviceUrl === null ||
      token === null ||
      snapshot === null ||
      upload === null ||
      file === null ||
      selectedAt === null ||
      durationSeconds === null ||
      sha256 === null ||
      provenance === null ||
      rights === null ||
      !reviewConfirmed
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
        confirmReviewedEvidence: true,
        review: {
          result,
          observation,
          contributorLabel,
          durationSeconds: Math.max(1, Math.round(durationSeconds)),
          citationStartSeconds,
          citationEndSeconds,
          confidence,
          continuity,
          provenance,
          rights,
          reuseScope,
          capturedAt:
            provenance === 'live_capture' ? selectedAt : new Date(file.lastModified).toISOString(),
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
            <strong>Film the Gap</strong>
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
            <div className="contributor-capture-challenge">
              <span>Optional fresh-capture check</span>
              <code>{mission.captureChallenge.phrase}</code>
              <p>
                To let the network verify that this recording followed the mission, keep the product
                visible and clearly say this phrase—or show it written in frame—near the start. An
                existing authorized clip is still useful, but will be labeled preexisting.
              </p>
            </div>
          </section>

          {mission.status === 'open' && !['processing', 'review', 'publishing'].includes(phase) ? (
            <section className="contributor-recorder" aria-labelledby="record-title">
              <div>
                <p className="evidence-eyebrow">No app or account required</p>
                <h2 id="record-title">Record or choose the evidence clip.</h2>
                <p>
                  The video stays on this phone until you choose upload. It then goes directly to a
                  one-time Cloudflare Stream URL. Vercel AI Gateway can draft a timestamped review;
                  you decide what gets published.
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
                  <label className="contributor-analysis-permission">
                    <input
                      type="checkbox"
                      checked={analysisRightsConfirmed}
                      onChange={(event) => setAnalysisRightsConfirmed(event.currentTarget.checked)}
                    />
                    I own this recording or have permission to upload it for this claim-scoped AI
                    review.
                  </label>
                  <button
                    className="evidence-primary-button"
                    type="button"
                    disabled={
                      !fileReady ||
                      !analysisRightsConfirmed ||
                      ['reserving', 'uploading', 'processing'].includes(phase)
                    }
                    onClick={() => void uploadSelectedVideo()}
                  >
                    {phase === 'reserving'
                      ? 'Creating one-time upload…'
                      : phase === 'uploading'
                        ? 'Uploading video…'
                        : 'Upload + draft evidence'}
                  </button>
                </div>
              ) : null}
            </section>
          ) : null}

          {phase === 'processing' ? (
            <section className="contributor-processing" aria-live="polite">
              <span aria-hidden="true">◎</span>
              <div>
                <p className="evidence-eyebrow">Claim-scoped AI draft</p>
                <h2>Finding the smallest interval that answers the question.</h2>
                <p>
                  {analysis?.kind === 'processing'
                    ? analysis.message
                    : 'Cloudflare Stream is verifying the upload before Vercel AI Gateway reviews it.'}
                </p>
              </div>
            </section>
          ) : null}

          {['review', 'publishing'].includes(phase) ? (
            <section className="contributor-review" aria-labelledby="review-title">
              <p className="evidence-eyebrow">Human review gate</p>
              <h2 id="review-title">What does your video actually show?</h2>
              <p>
                Inspect the AI draft, correct every field, and confirm your right to share the clip.
              </p>
              {localVideoUrl === null ? null : (
                <figure className="contributor-review-video">
                  <video
                    ref={reviewVideoRef}
                    aria-label="Review uploaded evidence video"
                    controls
                    playsInline
                    preload="metadata"
                    src={localVideoUrl}
                  />
                  <figcaption>
                    Scrub the exact clip you selected. Verify the observable result, continuity, and
                    cited interval yourself before publishing.
                  </figcaption>
                </figure>
              )}
              {analysis?.kind === 'proposal' ? (
                <div className="contributor-ai-proposal">
                  <span>AI draft · untrusted until you review it</span>
                  <strong>{analysis.modelId}</strong>
                  <p>
                    Proposed citation {formatEvidenceTimestamp(analysis.finding.startSeconds)}–
                    {formatEvidenceTimestamp(analysis.finding.endSeconds)}
                  </p>
                  {analysis.finding.segments === undefined ? null : (
                    <div className="contributor-video-map">
                      <div>
                        <strong>AI video map</strong>
                        <small>
                          Navigation only—not published evidence. A cut inside the cited interval
                          prevents it from being treated as one continuous take.
                        </small>
                      </div>
                      <ol>
                        {analysis.finding.segments.map((segment) => (
                          <li
                            key={`${segment.startSeconds}-${segment.endSeconds}-${segment.role}`}
                            data-transition={segment.transitionIn}
                          >
                            <button
                              type="button"
                              onClick={() => seekReviewVideo(segment.startSeconds)}
                              aria-label={`Seek video to ${formatEvidenceTimestamp(segment.startSeconds)} for ${segmentRoleCopy[segment.role]}`}
                            >
                              <span>
                                {formatEvidenceTimestamp(segment.startSeconds)}–
                                {formatEvidenceTimestamp(segment.endSeconds)}
                              </span>
                              <em>{segmentRoleCopy[segment.role]}</em>
                              <small>{segmentTransitionCopy[segment.transitionIn]}</small>
                            </button>
                            <p>{segment.summary}</p>
                          </li>
                        ))}
                      </ol>
                    </div>
                  )}
                  <ul>
                    {analysis.finding.visibleDetails.map((detail) => (
                      <li key={detail}>{detail}</li>
                    ))}
                  </ul>
                  <p
                    className={`contributor-challenge-result challenge-${analysis.finding.captureChallenge.status}`}
                  >
                    Fresh-capture check: {analysis.finding.captureChallenge.observation}
                  </p>
                  {analysis.finding.limitations.length > 0 ? (
                    <small>Limits: {analysis.finding.limitations.join(' · ')}</small>
                  ) : null}
                </div>
              ) : (
                <div className="contributor-manual-review">
                  <strong>Manual review</strong>
                  <p>
                    {analysis?.kind === 'manual-review-required'
                      ? analysis.message
                      : 'No model proposal was used. Start from inconclusive and review carefully.'}
                  </p>
                </div>
              )}
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
                  onChange={(event) => {
                    setObservation(event.currentTarget.value);
                    setReviewConfirmed(false);
                  }}
                />
              </label>
              <fieldset>
                <legend>Reviewed confidence</legend>
                {(['low', 'medium', 'high'] as const).map((candidate) => (
                  <label key={candidate}>
                    <input
                      type="radio"
                      name="confidence"
                      checked={confidence === candidate}
                      onChange={() => chooseConfidence(candidate)}
                    />
                    {candidate}
                  </label>
                ))}
              </fieldset>
              <fieldset>
                <legend>Recording continuity</legend>
                {(['continuous', 'edited', 'unknown'] as const).map((candidate) => (
                  <label key={candidate}>
                    <input
                      type="radio"
                      name="continuity"
                      checked={continuity === candidate}
                      onChange={() => chooseContinuity(candidate)}
                    />
                    {candidate}
                  </label>
                ))}
              </fieldset>
              <div className="contributor-time-range">
                <label>
                  Evidence starts (seconds)
                  <input
                    type="number"
                    min={0}
                    max={Math.max(0, citationEndSeconds - 1)}
                    value={citationStartSeconds}
                    onChange={(event) => {
                      setCitationStartSeconds(event.currentTarget.valueAsNumber);
                      setReviewConfirmed(false);
                    }}
                  />
                </label>
                <label>
                  Evidence ends (seconds)
                  <input
                    type="number"
                    min={citationStartSeconds + 1}
                    max={Math.max(1, Math.round(durationSeconds ?? 1))}
                    value={citationEndSeconds}
                    onChange={(event) => {
                      setCitationEndSeconds(event.currentTarget.valueAsNumber);
                      setReviewConfirmed(false);
                    }}
                  />
                </label>
              </div>
              <label>
                Public contributor label
                <input
                  aria-label="Public contributor label"
                  required
                  minLength={2}
                  maxLength={80}
                  value={contributorLabel}
                  onChange={(event) => {
                    setContributorLabel(event.currentTarget.value);
                    setReviewConfirmed(false);
                  }}
                />
                <small className="contributor-label-note">
                  Use a truthful self-description, such as “Customer,” “Retail employee,” or
                  “Borrower.” The network does not independently verify this label.
                </small>
              </label>
              <fieldset>
                <legend>How was this clip made?</legend>
                <label>
                  <input
                    type="radio"
                    name="provenance"
                    checked={provenance === 'live_capture'}
                    onChange={() => {
                      setProvenance('live_capture');
                      setReviewConfirmed(false);
                    }}
                  />
                  I recorded it now for this mission
                </label>
                <label>
                  <input
                    type="radio"
                    name="provenance"
                    checked={provenance === 'authorized_import'}
                    onChange={() => {
                      setProvenance('authorized_import');
                      setReviewConfirmed(false);
                    }}
                  />
                  I selected an existing clip I may share
                </label>
                <small>
                  This is your attestation. The file timestamp and digest do not independently prove
                  when or how the video was made.
                </small>
              </fieldset>
              <fieldset>
                <legend>Permission to publish this clip</legend>
                <label>
                  <input
                    type="radio"
                    name="rights"
                    checked={rights === 'owned'}
                    onChange={() => {
                      setRights('owned');
                      setReviewConfirmed(false);
                    }}
                  />
                  I recorded and own it
                </label>
                <label>
                  <input
                    type="radio"
                    name="rights"
                    checked={rights === 'authorized'}
                    onChange={() => {
                      setRights('authorized');
                      setReviewConfirmed(false);
                    }}
                  />
                  I am authorized to publish it
                </label>
              </fieldset>
              <fieldset>
                <legend>Who can reuse this reviewed clip?</legend>
                <label>
                  <input
                    type="radio"
                    name="reuse-scope"
                    checked={reuseScope === 'case_only'}
                    onChange={() => {
                      setReuseScope('case_only');
                      setReviewConfirmed(false);
                    }}
                  />
                  Only this evidence case
                </label>
                <label>
                  <input
                    type="radio"
                    name="reuse-scope"
                    disabled={!networkReuseEligible}
                    checked={reuseScope === 'public_network'}
                    onChange={() => {
                      setReuseScope('public_network');
                      setReviewConfirmed(false);
                    }}
                  />
                  Future matching product questions too
                </label>
                <small>
                  {networkReuseEligible
                    ? `Public-network reuse lasts up to ${publicNetworkEvidenceRetentionDays} days and includes the clip, reviewed observation, timestamp, contributor label, rights, and file receipt.`
                    : 'Network reuse unlocks for a conclusive, medium-or-high-confidence continuous recording.'}{' '}
                  It never includes shopper identity or private preferences.
                </small>
              </fieldset>
              <fieldset className="contributor-review-confirmation">
                <legend>Final human confirmation</legend>
                <label>
                  <input
                    type="checkbox"
                    checked={reviewConfirmed}
                    onChange={(event) => setReviewConfirmed(event.currentTarget.checked)}
                  />
                  I reviewed the exact video and every field above. These are my statements, not
                  independently verified facts.
                </label>
              </fieldset>
              <button
                className="evidence-primary-button"
                type="button"
                disabled={
                  phase === 'publishing' ||
                  provenance === null ||
                  rights === null ||
                  !reviewConfirmed ||
                  observation.trim().length < 4 ||
                  !Number.isInteger(citationStartSeconds) ||
                  !Number.isInteger(citationEndSeconds) ||
                  citationStartSeconds < 0 ||
                  citationStartSeconds >= citationEndSeconds ||
                  citationEndSeconds > Math.max(1, Math.round(durationSeconds ?? 1))
                }
                onClick={() => void publishReview()}
              >
                {phase === 'publishing' ? 'Publishing evidence…' : 'Publish reviewed evidence'}
              </button>
              <p className="contributor-fine-print">
                Cloudflare Stream hosts the uploaded recording and Vercel AI Gateway only proposes
                an observation. The client-computed digest is only a file receipt—not independent
                provenance or authenticity proof. Detecting the one-time mission phrase only bounds
                capture timing; it does not prove identity, ownership, or product authenticity—and
                your reviewed video remains the evidence.
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
              {reuseScope === 'public_network' ? (
                <p>
                  For up to {publicNetworkEvidenceRetentionDays} days, this reviewed recording is
                  reusable when a future shopper asks the same product question.
                </p>
              ) : null}
              <p>You can close this page. The shopper and ChatGPT receive the same cited update.</p>
            </section>
          ) : null}
        </>
      ) : null}
    </main>
  );
}
