-- ============================================================
-- Allow viewer (CEO) role to manage metric_definitions
-- ============================================================
-- The metrics admin page is now reachable by admin and viewer roles;
-- extend the write policy on metric_definitions to match.

begin;

drop policy if exists "metric_definitions: admin write" on metric_definitions;
create policy "metric_definitions: admin write"
  on metric_definitions for all
  to authenticated
  using ((select public.my_role()) in ('admin', 'viewer'));

commit;
