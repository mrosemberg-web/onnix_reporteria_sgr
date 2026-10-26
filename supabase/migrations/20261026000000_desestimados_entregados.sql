-- =====================================================================
-- Desestimados como entregados
-- Los SGR desestimados por el cliente (DST) cuentan como entregados en todo
-- el sistema: cantidades, tiempos de entrega y proyección. Siguen
-- identificados con la columna "desestimado". Su importe es el de la planilla,
-- que ya refleja el descuento cuando se aplicó (no hay un porcentaje fijo).
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
         -- Todos los SGR de la planilla de facturación cuentan como entregados,
         -- también los desestimados (DST): el trabajo se hizo y se factura.
         true                                                       as entregado,
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
