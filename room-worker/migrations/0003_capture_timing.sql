ALTER TABLE reusable_evidence
ADD COLUMN capture_timing TEXT NOT NULL DEFAULT 'unknown'
CHECK (
  capture_timing IN (
    'mission_challenge_verified',
    'contributor_attested',
    'preexisting',
    'unknown'
  )
);

UPDATE reusable_evidence
SET capture_timing = CASE
  WHEN provenance = 'live_capture' THEN 'contributor_attested'
  ELSE 'preexisting'
END;
