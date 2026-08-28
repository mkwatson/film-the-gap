CREATE TABLE public_evidence_missions (
  mission_id TEXT PRIMARY KEY,
  case_id TEXT NOT NULL UNIQUE,
  contributor_token TEXT NOT NULL,
  product_name TEXT NOT NULL,
  product_url TEXT,
  question TEXT NOT NULL,
  instruction TEXT NOT NULL,
  success_criterion TEXT NOT NULL,
  minimum_seconds INTEGER NOT NULL CHECK (minimum_seconds BETWEEN 2 AND 60),
  continuous_take_required INTEGER NOT NULL CHECK (continuous_take_required IN (0, 1)),
  status TEXT NOT NULL CHECK (status IN ('open', 'fulfilled', 'removed')),
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  fulfilled_at TEXT
);

CREATE INDEX public_evidence_missions_open
  ON public_evidence_missions (status, expires_at, created_at DESC);
