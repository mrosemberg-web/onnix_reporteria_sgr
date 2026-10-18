-- =====================================================================
-- Estados del SGR
--   PRO = Finalizado en producción (estado final)
--   PAP = Pase a producción: terminado, todavía no pasado a PRO
--   DST = Desestimado por el cliente: se consumieron horas pero no llegó
--         a producción.
-- Un SGR cuenta como ENTREGADO si no está desestimado (PRO, PAP).
-- Los desestimados conservan sus horas (el trabajo se hizo y se factura),
-- pero no cuentan como entregas ni para el tiempo de entrega.
--
-- Devoluciones: SGR devueltos AL CLIENTE por falta de datos o consultas
-- adicionales. Es tiempo de espera ajeno al equipo; se descuenta a través
-- de las horas pausadas.
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
         case when b.equipo_externo then b.horas_presu_desa > 0
              else (b.horas_desa > 0 or b.horas_presu_desa > 0) end as aplica_desa,
         (b.horas_test > 0 or b.horas_presu_test > 0)               as aplica_test
  from base b
), ciclo as (
  select f.*,
         least(case when f.aplica_desa then f.fecha_inicio_desa end,
               case when f.aplica_test then f.fecha_inicio_testing end) as inicio_ciclo
  from fases f
)
select c.*,
       (case when c.aplica_desa then c.horas_desa       else 0 end
      + case when c.aplica_test then c.horas_test       else 0 end) as horas_real_total,
       (case when c.aplica_desa then c.horas_presu_desa else 0 end
      + case when c.aplica_test then c.horas_presu_test else 0 end) as horas_presu_total,
       -- Tiempo de entrega: solo para SGR entregados (un desestimado no llegó a producción).
       case when c.entregado and c.inicio_ciclo is not null and c.implementacion >= c.inicio_ciclo
            then (c.implementacion - c.inicio_ciclo) + 1 end        as lead_cal,
       case when c.entregado and c.inicio_ciclo is not null and c.implementacion >= c.inicio_ciclo
            then greatest(((c.implementacion - c.inicio_ciclo) + 1) - c.horas_pausadas / 24.0, 0)
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
         estado, entregado, desestimado, implementacion, fecha_facturacion, asunto
  from v_requerimientos where aplica_desa
  union all
  select id_req, 'test'::text,
         coalesce(nullif(trim(asignado_testing), ''), 'Sin asignar'),
         horas_test, horas_presu_test,
         horas_pausadas_test, importe_test,
         fecha_inicio_testing, fecha_fin_testing,
         devoluciones, equipo, equipo_externo, tipo_requerimiento, departamento,
         estado, entregado, desestimado, implementacion, fecha_facturacion, asunto
  from v_requerimientos where aplica_test
)
select u.*,
       case when u.fecha_inicio is not null and u.fecha_fin >= u.fecha_inicio
            then (u.fecha_fin - u.fecha_inicio) + 1 end as dias_cal,
       case when u.fecha_inicio is not null and u.fecha_fin >= u.fecha_inicio
            then greatest(((u.fecha_fin - u.fecha_inicio) + 1) - u.horas_pausadas / 24.0, 0) end as dias_netos
from u;
