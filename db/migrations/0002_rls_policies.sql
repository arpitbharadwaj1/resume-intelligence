-- =============================================================================
-- 0002_rls_policies.sql
--
-- Row-level security. This is the authorization boundary for the application --
-- not the API layer, not the client. Spec section 44.
--
-- Two conventions used throughout:
--
--   (select auth.uid())  rather than bare auth.uid(). Postgres treats the
--                        subquery as a stable scalar and evaluates it once per
--                        statement instead of once per row, which matters on
--                        the child tables that join back to analyses.
--
--   Child ownership is derived, never duplicated. score_features has no
--   user_id; it is owned by whoever owns its analysis. Storing a second copy
--   of the owner would create a way for the two to disagree.
--
-- The service-role key bypasses every policy below. That is why
-- createAdminClient() in lib/supabase/server.ts is documented as requiring the
-- caller to establish authorization itself.
-- =============================================================================

-- --- profiles ---------------------------------------------------------------

create policy "profiles: read own"
  on profiles for select
  using ((select auth.uid()) = id);

create policy "profiles: update own"
  on profiles for update
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

create policy "profiles: insert own"
  on profiles for insert
  with check ((select auth.uid()) = id);

-- --- resumes ----------------------------------------------------------------
-- Soft-deleted rows are invisible even to their owner; only the retention job
-- (service role) sees them.

create policy "resumes: read own"
  on resumes for select
  using ((select auth.uid()) = user_id and deleted_at is null);

create policy "resumes: insert own"
  on resumes for insert
  with check ((select auth.uid()) = user_id);

create policy "resumes: update own"
  on resumes for update
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "resumes: delete own"
  on resumes for delete
  using ((select auth.uid()) = user_id);

-- --- resume_versions --------------------------------------------------------
-- Append-only by policy as well as by intent: there is no update and no delete
-- policy, so a version cannot be rewritten after an analysis has referenced it.

create policy "resume_versions: read own"
  on resume_versions for select
  using (
    exists (
      select 1 from resumes r
      where r.id = resume_versions.resume_id
        and r.user_id = (select auth.uid())
        and r.deleted_at is null
    )
  );

create policy "resume_versions: insert own"
  on resume_versions for insert
  with check (
    exists (
      select 1 from resumes r
      where r.id = resume_versions.resume_id
        and r.user_id = (select auth.uid())
    )
  );

-- --- target_profiles --------------------------------------------------------

create policy "target_profiles: read own"
  on target_profiles for select
  using ((select auth.uid()) = user_id);

create policy "target_profiles: insert own"
  on target_profiles for insert
  with check ((select auth.uid()) = user_id);

create policy "target_profiles: update own"
  on target_profiles for update
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "target_profiles: delete own"
  on target_profiles for delete
  using ((select auth.uid()) = user_id);

-- --- job_descriptions -------------------------------------------------------

create policy "job_descriptions: read own"
  on job_descriptions for select
  using ((select auth.uid()) = user_id);

create policy "job_descriptions: insert own"
  on job_descriptions for insert
  with check ((select auth.uid()) = user_id);

create policy "job_descriptions: delete own"
  on job_descriptions for delete
  using ((select auth.uid()) = user_id);

-- --- analyses ---------------------------------------------------------------
-- No update policy: analyses are written by the server (service role) as they
-- progress through their status machine. A user may read and delete, never edit
-- -- otherwise a score could be altered client-side.

create policy "analyses: read own"
  on analyses for select
  using ((select auth.uid()) = user_id);

create policy "analyses: insert own"
  on analyses for insert
  with check ((select auth.uid()) = user_id);

create policy "analyses: delete own"
  on analyses for delete
  using ((select auth.uid()) = user_id);

-- --- Analysis children ------------------------------------------------------
-- Read-only to users. Every one of these is server-written; a user who could
-- insert or update them could manufacture their own score, evidence, or
-- recommendations.

create policy "score_categories: read own"
  on score_categories for select
  using (
    exists (
      select 1 from analyses a
      where a.id = score_categories.analysis_id
        and a.user_id = (select auth.uid())
    )
  );

create policy "score_features: read own"
  on score_features for select
  using (
    exists (
      select 1 from analyses a
      where a.id = score_features.analysis_id
        and a.user_id = (select auth.uid())
    )
  );

create policy "skill_assessments: read own"
  on skill_assessments for select
  using (
    exists (
      select 1 from analyses a
      where a.id = skill_assessments.analysis_id
        and a.user_id = (select auth.uid())
    )
  );

create policy "recommendations: read own"
  on recommendations for select
  using (
    exists (
      select 1 from analyses a
      where a.id = recommendations.analysis_id
        and a.user_id = (select auth.uid())
    )
  );

-- A user may mark a recommendation accepted or dismissed. They may not alter
-- its content or its estimated impact -- that is enforced in application code,
-- since column-level restriction is not expressible in a policy.
create policy "recommendations: update status on own"
  on recommendations for update
  using (
    exists (
      select 1 from analyses a
      where a.id = recommendations.analysis_id
        and a.user_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1 from analyses a
      where a.id = recommendations.analysis_id
        and a.user_id = (select auth.uid())
    )
  );

create policy "resume_changes: read own"
  on resume_changes for select
  using (
    exists (
      select 1 from analyses a
      where a.id = resume_changes.analysis_id
        and a.user_id = (select auth.uid())
    )
  );

create policy "resume_changes: update acceptance on own"
  on resume_changes for update
  using (
    exists (
      select 1 from analyses a
      where a.id = resume_changes.analysis_id
        and a.user_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1 from analyses a
      where a.id = resume_changes.analysis_id
        and a.user_id = (select auth.uid())
    )
  );

-- --- Profile provisioning ---------------------------------------------------
-- Create the application-level profile row when Supabase Auth creates a user,
-- so no code path has to remember to.

create or replace function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();
