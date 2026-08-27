'use client';

import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';

import {
  blobToDataUrl,
  canvasToJpegBlob,
  createCameraEvidenceFrame,
} from '@/lib/live-market/camera-evidence';
import {
  applyHostSelections,
  createManualFinding,
  createVisualEvidenceReview,
  evidenceProposalResponseSchema,
  findingCanSupportAttestation,
  historicalEvidenceLimitation,
  type EvidenceProposalResponse,
} from '@/lib/live-market/evidence-proposal';
import {
  baseVisibilityValues,
  surfaceFindingValues,
  type BaseVisibility,
  type CameraEvidenceFrameProvenance,
  type RepairHistory,
  type SurfaceFinding,
  type VisualEvidenceFinding,
  type VisualEvidenceReview,
} from '@/lib/live-market/model';

type CapturePhase =
  'idle' | 'requesting' | 'live' | 'capturing' | 'captured' | 'unsupported' | 'denied' | 'error';

interface CapturedFrame {
  readonly blob: Blob;
  readonly provenance: CameraEvidenceFrameProvenance;
  readonly previewUrl: string;
}

interface HostCameraCaptureProps {
  readonly onPublish: (
    repairHistory: Exclude<RepairHistory, 'unknown'>,
    provenance: CameraEvidenceFrameProvenance,
    visualReview: VisualEvidenceReview,
    publicEvidenceImage: string,
  ) => void;
}

interface CameraFailure {
  readonly phase: 'denied' | 'error';
  readonly message: string;
}

const cameraConstraints = {
  audio: false,
  video: {
    facingMode: { ideal: 'environment' },
    width: { ideal: 1280 },
    height: { ideal: 720 },
  },
} as const satisfies MediaStreamConstraints;

function cameraFailure(error: unknown): CameraFailure {
  if (error instanceof DOMException && error.name === 'NotAllowedError') {
    return {
      phase: 'denied',
      message: 'Camera permission was not granted. You can retry or use the fixture fallback.',
    };
  }
  if (error instanceof DOMException && error.name === 'NotFoundError') {
    return {
      phase: 'error',
      message: 'No camera was found. The fixture fallback remains available.',
    };
  }
  return {
    phase: 'error',
    message: error instanceof Error ? error.message : 'The camera could not be opened.',
  };
}

function stopStream(stream: MediaStream | null): void {
  if (stream === null) {
    return;
  }
  for (const track of stream.getTracks()) {
    track.stop();
  }
}

function isBaseVisibility(value: string): value is BaseVisibility {
  return baseVisibilityValues.some((candidate) => candidate === value);
}

function isSurfaceFinding(value: string): value is SurfaceFinding {
  return surfaceFindingValues.some((candidate) => candidate === value);
}

export function HostCameraCapture({ onPublish }: HostCameraCaptureProps): React.JSX.Element {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const previewUrlRef = useRef<string | null>(null);
  const analysisAbortRef = useRef<AbortController | null>(null);
  const [phase, setPhase] = useState<CapturePhase>('idle');
  const [capturedFrame, setCapturedFrame] = useState<CapturedFrame | null>(null);
  const [proposalResponse, setProposalResponse] = useState<EvidenceProposalResponse | null>(null);
  const [draftFinding, setDraftFinding] = useState<VisualEvidenceFinding | null>(null);
  const [visualReview, setVisualReview] = useState<VisualEvidenceReview | null>(null);
  const [analysisPending, setAnalysisPending] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [status, setStatus] = useState(
    'Camera stays off until you start it. Audio is never requested.',
  );

  useEffect(
    () => () => {
      analysisAbortRef.current?.abort();
      stopStream(streamRef.current);
      const previewUrl = previewUrlRef.current;
      if (previewUrl !== null) {
        URL.revokeObjectURL(previewUrl);
      }
    },
    [],
  );

  function closeCamera(): void {
    stopStream(streamRef.current);
    streamRef.current = null;
    if (videoRef.current !== null) {
      videoRef.current.srcObject = null;
    }
  }

  function clearCapturedFrame(): void {
    analysisAbortRef.current?.abort();
    analysisAbortRef.current = null;
    const previewUrl = previewUrlRef.current;
    if (previewUrl !== null) {
      URL.revokeObjectURL(previewUrl);
      previewUrlRef.current = null;
    }
    setCapturedFrame(null);
    setProposalResponse(null);
    setDraftFinding(null);
    setVisualReview(null);
    setAnalysisPending(false);
    setPublishing(false);
  }

  async function startCamera(): Promise<void> {
    const mediaDevices = navigator.mediaDevices;
    if (mediaDevices?.getUserMedia === undefined) {
      setPhase('unsupported');
      setStatus('This browser cannot open a camera here. Use the fixture fallback below.');
      return;
    }

    clearCapturedFrame();
    setPhase('requesting');
    setStatus('Waiting for this browser’s camera permission…');

    try {
      const stream = await mediaDevices.getUserMedia(cameraConstraints);
      streamRef.current = stream;
      const video = videoRef.current;
      if (video === null) {
        throw new Error('The camera preview was not ready.');
      }
      video.srcObject = stream;
      await video.play();
      setPhase('live');
      setStatus('Camera is live locally. Frame the base, then capture one keyframe.');
    } catch (error: unknown) {
      closeCamera();
      const failure = cameraFailure(error);
      setPhase(failure.phase);
      setStatus(failure.message);
    }
  }

  function stopCamera(): void {
    closeCamera();
    setPhase('idle');
    setStatus('Camera stopped. No frame was published.');
  }

  async function captureKeyframe(): Promise<void> {
    const video = videoRef.current;
    if (video === null || video.videoWidth <= 0 || video.videoHeight <= 0) {
      setPhase('error');
      setStatus('The camera has not produced a frame yet. Retry after the preview appears.');
      return;
    }

    setPhase('capturing');
    setStatus('Encoding and fingerprinting one local keyframe…');

    try {
      const scale = Math.min(1, 960 / Math.max(video.videoWidth, video.videoHeight));
      const widthPx = Math.max(1, Math.round(video.videoWidth * scale));
      const heightPx = Math.max(1, Math.round(video.videoHeight * scale));
      const canvas = document.createElement('canvas');
      canvas.width = widthPx;
      canvas.height = heightPx;
      const context = canvas.getContext('2d');
      if (context === null) {
        throw new Error('The browser could not prepare the evidence keyframe.');
      }
      context.drawImage(video, 0, 0, widthPx, heightPx);
      const blob = await canvasToJpegBlob(canvas);
      const provenance = await createCameraEvidenceFrame({
        blob,
        widthPx,
        heightPx,
        capturedAt: new Date().toISOString(),
      });
      const previewUrl = URL.createObjectURL(blob);

      clearCapturedFrame();
      previewUrlRef.current = previewUrl;
      setCapturedFrame({ blob, provenance, previewUrl });
      closeCamera();
      setPhase('captured');
      setStatus('Keyframe captured locally. Review it before adding a history attestation.');
    } catch (error: unknown) {
      closeCamera();
      setPhase('error');
      setStatus(error instanceof Error ? error.message : 'The keyframe could not be captured.');
    }
  }

  function retake(): void {
    clearCapturedFrame();
    setPhase('idle');
    setStatus('Previous keyframe discarded. Start the camera when ready.');
  }

  async function requestProposal(): Promise<void> {
    if (capturedFrame === null || analysisPending) {
      return;
    }

    const controller = new AbortController();
    analysisAbortRef.current?.abort();
    analysisAbortRef.current = controller;
    setAnalysisPending(true);
    setVisualReview(null);
    setStatus('Sending only this selected frame for a bounded AI Gateway observation…');

    try {
      const formData = new FormData();
      formData.append('frame', capturedFrame.blob, `${capturedFrame.provenance.frameId}.jpg`);
      formData.append('frameId', capturedFrame.provenance.frameId);
      formData.append('frameSha256', capturedFrame.provenance.sha256);
      formData.append('widthPx', String(capturedFrame.provenance.widthPx));
      formData.append('heightPx', String(capturedFrame.provenance.heightPx));

      const response = await fetch('/api/evidence/propose', {
        method: 'POST',
        body: formData,
        signal: controller.signal,
      });
      const body: unknown = await response.json();
      const parsed = evidenceProposalResponseSchema.safeParse(body);
      if (!response.ok || !parsed.success) {
        throw new Error('The evidence proposal response was invalid.');
      }

      setProposalResponse(parsed.data);
      setDraftFinding(
        parsed.data.kind === 'proposal' ? parsed.data.finding : createManualFinding(),
      );
      setStatus(
        parsed.data.kind === 'proposal'
          ? 'AI Gateway proposed a frame-bound observation. Accept or correct it explicitly.'
          : parsed.data.message,
      );
    } catch (error: unknown) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        return;
      }
      const manualResponse: EvidenceProposalResponse = {
        kind: 'manual-review-required',
        frameId: capturedFrame.provenance.frameId,
        frameSha256: capturedFrame.provenance.sha256,
        reason: 'gateway-unavailable',
        message: 'The proposal route was unavailable. Review the exact frame manually.',
      };
      setProposalResponse(manualResponse);
      setDraftFinding(createManualFinding());
      setStatus(manualResponse.message);
    } finally {
      if (analysisAbortRef.current === controller) {
        analysisAbortRef.current = null;
        setAnalysisPending(false);
      }
    }
  }

  function beginManualReview(): void {
    if (capturedFrame === null) {
      return;
    }
    const response: EvidenceProposalResponse = {
      kind: 'manual-review-required',
      frameId: capturedFrame.provenance.frameId,
      frameSha256: capturedFrame.provenance.sha256,
      reason: 'host-chosen',
      message: 'The host chose manual review; no frame was sent to a model.',
    };
    setProposalResponse(response);
    setDraftFinding(createManualFinding());
    setVisualReview(null);
    setStatus(response.message);
  }

  function changeBaseVisibility(value: string): void {
    if (!isBaseVisibility(value)) {
      return;
    }
    setDraftFinding((current) =>
      current === null ? current : applyHostSelections(current, value, current.surfaceFinding),
    );
    setVisualReview(null);
  }

  function changeSurfaceFinding(value: string): void {
    if (!isSurfaceFinding(value)) {
      return;
    }
    setDraftFinding((current) =>
      current === null ? current : applyHostSelections(current, current.baseVisibility, value),
    );
    setVisualReview(null);
  }

  function saveVisualReview(): void {
    if (capturedFrame === null || proposalResponse === null || draftFinding === null) {
      return;
    }
    try {
      const review = createVisualEvidenceReview(
        capturedFrame.provenance,
        proposalResponse,
        draftFinding,
      );
      setVisualReview(review);
      setStatus(
        findingCanSupportAttestation(review.reviewedFinding)
          ? 'Visual review saved. Add the separate repair-history attestation to publish.'
          : 'Visual review saved, but this frame cannot support publication. Correct it or retake.',
      );
    } catch (error: unknown) {
      setStatus(error instanceof Error ? error.message : 'The visual review could not be saved.');
    }
  }

  async function publish(repairHistory: Exclude<RepairHistory, 'unknown'>): Promise<void> {
    if (
      capturedFrame === null ||
      visualReview === null ||
      !findingCanSupportAttestation(visualReview.reviewedFinding)
    ) {
      return;
    }
    setPublishing(true);
    setStatus('Publishing one selected JPEG, its provenance, and the reviewed observation…');
    try {
      const publicEvidenceImage = await blobToDataUrl(capturedFrame.blob);
      onPublish(repairHistory, capturedFrame.provenance, visualReview, publicEvidenceImage);
    } catch (error: unknown) {
      setPublishing(false);
      setStatus(
        error instanceof Error ? error.message : 'The evidence frame could not be published.',
      );
    }
  }

  const canStart = phase === 'idle' || phase === 'denied' || phase === 'error';
  const cameraVisible = phase === 'requesting' || phase === 'live' || phase === 'capturing';
  const canPublish =
    visualReview !== null &&
    findingCanSupportAttestation(visualReview.reviewedFinding) &&
    !publishing;
  const canAttestNoRepair =
    canPublish && visualReview.reviewedFinding.surfaceFinding === 'no-obvious-repair';

  return (
    <section className="host-camera-capture" aria-labelledby="host-camera-title">
      <div className="host-camera-heading">
        <span>
          <small>Live evidence · optional</small>
          <strong id="host-camera-title">Capture a host-controlled keyframe</strong>
        </span>
        <em className={`camera-phase camera-phase-${phase}`}>{phase}</em>
      </div>

      <div className="host-camera-preview">
        <video
          ref={videoRef}
          className={`camera-feed ${cameraVisible ? 'camera-feed-visible' : ''}`}
          autoPlay
          muted
          playsInline
          aria-label="Local host camera preview"
        />
        {capturedFrame !== null ? (
          <Image
            className="camera-keyframe"
            src={capturedFrame.previewUrl}
            width={capturedFrame.provenance.widthPx}
            height={capturedFrame.provenance.heightPx}
            alt="Captured host evidence keyframe"
            unoptimized
          />
        ) : null}
        {!cameraVisible && capturedFrame === null ? (
          <div className="camera-permission-gate">
            <span aria-hidden="true">◉</span>
            <strong>Camera off</strong>
            <small>Video remains on this device until one keyframe is published.</small>
          </div>
        ) : null}
      </div>

      <p className="camera-status" role="status" aria-live="polite">
        {status}
      </p>

      {capturedFrame !== null ? (
        <div className="camera-provenance">
          <span>
            <small>Frame</small>
            <strong>{capturedFrame.provenance.frameId}</strong>
          </span>
          <span>
            <small>SHA-256</small>
            <code>{capturedFrame.provenance.sha256.slice(0, 16)}…</code>
          </span>
          <p>
            The digest is a content fingerprint, not proof that the scene is authentic. The host’s
            disclosure remains an attestation.
          </p>
        </div>
      ) : null}

      {proposalResponse !== null && draftFinding !== null ? (
        <section className="visual-review-card" aria-labelledby="visual-review-title">
          <div className="visual-review-heading">
            <span>
              <small>
                {proposalResponse.kind === 'proposal'
                  ? 'AI proposal · untrusted until reviewed'
                  : 'Manual review · deterministic fallback'}
              </small>
              <strong id="visual-review-title">Frame-bound visual observation</strong>
            </span>
            <em>
              {proposalResponse.kind === 'proposal' ? proposalResponse.modelId : 'No model claim'}
            </em>
          </div>

          <p className="visual-review-summary">{draftFinding.summary}</p>
          {draftFinding.visibleDetails.length > 0 ? (
            <ul className="visual-detail-list">
              {draftFinding.visibleDetails.map((detail) => (
                <li key={detail}>{detail}</li>
              ))}
            </ul>
          ) : null}

          <div className="visual-review-fields">
            <label>
              <span>Base visibility</span>
              <select
                value={draftFinding.baseVisibility}
                onChange={(event) => changeBaseVisibility(event.target.value)}
                disabled={visualReview !== null || publishing}
              >
                <option value="clear">Clear full-base view</option>
                <option value="partial">Partial view</option>
                <option value="not-visible">Base not visible</option>
                <option value="unclear">Unclear</option>
              </select>
            </label>
            <label>
              <span>Visible surface signal</span>
              <select
                value={draftFinding.surfaceFinding}
                onChange={(event) => changeSurfaceFinding(event.target.value)}
                disabled={visualReview !== null || publishing}
              >
                <option value="no-obvious-repair">No obvious repair marker</option>
                <option value="possible-repair">Possible repair marker</option>
                <option value="unclear">Unclear</option>
              </select>
            </label>
          </div>

          <p className="visual-limitation">{historicalEvidenceLimitation}</p>

          <div className="visual-review-actions">
            {visualReview === null ? (
              <button className="primary-button" type="button" onClick={saveVisualReview}>
                {proposalResponse.kind === 'proposal'
                  ? 'Accept or save correction'
                  : 'Save manual observation'}
              </button>
            ) : (
              <>
                <span className={`review-receipt review-${visualReview.hostDecision}`}>
                  Host {visualReview.hostDecision}
                </span>
                <button
                  className="secondary-button"
                  type="button"
                  onClick={() => setVisualReview(null)}
                  disabled={publishing}
                >
                  Edit review
                </button>
              </>
            )}
          </div>
        </section>
      ) : null}

      <div className="camera-actions">
        {canStart ? (
          <button className="primary-button" type="button" onClick={() => void startCamera()}>
            Start camera
          </button>
        ) : null}
        {phase === 'requesting' ? (
          <button className="secondary-button" type="button" disabled>
            Requesting permission…
          </button>
        ) : null}
        {phase === 'live' ? (
          <>
            <button className="primary-button" type="button" onClick={() => void captureKeyframe()}>
              Capture keyframe
            </button>
            <button className="secondary-button" type="button" onClick={stopCamera}>
              Stop camera
            </button>
          </>
        ) : null}
        {phase === 'capturing' ? (
          <button className="secondary-button" type="button" disabled>
            Fingerprinting frame…
          </button>
        ) : null}
        {phase === 'captured' ? (
          <>
            {proposalResponse === null ? (
              <>
                <button
                  className="primary-button"
                  type="button"
                  onClick={() => void requestProposal()}
                  disabled={analysisPending}
                >
                  {analysisPending ? 'Analyzing selected frame…' : 'Analyze with AI Gateway'}
                </button>
                <button
                  className="secondary-button"
                  type="button"
                  onClick={beginManualReview}
                  disabled={analysisPending}
                >
                  Review manually
                </button>
              </>
            ) : null}
            {visualReview !== null ? (
              <>
                <button
                  className="primary-button"
                  type="button"
                  onClick={() => void publish('none')}
                  disabled={!canAttestNoRepair}
                >
                  {publishing ? 'Publishing evidence…' : 'Publish · no prior repair'}
                </button>
                <button
                  className="danger-button"
                  type="button"
                  onClick={() => void publish('repaired')}
                  disabled={!canPublish}
                >
                  Publish · repaired
                </button>
              </>
            ) : null}
            <button className="secondary-button" type="button" onClick={retake}>
              Discard and retake
            </button>
          </>
        ) : null}
      </div>

      <p className="camera-privacy-copy">
        Permission is explicit and video-only. The live feed stays local. “Analyze” sends only the
        selected JPEG through AI Gateway; “Publish” shares that same selected frame, its digest, the
        reviewed visual observation, and the host’s separate history attestation.
      </p>
    </section>
  );
}
