-- ============================================================
-- Fix: infinite recursion in profiles RLS policies (42P17)
-- ============================================================
-- Policies on `profiles` (and others) checked the caller's role by
-- querying `profiles` again inside their own USING clause. Evaluating
-- that inner query re-triggers the same RLS policy, which recurses
-- indefinitely. Move the role lookup into a SECURITY DEFINER function
-- that bypasses RLS, and have every policy call it instead.
--
-- Every call site wraps the function as `(select public.my_role())`
-- rather than a bare `public.my_role()`: since the function takes no
-- row-dependent arguments, this form lets the planner hoist it into a
-- single InitPlan evaluated once per statement instead of once per
-- row scanned (the standard Supabase RLS performance pattern).

begin;

create or replace function public.my_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role from profiles where id = auth.uid();
$$;

drop policy if exists "profiles: self or admin read" on profiles;
create policy "profiles: self or admin read"
  on profiles for select
  to authenticated
  using (
    id = auth.uid()
    or (select public.my_role()) in ('admin', 'viewer')
  );

drop policy if exists "profiles: admin write" on profiles;
create policy "profiles: admin write"
  on profiles for all
  to authenticated
  using ((select public.my_role()) = 'admin');

drop policy if exists "departments: admin write" on departments;
create policy "departments: admin write"
  on departments for all
  to authenticated
  using ((select public.my_role()) = 'admin');

drop policy if exists "metric_definitions: admin write" on metric_definitions;
create policy "metric_definitions: admin write"
  on metric_definitions for all
  to authenticated
  using ((select public.my_role()) = 'admin');

drop policy if exists "submissions: admin/viewer read all" on metric_submissions;
create policy "submissions: admin/viewer read all"
  on metric_submissions for select
  to authenticated
  using (
    profile_id = auth.uid()
    or (select public.my_role()) in ('admin', 'viewer')
  );

drop policy if exists "submissions: admin delete" on metric_submissions;
create policy "submissions: admin delete"
  on metric_submissions for delete
  to authenticated
  using ((select public.my_role()) = 'admin');

drop policy if exists "invitations: admin all" on invitations;
create policy "invitations: admin all"
  on invitations for all
  to authenticated
  using ((select public.my_role()) = 'admin');

commit;
