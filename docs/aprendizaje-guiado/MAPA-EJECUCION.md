# Ejecución del mapa espacial

Inicio: 2026-09-08. Base: `2d9c363ce36da7e70b4909ab2be3a5a2c5abb98c`.
Estado inicial limpio; sin AGENTS.md aplicables encontrados. Se conserva el plan y la documentación histórica.

## Registro de implementación

Implementación realizada en el checkout compartido, sin subagentes ni publicación. Se conserva el plan maestro. Las comprobaciones finales y la matriz de aceptación se registran por separado en `MAPA-VALIDACION.md`; esta tabla identifica el código entregado, no sustituye esas pruebas.

| Tarea | Resultado y archivos principales |
| --- | --- |
| T001 | Línea base PASS: contratos, API (154 pruebas), web (82), lint, tipos y build. React Flow 12.11.6 fijado; licencia MIT y peers React ≥17 comprobados con npm. |
| T002 | Contratos estrictos, DTOs sin manifiestos, discriminantes, límites y proveedor en `packages/contracts/src/learning-map.ts`. |
| T003 | Migración aditiva 0016, cuatro tablas, índices, referencias compuestas y RLS; tipos Kysely. |
| T004 | Proveedor PostgreSQL y `ensure` idempotente; importación inicial única por tema sin modificar inscripciones. |
| T005 | Resolver de root/nodo/bloque/lección con validación de propiedad, ascendencia, versión fijada y stableKey. |
| T006 | Progreso por unión de grupos de pasos esenciales, agregado en SQL por unidad; redondeo/cap99/null. |
| T007 | Crear, renombrar, agregar, quitar, layout y restaurar; transacción, savepoint, recibos y versiones separadas. |
| T008 | Agrupación por referencias canónicas, origen intacto y complete-block con deshacer. |
| T009 | Búsqueda normalizada, cursor estable, pertenencia contextual, relaciones por tema/orden y sugerencias con motivos. |
| T010 | Fastify con identidad de sesión, validación, límites, respuestas privadas y observabilidad `map.*`. |
| T011 | Allowlist BFF y lector servidor `learning-map-api.ts`; validación de respuesta y origen. |
| T012 | Bandera subordinada apagada por defecto, capacidad de sesión y nueva entrada bajo AppShell/RouteMain. |
| T013 | URL canónica, History API, enlaces directos, atrás/adelante y retorno validado sin open redirect. |
| T014 | Caché LRU acotada por cuenta, carga cancelable y prefetch limitado; invalidación protege contra respuestas anteriores. |
| T015 | Cola espacial por nivel; retry conserva cuerpo/clave; conflictos requieren elección; rutas de origen guardadas por cola. |
| T016 | Grid determinista, colocación incremental y corrección de solapamiento de la tarjeta movida. |
| T017 | Tokens marfil/blanco/verde/terracota, estructura de workspace y CSS de paneles. |
| T018 | 21 iconos SVG locales controlados; Phosphor para controles. |
| T019 | Nodos React Flow memoizados, botón accesible, menú, drag handle y selección. |
| T020 | Lienzo dinámico, nodos controlados, edges semánticos, zoom/fit/miniatura condicional y render visible desde 60 elementos. |
| T021 | Transición 120+120 ms y encuadre por nivel; reduced motion elimina movimiento. |
| T022 | Cabecera, breadcrumbs, resumen y panel de información. |
| T023 | Roadmap de actividades/alternativas con estado confirmado y CTA; no se agrega pestaña de notas vacía. |
| T024 | Launcher compartido con sesiones existentes, inscripción al comenzar, intento persistente y `returnTo` seguro. |
| T025 | Buscador con debounce, filtros, paginación y destino contextual (incluido menú de un nodo). |
| T026 | Crear/renombrar/quitar, selección/agrupación, mover por teclado y ordenar con deshacer. |
| T027 | Sugerencias y bloques incompletos en panel ancho o modal compacto. |
| T028 | Lista alternativa, modal con foco/inert, retorno de foco, objetivos de control y adaptación móvil. |
| T029 | Fixtures de seis estados y variantes vacío/error/retirado/largo/200 elementos, solo en desarrollo. |
| T030 | Pruebas de contratos, SQL, versiones, agrupación, aislamiento, recibos, caché, transporte, BFF y regresión. |
| T031 | Playwright escritorio/móvil, servidores automáticos, API efímera, actividad real, persistencia, edición, capturas. |
| T032 | Dataset SQL de 5.000 referencias/200 nodos, 5 warmups y 30 muestras; ocho consultas por lectura; artefacto JSON. Rendimiento remoto pendiente. |
| T033 | Revisión de capturas detectó y corrigió contenedor comprimido, cabecera móvil, superposición de controles y retorno de foco. Capturas finales en validación. |
| T034 | Procedimiento de migración, preview, rollback de bandera y recuperación en `MAPA-OPERACION.md`. Ambiente remoto NO VERIFICADO. |
| T035 | Documentación de ejecución, operación y matriz de validación; cierre local sujeto a los resultados finales registrados. |
| T036 | Fuera de alcance: notas privadas opcionales no solicitadas. |

## Incidencias resueltas durante la ejecución

- La página real necesitaba el contenedor RouteMain que ya utilizaban las fixtures. Se integró mediante AppShell, que respeta el shell persistente y evita duplicarlo.
- React Flow desactivaba eventos de puntero en nodos no seleccionables/no arrastrables. Se habilitaron para los controles del nodo, manteniendo el arrastre exclusivo del modo Organizar.
- El retorno rápido podía consultar un nivel anterior; atrás consulta la URL actual y las pruebas esperan el estado semántico correspondiente.
- La cabecera móvil dejaba el lienzo sin altura útil y los controles interceptaban una tarjeta. Se adaptó la cabecera y se reservó espacio para controles.
- La pérdida de respuesta espacial conservaba la petición pero podía borrar movimientos posteriores. La cola separa lote en vuelo y borrador.
- El buscador del menú de un nodo utilizaba inicialmente la pertenencia del root. Se propagó el destino explícito y se permite reutilizar contenido entre nodos diferentes.
- Las suites PGlite concurrentes podían provocar timeouts de inicialización en Fastify. La configuración API limita a dos workers, sin omitir pruebas ni aumentar globalmente sus límites.
- La cola conserva ahora las posiciones confirmadas al volver a un nivel todavía en caché, sin retroceder su versión.
- El reintento de carga inicial vuelve a comprobar y crear el mapa cuando la primera petición falla antes de inicializarlo.
- Los niveles con títulos largos utilizan una variante uniforme de 260 px, tres líneas y separación calculada con esa altura. El nombre íntegro se conserva en el nombre accesible, información y lista.
- La lista ajusta el fondo de cada tarjeta a todo su contenido; la cabecera compacta mantiene su altura y separa breadcrumbs de navegación global.
- Si el nivel no cabe a zoom 0,65, el encuadre inicial centra el siguiente elemento disponible; las seis tarjetas raíz utilizan dos columnas en compacto. El resto sigue accesible mediante pan y lista.

Los archivos de log locales `mapa-*.log` son salidas de trabajo ignoradas por Git. Los resultados y artefactos seleccionados se conservan en la documentación de validación. No se han aplicado migraciones ni cambiado banderas de producción.
