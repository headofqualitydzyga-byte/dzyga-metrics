alter table metric_definitions
  add column show_in_oc boolean not null default false,
  add column oc_featured boolean not null default false;

comment on column metric_definitions.show_in_oc is
  'Marks this as a department''s key metric, shown in the Operations Center department grid.';
comment on column metric_definitions.oc_featured is
  'Pins this metric into the Operations Center''s top summary row. Only meaningful when show_in_oc is also true (enforced in the admin UI, not the DB).';
