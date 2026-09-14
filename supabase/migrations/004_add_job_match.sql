-- Phase 9–10: Job Match columns on the analyses table.
--
-- jd_text            — the raw JD text submitted with the upload form.
--                      NULL when the user did not provide a JD.
-- candidate_years    — years of experience provided by the user for JD mode.
--                      NULL when no JD was provided.
-- job_match_score    — the deterministic total (0-100).
--                      NULL when no JD was provided.
-- job_match_json     — full JobMatchResult for the results page.
--                      NULL when no JD was provided.

ALTER TABLE analyses
  ADD COLUMN IF NOT EXISTS jd_text             TEXT,
  ADD COLUMN IF NOT EXISTS candidate_years     INTEGER,
  ADD COLUMN IF NOT EXISTS job_match_score     INTEGER,
  ADD COLUMN IF NOT EXISTS job_match_json      JSONB;
