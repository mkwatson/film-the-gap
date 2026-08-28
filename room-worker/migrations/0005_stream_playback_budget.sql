CREATE TABLE stream_playback_daily_usage (
  day TEXT PRIMARY KEY CHECK (length(day) = 10),
  tokens INTEGER NOT NULL CHECK (tokens BETWEEN 1 AND 60)
);
