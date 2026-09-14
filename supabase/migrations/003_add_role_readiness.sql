-- Phase 8: Role Readiness columns on the analyses table.
--
-- role_context_json  — the RoleContext submitted with the upload form.
--                      NULL when the user did not provide a target role.
-- role_readiness_score — the deterministic total (0-100).
--                        NULL when no role context was provided.
-- role_readiness_json  — full RoleReadinessResult for the results page.
--                        NULL when no role context was provided.

ALTER TABLE analyses
  ADD COLUMN IF NOT EXISTS role_context_json      JSONB,
  ADD COLUMN IF NOT EXISTS role_readiness_score   INTEGER,
  ADD COLUMN IF NOT EXISTS role_readiness_json    JSONB;
