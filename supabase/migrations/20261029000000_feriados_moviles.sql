-- =====================================================================
-- Feriados móviles (Ley 7544/2025, art. 2): 1/3, 12/6, 20/6 y 29/9.
-- El Poder Ejecutivo puede trasladarlos por decreto al lunes anterior o
-- siguiente. La columna "movil" permite trasladarlos desde la pantalla.
-- =====================================================================
alter table feriados add column if not exists movil boolean not null default false;

update feriados set movil = true
where tipo = 'trasladado'
   or (extract(year from fecha) >= 2026 and to_char(fecha, 'MM-DD') in ('03-01', '06-12', '06-20', '09-29'));

-- Los de 2027 se habían cargado con una aclaración en el texto; ahora la indica la columna.
update feriados set descripcion = replace(descripcion, ' (móvil: fecha legal, puede trasladarse por decreto)', '')
where descripcion like '% (móvil: fecha legal, puede trasladarse por decreto)';
