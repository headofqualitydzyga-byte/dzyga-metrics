-- ============================================================
-- Add frequency (weekly/monthly) to metric_definitions
-- ============================================================
-- metric_submissions.week_start is reused as a generic "period start"
-- key: for weekly metrics it's a Monday (unchanged), for monthly
-- metrics it's the 1st of the month. No new column / rename needed
-- there — see comment added below.

alter table metric_definitions
  add column frequency text not null default 'weekly'
    check (frequency in ('weekly', 'monthly'));

comment on column metric_definitions.frequency is
  'Submission cadence for this metric. Determines what metric_submissions.week_start holds for its rows: a Monday for ''weekly'', the 1st of a month for ''monthly''.';

comment on column metric_submissions.week_start is
  'Period start key. For submissions of a weekly metric this is a Monday; for a monthly metric this is the 1st of a month. See metric_definitions.frequency. Do not assume Monday semantics — check the metric''s frequency before deriving date-range labels (e.g. getWeekLabel vs getMonthLabel in src/lib/metrics/status.ts).';
