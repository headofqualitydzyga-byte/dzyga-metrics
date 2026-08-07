-- ============================================================
-- Per-employee metric access
-- ============================================================
-- Admin grants each non-admin employee access to a specific subset of
-- metrics (independent of department). Opt-in allow-list: a profile
-- with no rows here has zero metric access — the app filters metric
-- lists down to this set for every role except 'admin', which always
-- sees everything unrestricted.

create table profile_metric_access (
  profile_id            uuid not null references profiles on delete cascade,
  metric_definition_id  uuid not null references metric_definitions on delete cascade,
  primary key (profile_id, metric_definition_id)
);

alter table profile_metric_access enable row level security;

create policy "profile_metric_access: self or admin/viewer read"
  on profile_metric_access for select
  to authenticated
  using (
    profile_id = auth.uid()
    or (select public.my_role()) in ('admin', 'viewer')
  );

create policy "profile_metric_access: admin write"
  on profile_metric_access for all
  to authenticated
  using ((select public.my_role()) = 'admin');
