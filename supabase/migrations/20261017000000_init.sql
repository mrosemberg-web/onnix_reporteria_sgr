-- =====================================================================
-- Reportería de productividad — esquema inicial
-- Ejecutar en Supabase (SQL Editor) o con `npm run db:migrate`.
-- La app se conecta con la cadena DATABASE_URL (rol postgres), por lo que
-- RLS queda habilitado SIN políticas: la API REST pública de Supabase
-- (anon key) no puede leer ni escribir estas tablas.
-- =====================================================================

-- ---------- Usuarios e invitaciones ----------------------------------
create table if not exists usuarios (
  id                bigint generated always as identity primary key,
  usuario           text        not null,
  nombre            text        not null,
  clave_hash        text        not null,
  rol               text        not null check (rol in ('admin', 'lector')),
  activo            boolean     not null default true,
  intentos_fallidos int         not null default 0,
  bloqueado_hasta   timestamptz,
  creado_en         timestamptz not null default now(),
  ultimo_acceso     timestamptz
);
create unique index if not exists usuarios_usuario_uk on usuarios (lower(usuario));

create table if not exists invitaciones (
  id          bigint generated always as identity primary key,
  token_hash  text        not null unique,
  rol         text        not null check (rol in ('admin', 'lector')),
  nota        text,
  creada_por  bigint      references usuarios(id) on delete set null,
  creada_en   timestamptz not null default now(),
  expira_en   timestamptz not null,
  usada_en    timestamptz,
  usada_por   bigint      references usuarios(id) on delete set null,
  revocada    boolean     not null default false
);

-- ---------- Cargas de planilla ---------------------------------------
create table if not exists cargas (
  id           bigint generated always as identity primary key,
  archivo      text        not null,
  filas        int         not null,
  advertencias jsonb       not null default '[]'::jsonb,
  cargado_por  bigint      references usuarios(id) on delete set null,
  cargado_en   timestamptz not null default now()
);

-- ---------- Requerimientos (una fila por SGR de la planilla) ----------
create table if not exists requerimientos (
  id_req               text primary key,
  implementacion       date,
  departamento         text,
  solicitante          text,
  asunto               text,
  asignado_a           text,
  tipo_requerimiento   text,
  horas_desa           numeric(12,2) not null default 0,
  devoluciones         int           not null default 0,
  horas_pausadas_desa  numeric(12,2) not null default 0,
  horas_presu_desa     numeric(12,2) not null default 0,
  importe_desa         numeric(18,0) not null default 0,
  horas_test           numeric(12,2) not null default 0,
  horas_presu_test     numeric(12,2) not null default 0,
  importe_test         numeric(18,0) not null default 0,
  equipo               text,
  estado               text,
  fecha_facturacion    date,
  asignado_testing     text,
  fecha_inicio_desa    date,
  fecha_fin_desa       date,
  fecha_inicio_testing date,
  fecha_fin_testing    date,
  horas_pausadas       numeric(12,2) not null default 0,
  horas_pausadas_test  numeric(12,2) not null default 0,
  total_facturar       numeric(18,0) not null default 0,
  carga_id             bigint references cargas(id) on delete set null
);
create index if not exists requerimientos_impl_idx on requerimientos (implementacion);

alter table usuarios       enable row level security;
alter table invitaciones   enable row level security;
alter table cargas         enable row level security;
alter table requerimientos enable row level security;

-- =====================================================================
-- Capa de reglas de negocio
-- =====================================================================
-- Reglas:
--  * Equipos "DESARROLLO IT ALIANZA - (DITA)" y "DESARROLLO FPJ - (DPJ)":
--    el desarrollo lo hace el equipo del cliente, por lo que solo cuenta
--    TESTING, salvo que el SGR tenga horas presupuestadas de desarrollo.
--  * Resto de equipos: la fase de desarrollo aplica si hay horas trabajadas
--    o presupuestadas de desarrollo.
--  * Testing aplica si hay horas trabajadas o presupuestadas de testing.
--  * Las fechas de fin de desarrollo e inicio de testing NO son secuenciales,
--    por eso cada fase mide su propio ciclo.
--  * Las horas pausadas son tiempo calendario detenido (no es trabajo):
--    días netos = días calendario − horas pausadas / 24.
-- =====================================================================

create or replace view v_requerimientos with (security_invoker = true) as
with base as (
  select r.*,
         (coalesce(r.equipo, '') ~* '\((DITA|DPJ)\)') as equipo_externo
  from requerimientos r
), fases as (
  select b.*,
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
       case when c.inicio_ciclo is not null and c.implementacion >= c.inicio_ciclo
            then (c.implementacion - c.inicio_ciclo) + 1 end        as lead_cal,
       case when c.inicio_ciclo is not null and c.implementacion >= c.inicio_ciclo
            then greatest(((c.implementacion - c.inicio_ciclo) + 1) - c.horas_pausadas / 24.0, 0)
       end                                                          as lead_neto
from ciclo c;

-- Una fila por fase (desarrollo / testing) para medir cada una por separado.
create or replace view v_fases with (security_invoker = true) as
with u as (
  select id_req, 'desa'::text as fase,
         coalesce(nullif(trim(asignado_a), ''), 'Sin asignar') as responsable,
         horas_desa as horas_real, horas_presu_desa as horas_presu,
         horas_pausadas_desa as horas_pausadas, importe_desa as importe,
         fecha_inicio_desa as fecha_inicio, fecha_fin_desa as fecha_fin,
         devoluciones, equipo, equipo_externo, tipo_requerimiento, departamento,
         estado, implementacion, fecha_facturacion, asunto
  from v_requerimientos where aplica_desa
  union all
  select id_req, 'test'::text,
         coalesce(nullif(trim(asignado_testing), ''), 'Sin asignar'),
         horas_test, horas_presu_test,
         horas_pausadas_test, importe_test,
         fecha_inicio_testing, fecha_fin_testing,
         devoluciones, equipo, equipo_externo, tipo_requerimiento, departamento,
         estado, implementacion, fecha_facturacion, asunto
  from v_requerimientos where aplica_test
)
select u.*,
       case when u.fecha_inicio is not null and u.fecha_fin >= u.fecha_inicio
            then (u.fecha_fin - u.fecha_inicio) + 1 end as dias_cal,
       case when u.fecha_inicio is not null and u.fecha_fin >= u.fecha_inicio
            then greatest(((u.fecha_fin - u.fecha_inicio) + 1) - u.horas_pausadas / 24.0, 0) end as dias_netos
from u;
