CREATE TABLE corrections (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL,
  trail_id TEXT,
  kind TEXT NOT NULL,
  activity TEXT NOT NULL,
  notes TEXT NOT NULL,
  point_lat REAL,
  point_lng REAL,
  geometry_json TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TEXT NOT NULL
);

CREATE INDEX corrections_created_at_idx ON corrections(created_at);
CREATE INDEX corrections_trail_id_idx ON corrections(trail_id);

CREATE TABLE condition_reports (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL,
  trail_id TEXT NOT NULL,
  condition TEXT NOT NULL,
  notes TEXT NOT NULL DEFAULT '',
  latitude REAL,
  longitude REAL,
  created_at TEXT NOT NULL
);

CREATE INDEX condition_reports_trail_created_idx ON condition_reports(trail_id, created_at);
