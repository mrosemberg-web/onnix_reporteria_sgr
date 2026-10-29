-- =====================================================================
-- Desarrollador de cada SGR en la planilla de seguimiento de testing.
-- Permite atribuir las devoluciones de testing al desarrollador (de Onnix
-- o del cliente) en lugar del tester. Columna opcional en el CSV.
-- =====================================================================
alter table seguimiento add column if not exists desarrollador text;
