-- =============================================================================
-- 0003_storage.sql
--
-- Private storage bucket for uploaded resumes. Spec section 45.
--
-- `public = false` is the important flag: there is no unauthenticated URL for
-- any object in this bucket, and files are reached only through short-lived
-- signed URLs minted server-side.
--
-- Objects are keyed <user_id>/<resume_id>.<ext>, which is what makes the
-- policies below expressible -- the first path segment is the owner.
-- =============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'resumes',
  'resumes',
  false,
  5242880,  -- 5 MB, mirroring MAX_RESUME_SIZE_BYTES
  array[
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ]
)
on conflict (id) do nothing;

create policy "resume files: read own"
  on storage.objects for select
  using (
    bucket_id = 'resumes'
    and (select auth.uid())::text = (storage.foldername(name))[1]
  );

create policy "resume files: upload own"
  on storage.objects for insert
  with check (
    bucket_id = 'resumes'
    and (select auth.uid())::text = (storage.foldername(name))[1]
  );

create policy "resume files: delete own"
  on storage.objects for delete
  using (
    bucket_id = 'resumes'
    and (select auth.uid())::text = (storage.foldername(name))[1]
  );
