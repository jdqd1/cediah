# Validación del mapa espacial

Fecha de ejecución: 2026-09-08 a 2026-09-12. Base: `2d9c363ce36da7e70b4909ab2be3a5a2c5abb98c`.
Revisión del código validada: `bed9155` (`mapa`).
Revisión de activación inicial en web y API: `221fd80`, descendiente de `bed9155`. La allowlist productiva quedó corregida en `80bb88a`; la revisión actual de `main` incorpora además la remediación de dependencias descrita abajo.

El hito local está validado y el mapa está activo en producción desde el 2026-09-12. Se aplicó la migración a PostgreSQL real, se verificaron roles, se probó el estado apagado y se completó un smoke autenticado de API y navegador. No existe un ambiente preview del mapa; backup/restore, dos conexiones PostgreSQL, rendimiento remoto repetido, dispositivo físico y lector de pantalla real permanecen **NO VERIFICADO**.

## Comprobaciones mecánicas

| Comprobación | Estado | Evidencia |
| --- | --- | --- |
| Contratos | PASS | Compilación `@cediah/contracts`; `evidencias-mapa/contracts.txt`. |
| API | PASS | 24 archivos, 175 pruebas; `evidencias-mapa/api.txt`. |
| Web | PASS | 20 archivos, 92 pruebas; `evidencias-mapa/web.txt`. |
| Lint | PASS | API y web sin errores ni warnings; se excluyen artefactos generados de Playwright. |
| Typecheck | PASS | Contratos, API y web. |
| Build final | PASS | Compilación optimizada completa de contratos, API y web; `evidencias-mapa/build.txt`. |
| Diff final | PASS | `git diff --check` sin incidencias. |
| Navegador final | PASS | 15 pruebas pasan en 4,1 minutos; una omisión prevista del benchmark en móvil. API/SQL efímeros activos. `evidencias-mapa/browser.txt`. |
| Dependencias | PASS | El audit actual informa 0 avisos en todas las severidades. La base histórica tenía 14 avisos: 8 moderados, 4 altos y 2 críticos. `evidencias-mapa/audit-baseline.json`, `audit.json` y `dependency-remediation.txt`. |

## Comprobaciones remotas

| Comprobación | Estado | Evidencia |
| --- | --- | --- |
| Esquema productivo | PASS | `0016_learning_maps.sql` aplicada en una transacción; checksum `4874aad1…b786be4f` en `cediah_schema_migrations` y migración Supabase `20260912153059_cediah_0016_learning_maps`. |
| Seguridad productiva | PASS | Cuatro tablas con RLS, cuatro políticas para `cediah_runtime`, 16 grants de backend y cero privilegios de tabla para `anon`/`authenticated`. Supabase Security Advisor sin hallazgos. |
| Flag apagada | PASS | API del mapa respondió 404; `/health`, `/aprendizaje/mapa` y `/aprendizaje?tab=rutas` conservaron respuesta HTTP válida. |
| Activación | PASS | Render `dep-dain1he7bikc739b22hg`, revisión `221fd80`, estado `live`; `/health` 200 y endpoint del mapa sin sesión 401 con `private, no-store`. |
| Smoke autenticado | PASS | Cuenta temporal: summary sin mapa, ensure, nodo, replay idempotente, summary/level, layout persistido y render visual del nodo. Limpieza posterior: cero usuarios, mapas, nodos, entradas, layouts o recibos huérfanos de la prueba. |
| Concurrencia HTTP productiva | PASS | Dos sesiones autenticadas enviaron mutaciones simultáneas con la misma versión: respuestas 200/409 y un solo nodo persistido. No se instrumentó el identificador de dos conexiones PostgreSQL distintas. |
| Lectura API productiva | NO VERIFICADO | Muestra auxiliar con volumen pequeño: 5 warmups, 30 lecturas directas, mediana 348,6 ms y p95 412,7 ms. Cumple el presupuesto temporal, pero no sustituye el dataset preview de 5.000 referencias/200 elementos. |
| Errores | PASS | La sincronización inicial reveló que `render.yaml` omitía `koraz.app` de `WEB_ORIGINS`; un registro devolvió 500 y no creó usuario. Se amplió la allowlist, se redesplegó y se repitió la prueba. Sin errores de Vercel ni del mapa después de la corrección. |
| Backup/restore preview | NO VERIFICADO | El panel informa “No backups” y no existe branch preview. La migración fue aditiva/transaccional y no modificó tablas existentes, pero eso no sustituye restaurar una copia. |

Render emitió un warning preexistente de Better Auth durante el registro: el rate limiter no pudo resolver la IP del cliente detrás del proxy y utilizó un bucket compartido por ruta. No causó errores en el smoke del mapa, pero la configuración de `trustedProxies`/cabeceras de IP debe revisarse como mantenimiento de autenticación separado.

La auditoría publicada después de la activación detectó avisos nuevos para las versiones fijadas en el lockfile. Se actualizaron Next.js a 16.3.5, Tiptap a 3.31.3, Nodemailer a 9.1.1, Fastify a 5.12.1 y Vitest a 4.1.11; los overrides de Sharp y js-yaml pasaron a 0.35.4 y 4.3.2. El audit final informa cero vulnerabilidades. React Flow 12.11.6 sigue siendo el único paquete de producción añadido por el mapa y Playwright 1.63.0 continúa como herramienta de pruebas.

Las capturas finales están en `evidencias-mapa`: los prefijos `desktop-` y `mobile-` identifican los dos proyectos de Playwright; `root`, `node`, `block`, `lesson`, `direct` y `mixed` cubren los seis estados. `long-*` contiene la lista y `long-canvas-*` el lienzo en las cuatro anchuras. `persistent-map` corresponde al recorrido con API y SQL, no a fixtures. El indicador de Next visible en las capturas pertenece al servidor de desarrollo.

## Matriz del plan maestro

PASS se limita al método indicado en la evidencia. Una comprobación local no afirma haber probado dispositivos físicos, un lector de pantalla real ni un servicio remoto.

| ID | Estado | Evidencia y alcance |
| --- | --- | --- |
| F01 | PASS | `learning-map.spec.ts` recorre Anatomía/Tórax/Corazón; `learning-map-persistence.spec.ts` abre una guía mediante API/BFF/SQL y vuelve a la misma URL. |
| F02 | PASS | Recarga del enlace de lección y reapertura después de una sesión real. |
| F03 | PASS | Atrás/adelante y breadcrumbs en el recorrido; la prueba de transiciones añade recorridos repetidos. |
| F04 | PASS | Movimiento con flechas, confirmación y recarga: transformación Flow idéntica. Snapshot y cola tienen pruebas independientes. |
| F05 | PASS | IDs ajenos/ascendencia inválida rechazados por proveedor/API; salida al root y cierre al padre. |
| F06 | PASS | Test SQL de agregado sin inscripción, deduplicación y pertenencia; edición contextual por UI en escritorio y móvil. |
| F07 | PASS | Agrupación conserva referencias originales y no duplica progreso; quitar/deshacer preserva identidad. |
| F08 | PASS | Complete-block cambia cobertura 1→2 sin completar pasos; restauración devuelve la entrada original. |
| F09 | PASS | Catálogo paginado, pertenencia contextual y sugerencia determinista de bloque incompleto. |
| F10 | PASS | Menús y mover con flechas en E2E; la lista expone también menús fuera del encuadre. Pan sobre 200 elementos sin cambiar URL. |
| F11 | PASS | Zoom no cambia URL, reduced motion y cancelación de cargas; navegación rápida consulta la URL actual. |
| F12 | PASS | `map-helpers.test.ts`: 200 coordenadas deterministas, nuevo elemento conserva todas las anteriores y drop solo recoloca el movido. |
| F13 | PASS | `learning-map-contract.test.ts`: redondeo 1/8, límite 99, vacío y deduplicación; agregado real SQL por unidad. |
| F14 | PASS | Regresión del dominio de aprendizaje y DTO de alternativas; la guía tiene recorrido de navegador. Los cuatro formatos no se recorrieron manualmente desde el nuevo panel. |
| F15 | PASS | Prueba de versión fijada, publicación posterior, upgrade con stableKey ausente y null/unavailable; UI segura para contenido ausente. |
| F16 | NO VERIFICADO | Cola local prueba respuesta perdida, retry inmutable, borrador nuevo y elección de conflicto. En producción, dos sesiones simultáneas produjeron 200/409 y un solo nodo. Falta instrumentar dos conexiones PostgreSQL distintas en preview. |
| F17 | PASS | Launcher usa el dominio existente; recorrido de guía real y regresión de intentos/progreso/premios. |
| V01 | PASS | Seis estados capturados en escritorio/móvil; revisión visual de raíz, nodo, bloque, lección, contenido directo y mixto. Archivos `desktop-*.png` y `mobile-*.png`. |
| V02 | PASS | Fixtures 0/13/100 y aserciones de Corazón; selección usa borde independiente del estado. |
| V03 | PASS | Capturas y medición DOM a 320/768/1024/1440 px: alturas uniformes en la variante larga, tarjetas sin solapamientos y contenido dentro del fondo en lista. |
| V04 | PASS | Cálculo WCAG de tokens: CTA 12,11:1; texto 11,96:1; secundario 6,13:1; borde seleccionado 3,97:1; etiquetas 5,77:1. |
| V05 | PASS | Controles propios de zoom y fit; miniatura condicionada a volumen y contenido fuera del encuadre. |
| V06 | PASS | Fixture de error y estado vacío, mensajes de guardado/conflicto y retry de transporte probados. |
| A01 | PASS | Diálogo por teclado, foco inicial, Escape y retorno al botón; movimiento con flechas/Enter. |
| A02 | PASS | Hoja modal móvil y panel de escritorio en los recorridos; inert, trampa y restauración del foco. |
| A03 | PASS | Sin desbordamiento horizontal del documento a 320/768/1024/1440 px; cabecera compacta sin compresión. Lista desplazable y pan del lienzo conservan acceso al contenido. |
| A04 | PASS | Objetivos de control de 44 px en modo compacto, safe-area en CTA y drag explícito; emulación móvil. Teléfono físico NO VERIFICADO. |
| A05 | NO VERIFICADO | Nombres y estados accesibles y reduced motion probados en navegador; no se utilizó lector de pantalla real. |
| P01 | PASS | SQL con 5.000 referencias y nivel de 200; DTO sin manifiestos/soluciones, ocho consultas. Caché 12 niveles/2 MiB. |
| P02 | NO VERIFICADO | Muestra local: p95 462 ms en 30 transiciones tras 5 warmups, incluyendo automatización y Next dev; `navigation-performance.json`. El SLO de preview requiere medir ese ambiente. |
| P03 | PASS | Muestra local del proveedor PGlite: p95 388 ms, 30 lecturas, ocho consultas; `evidencias-mapa/root-performance.json`. Muestra productiva pequeña directa: p95 412,7 ms; el volumen remoto representativo sigue NO VERIFICADO. |
| P04 | NO VERIFICADO | Estado de arrastre local al canvas y caché acotada por diseño/tests; falta perfil React/handler p95 en preview. |
| S01 | PASS | Pruebas parametrizadas de escritura y lectura entre dos cuentas; no se confía en usuario ni padre enviados por el cliente. |
| S02 | PASS | PostgreSQL productivo confirma RLS en las cuatro tablas, políticas/grants exclusivos de `cediah_runtime` y cero permisos para `anon`/`authenticated`. |
| S03 | PASS | Contratos estrictos, retorno malicioso rechazado, allowlist y origen externo rechazado en BFF. |
| S04 | PASS | DTOs estrictos y test de exclusión de manifiestos/soluciones; respuestas privadas y observabilidad sin títulos/cookies/posiciones. |
| S05 | PASS | Cambio de cuenta en escritorio/móvil borra encuadres privados (incluido uno corrupto), rechaza el enlace de la otra cuenta y permite abrir el mapa propio vacío. |
| R01 | PASS | Cuatro combinaciones de banderas, endpoints nuevos cerrados por defecto y suite de rutas/sesiones existentes. |
| R02 | NO VERIFICADO | Migración productiva aplicada y restricciones verificadas sin pérdida ni cambios en tablas existentes. Backup/restore preview no se pudo ejecutar: el plan actual no ofrece backup y no existe branch de preview. |
| R03 | PASS | Contratos, 175 pruebas API, 92 web, lint, tipos, build optimizado y audit sin vulnerabilidades. El recorrido de navegador posterior a la remediación completó 15 pruebas y la omisión prevista del benchmark móvil. |

## Reproducción y limitaciones

Los comandos y la configuración de servidores están en `MAPA-OPERACION.md`. No ejecutar builds/typecheck mientras está activo un harness PGlite de pruebas. Para el navegador real de prueba, utilizar `MAP_E2E_REAL=true`; la omisión de esa variable omite explícitamente las pruebas SQL y no constituye validación de persistencia.

El benchmark local mide el proveedor en PGlite y no contiene PII. Las mediciones en desarrollo incluyen instrumentación y no se presentan como rendimiento productivo. El rollback de UI consiste en apagar la bandera del mapa, conservando las tablas. El estado apagado se comprobó antes de la activación; no se ejecutó una restauración de base de datos.
