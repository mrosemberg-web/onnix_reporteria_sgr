-- =====================================================================
-- Feriados nacionales de Paraguay 2027 (Ley 7544/2025), en su fecha legal.
--
-- La tabla guarda fechas concretas: cada año hay que cargar las suyas.
--  * Semana Santa cambia todos los años (2027: Pascua el 28/03).
--  * Los feriados móviles (1/3, 12/6, 20/6 y 29/9) pueden trasladarse al
--    lunes anterior o siguiente por decreto anual. Al cargar este script
--    todavía no hay decretos para 2027: van en su fecha legal y, cuando se
--    publique el traslado, se corrige desde Administración › Feriados.
--  * El Poder Ejecutivo puede sumar hasta 3 feriados extraordinarios por año.
-- Los que caen sábado o domingo se cargan igual (no afectan los días hábiles,
-- pero quedan registrados por si se trasladan).
-- =====================================================================

insert into feriados (fecha, descripcion, tipo, fecha_original) values
  ('2027-01-01', 'Año Nuevo', 'fijo', null),
  ('2027-03-01', 'Día de los Héroes (móvil: fecha legal, puede trasladarse por decreto)', 'fijo', null),
  ('2027-03-25', 'Jueves Santo', 'fijo', null),
  ('2027-03-26', 'Viernes Santo', 'fijo', null),
  ('2027-05-01', 'Día de los Trabajadores', 'fijo', null),
  ('2027-05-14', 'Independencia Nacional', 'fijo', null),
  ('2027-05-15', 'Independencia Nacional y Día de la Madre', 'fijo', null),
  ('2027-06-12', 'Paz del Chaco (móvil: fecha legal, puede trasladarse por decreto)', 'fijo', null),
  ('2027-06-20', 'Jura de la Constitución Nacional (móvil: fecha legal, puede trasladarse por decreto)', 'fijo', null),
  ('2027-08-15', 'Fundación de Asunción', 'fijo', null),
  ('2027-09-29', 'Batalla de Boquerón (móvil: fecha legal, puede trasladarse por decreto)', 'fijo', null),
  ('2027-12-08', 'Virgen de Caacupé', 'fijo', null),
  ('2027-12-25', 'Navidad', 'fijo', null)
on conflict (fecha) do nothing;
