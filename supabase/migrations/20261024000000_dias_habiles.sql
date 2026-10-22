-- =====================================================================
-- Días hábiles
-- Todos los plazos se cuentan en días hábiles: de lunes a viernes, sin los
-- feriados de la tabla "feriados" (que el administrador mantiene desde la
-- aplicación). Se cuentan inclusive: un SGR que empieza y termina el mismo
-- día hábil dura 1 día. Las pausas siguen la regla de 8 horas = 1 día hábil.
-- =====================================================================

create table if not exists feriados (
  fecha          date primary key,
  descripcion    text not null,
  tipo           text not null default 'fijo' check (tipo in ('fijo', 'trasladado', 'extraordinario')),
  fecha_original date,          -- para los trasladados: la fecha que conmemoran
  creado_en      timestamptz not null default now()
);
alter table feriados enable row level security;

-- Feriados nacionales de Paraguay 2026 (Ley 7544/2025), con los traslados y el
-- feriado extraordinario decretados por el Poder Ejecutivo.
insert into feriados (fecha, descripcion, tipo, fecha_original) values
  ('2026-01-01', 'Año Nuevo', 'fijo', null),
  ('2026-03-02', 'Día de los Héroes', 'trasladado', '2026-03-01'),
  ('2026-04-02', 'Jueves Santo', 'fijo', null),
  ('2026-04-03', 'Viernes Santo', 'fijo', null),
  ('2026-05-01', 'Día de los Trabajadores', 'fijo', null),
  ('2026-05-14', 'Independencia Nacional', 'fijo', null),
  ('2026-05-15', 'Independencia Nacional y Día de la Madre', 'fijo', null),
  ('2026-06-12', 'Paz del Chaco', 'fijo', null),
  ('2026-06-22', 'Jura de la Constitución Nacional', 'trasladado', '2026-06-20'),
  ('2026-06-30', 'Feriado extraordinario: triunfo de la Selección en el Mundial (Decreto 6280)', 'extraordinario', null),
  ('2026-08-15', 'Fundación de Asunción', 'fijo', null),
  ('2026-09-28', 'Batalla de Boquerón (Decreto 6601)', 'trasladado', '2026-09-29'),
  ('2026-12-08', 'Virgen de Caacupé', 'fijo', null),
  ('2026-12-25', 'Navidad', 'fijo', null)
on conflict (fecha) do nothing;

-- Días hábiles entre dos fechas, ambas inclusive.
create or replace function dias_habiles(desde date, hasta date) returns int
language sql stable as $$
  select case when desde is null or hasta is null or hasta < desde then null else (
    select count(*)::int
    from generate_series(desde, hasta, interval '1 day') as g(d)
    where extract(isodow from g.d) < 6
      and not exists (select 1 from feriados f where f.fecha = g.d::date)
  ) end
$$;

-- En Supabase, que la API pública no pueda invocarla.
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke execute on function dias_habiles(date, date) from public, anon, authenticated;
  end if;
end $$;

drop view if exists v_fases;
drop view if exists v_requerimientos;

create view v_requerimientos with (security_invoker = true) as
with base as (
  select r.*,
         (coalesce(r.equipo, '') ~* '\((DITA|DPJ)\)')     as equipo_externo,
         (upper(trim(coalesce(r.estado, ''))) = 'DST')     as desestimado
  from requerimientos r
), fases as (
  select b.*,
         not b.desestimado                                          as entregado,
         -- Solo es desarrollo (de Onnix) si tiene horas presupuestadas de desarrollo.
         b.horas_presu_desa > 0                                     as aplica_desa,
         (b.horas_test > 0 or b.horas_presu_test > 0)               as aplica_test
  from base b
), ciclo as (
  select f.*,
         least(case when f.aplica_desa then f.fecha_inicio_desa end,
               case when f.aplica_test then f.fecha_inicio_testing end) as inicio_ciclo
  from fases f
)
select c.*,
       case when c.aplica_desa and c.aplica_test then 'desa_test'
            when c.aplica_desa                   then 'solo_desa'
            when c.aplica_test                   then 'solo_test'
            else 'sin_servicio' end                                 as servicio,
       -- Horas de desarrollo de un equipo de Onnix cargadas sin presupuesto (no cuentan).
       (not c.equipo_externo and c.horas_desa > 0 and c.horas_presu_desa = 0) as desa_sin_presu,
       (case when c.aplica_desa then c.horas_desa       else 0 end
      + case when c.aplica_test then c.horas_test       else 0 end) as horas_real_total,
       (case when c.aplica_desa then c.horas_presu_desa else 0 end
      + case when c.aplica_test then c.horas_presu_test else 0 end) as horas_presu_total,
       -- Tiempo de entrega: solo para SGR entregados (un desestimado no llegó a producción).
       case when c.entregado and c.inicio_ciclo is not null and c.implementacion >= c.inicio_ciclo
            then dias_habiles(c.inicio_ciclo, c.implementacion) end  as lead_hab,
       case when c.entregado and c.inicio_ciclo is not null and c.implementacion >= c.inicio_ciclo
            then greatest(dias_habiles(c.inicio_ciclo, c.implementacion) - c.horas_pausadas / 8.0, 0)
       end                                                          as lead_neto
from ciclo c;

create view v_fases with (security_invoker = true) as
with u as (
  select id_req, 'desa'::text as fase,
         coalesce(nullif(trim(asignado_a), ''), 'Sin asignar') as responsable,
         horas_desa as horas_real, horas_presu_desa as horas_presu,
         horas_pausadas_desa as horas_pausadas, importe_desa as importe,
         fecha_inicio_desa as fecha_inicio, fecha_fin_desa as fecha_fin,
         devoluciones, equipo, equipo_externo, tipo_requerimiento, departamento,
         estado, entregado, desestimado, servicio, implementacion, fecha_facturacion, asunto
  from v_requerimientos where aplica_desa
  union all
  select id_req, 'test'::text,
         coalesce(nullif(trim(asignado_testing), ''), 'Sin asignar'),
         horas_test, horas_presu_test,
         horas_pausadas_test, importe_test,
         fecha_inicio_testing, fecha_fin_testing,
         devoluciones, equipo, equipo_externo, tipo_requerimiento, departamento,
         estado, entregado, desestimado, servicio, implementacion, fecha_facturacion, asunto
  from v_requerimientos where aplica_test
)
select u.*,
       case when u.fecha_inicio is not null and u.fecha_fin >= u.fecha_inicio
            then dias_habiles(u.fecha_inicio, u.fecha_fin) end as dias_hab,
       case when u.fecha_inicio is not null and u.fecha_fin >= u.fecha_inicio
            then greatest(dias_habiles(u.fecha_inicio, u.fecha_fin) - u.horas_pausadas / 8.0, 0) end as dias_netos
from u;
