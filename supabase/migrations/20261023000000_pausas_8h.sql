-- =====================================================================
-- Horas pausadas: 8 horas pausadas equivalen a 1 día.
-- Es la misma regla que usa el sistema de gestión para correr la entrega
-- estimada (Nueva entrega = Entrega + horas pausadas / 8). Antes se dividía
-- por 24. Solo cambia el cálculo de días netos en las vistas.
-- =====================================================================

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
            then (c.implementacion - c.inicio_ciclo) + 1 end        as lead_cal,
       case when c.entregado and c.inicio_ciclo is not null and c.implementacion >= c.inicio_ciclo
            then greatest(((c.implementacion - c.inicio_ciclo) + 1) - c.horas_pausadas / 8.0, 0)
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
            then (u.fecha_fin - u.fecha_inicio) + 1 end as dias_cal,
       case when u.fecha_inicio is not null and u.fecha_fin >= u.fecha_inicio
            then greatest(((u.fecha_fin - u.fecha_inicio) + 1) - u.horas_pausadas / 8.0, 0) end as dias_netos
from u;
