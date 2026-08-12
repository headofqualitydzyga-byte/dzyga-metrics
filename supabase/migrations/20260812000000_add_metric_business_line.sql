-- ============================================================
-- Add business_line (catering/boxes) to metric_definitions
-- ============================================================
-- Every metric must belong to exactly one business line, used to
-- split the manager's Telegram report and to filter the web dashboard.

alter table metric_definitions
  add column business_line text not null default 'catering'
    check (business_line in ('catering', 'boxes'));

comment on column metric_definitions.business_line is
  'Which business line this metric belongs to: catering (Кейтеринг) or boxes (Бокси). Required on every metric.';
