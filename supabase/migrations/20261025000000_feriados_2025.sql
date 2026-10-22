-- =====================================================================
-- Feriados nacionales de Paraguay 2025, con los traslados del Decreto 3047
-- y los feriados adicionales de la Ley 7544/2025 (Decretos 4522 y 5040).
-- El 20 de junio (Jura de la Constitución) recién es feriado desde 2026:
-- la Ley 7544 se promulgó el 3 de setiembre de 2025.
-- =====================================================================

insert into feriados (fecha, descripcion, tipo, fecha_original) values
  ('2025-01-01', 'Año Nuevo', 'fijo', null),
  ('2025-03-03', 'Día de los Héroes (Decreto 3047)', 'trasladado', '2025-03-01'),
  ('2025-04-17', 'Jueves Santo', 'fijo', null),
  ('2025-04-18', 'Viernes Santo', 'fijo', null),
  ('2025-05-01', 'Día de los Trabajadores', 'fijo', null),
  ('2025-05-14', 'Independencia Nacional', 'fijo', null),
  ('2025-05-15', 'Independencia Nacional y Día de la Madre', 'fijo', null),
  ('2025-06-16', 'Paz del Chaco (Decreto 3047)', 'trasladado', '2025-06-12'),
  ('2025-08-15', 'Fundación de Asunción', 'fijo', null),
  ('2025-09-05', 'Feriado extraordinario: clasificación de la Selección al Mundial 2026 (Decreto 4522)', 'extraordinario', null),
  ('2025-09-29', 'Batalla de Boquerón', 'fijo', null),
  ('2025-12-08', 'Virgen de Caacupé', 'fijo', null),
  ('2025-12-25', 'Navidad', 'fijo', null),
  ('2025-12-26', 'Feriado extraordinario de fin de año (Decreto 5040)', 'extraordinario', null)
on conflict (fecha) do nothing;

-- Número de decreto del traslado de 2026, si el texto no fue editado.
update feriados set descripcion = 'Jura de la Constitución Nacional (Decreto 6215)'
where fecha = '2026-06-22' and descripcion = 'Jura de la Constitución Nacional';
