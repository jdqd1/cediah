# Validación del mapa espacial

Fecha de ejecución: 2026-09-08 a 2026-09-10. Base: `2d9c363ce36da7e70b4909ab2be3a5a2c5abb98c`.

El alcance de esta entrega es local. Preview y producción son **NO VERIFICADO**: no se ejecutaron migraciones, restauraciones ni activaciones remotas. PGlite ejecuta SQL PostgreSQL en el harness, pero no sustituye una prueba con dos conexiones del servicio PostgreSQL de preview.

## Comprobaciones mecánicas

| Comprobación | Estado | Evidencia |
| --- | --- | --- |
| Contratos | PASS | Compilación `@cediah/contracts`; log de validación. |
| API | PASS | 24 archivos, 175 pruebas; `mapa-final-api.log`. |
| Web | PASS | 20 archivos, 92 pruebas; `mapa-final-web.log`. |
| Lint | PASS | API y web sin errores ni warnings; se excluyen artefactos generados de Playwright. |
| Typecheck | PASS | Contratos, API y web. |
| Build final | PASS | Compilación optimizada completa de contratos, API y web; `evidencias-mapa/build.txt`. |
| Diff final | PASS | `git diff --check` sin incidencias. |
| Navegador final | NO VERIFICADO | El recorrido de actividad/persistencia pasó en escritorio y móvil. Pendiente de la nueva ejecución conjunta con edición, cambio de cuenta y volumen. |
| Dependencias | PASS | Audit del lockfile base y actual: mismos 14 avisos, ningún identificador nuevo. Esto no significa ausencia de vulnerabilidades. |

El audit conserva avisos previos, incluidos críticos de Next.js y altos/moderados de otras dependencias. No se actualizaron paquetes ajenos al mapa. Los informes íntegros están en `evidencias-mapa/audit-baseline.json` y `evidencias-mapa/audit.json`. El único paquete nuevo de producción es React Flow 12.11.6; Playwright 1.63.0 se utiliza para pruebas. Los cambios de peer de Next/better-auth en el lockfile proceden de añadir Playwright, sin cambiar sus versiones.

## Matriz del plan maestro

PASS se limita al método indicado en la evidencia. Una comprobación local no afirma haber probado dispositivos físicos, un lector de pantalla real ni un servicio remoto.

| ID | Estado | Evidencia y alcance |
| --- | --- | --- |
| F01 | PASS | `learning-map.spec.ts` recorre Anatomía/Tórax/Corazón; `learning-map-persistence.spec.ts` abre una guía mediante API/BFF/SQL y vuelve a la misma URL. |
| F02 | PASS | Recarga del enlace de lección y reapertura después de una sesión real. |
| F03 | PASS | Atrás/adelante y breadcrumbs en el recorrido; la prueba de transiciones añade recorridos repetidos. |
| F04 | PASS | Movimiento con flechas, confirmación y recarga: transformación Flow idéntica. Snapshot y cola tienen pruebas independientes. |
| F05 | PASS | IDs ajenos/ascendencia inválida rechazados por proveedor/API; salida al root y cierre al padre. |
| F06 | PASS | Test SQL de agregado sin inscripción, deduplicación y pertenencia; prueba UI contextual incluida en la ejecución final. |
| F07 | PASS | Agrupación conserva referencias originales y no duplica progreso; quitar/deshacer preserva identidad. |
| F08 | PASS | Complete-block cambia cobertura 1→2 sin completar pasos; restauración devuelve la entrada original. |
| F09 | PASS | Catálogo paginado, pertenencia contextual y sugerencia determinista de bloque incompleto. |
| F10 | PASS | Menús y mover con flechas en E2E; lista conserva controles. Prueba de pan adicional incluida. |
| F11 | PASS | Zoom no cambia URL, reduced motion y cancelación de cargas; navegación rápida consulta la URL actual. |
| F12 | PASS | `map-helpers.test.ts`: 200 coordenadas deterministas, nuevo elemento conserva todas las anteriores y drop solo recoloca el movido. |
| F13 | PASS | `learning-map-contract.test.ts`: redondeo 1/8, límite 99, vacío y deduplicación; agregado real SQL por unidad. |
| F14 | PASS | Regresión del dominio de aprendizaje y DTO de alternativas; la guía tiene recorrido de navegador. Los cuatro formatos no se recorrieron manualmente desde el nuevo panel. |
| F15 | PASS | Prueba de versión fijada, publicación posterior, upgrade con stableKey ausente y null/unavailable; UI segura para contenido ausente. |
| F16 | NO VERIFICADO | Cola local prueba respuesta perdida, retry inmutable, borrador nuevo y elección de conflicto. Falta PostgreSQL real con dos conexiones. |
| F17 | PASS | Launcher usa el dominio existente; recorrido de guía real y regresión de intentos/progreso/premios. |
| V01 | NO VERIFICADO | Capturas finales de seis estados pendientes de recopilar y revisar. |
| V02 | PASS | Fixtures 0/13/100 y aserciones de Corazón; selección usa borde independiente del estado. |
| V03 | NO VERIFICADO | Pendiente de la revisión final de capturas de títulos largos y medidas. |
| V04 | PASS | Cálculo WCAG de tokens: CTA 12,11:1; texto 11,96:1; secundario 6,13:1; borde seleccionado 3,97:1; etiquetas 5,77:1. |
| V05 | PASS | Controles propios de zoom y fit; miniatura condicionada a volumen y contenido fuera del encuadre. |
| V06 | PASS | Fixture de error y estado vacío, mensajes de guardado/conflicto y retry de transporte probados. |
| A01 | PASS | Diálogo por teclado, foco inicial, Escape y retorno al botón; movimiento con flechas/Enter. |
| A02 | PASS | Hoja modal móvil y panel de escritorio en los recorridos; inert, trampa y restauración del foco. |
| A03 | NO VERIFICADO | Reflujo de documento en móvil ya probado; capturas 320/768/1024/1440 de la ejecución final pendientes. |
| A04 | PASS | Controles CSS ≥44 px, safe-area en CTA y drag explícito; emulación móvil. Teléfono físico NO VERIFICADO. |
| A05 | NO VERIFICADO | Nombres y estados accesibles y reduced motion probados en navegador; no se utilizó lector de pantalla real. |
| P01 | PASS | SQL con 5.000 referencias y nivel de 200; DTO sin manifiestos/soluciones, ocho consultas. Caché 12 niveles/2 MiB. |
| P02 | NO VERIFICADO | Se incorpora muestra de 30 transiciones tras 5 warmups; el SLO de preview requiere build y medición de ese ambiente. |
| P03 | PASS | Muestra local del proveedor PGlite: p95 388 ms, 30 lecturas, ocho consultas; `evidencias-mapa/root-performance.json`. HTTP/PostgreSQL remoto NO VERIFICADO. |
| P04 | NO VERIFICADO | Estado de arrastre local al canvas y caché acotada por diseño/tests; falta perfil React/handler p95 en preview. |
| S01 | PASS | Pruebas parametrizadas de escritura y lectura entre dos cuentas; no se confía en usuario ni padre enviados por el cliente. |
| S02 | NO VERIFICADO | Harness confirma RLS y ausencia de grant anon. Falta verificación de roles efectivos del servicio remoto. |
| S03 | PASS | Contratos estrictos, retorno malicioso rechazado, allowlist y origen externo rechazado en BFF. |
| S04 | PASS | DTOs estrictos y test de exclusión de manifiestos/soluciones; respuestas privadas y observabilidad sin títulos/cookies/posiciones. |
| S05 | NO VERIFICADO | Prueba de cuenta diferente y sessionStorage corrupto incluida en la ejecución final de navegador. |
| R01 | PASS | Cuatro combinaciones de banderas, endpoints nuevos cerrados por defecto y suite de rutas/sesiones existentes. |
| R02 | NO VERIFICADO | Migración sobre esquema anterior comprobada en harness; backup/restore remoto pendiente. |
| R03 | NO VERIFICADO | API/web/lint/tipos pasan; cierre pendiente de build, navegador y diff final. |

## Reproducción y limitaciones

Los comandos y la configuración de servidores están en `MAPA-OPERACION.md`. No ejecutar builds/typecheck mientras está activo un harness PGlite de pruebas. Para el navegador real de prueba, utilizar `MAP_E2E_REAL=true`; la omisión de esa variable omite explícitamente las pruebas SQL y no constituye validación de persistencia.

El benchmark local mide el proveedor en PGlite y no contiene PII. Las mediciones en desarrollo incluyen instrumentación y no se presentan como rendimiento productivo. El rollback de UI consiste en apagar la bandera del mapa, conservando las tablas; el procedimiento remoto está documentado, no ejecutado.
