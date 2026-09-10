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
6. La activación productiva es un hito separado: requiere la autorización del responsable y el smoke del ambiente. Esta implementación local no ha publicado ni activado servicios remotos.

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

No se verificaron en un ambiente remoto la restauración de backup, los roles reales, la concurrencia con dos conexiones ni la activación. Esos resultados deben añadirse con evidencia antes de declarar el hito de preview o producción.
