-- Lets a manager/viewer clear their own submitted metric value from the
-- web form (previously only "admin" could delete metric_submissions rows
-- at all — see "submissions: admin delete"). Multiple permissive policies
-- for the same command combine with OR, so this adds to, not replaces,
-- the existing admin-delete policy.
create policy "submissions: owner delete own"
  on metric_submissions for delete
  to authenticated
  using (profile_id = auth.uid());
