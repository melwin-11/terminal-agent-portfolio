CREATE TABLE IF NOT EXISTS traces (
  id TEXT PRIMARY KEY,
  ts INTEGER NOT NULL,
  day TEXT NOT NULL,
  session TEXT,
  turn INTEGER,
  visitor TEXT,
  country TEXT,
  client TEXT,
  model TEXT,
  question TEXT,
  answer TEXT,
  status TEXT NOT NULL,
  error TEXT,
  unanswered INTEGER NOT NULL DEFAULT 0,
  ttft_ms INTEGER,
  total_ms INTEGER,
  tokens_in INTEGER,
  tokens_out INTEGER,
  tokens_think INTEGER
);

CREATE INDEX IF NOT EXISTS idx_traces_ts ON traces (ts);
CREATE INDEX IF NOT EXISTS idx_traces_day ON traces (day);
