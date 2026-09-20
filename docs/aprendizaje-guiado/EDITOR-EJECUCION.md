# Ejecución del editor intuitivo de rutas

Fecha de inicio: 19 de septiembre de 2026  
Base analizada por el plan: `1b3b6c8b11796aa070047c38057e6ab36940dcb0`  
HEAD al iniciar la implementación: `c7df680accfeb751f612c95b2577527a0fa6b6d9`

## Estado previo preservado

Antes de modificar archivos había cambios no atribuidos a esta ejecución en:

- `docs/aprendizaje-guiado/HANDOFF-EDITOR-INTUITIVO.md`
- `docs/aprendizaje-guiado/PLAN-MAESTRO-EDITOR-INTUITIVO.md`

Ambos se consideran documentación ya presente y trabajo ajeno. No se reescriben para registrar la ejecución. No se encontraron archivos `AGENTS.md` en el repositorio.

## Tareas

| Tarea | Resultado | Archivos | Evidencia / observación |
|---|---|---|---|
| T001 | PASS | `apps/web/package.json`, `pnpm-lock.yaml`, este documento, `EDITOR-VALIDACION.md`, `evidencias-editor/baseline-*.txt` | Node 24.19.0 y pnpm 11.9.0 usados desde el runtime local. Versiones/licencias/peers confirmados. V02/V03/V04/V08 y V11 PASS. V07 registró un fallo previo de orden no determinista en una aserción de historial; 20/20 suites web y 23/24 suites API pasaron. No se inició la API ni se abrió una conexión de base real. |
| T002 | PASS | `packages/contracts/src/guided-learning.ts`, `apps/api/test/guided-learning-editor-contract.test.ts`, `apps/api/test/guided-learning-routes.test.ts` | Contratos aditivos estrictos y 7 tests nuevos PASS; 18/18 tests del contrato+rutas PASS. Build de contratos PASS. El typecheck API muestra únicamente los dos métodos del proveedor real previstos para T005/T006; no se simuló su implementación. Evidencia: `evidencias-editor/t002-contracts.txt`. |
| T003 | PASS | `apps/web/src/components/learning/editor/editor-model.ts`, `editor-serialization.ts` y sus tests | 9/9 tests PASS y typecheck web PASS. Evidencia: `evidencias-editor/t003-model.txt`. |
| T004 | PASS | `apps/web/src/components/learning/editor/editor-reducer.ts` y test | 9/9 tests PASS y typecheck web PASS. Evidencia: `evidencias-editor/t004-reducer.txt`. |
| T005 | PASS | `apps/api/src/providers/postgres-guided-learning.ts`, `apps/api/test/guided-learning-editor-storage.test.ts` | 4/4 pruebas PGlite nuevas PASS; lint API PASS. Catálogo: 19/20 PASS, conserva el único fallo baseline de orden de historial. Evidencia: `evidencias-editor/t005-storage.txt`. |
| T006 | PASS | `apps/api/src/guided-learning/content-resolver.ts`, `editor-material-details.ts`, `editor-routes.ts`, tests storage/rutas | 18/18 storage+rutas y 2/2 adapters PASS; typecheck API PASS. Evidencia: `evidencias-editor/t006-material-details.txt`. |
| T007 | PASS | `apps/api/src/guided-learning/service.ts`, `apps/api/src/providers/postgres-guided-learning.ts`, `apps/api/src/guided-learning/editor-routes.ts`, tests validation/storage/rutas | 23/23 pruebas focalizadas PASS; typecheck y lint API PASS. Catálogo 19/20 conserva el fallo baseline de orden de historial. Evidencia: `evidencias-editor/t007-validation.txt`. |
| T008 | PASS | BFF de detalle actual/fijado, `editor-api.ts` y tests de transporte | 17/17 pruebas web PASS; typecheck y lint web PASS. Evidencia: `evidencias-editor/t008-transport.txt`. |
| T009 | PASS | páginas `/panel/rutas`, `/nueva`, `/[pathId]`; fachada, `editor-shell.tsx`, CSS Module | Build Next PASS; lint PASS; 35/35 pruebas focalizadas PASS. Radix Tabs integrado. Evidencia: `evidencias-editor/t009-shell.txt`. |
| T010 | PASS | `route-basics.tsx`, `field-help.tsx`, integración y estilos locales | 4/4 pruebas PASS; typecheck y lint web PASS. Evidencia: `evidencias-editor/t010-basics.txt`. |
| T011 | PASS | `unit-card.tsx`, `editor-dialog.tsx`, shell y estilos | 12/12 reducer+unidad PASS; typecheck/lint PASS. Persistencia PATCH de borrado queda NO VERIFICADO hasta T019. Evidencia: `evidencias-editor/t011-units.txt`. |
| T012 | PASS | Query provider/keys/hook, `material-picker.tsx`, fachada y estilos | 22/22 pruebas query/transporte/modelo PASS; typecheck/lint PASS. TanStack Query integrado. Evidencia: `evidencias-editor/t012-material-picker.txt`. |
| T013 | PASS | `activity-card.tsx`, `activity-options.tsx`, `objective-mapping-editor.tsx`, reducer/shell/styles | 18/18 pruebas modelo/reducer/query PASS; typecheck/lint PASS. Radix Accordion/Collapsible y detalle Query integrados. Evidencia: `evidencias-editor/t013-activities.txt`. |
| T014 | PASS | mensajes de validación, navegación, foco y tests editoriales | 31/31 pruebas focalizadas, typecheck y lint web PASS. Cada código se traduce a problema, ubicación, solución y acción sin exponer datos técnicos. |
| T015 | PASS | `use-route-editor.ts`, recuperación, diálogos de salida y tests | 81/81 pruebas puras del editor, V03, typecheck y lint web PASS. Orquestación y protección de cambios verificadas. |
| T016 | PASS | vista previa, flujo editorial, opciones y tests | 11/11 pruebas focalizadas, typecheck y lint web PASS. No se ejecutó publicación real. |
| T017 | PASS | `route-editor.module.css`, fachada y limpieza de CSS legado | V03/V04 PASS; responsive, estados y límites visuales confirmados después en T020/T021. |
| T018 | PASS | fixtures, transporte en memoria, página visual y configuración Playwright | Nueve estados HTTP 200; 17/17 pruebas focalizadas, typecheck y lint web PASS. |
| T019 | PASS | contratos, Fastify, PGlite, validación, mapa y regresión | V06 21/21 y pruebas focalizadas 15/15 PASS. La regresión global observó el fallo de orden heredado, corregido y cerrado en T022. Evidencia: `evidencias-editor/t019-api-storage-regression.txt`. |
| T020 | PASS | suite Playwright, fixtures y componentes editoriales | 30/30 E2E desktop/mobile; Axe sin violaciones, teclado, foco, reflow y recuperación PASS. Evidencia: `evidencias-editor/t020-playwright.txt`. |
| T021 | PASS | CSS/UI, índice reutilizable, capturas y mediciones | 16 capturas revisadas; cinco anchos, zoom equivalente, sticky, contraste, foco y copy PASS. Evidencia: `evidencias-editor/t021-inspeccion-visual.md`. |
| T022 | PASS | `path-upgrade.ts`, documentos de cierre y operación | Historial determinista corregido en producción; V03/V04/V07/V08/V09/V10/V11 PASS. Evidencia: `evidencias-editor/t022-cierre.txt`. |

## T001 — baseline e instalación

### Runtime y dependencias

- El `node` global era 22.22.0 y no se utilizó para los checks del proyecto.
- Runtime local usado: `C:\Users\josed\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe`, versión 24.19.0.
- Corepack respetó `packageManager: pnpm@11.9.0`; no se cambiaron `engines` ni `packageManager`.
- `radix-ui@1.6.7`: MIT; peers React/React DOM 16.8–19 y tipos opcionales.
- `@tanstack/react-query@5.102.8`: MIT; peer React 18–19.
- `@axe-core/playwright@4.13.0`: MPL-2.0; peer `playwright-core >=1.0.0`.
- Instalación final: Radix y TanStack Query en `dependencies`; axe en `devDependencies`; versiones exactas.
- El primer intento de `pnpm add` falló con `EPERM` al renombrar temporalmente `apps/web/package.json`. Se aplicaron exclusivamente las tres entradas autorizadas al manifiesto y se repitieron los dos comandos exactos; ambos finalizaron con exit code 0. El lockfile pasa `pnpm install --frozen-lockfile`.

### Baseline

| Check | Resultado | Evidencia |
|---|---|---|
| V01 | PASS | `evidencias-editor/baseline-v01.txt` |
| V02 | PASS | `evidencias-editor/baseline-v02.txt` |
| V03 preinstalación | PASS | `evidencias-editor/baseline-v03.txt` |
| V04 preinstalación | PASS | `evidencias-editor/baseline-v04.txt` |
| V07 | FAIL previo registrado | `evidencias-editor/baseline-v07.txt`; una aserción esperaba historial 1,2,3 y recibió 2,3,1. |
| V08 | PASS | `evidencias-editor/baseline-v08.txt` |
| V11 | PASS | `evidencias-editor/baseline-v11.txt` |
| V03 posinstalación | PASS | `evidencias-editor/baseline-v03-postinstall.txt` |
| V04 posinstalación | PASS | `evidencias-editor/baseline-v04-postinstall.txt` |

### Símbolos fuente confirmados

Los archivos enumerados en §9 siguen presentes. Se confirmaron en particular `LearningRouteEditor`, `addUnit`, `updateOption`, `validate`, `resolveDefinition`, `createVersion`, `updatePath`, `storedValidation`, `validateLearningPathDefinition`, `canonicalContentRow`, `adapterContent` y `forwardGuidedLearningRequest`. También siguen presentes las migraciones 0010/0016 y los estilos `identity-v3.css`/`learning.css`. El editor anterior aún imprime `issue.message` y `issue.path`, carece de eliminar unidad, valida sin guardar primero y reconstruye configuración en `updateOption`; son los comportamientos a sustituir en las tareas dependientes.

### Aislamiento

No se inició `dev:api`, no se inspeccionó ni utilizó `DATABASE_URL`, no se ejecutaron migraciones y no se tocaron datos reales. La baseline de UI permanece NO VERIFICADO hasta las fixtures de T018 y la inspección de T021.

## T002 — contratos editoriales

Resultado: PASS.

- Se añadieron las instrucciones opcionales `refreshResource` y `expectedSourceVersion` sin invalidar payloads legacy.
- Se añadieron request de comprobación, versión comprobada y contexto estricto de incidencias.
- Se añadió la unión discriminada de detalle editorial `ready | unavailable`, con límites de título, duración, ítems y UUID.
- El proveedor tipado incluye detalle actual, detalle fijado y `expectedVersion` en `validatePath`.
- El stub de rutas falla explícitamente si un test invoca un detalle sin fixture.
- `@cediah/contracts` compila y los tests nuevos/rutas pasan.
- Pendiente esperado: el typecheck de API señala exclusivamente que el proveedor PostgreSQL todavía no implementa `getEditorMaterialDetail` y `getEditorOptionMaterialDetail`. Es la implementación asignada a T005/T006 y no se ocultó con respuestas vacías.

## T003 — modelo, fábricas y serialización

Resultado: PASS.

- El estado editable usa IDs locales obligatorios y mantiene metadata UI separada del request.
- La hidratación clona y conserva todos los objetivos, alternativas, selecciones, mappings, rangos, reglas de finalización e identidades heredadas.
- Las fábricas generan claves estables desde UUID una sola vez y aplican propósito, obligatoriedad y texto por formato únicamente al crear.
- El slug se genera de forma determinista con `creationId`, admite acentos/emoji y queda dentro de 192 caracteres.
- La serialización recorta texto mediante los schemas, omite solo objetivos vacíos no referenciados y devuelve destinos de campo por ID para errores.
- No se resuelven materiales ni se incluyen estados de UI/búsqueda en el request.

## T004 — mutaciones puras

Resultado: PASS.

- Altas, ediciones, eliminación y orden de unidades/actividades se resuelven por ID.
- Eliminar unidad o actividad limpia `recommendedAfter` en toda la ruta sin alterar el orden o las demás identidades.
- Quitar la opción recomendada promueve una sola alternativa; también se admite dejar cero opciones.
- Editar etiqueta/duración conserva config, completionRule, fuente, recompensa y versiones.
- El cambio explícito de material conserva actividad/opción/recompensa y restablece solo config/completionRule/fuente/formato.
- Un objetivo referenciado no se elimina sin destino explícito; la reasignación deduplica objetivos y mappings sin borrar ítems.
- Toda mutación efectiva incrementa `localRevision`, marca dirty e invalida comprobación; IDs ausentes, límites y operaciones activas son no-op.

## T005 — revisiones fijadas y clonación

Resultado: PASS.

- `updatePath` comprueba acceso, estado y versión antes de resolver materiales y vuelve a comprobarlos bajo transacción.
- Una opción existente con el mismo ID/fuente/formato reutiliza su `resourceRevisionId`, incluso si la publicación fuente cambió o fue retirada.
- Altas, reemplazos y refresh explícito resuelven la publicación actual y verifican `expectedSourceVersion`.
- IDs de opción ya existentes fuera de la versión autorizada se rechazan sin reutilizarlos.
- Crear una versión clona snapshots/config y genera filas nuevas de unidad/actividad/opción, conservando stableKeys, objetivos, recompensas y versiones pedagógicas.
- Pruebas PGlite verifican cambio cosmético, clonación, versión fuente obsoleta sin escritura parcial, rollback de metadata/definición/auditoría y autorización antes del resolver.
- La suite catálogo sigue mostrando exclusivamente el fallo baseline de orden de historial; las otras 19 pruebas pasan.

## T006 — detalle editorial actual y fijado

Resultado: PASS.

- La lectura canónica publicada quedó separada de `resolvePublishedRevision`; el GET no crea ítems, recursos ni revisiones.
- El detalle actual resuelve correctamente fuente canónica, incluida la guía enlazada a video, y nunca habilita contenido no publicado mediante `canEditAll`.
- El detalle fijado exige pertenencia de la opción a la última versión editorial accesible, valida hash antes del adapter y usa título/versión del snapshot.
- Fuentes retiradas, no publicadas o revisiones inválidas producen la variante `unavailable`; una opción ajena devuelve 404.
- Ambos endpoints Fastify aplican permiso editorial, entradas UUID/enum estrictas, schema de respuesta y `Cache-Control: private, no-store`.
- Las pruebas PGlite comparan conteos antes/después de ambos GET y confirman cero escrituras, además de distinguir versión fijada de versión actual.

## T007 — validación localizable y coherente

Resultado: PASS.

- Los avisos incluyen IDs y claves estables conocidos de unidad, actividad, opción, objetivo y fuente; la selección inválida se localiza sin inferirla por posición.
- Se detecta `duplicate_unit_key` antes de persistir; cada opción sin revisión válida emite su propio `resource_unavailable` contextual.
- La evidencia sigue usando un `Set` de ítems canónicos: reutilizar tres preguntas como tarjetas mantiene `actualCount: 3` y `requiredCount: 5`.
- `standard` conserva el error bloqueante; `limited` conserva el warning no bloqueante y no se activa implícitamente.
- `validate` acepta un body estricto con `expectedVersion`, rechaza versiones obsoletas, vuelve a leer `edit_version` después de validar y devuelve `validatedEditVersion` confirmado.
- Los POST/PATCH editoriales inválidos devuelven solamente rutas y códigos Zod seguros; no reflejan el payload recibido.
- Un material que cambia durante edición devuelve `resource_changed` como incidencia 422 contextual para dirigir la corrección.
- 23/23 pruebas focalizadas de validador, almacenamiento PGlite y rutas Fastify pasaron; typecheck y lint API pasaron. El catálogo conserva el único fallo baseline no atribuible: historial recibido 2,3,1 frente a 1,2,3.

## T008 — BFF y cliente editorial tipado

Resultado: PASS.

- El BFF añade detalle de material actual y fijado con allowlist exacta de UUID/formato/ruta, sesión existente, validación Zod y `private, no-store`.
- El cliente usa exclusivamente `/api/editor/...`, codifica segmentos y filtros, discrimina `response.ok` y conserva 400/401/403/404/409/422/429/503.
- Crear, guardar, comprobar, transicionar, crear versión, buscar y leer ambos detalles tienen métodos tipados; `validate` envía `expectedVersion` y exige `validatedEditVersion` válido cuando viene en la respuesta.
- Las lecturas aceptan y propagan `AbortSignal`; un abort se vuelve a lanzar y una falla de red se convierte en un error seguro sin filtrar texto privado.
- `unwrapEditorReadResult` distingue catálogo vacío válido de fallo y lanza `EditorQueryError` con código/status seguros para TanStack Query.
- 17/17 pruebas BFF/cliente pasaron; typecheck y lint web pasaron.

## T009 — índice y estructura del editor

Resultado: PASS.

- `/panel/rutas` muestra únicamente el índice y el CTA «Crear ruta»; el formulario ya no aparece debajo del listado.
- `/panel/rutas/nueva` y `/panel/rutas/[pathId]` aplican identidad, feature flag y permisos antes de montar el editor; edición conserva la URL anterior y usa `key={path.id}`.
- La fachada inicializa un único `RouteEditorState` nuevo o hidratado y pasa ese mismo estado a Datos, Actividades y Revisión.
- Las tres secciones usan `Tabs.Root` controlado, `activationMode="manual"`, `List`, `Trigger` y `Content` de Radix.
- Slug y claves internas no se presentan como inputs; el slug se deriva del título para una ruta nueva y queda fijado al hidratar una existente.
- El CSS local inicia la geometría requerida (1120 px, controles de 44 px, inputs de 16 px, tarjetas de 16 px y tokens `--koraz-*`).
- Build Next de producción, typecheck y lint pasaron; 35/35 pruebas focalizadas de modelo/reducer/transporte pasaron.

## T010 — Datos y ayuda mínima

Resultado: PASS.

- Datos muestra únicamente «Título de la ruta», «Tema» y «Descripción breve» como campos principales requeridos, con límites 200/2000 y mensajes enlazados mediante `aria-describedby`.
- No presenta slug, stable keys ni nivel de evidencia; el texto sobre el enlace automático evita exponer su valor técnico.
- La portada conserva las ocho opciones existentes dentro de «Personalizar portada», cerrado inicialmente y sin inventar assets.
- El tema queda vacío con varias opciones y se preselecciona solo cuando existe exactamente uno; sin temas se ofrece un enlace viable a Contenido en otra pestaña.
- `FieldHelp` usa Radix Popover controlado, trigger nativo de 44 px y solo admite las tres familias autorizadas (`objectives`, `alternatives`, `practice-mode`).
- 4/4 pruebas de JSX/modelo pasaron; typecheck y lint web pasaron.

## T011 — unidades, objetivos y eliminación local

Resultado: PASS para la capa de UI/estado; persistencia extremo a extremo pendiente de T019.

- Las unidades usan Radix Accordion controlado por ID; abrir/cerrar no modifica ni pierde el borrador.
- Cada unidad muestra todos sus objetivos, permite añadir y editar, e impide borrar el único objetivo referenciado sin destino.
- Si un objetivo tiene asociaciones y existe otro, la confirmación exige una reasignación explícita; el reducer actualiza `objectiveIds` y mappings por ID.
- El menú Radix Dropdown permite subir/bajar con extremos realmente deshabilitados y encola la confirmación después de cerrar el menú.
- Eliminar unidad usa Radix AlertDialog con Cancelar enfocado, informa el número de actividades y aclara que no elimina fuentes publicadas; no usa `window.confirm` en el flujo nuevo.
- Tras confirmar, el reducer limpia dependencias `recommendedAfter` globales y el foco se dirige a una unidad restante o a «Añadir unidad».
- «Añadir actividad» bloquea y enfoca un objetivo incompleto; la apertura del selector real corresponde a T012.
- 12/12 pruebas de unidad/reducer pasaron; typecheck y lint web pasaron. La prueba de que el borrado termina en PATCH y conserva la versión publicada no se atribuye aquí: queda NO VERIFICADO hasta T019.

## T012 — selector contextual y catálogo

Resultado: PASS.

- La fachada monta un `QueryClientProvider` local con clave actor+ruta/sesión nueva; no existe singleton ni persistencia del cache.
- Los defaults GET son `staleTime=30000`, `gcTime=300000`, `retry=false`, sin refetch por foco/reconexión y `networkMode="always"`.
- El catálogo usa `useInfiniteQuery`, `limit=24`, cursor original, claves por filtros aplicados y páginas deduplicadas derivadas; no mantiene otro array mutable de resultados.
- El detalle actual usa `useQuery` con clave distinta por fuente/formato/versión y propaga el `AbortSignal` hasta `fetch`; cerrar cancela únicamente las queries del scope.
- El modal Radix Dialog implementa los modos tipados `new-activity`, `replace` y `alternative`, títulos/CTA contextuales, filtros explícitos con Buscar/Enter, paginación y estados vacío/error.
- Elegir una fila es provisional; con varios formatos exige selección explícita, con uno lo preselecciona. Cancelar no toca el reducer y confirmar crea la actividad con objetivo/material/detalle aún existentes.
- La UI traduce Video/Guía/Cuestionario/Tarjetas, no presenta UUID/revisión, y el catálogo vacío conserva un enlace a Contenido.
- 22/22 pruebas de claves/defaults/deduplicación/transporte/fábricas pasaron; typecheck y lint web pasaron. El trap de foco y el viewport móvil se verifican en T020.

## T013 — actividades y opciones avanzadas

Resultado: PASS.

- Las actividades usan un Accordion controlado por ID y resumen nombre, formato legible, duración conocida y distintivo «Opcional».
- El detalle actual o fijado se lee con `useQuery` solo desde una actividad montada/visible, con claves separadas y `AbortSignal`; fuentes antiguas se presentan como «Material vinculado», nunca como UUID.
- «Más opciones» usa Radix Collapsible inicialmente cerrado y contiene propósito legible, opcionalidad, duración, texto del botón, recomendación, dependencias y alternativas.
- Editar etiqueta, duración, propósito u orden despacha parches mínimos; las pruebas confirman que config, completionRule, fuente, recompensa y rangos se conservan.
- Cambiar material mantiene IDs/campos de actividad y solo reinicia los datos específicos de la opción; «Usar el nombre del nuevo material» permanece desmarcado.
- Alternativas nuevas se restringen a video/guía o cuestionario/tarjetas según la familia existente; alternativas heredadas se muestran sin convertirlas.
- El panel de preguntas muestra enunciados, nunca UUID, y permite selección/asociación explícita por títulos cuando hay varios objetivos o configuración parcial.
- Referencias de orden rotas se muestran como «Actividad eliminada» con «Quitar»; eliminar actividad limpia dependencias mediante reducer.
- 18/18 pruebas modelo/reducer/query pasaron; typecheck y lint web pasaron. Interacciones completas de teclado quedan para T020.

## T014 — mensajes de validación y navegación

Resultado: PASS.

- Cada código conocido se transforma en un problema breve, ubicación humana, solución y acción; `message`, `path`, UUID y DTO nunca se presentan.
- El contexto confirmado por IDs/claves tiene prioridad; el fallback legacy acepta solo cuatro patrones estrictos y una ruta desconocida vuelve a «Ruta completa».
- Los avisos se deduplican por código+contexto+ruta y se ordenan por unidad/actividad sin fusionar hallazgos de lugares distintos.
- `insufficient_evidence` muestra la diferencia exacta entre `actualCount` y `requiredCount`; `limited_evidence` se mantiene como sugerencia no bloqueante.
- Las acciones cambian de sección, expanden unidad/actividad, abren «Más opciones», enfocan el control o abren el selector en el modo adecuado. Una actividad vacía recibe su material como alternativa en la propia actividad.
- El registro de foco ejecuta foco y scroll después de montar; los destinos no interactivos llevan `tabIndex=-1` e indicador visual.
- 31/31 pruebas focalizadas de mensajes/unidades pasaron; typecheck y lint web pasaron.

## T015 — guardado, comprobación y protección de cambios

Resultado: PASS; los recorridos completos en navegador quedan asignados a T020.

- `useRouteEditor` mantiene un único lock visible/ref para guardar, comprobar, transicionar y crear versión; un segundo click devuelve `busy` sin iniciar otra petición.
- El guardado se valida localmente con Zod, congela el slug solo en el primer intento válido, conserva `dirty` en error y reemplaza el borrador únicamente con la respuesta confirmada.
- `saveThenValidate` usa el `id/editVersion` de esa respuesta, no un render anterior; un fallo de guardado produce cero validate y una versión confirmada distinta/ausente nunca acepta `ready`.
- Las mutaciones locales invalidan la comprobación y muestran que hay cambios nuevos; campos y CTAs mutantes reciben el mismo estado de bloqueo durante una operación.
- Se implementaron mensajes seguros para 400/401/403/404/409/422/429/5xx, incidencias 422, acceso alternativo tras 401 y conflicto sin overwrite automático.
- El conflicto permite descargar un JSON local estricto y abrir la versión guardada en otra pestaña; no hay merge ni reintento de red automático.
- La recuperación usa `sessionStorage` aislado por actor+ruta, debounce 400 ms, TTL 24 h, `baseEditVersion`, flush en pagehide/popstate y aplicación exclusivamente tras «Recuperar». Actor, ruta o versión distinta no se aplican.
- Los enlaces same-origin que abandonan el editor usan un AlertDialog Radix con Seguir editando/Guardar y salir/Salir sin guardar; Ctrl/Cmd+click, descargas, `_blank` y navegación dentro de la misma ruta no se interceptan. `beforeunload` permanece activo con dirty u operación pendiente.
- 81/81 pruebas puras del directorio editor pasaron; V03 monorepo, typecheck web y lint web pasaron.

## T016 — vista previa y flujo editorial

Resultado: PASS; publicación real no ejecutada por diseño.

- La vista previa Radix Dialog está disponible desde cualquier sección y renderiza el `draft` local, incluso dirty, sin reutilizar componentes de alumno ni llamar a endpoints de tracking.
- Muestra portada existente, descripción, unidades, objetivos, actividades, formatos y alternativas en español. Suma solo la opción recomendada y muestra «Duración por definir» si faltaría una parte del total.
- Se eliminó del flujo renderizado el acceso a «DTO confirmado»; los controles de material de la vista previa son únicamente texto presentacional.
- Las acciones se derivan de estado, `archivedAt`, `canReview` y `canPublish`: nueva/borrador/cambios→revisión; revisión→solicitar/aprobar solo con permiso; aprobada→publicar solo con permiso; publicada→nueva versión; archivada→ninguna.
- Enviar a revisión reutiliza la orquestación T015: guarda/comprueba cuando hace falta, acepta warnings y no transiciona con errores o resultado obsoleto.
- Publicar requiere AlertDialog Radix y solo se cierra tras respuesta confirmada; no usa `window.confirm`. Crear versión usa el endpoint y la respuesta confirmada del hook.
- Ajustes de evaluación y notas usan Collapsible cerrados inicialmente. `standard` explica el umbral de cinco; `limited` se elige únicamente mediante radio explícito y se describe como práctica introductoria.
- Una versión editable posterior muestra el alcance real de metadata compartida; unidades/materiales se describen como separados, sin prometer aislamiento inexistente.
- 11/11 pruebas focalizadas de flujo/vista previa/orquestación pasaron; typecheck y lint web pasaron.

## T017 — diseño responsive definitivo

Resultado de implementación: PASS. Auditoría visual: NO VERIFICADO hasta T021.

- El editor usa un único CSS Module local con ancho máximo 1120 px, padding inferior para la barra sticky, tarjetas de 16 px, controles de al menos 44 px e inputs de 16 px.
- La jerarquía se mantiene por espaciado/tipografía y superficies blancas; estados de error/advertencia reservan rojo/ámbar y el foco usa el azul `--koraz-*`.
- Selector y vista previa usan `min(880px, viewport-32px)`/85dvh en escritorio y 100dvw×100dvh en móvil, con header/footer y contenido central desplazable.
- A menos de 768 px, formularios, avisos, acciones, flujo y barra de guardado se apilan; no se añadió `overflow-x:hidden` para ocultar defectos.
- Se añadieron hover, disabled, error, focus-visible en portales, textos largos con wrap y `prefers-reduced-motion`.
- El archivo legado `learning-route-editor.tsx` quedó reducido al re-export de la fachada nueva. Se retiró de `learning.css` el bloque `.learning-editor-*` ya sin consumidores; no se modificó `identity-v3.css` por prohibición de la ficha.
- El flujo nuevo no contiene `window.confirm`, «DTO confirmado» ni tabla técnica de cinco columnas.
- V03 (`pnpm typecheck`) y V04 (`pnpm lint`) pasaron en el monorepo.

NO VERIFICADO aquí: overflow real, zoom 200 %, contraste medido y aceptación de capturas. Se comprueban con fixture/navegador en T020–T021 y no se atribuyen a esta tarea.

## T018 — fixtures y entorno UI aislado

Resultado: PASS.

- Se añadieron los estados `new`, `ready`, `errors`, `limited`, `legacy`, `published`, `archived`, `empty-catalog` y `long`, todos con UUID estables y detalles validados por schema.
- `ready` contiene una unidad/objetivo, guía y cuestionario con cinco identidades distintas; `errors` carece de comprensión y tiene tres ítems; `limited` conserva comprensión y produce solo warning 3/5.
- `legacy` conserva dos objetivos, propósito integrate/diagnostic, cuatro formatos, alternativas, rango de video y mappings; `long` usa título de 200, títulos de 240 y 30 unidades.
- El transporte en memoria cubre mutaciones y GET de TanStack Query, respeta `expectedVersion`, mantiene `editVersion`, permite espera y fallos deterministas, y registra orden de operaciones sin tocar API/base real.
- La corrección de la interfaz inyectable hizo que catálogo, detalle actual y detalle fijado consuman el mismo transporte de fixture; producción conserva `editorApi` como default.
- La página `/visual-fixtures/editor-rutas` aplica `NODE_ENV === development`; fuera de desarrollo devuelve notFound. Playwright quedó configurado para Chromium, 1440×900/390×844, puerto 3100 y `.editor-test-results`.
- Los nueve estados respondieron HTTP 200 en Next dev local en 3100; el proceso se cerró al terminar y no se inició la API.
- 17/17 pruebas focalizadas de fixtures/query pasaron; typecheck y lint web pasaron.

## T019 — contratos, API, persistencia y regresión

Resultado de alcance: PASS. Regresión total V07: FAIL por el único fallo intermitente heredado del baseline, no atribuible al editor.

- Se creó la suite editorial Fastify separada y V06 pasó 21/21 pruebas de contratos, rutas y almacenamiento.
- La eliminación se verificó en dos límites: PATCH seguido de GET en Fastify y persistencia real en PGlite tras clonar una ruta publicada. La v2 queda sin unidades mientras la v1 publicada conserva `unidad-torax`.
- La matrícula histórica continúa apuntando a v1; los conteos de matrículas, intentos y recompensas permanecen idénticos antes y después de las operaciones editoriales.
- El material fijado retirado devuelve una respuesta `unavailable` legible sin crear ítems/revisiones ni reconstruir el snapshot. Los detalles actual/fijado mantienen fuente y versión canónicas.
- Se comprobaron rollback transaccional inducido, conservación profunda de config/completionRule/revisión/recompensa, clonado de IDs relacionales con claves estables y rechazo de refresh obsoleto sin escritura parcial.
- Se comprobaron `expectedVersion`, request estricto sin eco de datos, optionId ajena, propiedad de ruta, roles anónimo/alumno/editor/coordinador, `private, no-store`, inmutabilidad en revisión/aprobación/publicación y archivado sin nueva versión.
- La regresión del mapa pasó: la referencia y las dos claves de v1 permanecen; al adoptar la v2 sin la unidad, la misma entrada pasa a `version_missing` sin ser borrada.
- V02, V03 y V04 pasaron. Las pruebas focalizadas adicionales de validación+mapa pasaron 15/15.
- V07 terminó con web 195/195 y API 200/201. El único fallo es el mismo baseline de orden del historial: esperado 1,2,3, recibido 2,3,1. No se modificó el test antiguo para esconderlo.

Evidencia: `evidencias-editor/t019-api-storage-regression.txt`.

Limitación expresa: toda la evidencia de persistencia/permisos usa PGlite y Fastify inject local. No comprueba producción, no usa datos reales y no publicó rutas.

## T020 — interacción E2E, teclado y accesibilidad automática

Resultado: PASS.

- La suite Playwright final ejecutó 30/30 casos en Chromium: 15 desktop (1440×900) y 15 mobile (390×844), con un worker y transporte fixture determinista en memoria.
- El recorrido nominal crea datos, unidad, objetivo, guía y cuestionario; después confirma el orden guardar → validar → transición a revisión.
- Se cubren borrado con cancelación/confirmación/PATCH, material fijado fuera de página, paginación, filtros obsoletos abortados, doble guardado, save 503 sin validate, validación obsoleta, 409 con recuperación, preview sin tracking, versiones publicadas/archivadas y contenido legacy.
- La matriz de reflow recorrió 320, 390, 768, 1024 y 1440 px en ambos proyectos: `scrollWidth === clientWidth` y el CTA permaneció visible en las diez combinaciones.
- Radix devolvió el foco al disparador tras Escape/cancelación en selector y eliminación. Se corrigió la captura del destino de foco sin leer refs durante render.
- Axe se ejecutó en Datos, unidad expandida, selector abierto, Revisión con errores y confirmación, en desktop y mobile, bajo los tags fijados: cero violations en diez auditorías y sin exclusiones del editor.
- Se corrigieron tres defectos descubiertos por E2E: clasificación save/validate, recuperación bajo Strict Mode y retorno de foco en diálogos controlados. También se estabilizó la hidratación del fixture y se añadió el estado off-page.
- Tras las correcciones: Vitest del editor 102/102, typecheck web y lint web pasaron. La prueba focalizada de teclado pasó 2/2 después del último ajuste.

Archivos principales: `apps/web/tests/e2e/route-editor.spec.ts`, `apps/web/playwright.editor.config.ts`, `apps/web/src/components/learning/editor/editor-fixtures.ts`, `editor-fixture-workspace.tsx`, `use-route-editor.ts`, `editor-recovery.test.ts`, `editor-dialog.tsx`, `material-picker.tsx` y `editor-shell.tsx`.

Evidencia: `evidencias-editor/t020-playwright.txt` y adjuntos JSON/capturas/trazas de `.editor-test-results` durante la ejecución.

Límite: la UI usa fixture simulado. Persistencia/permisos son evidencia separada T019 con PGlite/Fastify inject local; no se atribuye comprobación en producción.

## T021 — inspección de diseño, contenido y accesibilidad

Resultado: PASS.

- Se generaron y revisaron a tamaño legible las 13 capturas obligatorias de §11.3 y tres complementarias para 768, 1024 y zoom 200 % equivalente.
- La inspección encontró y corrigió dos defectos concretos: colisión de pestañas a 320 px y encabezado demasiado estrecho para un título de 200 caracteres a 768 px. No se cambió arquitectura, política pedagógica ni branding global.
- El índice productivo se extrajo sin alterar su markup a `LearningPathsEditorIndex`; la ruta visual de development reutiliza el mismo componente para acreditar la captura sin sesión ni datos reales.
- El barrido de 320/390/768/1024/1440 pasó sin overflow en ambos proyectos. La medición 200 % equivalente mantuvo `scrollWidth=clientWidth=720`.
- La barra sticky no intersectó el último campo a 320 px ni la acción de error después de llevarlos al centro del viewport; las capturas confirman el espacio inferior y la jerarquía.
- Los contrastes medidos fueron 16.15:1, 6.07:1, 11.46:1, 15.39:1 y 6.07:1 en las muestras acordadas.
- Axe mantuvo cero violations. Los `incomplete` se resolvieron manualmente con evidencia: 12/4 Tab permanecieron dentro de los portales Radix en ambos proyectos y el texto cuyo fondo Axe no determinó midió 6.07:1.
- La configuración E2E usa reduced motion para auditar estados estables y conserva la espera por animaciones; no hay sleeps, exclusiones de reglas ni exclusiones de nodos.
- Los tres usos de ayuda son únicamente objetivos, uso de actividad y alternativas. La revisión de códigos/copy no encontró exposición de path, UUID, DTO, projection o payload.
- Checks posteriores: teclado/foco 2/2, reflow 2/2, Axe 2/2, typecheck web y lint web pasaron.

Archivos principales: `route-editor.module.css`, `learning-paths-editor-index.tsx`, página índice, fixture visual/workspace, `route-editor.spec.ts`, `capture-route-editor.mjs`, configuración Playwright y documentos/evidencias.

Evidencia: `evidencias-editor/t021-inspeccion-visual.md`, capturas `01`–`16` y `evidencias-editor/t021-mediciones.json`.

## T022 — cierre, documentación y checks finales

Resultado: PASS. La implementación del editor queda operativa y todos los criterios obligatorios están verificados.

- V11 pasó: `radix-ui@1.6.7` y `@tanstack/react-query@5.102.8` están en dependencies; `@axe-core/playwright@4.13.0` en devDependencies; `pnpm install --frozen-lockfile` confirmó lockfile reproducible.
- Licencias registradas: MIT, MIT y MPL-2.0. Los imports efectivos se verificaron en componentes, queries y Playwright; no son dependencias instaladas sin uso.
- V03 y V04 pasaron en contracts/API/web. V08 pasó: contracts, API y Next producción completaron sin error.
- V09 final, posterior a T021, pasó 30/30 en desktop/mobile (5.0 min).
- El bloqueo heredado de V07 se corrigió en código de producción: el historial se ordena primero por `version_number` y usa `adopted_at` solo como desempate. No se cambió el test. El archivo de catálogo pasó 20/20.
- V07 final pasó: web 34/34 archivos y 197/197 pruebas; API 28/28 archivos y 201/201 pruebas. Una corrida previa bajo carga concurrente agotó dos timeouts de 5 s; la API aislada y la repetición raíz inmediata pasaron sin modificar esos tests ni sus timeouts.
- V10 pasó y no hay cambios de migraciones. Se retiraron del diff `next-env.d.ts` y los archivos de instrucciones generados automáticamente por Next dev.
- Los dos documentos maestros modificados antes de T001 se conservaron sin sobrescribir. La revisión contra la base antigua también contiene cambios ya presentes en el HEAD de inicio; el alcance de esta ejecución se distingue mediante V01/status.
- Se creó `OPERACION.md` con instrucciones nuevas para crear rutas, corregir avisos, eliminar unidades y actualizar materiales; no se añadió despliegue ni operación de publicación real.
- `EDITOR-VALIDACION.md` contiene D01–D16 y Q01–Q41 en PASS con evidencia; no quedan FAIL ni NO VERIFICADO obligatorios.

Evidencia: `evidencias-editor/t022-cierre.txt`.

Limitaciones: PGlite/Fastify inject no prueban producción; el E2E usa transporte fixture; no se realizó despliegue ni publicación. Estas son fronteras de evidencia declaradas, no criterios obligatorios pendientes.
