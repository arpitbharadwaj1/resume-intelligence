-- Add recommendations JSON column to analyses.
-- Stored as JSONB so the results page can read them without a join.
alter table analyses
  add column if not exists recommendations_json jsonb not null default '[]';
