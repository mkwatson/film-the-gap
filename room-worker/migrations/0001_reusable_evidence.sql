CREATE TABLE reusable_evidence (
  evidence_id TEXT PRIMARY KEY,
  product_name TEXT NOT NULL,
  product_name_key TEXT NOT NULL,
  product_url TEXT,
  product_url_key TEXT,
  question TEXT NOT NULL,
  question_key TEXT NOT NULL,
  source_title TEXT NOT NULL,
  video_url TEXT NOT NULL,
  rights TEXT NOT NULL CHECK (rights IN ('owned', 'authorized')),
  provenance TEXT NOT NULL CHECK (provenance IN ('live_capture', 'authorized_import')),
  continuity TEXT NOT NULL CHECK (continuity = 'continuous'),
  contributor_label TEXT NOT NULL,
  captured_at TEXT NOT NULL,
  stream_uid TEXT NOT NULL UNIQUE,
  sha256 TEXT NOT NULL,
  duration_seconds INTEGER NOT NULL CHECK (duration_seconds BETWEEN 1 AND 300),
  result TEXT NOT NULL CHECK (result IN ('supports', 'contradicts')),
  confidence TEXT NOT NULL CHECK (confidence IN ('medium', 'high')),
  observation_text TEXT NOT NULL,
  citation_start_seconds INTEGER NOT NULL CHECK (citation_start_seconds >= 0),
  citation_end_seconds INTEGER NOT NULL CHECK (citation_end_seconds > citation_start_seconds),
  reviewed_at TEXT NOT NULL,
  indexed_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
);

CREATE INDEX reusable_evidence_product_question
  ON reusable_evidence (product_name_key, question_key, expires_at, reviewed_at DESC);

CREATE INDEX reusable_evidence_url_question
  ON reusable_evidence (product_url_key, question_key, expires_at, reviewed_at DESC);
