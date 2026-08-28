CREATE TABLE page_reader_daily_usage (
  day TEXT PRIMARY KEY CHECK (length(day) = 10),
  calls INTEGER NOT NULL CHECK (calls BETWEEN 1 AND 60)
);
