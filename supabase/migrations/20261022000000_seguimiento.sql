-- =====================================================================
-- Seguimiento de requerimientos EN CURSO
-- Dos planillas: la mirada de desarrollo (Seguimiento_desa.csv) y la de
-- testing (Seguimiento_testing.csv). Cada una reemplaza solo sus filas.
-- Un mismo SGR aparece en una sola de las dos, según la fase en que está.
-- =====================================================================

-- Las cargas ahora tienen tipo y fecha de corte (el "hoy" del análisis).
alter table cargas add column if not exists tipo text not null default 'facturacion'
  check (tipo in ('facturacion', 'seguimiento_desa', 'seguimiento_test'));
alter table cargas add column if not exists fecha_corte date;

create table if not exists seguimiento (
  id                   bigint generated always as identity primary key,
  fase                 text not null check (fase in ('desa', 'test')),
  id_req               text not null,          -- "0" = persona sin SGR asignado
  usuario              text not null,
  nombre               text,
  team_leader          text,
  asunto               text,
  estado               text,
  tipo_servicio        text,
  equipo               text,
  fecha_estado         date,
  devoluciones         int,                    -- solo testing: devoluciones al desarrollador
  fecha_inicio         date,
  horas_ayer           numeric(12,2) not null default 0,
  horas_trab           numeric(12,2) not null default 0,
  horas_presu          numeric(12,2),          -- null: todavía sin presupuesto
  entrega_estimada     date,
  horas_pausadas_fase  numeric(12,2) not null default 0,
  nueva_entrega        date,                   -- entrega estimada corrida por las pausas
  otras_horas_pausadas numeric(12,2) not null default 0,
  total_horas_pausadas numeric(12,2) not null default 0,
  importe_desa         numeric(18,0),
  importe_test         numeric(18,0),
  importe_total        numeric(18,0),
  carga_id             bigint references cargas(id) on delete set null
);
create index if not exists seguimiento_fase_idx on seguimiento (fase);
alter table seguimiento enable row level security;
