# Reportería de productividad

Sistema web para demostrar la productividad del servicio de desarrollo y testing a un cliente: horas trabajadas contra presupuestadas, cantidad de SGR entregados por mes y acumulados en el año, tiempos de ciclo descontando pausas y el efecto de las devoluciones. Se alimenta subiendo la planilla «Facturación por período».

Stack: Next.js 15 (App Router, React 19, TypeScript) y PostgreSQL. Pensado para desplegar la base en Supabase y la aplicación en Vercel. No usa librerías de gráficos: los gráficos son SVG generados en el servidor.

## Puesta en marcha local

Requisitos: Node.js 20 o superior y un PostgreSQL (local o el de Supabase).

```bash
npm install
cp .env.example .env.local        # completar DATABASE_URL y AUTH_SECRET
npm run db:migrate                # crea tablas y vistas
npm run crear-admin -- admin "Nombre Apellido" "UnaClaveLarga2026"
npm run dev                       # http://localhost:3000
```

Ingresá con el administrador, andá a **Cargar planilla** y subí el CSV.

## Despliegue en Supabase y Vercel

1. **Supabase.** Creá un proyecto. En *Project Settings › Database › Connection string* copiá la cadena del **Transaction pooler** (puerto 6543). La app desactiva los prepared statements para que funcione con ese pooler.
2. **Esquema.** Elegí una de dos opciones:
   - Pegá el contenido de `supabase/migrations/20261017000000_init.sql` en el *SQL Editor* y ejecutalo.
   - O corré `npm run db:migrate` desde tu máquina con `DATABASE_URL` apuntando a Supabase. Esta opción además registra las migraciones aplicadas.
3. **Primer administrador.** Con la misma `DATABASE_URL`, corré `npm run crear-admin -- <usuario> "<Nombre>" <clave>`.
4. **Vercel.** Importá el repositorio. Framework: Next.js, sin cambios de build. Definí estas variables de entorno:
   - `DATABASE_URL`: la cadena del pooler.
   - `AUTH_SECRET`: al menos 32 caracteres aleatorios, por ejemplo `openssl rand -base64 48`.
   - `APP_URL` (opcional): URL pública, por ejemplo `https://reportes.onnix.com.py`. Se usa para armar los enlaces de invitación; si no se define, se toma del dominio de la petición.
   - `APP_TZ` (opcional): por defecto `America/Asuncion`.
5. **Región.** Conviene que la región de las funciones de Vercel sea la misma que la de Supabase (por ejemplo, São Paulo `gru1` con `sa-east-1`).

Seguridad de la base: las tablas tienen RLS habilitado **sin políticas**. La app entra con el rol `postgres` por la cadena de conexión, mientras que la API REST pública de Supabase (anon key) no puede leer nada. Las vistas usan `security_invoker`.

## Diagnóstico

Abrí `https://<tu-app>/api/salud` (no requiere sesión). Devuelve un JSON que indica:

- si `DATABASE_URL` apunta al pooler de Supabase, con el usuario `postgres.<ref>` y sin la clave de ejemplo;
- si `AUTH_SECRET` es válido;
- si la base conecta, cuánto tarda, cuántos administradores hay y si están aplicadas las migraciones.

Si algo falla, el campo `base.motivo` explica la causa. No muestra secretos ni la cadena de conexión.

Si el ingreso no funciona, la pantalla de login también muestra el motivo y un código: `28P01` es una clave de base incorrecta y `CONNECT_TIMEOUT` es un host equivocado o inaccesible.

### Conexiones en Vercel

Vercel congela las funciones entre requests y, mientras tanto, el pooler de Supabase puede cerrar las conexiones inactivas. Un cliente persistente como postgres.js no se entera y, al reanudar, la consulta queda colgada hasta el límite de la función (error 504 `FUNCTION_INVOCATION_TIMEOUT`). `src/lib/db.ts` lo evita de dos maneras:

- mantiene viva la función (con `waitUntil`) hasta que las conexiones ociosas se cierran, a los 5 segundos;
- antes de la primera consulta de cada request, si la base estuvo inactiva, hace un `select 1` con 3 segundos de límite y, si no responde, recrea el cliente.

Además, cada pantalla tiene un límite de 60 segundos (`maxDuration`), así que ningún error puede dejar la página esperando 5 minutos.

Conviene que la región de las funciones de Vercel coincida con la de Supabase. Se configura en el proyecto de Vercel o con un `vercel.json` en la raíz, por ejemplo `{ "regions": ["gru1"] }` para Supabase en `sa-east-1` (São Paulo). `/api/salud` informa en qué región corrió la función.

## Usuarios

- **Ingreso.** Con usuario y clave. La clave se guarda con bcrypt y la sesión es un JWT firmado en una cookie `httpOnly` que dura 8 horas. En cada página se vuelve a verificar contra la base que el usuario siga activo, así que desactivar a alguien corta su acceso de inmediato.
- **Bloqueo.** Después de 5 intentos fallidos, el usuario queda bloqueado 15 minutos.
- **Perfiles.**
  - *Administrador*: reportes, carga de planilla y usuarios.
  - *Consulta*: solo reportes.
- **Invitaciones.** El administrador genera un enlace de invitación con perfil y vencimiento de 1 a 30 días, y la persona elige su usuario y clave. Cada enlace sirve una sola vez, se puede revocar y en la base solo se guarda su hash.
- **Claves olvidadas.** El administrador genera una clave temporal, que se muestra una sola vez. Cada usuario puede cambiar su clave en *Mi cuenta*.

## Carga de la planilla

- **Formato.** Acepta el CSV separado por punto y coma tal como lo exporta el sistema, en Windows-1252 o UTF-8, con números en formato paraguayo («1.800.000», «101,8») y fechas dd/mm/aaaa. Los encabezados se reconocen sin importar mayúsculas ni tildes. Si falta una columna obligatoria, la carga se rechaza y se indica cuál falta.
- **Reemplazo total.** La carga **reemplaza todos los SGR** en una sola transacción: si algo falla, los datos anteriores quedan intactos.
- **Historial.** Cada carga queda registrada con su archivo, usuario, cantidad de filas y advertencias.

## Reglas de negocio

Están en las vistas `v_requerimientos` y `v_fases` del archivo de migración, para que se puedan auditar con SQL.

- **Equipos DITA y DPJ.** «DESARROLLO IT ALIANZA - (DITA)» y «DESARROLLO FPJ - (DPJ)» solo cuentan **testing**, salvo que el SGR tenga horas presupuestadas de desarrollo. En ese caso también cuenta la fase de desarrollo.
- **Resto de equipos.** La fase de desarrollo existe si hay horas trabajadas o presupuestadas de desarrollo. La de testing existe si hay horas trabajadas o presupuestadas de testing. Se decide por horas y no por fechas, porque la planilla trae fechas de fin aun cuando la fase no existió.
- **Fases independientes.** Desarrollo y testing se miden por separado, cada uno con su fecha de inicio y fin, porque no son secuenciales.
- **Pausas.** Las horas pausadas se consideran tiempo calendario detenido: *días netos = días calendario − horas pausadas ÷ 24* (los días calendario se cuentan inclusive).
- **Tiempo de entrega.** Va desde el inicio de la primera fase que aplique hasta la fecha de implementación, descontando las «Horas Pausadas» totales del SGR.
- **Desarrollo y Testing como servicios.** Un SGR es un **desarrollo de Onnix** solo si tiene horas presupuestadas de desarrollo, en cualquier equipo. Sin presupuesto de desarrollo nunca cuenta como desarrollo entregado, aunque tenga horas o importe cargados; esas horas se informan aparte como «horas de desarrollo sin presupuesto». **Testing** es un servicio adicional que se presta sobre desarrollos de Onnix y sobre desarrollos internos del cliente. Cada SGR tiene un servicio: *Desarrollo con testing*, *Desarrollo sin testing*, *Solo testing (desarrollo del cliente)* o *Sin horas presupuestadas*.
- **Estados.** PRO es *Finalizado en producción*, PAP es *Pase a producción* (terminado, todavía no pasado a PRO) y DST es *Desestimado por el cliente*.
  - Un SGR cuenta como **entregado** si está en PRO o PAP.
  - Los desestimados conservan sus horas y su facturación, porque el trabajo se hizo, pero no cuentan como entregas ni para el tiempo de entrega. Se informan aparte.
- **Devoluciones.** Son SGR devueltos **al cliente** por falta de datos o consultas adicionales para continuar. Es espera ajena al equipo: no se usan como indicador de calidad del equipo, y su efecto en la fecha se descuenta a través de las horas pausadas. El reporte *Tiempos y devoluciones* avisa cuántos SGR tienen devoluciones sin horas pausadas registradas, porque en esos casos la espera no se puede descontar.
- **Año del reporte.** Un SGR pertenece al año de su **fecha de implementación**. En los reportes por fase, las entregas mensuales se agrupan por fecha de fin de la fase; «Previo» reúne las que terminaron antes de ese año.

## Definiciones de los indicadores

- **Índice de cumplimiento** = horas presupuestadas ÷ horas trabajadas, calculado solo sobre SGR con horas cargadas.
  - 1 o más: dentro del presupuesto (verde).
  - Entre 0,91 y 1: desvío de hasta 10 % (ámbar).
  - Menos de 0,91: desvío mayor a 10 % (rojo).
- **SGR sin horas cargadas.** Son los que tienen horas presupuestadas y cero trabajadas. Se muestran aparte para no inflar el índice.
- **Horas trabajadas no facturadas.** Es la suma del excedente sobre lo presupuestado en los SGR que lo superaron. La facturación de la planilla se calcula sobre horas presupuestadas: 240.000 Gs/h en desarrollo y 200.000 Gs/h en testing en la mayoría de los SGR.
- **Devueltos al cliente.** SGR con al menos una devolución al cliente.

## Reportes

- **Resumen:** SGR entregados por mes y acumulado del año, indicadores generales, comparación entre desarrollo y testing, y horas por mes.
- **Desarrollo y Testing:** productividad por persona (SGR, horas, desvío, índice, porcentaje en presupuesto, horas por SGR, SGR por mes activo, devoluciones, días netos, pausa), entregas mensuales, distribución por desvío y precisión de la estimación por SGR.
- **Tiempos y devoluciones:** duración por fase, tramos del tiempo total de entrega, impacto de las devoluciones y SGR con más pausa.
- **Por área y tipo:** desglose por tipo de requerimiento, departamento, equipo y solicitante.
- **Facturación:** importes por período, SGR sin fecha de facturación y horas no facturadas.
- **Requerimientos:** detalle buscable y ordenable, con exportación a CSV.

Todos se filtran por año, servicio, equipo (incluidos los grupos «Equipos de Onnix» y «Equipos DITA y DPJ»), tipo y estado. Cada filtro admite **varios valores**: dentro de un filtro se combinan con «o» y entre filtros con «y». Con varios años, los gráficos mensuales muestran cada mes de cada año y el acumulado se reinicia al empezar cada año.

Cada reporte tiene un botón **Exportar PDF**: abre el diálogo de impresión del navegador, donde se elige «Guardar como PDF». El PDF sale en A4 apaisado, en colores claros, con el título, los filtros aplicados, la fecha de generación y el archivo de datos usado; el nombre del archivo es el título del reporte.

## Estructura

```
supabase/migrations/   esquema, RLS y vistas con las reglas de negocio
scripts/               migración y alta del primer administrador
src/middleware.ts      protección de rutas
src/lib/planilla.ts    lectura y validación del CSV
src/lib/importar.ts    reemplazo transaccional de datos
src/lib/reportes.ts    consultas de los reportes
src/lib/lectura.ts     textos de lectura automática
src/components/        gráficos SVG, filtros y tablas
src/app/(app)/         páginas de reportes y administración
src/app/login, invitacion/[token]   acceso
```
