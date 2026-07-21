-- ============================================================
-- Sync metric_definitions with the metrics source table
-- ============================================================
-- Reconciles seeded metrics against the department's authoritative
-- metric table. Existing metrics not present in the source table
-- (ROAS/ROMI/CAC for Маркетинг, "Якість підбору" for HR, "Відсоток
-- бою" for Сервіс) are kept as-is. Metrics with "уточнити норму" in
-- the source are inserted with plan_value = null.

-- ---------------- Маркетинг ----------------
update metric_definitions
set plan_value = 90, sort_order = 1
where department_id = (select id from departments where name = 'Маркетинг')
  and name = 'Виконання плану по кількості лідів';

delete from metric_definitions
where department_id = (select id from departments where name = 'Маркетинг')
  and name in ('CPL Google / PPC', 'CPL Meta Ads');

insert into metric_definitions
  (department_id, name, type, value_type, unit, plan_value, warning_threshold, critical_threshold, sort_order)
select departments.id, m.name, m.type, m.value_type, m.unit, m.plan_value, m.warn, m.crit, m.ord
from departments, (values
  ('CPL Google/PPC — Кейтеринг', 'declining', 'number', 'грн/лід', 700::numeric, 20, 50, 2),
  ('CPL Google/PPC — Бокси',     'declining', 'number', 'грн/лід', 550::numeric, 20, 50, 3),
  ('CPL Meta Ads — Кейтеринг',   'declining', 'number', 'грн/лід', 800::numeric, 20, 50, 4),
  ('CPL Meta Ads — Бокси',       'declining', 'number', 'грн/лід', 650::numeric, 20, 50, 5)
) as m(name, type, value_type, unit, plan_value, warn, crit, ord)
where departments.name = 'Маркетинг';

update metric_definitions set sort_order = 6 where department_id = (select id from departments where name = 'Маркетинг') and name = 'ROAS Google / Meta';
update metric_definitions set sort_order = 7 where department_id = (select id from departments where name = 'Маркетинг') and name = 'ROMI';
update metric_definitions set sort_order = 8 where department_id = (select id from departments where name = 'Маркетинг') and name = 'CAC / ціна клієнта';

-- ---------------- Продажі ----------------
update metric_definitions set sort_order = 1 where department_id = (select id from departments where name = 'Продажі') and name = 'Виконання плану продажів';

insert into metric_definitions (department_id, name, type, value_type, unit, plan_value, sort_order)
select id, 'Конверсія з ліда в угоду', 'growing', 'percent', '%', null, 2
from departments where name = 'Продажі';

update metric_definitions set sort_order = 3 where department_id = (select id from departments where name = 'Продажі') and name = 'Маржинальність';
update metric_definitions set sort_order = 4 where department_id = (select id from departments where name = 'Продажі') and name = 'Валова маржа';

-- ---------------- Відділ КЯ ----------------
-- "Якість дзвінків" becomes "Середня оцінка якості дзвінків" in place (keeps id/created_at).
update metric_definitions
set name = 'Середня оцінка якості дзвінків', type = 'range', value_type = 'percent', unit = '%',
    plan_value = null, range_min = 85, range_max = 100,
    warning_threshold = 50, critical_threshold = 100, sort_order = 5
where department_id = (select id from departments where name = 'Відділ КЯ')
  and name = 'Якість дзвінків';

insert into metric_definitions
  (department_id, name, type, value_type, unit, plan_value, sort_order)
select departments.id, m.name, m.type, m.value_type, m.unit, m.plan_value, m.ord
from departments, (values
  ('Якість ведення CRM',                 'growing', 'percent', '%', 95::numeric, 1),
  ('Виконання плану перевірки дзвінків', 'growing', 'percent', '%', 100,          2),
  ('Своєчасність перевірки дзвінків',    'growing', 'percent', '%', 95,           3),
  ('Якість зворотного зв''язку',         'growing', 'percent', '%', 95,           4)
) as m(name, type, value_type, unit, plan_value, ord)
where departments.name = 'Відділ КЯ';

-- ---------------- HR ----------------
-- "Якість підбору" stays as-is (sort_order 1), not in the source table but kept.
insert into metric_definitions (department_id, name, type, value_type, unit, plan_value, sort_order)
select departments.id, m.name, m.type, m.value_type, m.unit, m.plan_value, m.ord
from departments, (values
  ('Укомплектованість штату',     'growing',   'percent', '%',    null::numeric, 2),
  ('Швидкість закриття вакансій', 'declining', 'number',  'днів', null,          3)
) as m(name, type, value_type, unit, plan_value, ord)
where departments.name = 'HR';

-- ---------------- Виробництво ----------------
update metric_definitions
set type = 'range', plan_value = null, range_min = 8, range_max = 10,
    warning_threshold = 50, critical_threshold = 100
where department_id = (select id from departments where name = 'Виробництво')
  and name = 'Виплати фрілансу / сума меню';

-- ---------------- Постачання ----------------
update metric_definitions
set name = 'Food cost: закупка / сума меню', type = 'range', plan_value = null, range_min = 22, range_max = 25,
    warning_threshold = 50, critical_threshold = 100
where department_id = (select id from departments where name = 'Постачання')
  and name = 'Food cost';

insert into metric_definitions
  (department_id, name, type, value_type, unit, plan_value, warning_threshold, critical_threshold, sort_order)
select departments.id, m.name, m.type, m.value_type, m.unit, m.plan_value, m.warn, m.crit, m.ord
from departments, (values
  ('Брак від постачальника',       'declining', 'percent', '%',     3::numeric,    50, 100, 2),
  ('Термінові закупівлі по тижню', 'declining', 'number',  'разів', null::numeric, 10, 20,  3)
) as m(name, type, value_type, unit, plan_value, warn, crit, ord)
where departments.name = 'Постачання';

-- ---------------- Сервіс ----------------
-- "Відсоток бою" stays as-is (sort_order 1), not in the source table but kept.
insert into metric_definitions (department_id, name, type, value_type, unit, range_min, range_max, warning_threshold, critical_threshold, sort_order)
select id, 'Витрати на фріланс / сума заходів', 'range', 'percent', '%', 6, 8, 50, 100, 2
from departments where name = 'Сервіс';

-- ---------------- Бухгалтерія ----------------
-- "Своєчасність документів" becomes "Своєчасність обробки банківських виписок" in place.
update metric_definitions
set name = 'Своєчасність обробки банківських виписок', plan_value = 98, sort_order = 1
where department_id = (select id from departments where name = 'Бухгалтерія')
  and name = 'Своєчасність документів';

insert into metric_definitions (department_id, name, type, value_type, unit, plan_value, sort_order)
select id, 'Своєчасність оформлення первинних документів', 'growing', 'percent', '%', 98, 2
from departments where name = 'Бухгалтерія';

-- ---------------- Фінансовий відділ ----------------
-- "Звітність та аналітика" becomes "Своєчасність управлінської звітності" in place.
update metric_definitions
set name = 'Своєчасність управлінської звітності', plan_value = 95, sort_order = 1
where department_id = (select id from departments where name = 'Фінансовий відділ')
  and name = 'Звітність та аналітика';

insert into metric_definitions (department_id, name, type, value_type, unit, plan_value, sort_order)
select departments.id, m.name, 'growing', 'percent', '%', m.plan_value, m.ord
from departments, (values
  ('Своєчасність фінансової аналітики',      95::numeric, 2),
  ('Частка заходів із маржинальністю ≥70%',  95,          3)
) as m(name, plan_value, ord)
where departments.name = 'Фінансовий відділ';
