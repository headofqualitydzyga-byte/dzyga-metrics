-- ============================================================
-- Recurring plan-value updates for metric_definitions
-- ============================================================
-- Some metrics' plan (target) values are not fixed — they must be
-- re-entered every period by a designated plan-setter over Telegram,
-- the same way managers submit actual values.

alter table metric_definitions
  add column plan_recurring boolean not null default false,
  add column plan_value_updated_at timestamptz;

comment on column metric_definitions.plan_recurring is
  'When true, plan_value must be re-entered every period (week for weekly metrics, month for monthly) by the designated plan-setter via the /planvalues Telegram flow, instead of staying fixed.';
comment on column metric_definitions.plan_value_updated_at is
  'When plan_value was last set. Used to determine which plan_recurring metrics still need updating for the current period.';
