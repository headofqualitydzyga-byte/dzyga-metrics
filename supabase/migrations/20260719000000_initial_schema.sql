-- ============================================================
-- Dzyga Metrics — initial schema
-- ============================================================

-- Extensions
create extension if not exists "pgcrypto";

-- ============================================================
-- DEPARTMENTS
-- ============================================================
create table departments (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  description text,
  color       text not null default '#6366f1',
  icon        text not null default 'chart',
  sort_order  int  not null default 0,
  created_at  timestamptz not null default now()
);

alter table departments enable row level security;

-- All authenticated users can read departments
create policy "departments: authenticated read"
  on departments for select
  to authenticated
  using (true);

-- Only admins can mutate
create policy "departments: admin write"
  on departments for all
  to authenticated
  using (
    exists (
      select 1 from profiles
      where profiles.id = auth.uid() and profiles.role = 'admin'
    )
  );

-- ============================================================
-- PROFILES
-- ============================================================
create table profiles (
  id                uuid primary key references auth.users on delete cascade,
  email             text not null,
  full_name         text,
  role              text not null default 'manager'
                    check (role in ('admin', 'manager', 'viewer')),
  department_id     uuid references departments on delete set null,
  telegram_id       text unique,
  telegram_username text,
  created_at        timestamptz not null default now()
);

alter table profiles enable row level security;

-- Everyone reads their own profile; admin reads all
create policy "profiles: self or admin read"
  on profiles for select
  to authenticated
  using (
    id = auth.uid()
    or exists (
      select 1 from profiles p
      where p.id = auth.uid() and p.role in ('admin', 'viewer')
    )
  );

-- Only admin can insert/update/delete profiles
create policy "profiles: admin write"
  on profiles for all
  to authenticated
  using (
    exists (
      select 1 from profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );

-- Auto-create profile on signup (via trigger)
create or replace function handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure handle_new_user();

-- ============================================================
-- METRIC DEFINITIONS
-- ============================================================
create table metric_definitions (
  id                 uuid primary key default gen_random_uuid(),
  department_id      uuid not null references departments on delete cascade,
  name               text not null,
  description        text,
  type               text not null check (type in ('growing', 'declining', 'range')),
  value_type         text not null default 'percent'
                     check (value_type in ('percent', 'number', 'boolean')),
  unit               text not null default '%',
  plan_value         numeric,
  range_min          numeric,
  range_max          numeric,
  warning_threshold  numeric not null default 10,
  critical_threshold numeric not null default 20,
  is_active          boolean not null default true,
  sort_order         int not null default 0,
  created_at         timestamptz not null default now()
);

alter table metric_definitions enable row level security;

create policy "metric_definitions: authenticated read"
  on metric_definitions for select
  to authenticated
  using (true);

create policy "metric_definitions: admin write"
  on metric_definitions for all
  to authenticated
  using (
    exists (
      select 1 from profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );

-- ============================================================
-- METRIC SUBMISSIONS
-- ============================================================
create table metric_submissions (
  id                   uuid primary key default gen_random_uuid(),
  profile_id           uuid not null references profiles on delete cascade,
  metric_definition_id uuid not null references metric_definitions on delete cascade,
  week_start           date not null,
  value                numeric not null,
  comment              text,
  submitted_via        text not null default 'web'
                       check (submitted_via in ('telegram', 'web')),
  submitted_at         timestamptz not null default now(),
  unique (profile_id, metric_definition_id, week_start)
);

alter table metric_submissions enable row level security;

-- Managers submit only their own; admin/viewer read all
create policy "submissions: manager insert own"
  on metric_submissions for insert
  to authenticated
  with check (profile_id = auth.uid());

create policy "submissions: manager update own"
  on metric_submissions for update
  to authenticated
  using (profile_id = auth.uid());

create policy "submissions: admin/viewer read all"
  on metric_submissions for select
  to authenticated
  using (
    profile_id = auth.uid()
    or exists (
      select 1 from profiles p
      where p.id = auth.uid() and p.role in ('admin', 'viewer')
    )
  );

create policy "submissions: admin delete"
  on metric_submissions for delete
  to authenticated
  using (
    exists (
      select 1 from profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );

-- ============================================================
-- INVITATIONS
-- ============================================================
create table invitations (
  id            uuid primary key default gen_random_uuid(),
  email         text not null,
  role          text not null check (role in ('admin', 'manager', 'viewer')),
  department_id uuid references departments on delete set null,
  token         text not null unique default encode(gen_random_bytes(32), 'hex'),
  invited_by    uuid references profiles on delete set null,
  expires_at    timestamptz not null default (now() + interval '7 days'),
  accepted_at   timestamptz,
  created_at    timestamptz not null default now()
);

alter table invitations enable row level security;

create policy "invitations: admin all"
  on invitations for all
  to authenticated
  using (
    exists (
      select 1 from profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );

-- ============================================================
-- SEED: DEPARTMENTS
-- ============================================================
insert into departments (name, color, icon, sort_order) values
  ('Маркетинг',       '#3b82f6', 'megaphone',  1),
  ('Продажі',         '#16a34a', 'cart',        2),
  ('Відділ КЯ',       '#8b5cf6', 'star',        3),
  ('HR',              '#f59e0b', 'users',       4),
  ('Виробництво',     '#6366f1', 'cog',         5),
  ('Постачання',      '#0ea5e9', 'truck',       6),
  ('Сервіс',          '#e5672a', 'clipboard',   7),
  ('Бухгалтерія',     '#64748b', 'document',    8),
  ('Фінансовий відділ', '#059669', 'currency',  9);

-- ============================================================
-- SEED: METRIC DEFINITIONS
-- ============================================================
-- Маркетинг
with dept as (select id from departments where name = 'Маркетинг')
insert into metric_definitions
  (department_id, name, type, value_type, unit, plan_value, warning_threshold, critical_threshold, sort_order)
select dept.id, m.name, m.type, m.value_type, m.unit, m.plan_value, m.warn, m.crit, m.ord
from dept, (values
  ('Виконання плану по кількості лідів', 'growing',   'percent', '%',       100,  5, 15, 1),
  ('CPL Google / PPC',                   'declining',  'number',  'грн/лід', 400, 20, 50, 2),
  ('CPL Meta Ads',                       'declining',  'number',  'грн/лід', 350, 20, 50, 3),
  ('ROAS Google / Meta',                 'growing',    'number',  'x',       3,   15, 30, 4),
  ('ROMI',                               'growing',    'percent', '%',       200, 20, 40, 5),
  ('CAC / ціна клієнта',                'declining',  'number',  'грн',     500, 20, 50, 6)
) as m(name, type, value_type, unit, plan_value, warn, crit, ord);

-- Продажі
with dept as (select id from departments where name = 'Продажі')
insert into metric_definitions
  (department_id, name, type, value_type, unit, plan_value, warning_threshold, critical_threshold, sort_order)
select dept.id, m.name, m.type, m.value_type, m.unit, m.plan_value, m.warn, m.crit, m.ord
from dept, (values
  ('Виконання плану продажів', 'growing', 'percent', '%',   100, 5,  15, 1),
  ('Маржинальність',           'growing', 'percent', '%',   30,  5,  10, 2),
  ('Валова маржа',             'growing', 'number',  'грн', null, 10, 20, 3)
) as m(name, type, value_type, unit, plan_value, warn, crit, ord);

-- Відділ КЯ
with dept as (select id from departments where name = 'Відділ КЯ')
insert into metric_definitions
  (department_id, name, type, value_type, unit, plan_value, warning_threshold, critical_threshold, sort_order)
select dept.id, m.name, m.type, m.value_type, m.unit, m.plan_value, m.warn, m.crit, m.ord
from dept, (values
  ('Якість дзвінків', 'growing', 'number', 'бал', 9.0, 5, 15, 1)
) as m(name, type, value_type, unit, plan_value, warn, crit, ord);

-- HR
with dept as (select id from departments where name = 'HR')
insert into metric_definitions
  (department_id, name, type, value_type, unit, plan_value, warning_threshold, critical_threshold, sort_order)
select dept.id, m.name, m.type, m.value_type, m.unit, m.plan_value, m.warn, m.crit, m.ord
from dept, (values
  ('Якість підбору', 'growing', 'percent', '%', 80, 10, 20, 1)
) as m(name, type, value_type, unit, plan_value, warn, crit, ord);

-- Виробництво
with dept as (select id from departments where name = 'Виробництво')
insert into metric_definitions
  (department_id, name, type, value_type, unit, plan_value, warning_threshold, critical_threshold, sort_order)
select dept.id, m.name, m.type, m.value_type, m.unit, m.plan_value, m.warn, m.crit, m.ord
from dept, (values
  ('Виплати фрілансу / сума меню', 'declining', 'percent', '%', 15, 10, 25, 1)
) as m(name, type, value_type, unit, plan_value, warn, crit, ord);

-- Постачання
with dept as (select id from departments where name = 'Постачання')
insert into metric_definitions
  (department_id, name, type, value_type, unit, plan_value, warning_threshold, critical_threshold, sort_order)
select dept.id, m.name, m.type, m.value_type, m.unit, m.plan_value, m.warn, m.crit, m.ord
from dept, (values
  ('Food cost', 'declining', 'percent', '%', 30, 5, 15, 1)
) as m(name, type, value_type, unit, plan_value, warn, crit, ord);

-- Сервіс
with dept as (select id from departments where name = 'Сервіс')
insert into metric_definitions
  (department_id, name, type, value_type, unit, plan_value, warning_threshold, critical_threshold, sort_order)
select dept.id, m.name, m.type, m.value_type, m.unit, m.plan_value, m.warn, m.crit, m.ord
from dept, (values
  ('Відсоток бою', 'declining', 'percent', '%', 2, 50, 100, 1)
) as m(name, type, value_type, unit, plan_value, warn, crit, ord);

-- Бухгалтерія
with dept as (select id from departments where name = 'Бухгалтерія')
insert into metric_definitions
  (department_id, name, type, value_type, unit, plan_value, warning_threshold, critical_threshold, sort_order)
select dept.id, m.name, m.type, m.value_type, m.unit, m.plan_value, m.warn, m.crit, m.ord
from dept, (values
  ('Своєчасність документів', 'growing', 'percent', '%', 100, 5, 15, 1)
) as m(name, type, value_type, unit, plan_value, warn, crit, ord);

-- Фінансовий відділ
with dept as (select id from departments where name = 'Фінансовий відділ')
insert into metric_definitions
  (department_id, name, type, value_type, unit, plan_value, warning_threshold, critical_threshold, sort_order)
select dept.id, m.name, m.type, m.value_type, m.unit, m.plan_value, m.warn, m.crit, m.ord
from dept, (values
  ('Звітність та аналітика', 'growing', 'percent', '%', 100, 5, 15, 1)
) as m(name, type, value_type, unit, plan_value, warn, crit, ord);
