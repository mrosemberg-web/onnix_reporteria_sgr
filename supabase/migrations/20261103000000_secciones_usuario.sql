-- =====================================================================
-- Acceso por sección: cada usuario de consulta puede ver "Implementados",
-- "En curso" o ambas. Los administradores ven todo siempre.
-- Por defecto, ambas: al desplegar nadie pierde acceso.
-- =====================================================================
alter table usuarios add column if not exists secciones text[] not null default array['implementados', 'en_curso']::text[];
alter table invitaciones add column if not exists secciones text[] not null default array['implementados', 'en_curso']::text[];

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'usuarios_secciones_ck') then
    alter table usuarios add constraint usuarios_secciones_ck
      check (cardinality(secciones) > 0 and secciones <@ array['implementados', 'en_curso']::text[]);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'invitaciones_secciones_ck') then
    alter table invitaciones add constraint invitaciones_secciones_ck
      check (cardinality(secciones) > 0 and secciones <@ array['implementados', 'en_curso']::text[]);
  end if;
end $$;
