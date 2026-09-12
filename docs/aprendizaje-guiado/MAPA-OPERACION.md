# Operación del mapa de aprendizaje

## Alcance y activación

La implementación añade `/aprendizaje/mapa` y `/v1/guided-learning/map/*`. El navegador utiliza exclusivamente el BFF `/api/guided-learning/map/*`. La identidad procede de la sesión; ningún cuerpo de mutación admite un identificador de usuario.

La bandera `GUIDED_LEARNING_MAP_ENABLED` vale `false` por defecto y requiere también `GUIDED_LEARNING_ENABLED=true`. Con cualquiera apagada, los endpoints del mapa no se registran y la página nueva devuelve 404. La entrada `/aprendizaje` solo redirige al mapa cuando ambas están activas y no se solicitó una pestaña clásica. Hoy, Rutas, Progreso y las sesiones existentes permanecen disponibles.

Antes de activar en un ambiente:

1. Conservar su copia de seguridad y comprobar la restauración según el procedimiento de PostgreSQL del proyecto.
2. Ejecutar las migraciones con el runner habitual (`pnpm db:migrate`), con `DATABASE_URL` y la ruta de migraciones configuradas para ese ambiente. La nueva migración es `0016_learning_maps.sql`; no modifica progreso ni contenido académico.
3. Comprobar las cuatro tablas, índices, claves foráneas, RLS y permisos del rol real `cediah_runtime`. Las políticas dan acceso al backend; el aislamiento por propietario se aplica en el proveedor. Los roles de navegador no reciben grants.
4. Publicar el código con la bandera del mapa apagada. Verificar las rutas clásicas.
5. En preview, activar ambas banderas y recorrer con dos cuentas las pruebas de `MAPA-VALIDACION.md`, incluidas dos conexiones PostgreSQL y pérdida de respuesta.
6. La activación productiva es un hito separado: requiere la autorización del responsable y el smoke del ambiente.

## Estado productivo del 2026-09-12

El responsable autorizó la activación. La revisión productiva `221fd80` contiene el commit del mapa `bed9155`. Antes de activar, `/health` respondió 200, el endpoint del mapa respondió 404 con la bandera apagada y las rutas web nueva y clásica respondieron 200.

Se aplicó `0016_learning_maps.sql` a Supabase PostgreSQL dentro de una transacción. El registro de la aplicación conserva el checksum `4874aad19fd76288fa89f3bf3f2b4bc4f10c4d58d076eb0936b3fd63b786be4f`; Supabase la registra como `20260912153059_cediah_0016_learning_maps`. Las cuatro tablas quedaron inicialmente vacías. Se comprobaron sus trece índices, siete claves foráneas, RLS y políticas. `cediah_runtime` tiene SELECT/INSERT/UPDATE/DELETE; `anon` y `authenticated` no tienen privilegios sobre las tablas. Security Advisor no informó hallazgos.

Render activó `GUIDED_LEARNING_MAP_ENABLED=true` mediante el despliegue `dep-dain1he7bikc739b22hg`, revisión `221fd80`, estado `live`. Después, `/health` respondió 200 y el endpoint sin sesión respondió 401 con caché privada. Una cuenta temporal recorrió summary → ensure → crear nodo → replay con la misma clave → level → guardar layout. El replay no duplicó el nodo, la posición se recuperó y la UI productiva mostró “Prueba de humo”. La cuenta y todos sus datos se eliminaron al finalizar; las tablas del mapa y los recibos huérfanos volvieron a cero.

La primera sincronización del Blueprint mostró que la allowlist versionada solo contenía dominios Vercel anteriores. El formulario desde `koraz.app` recibió `Origin not allowed` y no creó datos. Se añadió `https://koraz.app` y `https://www.koraz.app` a `WEB_ORIGINS`, manteniendo los dominios anteriores, y se redesplegó antes de repetir el smoke.

Después de corregir la allowlist, dos sesiones autenticadas enviaron simultáneamente dos nodos con la misma versión esperada. Una petición respondió 200, la otra 409 y quedó un solo nodo, como exige el control optimista. Una muestra auxiliar de lectura directa a la API, con 5 warmups y 30 repeticiones sobre un mapa pequeño, dio mediana 348,6 ms y p95 412,7 ms. No se usa como sustituto del benchmark de volumen en preview. La segunda cuenta temporal también se eliminó con sus datos.

El plan gratuito muestra `No backups` y no hay branch de preview. Se confirmó el costo anunciado de USD 0,01344/h, pero Supabase rechazó la creación porque branching requiere un plan Pro; no se creó ningún recurso facturable. Por ello no se declara probado un restore ni se afirma que las dos peticiones usaron conexiones PostgreSQL distintas. La migración es aditiva y transaccional; no modifica tablas existentes.

## Persistencia y recuperación

- `learning_maps`: un mapa por cuenta y versión estructural.
- `learning_map_nodes`: título, icono, orden y tema de origen del nodo personal.
- `learning_map_entries`: referencia a bloque (`path_id`) o lección (`path_id`, `unit_stable_key`). Los identificadores de ocurrencia son diferentes de la identidad académica.
- `learning_map_layouts`: posiciones por mapa/nivel y su propia versión. Un cambio espacial no modifica la versión estructural.
- `learning_mutation_receipts`: reutilizado para idempotencia y snapshots de deshacer; no se almacena una copia del contenido académico en las tablas del mapa.

`GET` no crea datos. `ensure` importa una sola vez las inscripciones no archivadas, agrupadas por tema. Volver a abrir el mapa no reimporta elementos quitados. Crear/agregar/agrupar no inscribe ni otorga progreso; la inscripción se confirma al comenzar una actividad.

Las mutaciones usan UUID de idempotencia y `expectedVersion`. Conservar la misma clave y el mismo cuerpo cuando se perdió una respuesta. Cambiar el cuerpo exige otra clave. Los fallos de dominio revierten la operación mediante savepoint y conservan su recibo. Un fallo técnico revierte la transacción completa.

El guardado espacial mantiene una petición en vuelo por nivel y conserva los movimientos posteriores. Ante 409, el usuario elige entre aplicar su borrador sobre la versión confirmada o utilizar lo guardado. Nunca se resuelve el conflicto sobrescribiendo en silencio.

Quitar y completar bloque ofrecen deshacer durante 30 segundos. El servidor comprueba caducidad, referencias y versiones. Una edición estructural posterior o un layout incompatible impide restaurar el snapshot anterior; la interfaz muestra el conflicto. El deshacer no altera inscripciones, intentos, memoria, evidencias ni premios.

Límites: 200 nodos raíz, 200 entradas por nodo, 5.000 referencias por mapa, título de 80 caracteres y posiciones finitas entre −100.000 y 100.000. El layout es incremental: se preservan coordenadas existentes y se coloca lo nuevo en espacio libre.

## Navegación y caché

Los enlaces usan `node`, `item` y `unit`. El backend comprueba la ascendencia y la propiedad. La versión académica es la fijada por la inscripción; sin inscripción se utiliza la publicada. Una clave estable ausente tras un upgrade se presenta como no disponible.

El progreso representa la unión de pasos esenciales de las referencias resueltas. El agregado SQL por unidad conserva esa unión sin cargar manifiestos. Se redondea al entero, se limita a 99 hasta completar el total, y el denominador vacío o no disponible usa `null`.

La caché de niveles vive en la instancia de la cuenta: máximo 12 niveles, 2 MiB y TTL de 15 segundos. Las mutaciones invalidan la caché y los prefetch anteriores no pueden repoblarla. El encuadre se conserva en `sessionStorage` con cuenta, mapa, nivel y modo de pantalla; no contiene progreso ni recursos. Las posiciones confirmadas viven en PostgreSQL. El fallo o corrupción de ese almacenamiento opcional utiliza un encuadre seguro.

## Pruebas reproducibles

Primero ejecutar, secuencialmente, contratos, API, web, lint, tipos, build y `git diff --check`, como indica el plan maestro. En este equipo se utilizó `pnpm --config.verify-deps-before-run=false` para evitar que el wrapper local reinstalara dependencias por una diferencia de configuración del store.

Para los navegadores, instalar Chromium una vez:

```powershell
pnpm --filter @cediah/web exec playwright install chromium
```

La configuración Playwright puede arrancar los servidores de desarrollo automáticamente. Para incluir API, SQL y sesiones reales de prueba:

```powershell
$env:MAP_E2E_REAL = 'true'
pnpm --config.verify-deps-before-run=false --filter @cediah/web test:e2e
Remove-Item Env:MAP_E2E_REAL
```

El servidor `apps/api/test/helpers/learning-map-server.ts` exige `NODE_ENV=test` y `MAP_E2E_TEST_SERVER=true`, escucha solo en loopback:4100 y usa PGlite efímero. Su identidad sintética está definida únicamente en ese bootstrap de test, nunca en la aplicación. Los tests abren la web en localhost:3000. Evitar reutilizar en ese puerto un servidor iniciado con otra API. Las capturas y trazas quedan en `apps/web/test-results`; el informe en `apps/web/playwright-report`.

Si Windows bloquea la limpieza de un resultado anterior, ejecutar Playwright con un directorio nuevo bajo `test-results`, por ejemplo `--output test-results/validacion-20260910`. Esto conserva las trazas anteriores y evita confundir una espera de limpieza con un fallo de la aplicación.

Sin `MAP_E2E_REAL=true`, solo se ejecutan fixtures y pruebas visuales; las pruebas de persistencia se omiten expresamente. Las fixtures `/visual-fixtures/mapa` solo están disponibles en desarrollo, usan datos identificados como ficticios y no sustituyen una API fallida. `MAP_E2E_URL` permite utilizar un servidor ya preparado; para preview hay que seleccionar pruebas compatibles con ese ambiente, sin las rutas de fixture de desarrollo.

## Observabilidad y rollback

Las operaciones `map.*` participan en la observabilidad de aprendizaje guiado: duración, método, resultado, código de error y presencia de clave idempotente. No registrar títulos personales, coordenadas completas, cookies, búsquedas o contenido de snapshots. Las respuestas son `private, no-store`.

Ante una incidencia, desactivar `GUIDED_LEARNING_MAP_ENABLED` y reiniciar/republicar la API con la configuración habitual del ambiente. La UI vuelve a la experiencia anterior mediante las capacidades de sesión. Conservar las tablas y los recibos para recuperar el servicio; no borrar datos ni revertir la migración para apagar una interfaz.

La activación, los roles reales y el smoke están verificados en producción. Restauración, concurrencia de dos conexiones y rendimiento repetido siguen pendientes de un ambiente preview. No presentar esos puntos como PASS hasta ejecutarlos allí.
