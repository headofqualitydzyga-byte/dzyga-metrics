-- ============================================================
-- Telegram bot session storage
-- ============================================================
-- grammy's session middleware defaults to an in-memory Map, which does
-- not survive across serverless invocations (each webhook POST can be
-- routed to a different, memoryless Lambda instance on Vercel). Back
-- sessions with a table instead so multi-step flows (/submit) keep
-- their state between messages.

create table bot_sessions (
  id         text primary key,
  data       jsonb not null default '{}',
  updated_at timestamptz not null default now()
);

alter table bot_sessions enable row level security;
-- No policies: only accessed via the service-role admin client, which
-- bypasses RLS. No end-user role should read or write this table.
