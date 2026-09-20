# === HANDOFF PARA MODELO EJECUTOR ===

Paquete completo y autosuficiente, revisión 2 actualizada el 19 de septiembre de 2026. Incluye las quince secciones del plan, 22 fichas de tareas, 16 criterios de terminado, 41 comprobaciones finales, 41 casos de prueba, contratos y ejemplos de código. Exige instalar e integrar Radix UI, TanStack Query y axe para Playwright en las versiones y puntos definidos en §8.12. Puede entregarse como único documento al implementador junto al repositorio. No depende de la conversación.

---

# Plan maestro de ejecución: editor intuitivo de rutas de aprendizaje

Fecha del análisis inicial: 14 de septiembre de 2026. Revisión 2 actualizada el 19 de septiembre de 2026: incorporación obligatoria de bibliotecas gratuitas reconocidas, según solicitud del usuario. Estado: especificación para implementar; implementación NO realizada.

Repositorio: `D:\Jose (Datos)\Medicina\CEDIAH\Web`. Base inspeccionada: `1b3b6c8b11796aa070047c38057e6ab36940dcb0`. El árbol estaba limpio al comenzar. No se encontraron archivos AGENTS.md en el repositorio ni en los directorios ascendentes inspeccionados.

Este documento toma las decisiones de producto y arquitectura. El ejecutor debe seguirlas y registrar desviaciones justificadas. Los ejemplos de código son patrones de implementación, no cambios ya aplicados. Las rutas de archivos de las tablas son relativas a la raíz indicada arriba.

## 1. Objetivo final

Un editor con permisos editoriales debe poder crear una ruta de calidad proporcionando información pedagógica comprensible, eligiendo contenidos publicados y siguiendo instrucciones de corrección concretas. No debe necesitar conocer identificadores, slugs, snapshots, proyecciones ni estructuras de datos.

Se resolverán cinco problemas: exceso de campos técnicos; relación confusa entre unidad, actividad y material; validación incomprensible y potencialmente desactualizada; imposibilidad de eliminar unidades desde la interfaz; diseño denso con demasiados formularios simultáneos.

Entregables de la implementación:

1. Editor renovado en `/panel/rutas/[pathId]` y entrada ordenada en `/panel/rutas`, con creación en `/panel/rutas/nueva`.
2. Tres secciones: **Datos de la ruta**, **Unidades y actividades**, **Revisar y publicar**. Vista previa como acción secundaria dentro del editor.
3. Selector contextual de materiales, eliminación de unidades y actividades, valores técnicos automáticos y opciones avanzadas limitadas.
4. Catálogo de mensajes en español con problema, ubicación, solución y acción. Diferenciación explícita entre impedimentos y sugerencias.
5. Guardado, comprobación y transiciones editoriales coherentes con la versión que el usuario está viendo.
6. Pruebas de contratos, reglas, persistencia, permisos, navegación, accesibilidad y diseño responsive; informe con resultados y evidencias.
7. Documentación de ejecución y operación actualizada exclusivamente para esta mejora.

Fuera del alcance: rediseñar el panel entero, el mapa espacial o la experiencia de estudio; cambiar el cálculo de progreso, recompensas, memoria o evidencia; generar contenido médico o preguntas mediante IA; editar el contenido académico dentro del selector; sustituir Next.js/Fastify/PostgreSQL/Better Auth; migrar proveedores; publicar rutas reales; desplegar o modificar infraestructura; borrar publicaciones o versiones históricas.

## 2. Definición de terminado

| ID | Criterio verificable |
|---|---|
| D01 | Se crea una ruta con título, tema y descripción; no hay campo editable de slug ni de clave estable. |
| D02 | El flujo normal solo exige el nombre de cada unidad, lo que se aprenderá y elegir materiales. Los controles avanzados comienzan cerrados. |
| D03 | Añadir una actividad abre el catálogo indicando la unidad destino; ningún material se inserta por ser el primero de una lista. |
| D04 | Se elimina una unidad guardada, se guarda y se recarga: sigue eliminada. Cancelar la confirmación conserva exactamente el estado anterior. |
| D05 | Eliminar la última unidad permite guardar un borrador vacío y produce una instrucción comprensible al comprobarlo. |
| D06 | Modificar la ruta y pulsar «Comprobar ruta» guarda primero los cambios válidos y comprueba esa versión. Si falla el guardado, no se lanza la comprobación. |
| D07 | Todos los códigos actuales de validación y los añadidos por este plan tienen mensaje y acción; ningún aviso visible imprime un path de JSON o código interno. |
| D08 | Solo las incidencias `error` impiden avanzar. Las `warning` se presentan como sugerencias y no bloquean el flujo permitido por el servidor. |
| D09 | Las acciones de corrección abren la sección, unidad y actividad apropiadas y enfocan un control visible. |
| D10 | Renombrar, reordenar o cambiar una etiqueta no altera identidades, selección de preguntas, asociaciones, reglas de finalización ni revisión del material. |
| D11 | Se pueden abrir y editar rutas anteriores con múltiples objetivos, alternativas, reglas y configuraciones personalizadas sin perder datos. |
| D12 | Una versión publicada solo se edita mediante un nuevo borrador; las matrículas, intentos y versiones anteriores conservan sus registros. |
| D13 | El editor funciona a 320, 390, 768, 1024 y 1440 px; no hay desbordamiento horizontal de página ni acciones inaccesibles. |
| D14 | Teclado: navegación de secciones, selector, confirmación, ayuda y correcciones funcionan; el foco regresa a una ubicación lógica al cerrar. |
| D15 | Las comprobaciones obligatorias de T001–T022 están PASS. Todo NO VERIFICADO obligatorio impide declarar la implementación terminada. |
| D16 | Radix se usa en los componentes indicados, TanStack Query ejecuta las lecturas del catálogo/detalles y axe analiza el editor en Playwright. Las tres versiones están fijadas, sus licencias registradas y sus pruebas PASS; no basta instalarlas. |

## 3. Requisitos

### Obligatorios

- Simplificar creación y edición sin reducir los controles de calidad existentes.
- Eliminar de la edición cotidiana slug, clave estable, nivel de evidencia, propósito, avance esencial y etiqueta para estudiante; automatizar o trasladar según la tabla de campos de §8.
- Hacer comprensible el significado de materiales y su relación con actividades y unidades.
- Permitir eliminar unidades existentes, incluyendo sus actividades, sin eliminar publicaciones fuente.
- Escribir avisos breves que expliquen qué ocurre y cómo resolverlo; incluir una acción que lleve a la solución cuando exista un destino navegable.
- Interfaz moderna, limpia, profesional, intuitiva y responsive; reutilizar identidad visual del producto.
- Ayudas «?» breves y selectivas. No añadir una ayuda al título ni a otros campos evidentes.
- Conservar compatibilidad con rutas existentes y permisos editoriales.
- Proporcionar pruebas y evidencias suficientes para que un ejecutor económico pueda verificar el resultado.
- Instalar e integrar efectivamente Radix UI Primitives, TanStack Query y axe-core para Playwright según §8.12. Reutilizar Zod, Phosphor, Vitest y PGlite existentes. Incluirlos en package.json sin usarlos no cumple este requisito.

### Deseables

- Resumen de unidades, actividades y tiempo aproximado visible en la vista previa.
- Mostrar «Nueva versión disponible» cuando el detalle del material confirme ese dato.
- Buscador de rutas en el índice, cuando haya más de seis rutas.

Los deseables no autorizan modificar contratos fuera de este documento ni retrasar la entrega obligatoria.

### Restricciones

- Stack existente: Node 24, pnpm 11.9.0, Next 16.3.5, React 19.2.8, TypeScript, CSS Modules, iconos `@phosphor-icons/react`, Fastify, Kysely, Zod y PostgreSQL.
- Navegador → BFF Next → API Fastify → PostgreSQL. Autenticación, autorización y reglas finales siguen en API.
- Se mantiene `guided-v1` y la política actual: cinco preguntas/tarjetas distintas por objetivo para modalidad estándar. Es una regla del producto; no una clasificación de evidencia científica clínica.
- Las versiones publicadas y los snapshots son inmutables. No editar migraciones aplicadas. Este plan no necesita migraciones nuevas.
- Mantener límites actuales: 30 unidades/ruta, 60 actividades/unidad, 30 objetivos/unidad, 20 objetivos/actividad, 12 alternativas/actividad, 500 ítems/alternativa.
- Los objetivos, títulos y asociaciones requieren contenido del autor; no inventar objetivos para conseguir que una validación pase.

### Prohibiciones

- Las únicas dependencias directas nuevas previstas son `radix-ui`, `@tanstack/react-query` y `@axe-core/playwright`, con las versiones y destinos de §8.12. Sus transitivas son esperables. No incorporar kits visuales adicionales, gestores de borrador, formularios o drag-and-drop sin una necesidad nueva demostrada; los candidatos descartados están explicados en §8.12.
- No transformar automáticamente `standard` en `limited`, ni ocultar errores para permitir publicar.
- No regenerar identidades de entidades existentes por cambiar títulos, orden, nombre de campo o sección.
- No insertar por defecto `resources[0]`; no reconstruir `config` al editar `label` o `isDefault`.
- No usar solo color para comunicar gravedad; no depender de hover para ayuda ni usar `window.confirm` para el nuevo flujo.
- No enviar borradores a una base de producción para probar. No introducir bypass de autenticación en rutas reales.
- No exponer DTO, JSON, UUID, «PostgreSQL», «snapshot», «mapping» o «ítems canónicos» como instrucciones al autor.
- No usar `any`, `as unknown as` o desactivar reglas del linter para salvar errores nuevos de tipos.

### Preferencias expresas del usuario

Menos campos; entender qué poner y por qué; creación fácil de una ruta de calidad; avisos rojos y amarillos comprensibles; eliminación de unidades; explicación/reorganización de materiales; pocos tooltips; diseño moderno y profesional; funcionamiento móvil; decisiones tomadas de antemano y ejemplos de código operativos. El usuario solicita además bibliotecas gratuitas y reconocidas que simplifiquen la ejecución. Esta entrega actualiza el plan; la instalación e implementación quedan encargadas al ejecutor.

## 4. Decisiones de arquitectura

| ID | Decisión adoptada y razón | Alternativa descartada | Consecuencia concreta |
|---|---|---|---|
| A01 | Tres secciones accesibles libremente. Reduce densidad y conserva contexto. | Asistente rígido que obliga a recorrer pasos para cualquier edición. | Un único estado de borrador sobre los tres paneles; cambiar de sección no guarda ni descarta. |
| A02 | Eliminar la pestaña Materiales; abrir selector desde «Añadir actividad» o «Cambiar material». | Mantener dos pestañas que repiten el mismo formulario. | El selector recibe destino y modo explícitos. |
| A03 | Un material seleccionado crea una actividad. Las alternativas quedan en ajustes avanzados. | Tratar cada nuevo material como una alternativa equivalente. | Video seguido de cuestionario son dos actividades; dos formatos equivalentes pueden seguir siendo alternativas. |
| A04 | Identidades automáticas y permanentes; no se muestran inputs técnicos. | Borrar columnas técnicas del dominio. | Fábricas generan UUID una sola vez; adaptadores conservan valores existentes. |
| A05 | Propósito inicial según formato, actividad obligatoria por defecto y texto del botón automático. | Exigir al autor configurar todos estos campos. | Guía/video→understand; cuestionario→check; tarjetas→recall. No recalcular estos valores al abrir rutas existentes. |
| A06 | Conservar objetivos y asociaciones; un objetivo por defecto, varios cuando el autor los necesita. | Eliminar objetivos o asignar todas las preguntas a todos los objetivos silenciosamente. | Todos los objetivos existentes son editables; si hay varios, la relación se elige con texto legible. |
| A07 | Conservar evaluación estándar; modalidad introductoria en ajustes de evaluación explicados. | Debilitar automáticamente los controles para hacer fácil la publicación. | Umbral cinco inalterado; warnings de rutas `limited` siguen sin bloquear. |
| A08 | Eliminar unidades mediante edición del borrador completo y PATCH existente. | Nuevo DELETE de tablas o endpoint que borre una versión histórica. | Filtrar unidad y dependencias internas, confirmar localmente, guardar por API actual. |
| A09 | Reducer puro y hook de orquestación separados de componentes. | Mantener un archivo con toda la UI y todas las mutaciones. | Tests de transformaciones sin DOM; componentes por responsabilidad. |
| A10 | Guardado manual claro; comprobación con guardado previo. | Autosave remoto con debounce y cola offline. | No aparece «Guardado» antes de confirmación del servidor. Una operación editorial en vuelo a la vez. |
| A11 | Resultados de validación vinculados a `editVersion`. | Mostrar avisos antiguos después de modificar la estructura. | Invalidar resultado tras cada cambio; validar la respuesta contra el borrador guardado. |
| A12 | Mensajes presentacionales en web por código; API añade contexto estructurado opcional. | Traducir mediante regex el texto técnico recibido o duplicar reglas de calidad en frontend. | Diccionario exhaustivo y parser legacy por paths; el servidor decide severidad y ready. |
| A13 | Reutilizar revisiones de materiales en cambios cosméticos y al crear versión. Actualizar solo mediante acción explícita. | Resolver siempre la última publicación al guardar cualquier campo. | Cambiar `resolveDefinition` y clonación; agregar `refreshResource` y `expectedSourceVersion` opcionales al request de opción. |
| A14 | Detalle editorial bajo demanda y TanStack Query para búsqueda, paginación y cache de lecturas. | Cache remoto manual y dependencia de los primeros 24 resultados. | useInfiniteQuery/useQuery con claves de actor/ruta/filtros/revisión; el borrador permanece exclusivamente en el reducer. |
| A15 | CSS Module local y tokens vigentes de marca. | Rediseño global o estilo genérico de dashboard. | Tocar solo estilos usados por el editor; conservar el shell y el mapa. |
| A16 | Radix UI Primitives: Dialog/AlertDialog/Tabs/Accordion/DropdownMenu/Popover/Collapsible. | Implementar manualmente foco, teclado y capas; sustituir el diseño por un kit completo. | Wrappers locales con CSS Modules; Radix gestiona interacción y accesibilidad de base. No usar showModal ni focus traps propios para los nuevos modales. |
| A17 | Índice de rutas separado del formulario de creación. | Mostrar tarjetas de todas las rutas encima de un formulario nuevo largo. | `/panel/rutas` lista; `/panel/rutas/nueva` crea; URLs de edición existentes continúan funcionando. |
| A18 | Fixtures locales, API con PGlite y accesibilidad automática con @axe-core/playwright. | Depender de producción o asumir accesibilidad solo por usar Radix. | Playwright propio del editor; axe sobre estados finales; revisión visual/teclado sigue siendo obligatoria. |

## 5. Hechos, inferencias, supuestos y desconocidos

### Hechos comprobados en código

| Hallazgo | Fuente / símbolo |
|---|---|
| El componente actual combina datos, catálogo, estructura, preview y publicación. | `apps/web/src/components/learning/learning-route-editor.tsx`, `LearningRouteEditor`. |
| No tiene operación de eliminar unidad; sí permite eliminar pasos y opciones. | Mismo archivo, `addUnit`, render de unidades y botones Trash. |
| `validate()` envía POST sin guardar dirty ni comprobar `response.ok`. | Mismo archivo, `validate`. |
| `updateOption()` borra `completionRule` y reconstruye selección/mappings incluso cuando solo cambia label. | Mismo archivo, `updateOption`. |
| El slug automático puede quedar en la primera entrada porque usa `draft.slug || slugify(...)`. | Handler del título en el componente actual. |
| Se muestran directamente `issue.message` e `issue.path`. | Render de `learning-editor-issues`. |
| Materiales muestra filtros pero comparte formulario/estructura; seleccionar material usa selects extensos. | Rama `tab === materials` y render de opciones. |
| La API PATCH sustituye la definición de la versión editable dentro de transacción. | `apps/api/src/providers/postgres-guided-learning.ts`, `updatePath` e `insertDefinition`. |
| Guardado resuelve actualmente la última revisión publicada de cada material. | Mismo archivo, `resolveDefinition`. |
| Published y snapshots tienen protección de inmutabilidad en base. | `database/migrations/0010_guided_learning_catalog.sql`. |
| El mapa referencia unidades por stableKey; tiene estado unavailable para referencias no disponibles. | `database/migrations/0016_learning_maps.sql`; `apps/api/src/learning-map/resolver.ts`. |
| Ya hay Vitest, Playwright y pruebas reales del proveedor con PGlite. | package.json de apps; tests guided-learning-catalog y config Playwright. |

### Inferencias

- La ausencia del botón explica la imposibilidad de eliminar desde esta UI; no se ha reproducido la sesión específica del usuario ni descartado otro problema de persistencia.
- Parte de los avisos que el usuario ve puede corresponder a una versión anterior guardada. No se conoce la ruta concreta ni sus datos.
- Mostrar menos configuración y enlazar cada aviso con su corrección reducirá las decisiones necesarias. No se ha medido aún con usuarios.

### Supuestos de diseño adoptados

- El autor entiende título, unidad, actividad, video, guía y cuestionario; no necesita conocer el modelo técnico.
- La ruta usa materiales publicados desde el módulo Contenido existente.
- Español es el idioma de toda la nueva interfaz.
- La revisión/aprobación/publicación siguen siendo pasos institucionales distintos.
- Los patrones de marca existentes prevalecen sobre crear una nueva identidad.

### Información desconocida y tratamiento

- No hubo servidor en `http://localhost:3000/panel/rutas` durante el análisis (`ERR_CONNECTION_REFUSED`). No se realizó auditoría visual ni prueba autenticada. T001 y T021 cubren esas verificaciones.
- No se conocen volumen real de rutas, calidad de materiales ni cuentas concretas. Usar fixtures explícitos; nunca convertir esa ausencia en números de producción.
- No se ejecutaron suites de tests durante la elaboración de este plan. Sus resultados actuales son NO VERIFICADO; T001 registra baseline.
- No se sabe si hay fallos adicionales en base o en enlaces del mapa tras eliminar. T019 exige comprobarlos; no asumir que quitar un botón los resuelve.
- No se necesita una decisión adicional del usuario para comenzar T001.

## 6. Descomposición del proyecto: fichas T001–T022

Reglas comunes a todas las fichas: los permisos de archivos se interpretan relativos a la raíz; «no modificar» incluye todos los archivos no enumerados salvo imports/exports estrictamente necesarios mencionados por la ficha. No tocar datos reales, migraciones, autenticación ni políticas de estudiante. T001 modifica únicamente las dependencias autorizadas de §8.12 y su lockfile; las demás tareas usan esas versiones. Los tests nuevos se crean junto a cada unidad funcional; T019/T020 completan integración y no posponen todas las pruebas hasta el final. Un check solo cuenta como ejecutado si se registró salida y exit code.

### T001 — Registrar baseline e instalar bibliotecas aprobadas [C]

- **Objetivo:** establecer baseline, confirmar aislamiento de producción e instalar las tres bibliotecas aprobadas antes de sus integraciones.
- **Inputs:** este plan, especialmente §8.12; package.json raíz/apps; pnpm-lock.yaml; README; git status y AGENTS aplicables del checkout actual.
- **Instrucciones:** leer AGENTS de raíz y ancestros; registrar HEAD y cambios existentes; marcar este plan como documentación ya presente. Ejecutar V01. Confirmar Node 24/pnpm 11.9.0; usar el runtime local requerido, sin cambiar engines. Instalar con frozen-lockfile solo si faltan dependencias. Ejecutar V02, V03, V04, V07, V08 secuencialmente. Leer archivos fuente enumerados en §9 y registrar si los símbolos aún existen. No arrancar API con credenciales de entorno. Una vez registrados los checks de baseline, comprobar las versiones/licencias/peers fijados en §8.12 e instalar con sus dos comandos exactos; registrar resultado y mantener las versiones anteriores de dependencias no relacionadas. Ejecutar V11 y V03/V04 tras instalar. No ampliar overrides ni allowBuilds.
- **Output:** EDITOR-EJECUCION.md con baseline, lista de tareas y resultados reales; logs en evidencias-editor/baseline-*.txt.
- **Dependencias:** ninguna.
- **Puede modificar:** documentos EDITOR-EJECUCION.md, EDITOR-VALIDACION.md, evidencias-editor; apps/web/package.json exclusivamente para las tres bibliotecas; pnpm-lock.yaml para resolverlas y sus transitivas; outputs de build ignorados por git.
- **No puede modificar:** código de aplicación, .env, migraciones, pnpm-workspace.yaml, versiones de paquetes existentes ni este plan para cambiar requisitos. La excepción de lockfile está limitada a las bibliotecas aprobadas.
- **Aceptación:** runtime/HEAD y baseline registrados; tres paquetes fijados en sus categorías correctas, V11 confirma instalación; ninguna conexión a base real realizada. La instalación sola no acredita integración: se verifica en T009–T021.
- **Comprobaciones:** V01–V04/V07/V08 y V11, según disponibilidad; registrar NO VERIFICADO con causa si no pueden correr. Los fallos previos no conceden permiso de ignorar una regresión nueva.
- **Errores a evitar:** atribuirse tests no corridos, copiar secretos a logs, usar pnpm update, arrancar dev:api sin revisar destino de base.

### T002 — Extender contratos editoriales [B]

- **Objetivo:** fijar tipos compartidos antes de integrar UI/API.
- **Inputs:** §8.6; packages/contracts/src/guided-learning.ts; interfaz GuidedLearningProvider y exports.
- **Instrucciones:** agregar los campos opcionales de opción, validate request/response/context y union de detalle exactamente como §8.6. Incorporar métodos `getEditorMaterialDetail({actorUserId,canEditAll,contentId,projection})` y `getEditorOptionMaterialDetail({actorUserId,canEditAll,pathId,optionId})`, retornando GuidedLearningResult<LearningEditorMaterialDetail>. Para detalle actual, la ruta comprueba capacidad editorial; canEditAll no habilita contenido no publicado. Actualizar tipos de validatePath con expectedVersion opcional. Crear tests de validación del contrato: legacy, campos extra, UUID inválido, límites y response unavailable. Actualizar stubs de provider en tests existentes con métodos explícitos que fallen si se llaman sin fixture; no introducir respuestas vacías que simulen éxito.
- **Output:** contratos compilables, API/web capaces de importar nuevos tipos y tests de esquema.
- **Dependencias:** T001.
- **Puede modificar:** packages/contracts/src/guided-learning.ts, packages/contracts/src/index.ts si requiere export; test/guided-learning-editor-contract.test.ts; stubs tipados en tests guided-learning existentes.
- **No puede modificar:** reglas de progreso, schemas públicos de attempts, tablas SQL, semántica del umbral cinco.
- **Aceptación:** payloads legacy válidos siguen pasando; nuevos campos validados; entradas extra rechazadas; no UUID mostrado en copy.
- **Comprobaciones:** V02; test de contratos nuevo; typecheck dirigido de contracts/API para identificar implementación pendiente de nuevos métodos. Mientras T005/T006 no estén integradas, registrar pendientes de interfaz sin simular implementación.
- **Errores a evitar:** reemplazar `strictObject` por `passthrough`, hacer required un campo de compatibilidad, devolver DTO sin schema.

### T003 — Crear modelo, fábricas y serialización [B]

- **Objetivo:** aislar estado editable e identidades de los componentes.
- **Inputs:** §8.2/8.4/8.5; fromDetail y emptyDraft actuales; nuevos contratos.
- **Instrucciones:** crear editor-model.ts y editor-serialization.ts. Tipar estado UI fuera del request; usar IDs obligatorios locales. Implementar fromDetail sin pérdida, fábricas con UUID generado al crear y makeSlug del plan. Serializar sin UI metadata; omitir solo objetivos vacíos no referenciados. Validar con schemas antes del fetch y devolver field targets por id. Preservar rutas heredadas con múltiples objetivos, mappings/rangos/completionRule/identidades; serialización nunca resuelve materiales.
- **Output:** funciones puras tipadas y tests editor-model.test.ts/editor-serialization.test.ts.
- **Dependencias:** T002.
- **Puede modificar:** editor-model.ts, editor-serialization.ts y sus tests, dentro del directorio editor.
- **No puede modificar:** LearningRouteEditor todavía, provider, schemas para relajar validaciones, CSS global.
- **Aceptación:** P01/P03/P07/P20/P34; igualdad de roundtrip salvo campos definidos como UI o datos no enviados por el contrato; slug reproducible por creación y permanente tras guardado.
- **Comprobaciones:** V05 filtrado a esos dos archivos; V03.
- **Errores a evitar:** crypto.randomUUID en render, usar índices como keys, perder segunda objective, cambiar config al editar textos, truncar automáticamente un título excedido en vez de informar.

### T004 — Implementar mutaciones puras del borrador [B]

- **Objetivo:** eliminar/reordenar entidades sin referencias rotas ni cambios colaterales.
- **Inputs:** §8.5; modelo y fábricas de T003.
- **Instrucciones:** crear reducer con acciones add/update/remove/move de unidad/actividad; añadir/quitar opción, marcar default, editar/reasignar objetivo y cambiar material. Usar IDs. Cada mutación efectiva incrementa localRevision, marca dirty e invalida validation. Implementar limpieza de recommendedAfter al eliminar; no modificar dependencias al reordenar. Al quitar default promover primera restante. Reasignación de objetivo requiere destino explícito, deduplica IDs en step/config. Permitir draft con cero unidades o cero opciones. Añadir guardas de límites antes de insertar.
- **Output:** editor-reducer.ts y tests de estados antes/después.
- **Dependencias:** T003.
- **Puede modificar:** editor-reducer.ts, editor-reducer.test.ts; extensiones puntuales de tipos de editor-model.ts.
- **No puede modificar:** identidades de entidades no afectadas, servidor, reglas pedagógicas, material fuente.
- **Aceptación:** P03–P07/P21/P34; una mutación de label cambia solo label más metadata UI; acciones con ID inexistente no corrompen arrays.
- **Comprobaciones:** V05; tests de igualdad profunda y referencias entrantes de varias unidades.
- **Errores a evitar:** mutar arrays originales, limpiar todas las dependencias de la ruta, borrar materiales al borrar actividad, enviar al servidor índices en vez de IDs.

### T005 — Preservar revisiones y clonación de versiones [B]

- **Objetivo:** impedir que cambios de interfaz actualicen materiales o configuración sin intención.
- **Inputs:** §8.6; postgres-guided-learning.ts/resolveDefinition/createVersion/updatePath; content-resolver; migración 0010; pruebas catálogo existentes.
- **Instrucciones:** mover la comprobación inicial de acceso antes de resolver materiales. Preparar resolución con mapa de opciones existentes de la versión autorizada. Reutilizar snapshot en caso mismo id/fuente/formato y sin refresh. Resolver y comparar expectedSourceVersion solo en altas/reemplazos/refresh; nuevo cliente envía fuente canónica del detalle. Conservar referencias retiradas sin refrescarlas durante guardado estructural. Crear helper de clonación que conserve referencias y genere nuevas filas sin IDs heredados de unidad/paso/opción. Revalidar permiso/estado/version bajo transacción antes de escribir. Asegurar rollback de metadata/definición/auditoría si falla insert. La API añade contexto de opción a resource_changed cuando esté disponible.
- **Output:** proveedor con preservación y test de regresión cosmético/clonación/rollback.
- **Dependencias:** T002.
- **Puede modificar:** postgres-guided-learning.ts; helper nuevo `editor-definition.ts` si separa estas funciones; tests guided-learning-editor-storage.test.ts; fixtures de esos tests.
- **No puede modificar:** snapshots existentes, algoritmos de progreso/recompensas, SQL aplicado, contenido médico ni Data API.
- **Aceptación:** P07/P22/P23/P25/P28; snapshots idénticos al guardar etiqueta, clone usa revisión original y versión fuente desactualizada no persiste ruta parcial.
- **Comprobaciones:** V02; tests storage enfocados; guided-learning-catalog.test.ts; V03.
- **Errores a evitar:** confiar en optionId de otra ruta, resolver todas las fuentes antes de autorizar, regenerar stableKey durante clone, publicar un borrador para conseguir que un test pase.

### T006 — Exponer detalle actual y fijado del material [B]

- **Objetivo:** hacer posible selección comprensible y asociaciones sin depender de la página cargada.
- **Inputs:** §8.6/8.7; content-resolver/canonicalContentRow/adapterContent; adapter registry; contratos T002; proveedor T005.
- **Instrucciones:** factorizar lectura canónica sin mutaciones y reutilizarla tanto en resolución como preview editorial; extraer enunciados/frentes mediante adapters. Implementar ambos métodos y GET exactos. En detalle fijado comprobar pertenencia a ruta/version y hash; devolver unavailable sin analizar payload inválido. Devolver fuente canónica y sourceVersion; no UUID nuevo ni respuestas correctas. Crear pruebas que comparen número de revisiones/items antes y después de GET y que nieguen una opción ajena.
- **Output:** editor-material-details.ts, métodos provider y rutas editoriales tipadas.
- **Dependencias:** T002 y T005.
- **Puede modificar:** editor-material-details.ts, content-resolver.ts por factorización de lectura, postgres-guided-learning.ts para conexión, editor-routes.ts para dos GET, tests storage/routes nuevos.
- **No puede modificar:** política de publicación, acceso de alumno a respuestas, API pública de estudiante, modificar registros desde GET.
- **Aceptación:** P08/P22/P26–P28; detalle de video con guía vinculada y snapshot antiguo coincide con su fuente real.
- **Comprobaciones:** tests routes/storage para nuevos GET; guided-learning-adapters.test.ts y catálogo; V03.
- **Errores a evitar:** llamar resolvePublishedRevision desde GET, usar row.title actual para snapshot antiguo, identificar material solo por formato sin sourceContentId.

### T007 — Enriquecer validación sin cambiar sus exigencias [B]

- **Objetivo:** producir incidencias localizables, conteos fiables y comprobaciones coherentes con la versión.
- **Inputs:** §8.6/8.8; service.ts/validateLearningPathDefinition, storedValidation, editor-routes.ts.
- **Instrucciones:** añadir context en los issues donde se conoce unidad/actividad/opción/objetivo; incluir actualCount y requiredCount usando el Set ya empleado por la regla. Detectar duplicate_unit_key. Para unavailable emitir contexto por cada opción afectada. Implementar expectedVersion/validatedEditVersion y comprobación concurrente antes de responder. Registrar schema de validate request. Para POST/PATCH inválidos incluir fieldErrors seguros. No reescribir con reglas frontend la decisión ready ni cambiar severidad existente.
- **Output:** editor-validation.ts si se necesitan helpers; validador/API compatibles; tests de tabla de códigos y versiones.
- **Dependencias:** T002; integración de llamadas del provider después de T005/T006 para evitar colisión de archivo.
- **Puede modificar:** service.ts, editor-validation.ts, storedValidation/validatePath del provider, editor-routes.ts, tests contract/routes/storage de editor.
- **No puede modificar:** policies.ts, completion rules, threshold de evidencia, permisos canTransitionLearningPath, campos clínicos del contenido.
- **Aceptación:** P11/P12/P14–P19/P22; tres ítems convertidos a tarjetas siguen siendo tres; mismos errores legacy más contexto, sin estados ready obsoletos.
- **Comprobaciones:** tests validación nuevos; guided-learning-catalog.test.ts; V02/V03.
- **Errores a evitar:** sumar conteos de alternativas, llamar al nivel de práctica evidencia científica, inferir contexto desde el orden después de una mutación, validar request y luego ignorarlo.

### T008 — Conectar BFF y cliente HTTP tipado [C]

- **Objetivo:** transportar los contratos nuevos sin exponer la API directamente al navegador.
- **Inputs:** endpoints y schemas de T006/T007; forwardGuidedLearningRequest; §8.6/8.9.
- **Instrucciones:** crear BFF learning-resources/[contentId]/route.ts; extender GET catch-all para [pathId,materials,optionId]; conservar resto de rutas. Crear editor-api.ts con métodos save/create/validate/transition/createVersion/search/detail; las lecturas aceptan AbortSignal opcional y lo pasan a fetch; parsear response con Zod y discriminar éxito/fallo por response.ok. Crear unwrapEditorReadResult y EditorQueryError según §8.12.4; preservar la cancelación sin convertirla en respuesta vacía. Para validate mandar expectedVersion y verificar schema con nuevo campo. No construir URLs con datos no codificados ni permitir sufijos arbitrarios.
- **Output:** BFF y adaptador de transporte consumibles por los hooks; tests de enrutamiento y errores.
- **Dependencias:** T006/T007.
- **Puede modificar:** dos BFF indicados; guided-learning-api.ts para helper servidor si hace falta; editor-api.ts; tests web `src/lib/learning-editor-route.test.ts` y `editor-api.test.ts`.
- **No puede modificar:** same-origin, sesión/cookies, políticas de cache, URL base API, endpoints de estudiante.
- **Aceptación:** 200/400/401/403/404/409/422/429/503 tipados y preservados; GET detalle exige UUID correcto; no error tratado como ready=false con lista vacía.
- **Comprobaciones:** Vitest de BFF y editor-api; V02/V03.
- **Errores a evitar:** response.json como único criterio de éxito, filtrar context por no actualizar responseSchema, saltarse forwarding con fetch a base privada desde cliente.

### T009 — Crear índice y estructura del editor [B]

- **Objetivo:** separar listado/creación y montar las tres secciones con un estado compartido.
- **Inputs:** §8.1/8.3/8.11; páginas actuales panel/rutas; modelos T003.
- **Instrucciones:** convertir `/panel/rutas` en lista con Crear ruta; añadir `/panel/rutas/nueva` con guardas equivalentes. Mantener [pathId] y las mismas capacidades. Pasar actorUserId al editor para recuperación local; no renderizar editor sin identidad autorizada. Extraer editor-shell y usar LearningRouteEditor como fachada. Crear tabs con Radix Tabs controlado y activationMode="manual", IDs y paneles; Radix resuelve el teclado definido; provisionalmente conectar paneles básicos a modelos sin lógica HTTP duplicada. En [pathId] usar key por path.id. Un único h1 y un main efectivo: revisar shell antes de anidar main.
- **Output:** navegación de índice/nueva/editar funcional y contenedor de secciones.
- **Dependencias:** T003.
- **Puede modificar:** páginas panel/rutas/page.tsx, nueva/page.tsx, [pathId]/page.tsx; learning-route-editor.tsx; editor-shell.tsx; `routes-index.tsx` opcional local.
- **No puede modificar:** navegación global del panel, AppShell, rutas públicas de aprendizaje ni permisos institucionales.
- **Aceptación:** P01/P25/P26; URL previa de edición sigue válida; tres secciones con borrador compartido; no listado encima del formulario.
- **Comprobaciones:** V03; smoke local de rutas con fixtures cuando exista T018; registrar visual como pendiente hasta entonces.
- **Errores a evitar:** nueva tratada como UUID, doble main, usar state inicial de otra ruta al navegar, borrar la feature gate.

### T010 — Implementar Datos de la ruta y ayudas mínimas [C]

- **Objetivo:** reducir datos iniciales a información comprensible.
- **Inputs:** §8.1/8.2; editor-shell; contrato/modelo.
- **Instrucciones:** crear route-basics con título, tema y descripción; required/maxLength apropiados y errores bajo campos. No mostrar slug/key/evidencia. Tema sin selección silenciosa salvo caso de único tema. Portada en disclosure con ocho opciones actuales, sin imágenes inventadas. Implementar field-help con Radix Popover controlado, botón click/teclado, Escape y una ayuda abierta; usarlo únicamente en las tres familias autorizadas.
- **Output:** panel Datos terminado y componente de ayuda.
- **Dependencias:** T009.
- **Puede modificar:** route-basics.tsx, field-help.tsx; reglas CSS específicas que T017 consolidará.
- **No puede modificar:** límites del contrato, vocabulario del resto de producto, generador de contenidos ni assets de marca.
- **Aceptación:** D01/D02; no inputs técnicos visibles; labels asociados; no tooltip de título; caso sin temas tiene enlace viable a Contenido.
- **Comprobaciones:** V03; inspección de JSX de campos; P33/P34 al integrar E2E.
- **Errores a evitar:** placeholder usado como label, título/tema vacío seleccionado por defecto, ayuda en hover solamente, guardar textos de ejemplo como objetivos reales.

### T011 — Implementar unidades, objetivos y eliminación [B]

- **Objetivo:** ofrecer estructura navegable y resolver la eliminación de unidades existentes.
- **Inputs:** §8.1/8.5/8.11; reducer T004; shell T009.
- **Instrucciones:** crear unit-card con Radix Accordion y editor-dialog con Radix Dialog para selección/vista previa y Radix AlertDialog para confirmación; envolverlos localmente sin implementar focus trap propio. Mostrar todos los objetivos de una unidad, añadir/editar/eliminar con regla de reasignación. Añadir menú de subir/bajar/eliminar unidad con Radix DropdownMenu. Confirmación informa N actividades y que fuentes se conservan; foco inicial Cancelar. Conectar confirmación a reducer; resolver foco después de eliminar por sucesor lógico. Botones de añadir respetan límites. Si no hay objetivos completos, Añadir actividad enfoca objetivo y explica por qué.
- **Output:** unidades/objetivos operativos, eliminar/cancelar y reordenar.
- **Dependencias:** T004/T009.
- **Puede modificar:** unit-card.tsx, editor-dialog.tsx; learning-route-editor.tsx solo cableado; tests reducer si aparece caso faltante.
- **No puede modificar:** snapshots, migraciones, DELETE de API, componentes del mapa ni focus hook compartido.
- **Aceptación:** P04/P05/P21/P34/P35/P37; botones incluyen nombre de unidad en aria-label cuando hay varios; cambiar unidad no pierde input; menú, accordion y confirmación usan Radix con foco correcto.
- **Comprobaciones:** V05/V03; E2E de T020 verificará persistencia UI/foco. No declarar completo el defecto de borrado hasta storage T019.
- **Errores a evitar:** botón de eliminar sin confirmación, guardar implícitamente al borrar, referenciar unitIndex antiguo, menú que no permite teclado.

### T012 — Implementar selector contextual y catálogo [B]

- **Objetivo:** sustituir Materiales por elección comprensible dentro de cada actividad.
- **Inputs:** §8.5/8.7; API T008; unit-card y dialog.
- **Instrucciones:** crear use-material-catalog y material-picker con los tres modos exactos. Usar TanStack Query: useInfiniteQuery para catálogo y useQuery para detalles, según claves y opciones de §8.12. Derivar resultados desde data.pages, sin segundo cache manual; pasar signal hasta fetch. Mantener filtros aplicados/cursor coherentes y destino de selección local. Selección provisional en modal, carga del detalle y confirmación explícita; cancelar no modifica draft. Crear nueva actividad solo al confirmar material/formato/objetivo cuando sea necesario. Traducir nombres de formatos; estados empty/loading/failure y enlace a Contenido.
- **Output:** búsqueda, paginación, selección nueva y reemplazo contextual; eliminación de la pestaña Materiales en fachada.
- **Dependencias:** T006/T008/T011.
- **Puede modificar:** material-picker.tsx, use-material-catalog.ts, editor-query-provider.tsx, editor-query-keys.ts, editor-query-provider.test.ts, sus tests y cableado de fachada. editor-api.ts solo para propagar signal en lecturas según §8.12.
- **No puede modificar:** filtros del catálogo público, base de datos desde web, esquemas de contenido, reglas de publicación.
- **Aceptación:** P02/P08/P09/P18/P27/P33/P38/P41; abrir/cerrar no inserta resources[0]; consulta vieja no reemplaza resultados vigentes; GET pasa por Query y signal llega al transporte, sin cache manual duplicado.
- **Comprobaciones:** tests del catálogo/transport; V03; T020 probará modal en móvil.
- **Errores a evitar:** mezclar cache con resultados, perder source canonical del detalle, impedir selector cuando catálogo inicial está vacío pero una búsqueda puede devolver datos.

### T013 — Implementar actividad y opciones pedagógicas avanzadas [B]

- **Objetivo:** automatizar el caso simple y conservar capacidad de editar casos existentes complejos.
- **Inputs:** §8.2/8.5; reducer; selector y detalle de material.
- **Instrucciones:** crear activity-card/activity-options/objective-mapping-editor. Tarjeta principal con título/material/duración; Radix Collapsible para Más opciones inicialmente cerrado; Radix Accordion controlado para desplegar actividad. Defaults según formato solo al crear. Objetivo único automático; varios por elección explícita con enunciados legibles. Permitir personalizar label, opcionalidad, duración, propósito y recomendado sin reset de config. Cambiar fuente/refresh requiere confirmación si config personalizada. Mostrar alternativas heredadas sin convertirlas; restringir nuevas alternativas a familias definidas. Mostrar dependencias por títulos; representar referencia rota como «Actividad eliminada» con botón Quitar.
- **Output:** actividades y ajustes avanzados completos; materiales fijados visibles por detalle lazy.
- **Dependencias:** T012 y T004.
- **Puede modificar:** activity-card.tsx, activity-options.tsx, objective-mapping-editor.tsx; editor-model/reducer solo acciones necesarias ya definidas; tests relacionados.
- **No puede modificar:** política de evidencia ni objetivos sin acción del autor; rutas de Contenido; selección al cambiar solo texto.
- **Aceptación:** P02/P06/P07/P17/P20/P21; personalizar etiqueta no cambia snapshot/config; no duplicar ítems al usar tarjetas derivadas.
- **Comprobaciones:** V05/V03; tabla de roundtrip heredado y mutaciones por campo.
- **Errores a evitar:** asignar todos los ítems a todos los objetivos por defecto, transformar existing diagnostic en check, usar el último recurso del catálogo como fuente de metadata fijada.

### T014 — Implementar mensajes y navegación de corrección [B]

- **Objetivo:** convertir cada incidencia técnica en una instrucción accionable.
- **Inputs:** §8.8 completo; contratos/contexto T007; secciones/unidades/actividades.
- **Instrucciones:** crear editor-issues como función pura `presentIssue(issue, validatedDetail)` con resultado título/ubicación/solución/target/CTA. Implementar catálogo exhaustivo y fallback legacy; tabla de tests por código y paths. Implementar issue-card y agrupación en review-panel. Crear registro de refs y mecanismo de foco después del montaje del destino; abrir Más opciones cuando la solución lo requiere. Copy exacto de tabla salvo correcciones gramaticales documentadas sin cambiar significado.
- **Output:** avisos comprensibles, enlaces a paneles y ausencia de mensajes raw.
- **Dependencias:** T007/T011; integrar targets de actividades tras T013.
- **Puede modificar:** editor-issues.ts, editor-issues.test.ts, issue-card.tsx, review-panel.tsx; cableado de refs en componentes editor.
- **No puede modificar:** códigos/severidades en API para alterar ready; console.log con datos de alumno; publicación automática.
- **Aceptación:** P14–P19; todos los códigos de §8.8 cubiertos; objetivo UUID y revision UUID se traducen por mapa correcto; path inválido no enfoca otro elemento.
- **Comprobaciones:** V05 con tests tabulados; V03; revisión mecánica de copy; T020 valida cada familia de CTA.
- **Errores a evitar:** traducir comparando issue.message, imprimir IDs en ubicación, deduplicar problemas distintos de dos unidades, mostrar un botón sin callback real.

### T015 — Orquestar guardar/comprobar y proteger cambios [B]

- **Objetivo:** sincronizar el contenido mostrado, lo guardado y lo validado, con recuperación de errores.
- **Inputs:** §8.4/8.9; reducer; transporte; copy; props actorUserId.
- **Instrucciones:** crear use-route-editor con operación única y comandos que retornan respuestas confirmadas. Implementar saveThenValidate exacto; validar Zod antes de enviar, bloqueo de mutaciones, invalidación local y validatedEditVersion. Reemplazar URL al crear sin duplicar POST. Implementar errores 400/401/403/404/409/422/429/5xx. Guardas de enlaces/beforeunload y recuperación sessionStorage con TTL/actor/baseVersion, sin parches del historial ni cola de red. Añadir descarga local de borrador y flujo de conflicto. Transport inyectable por interfaz para fixtures, default real en producción. TanStack Query administra únicamente GET; save/validate/transition/createVersion siguen esta orquestación con fetch sin reintentos automáticos y jamás se montan como useQuery.
- **Output:** orquestación completa, barra de guardado y recuperación; viejo save/validate reemplazados.
- **Dependencias:** T004/T008/T013/T014.
- **Puede modificar:** use-route-editor.ts, editor-api.ts si requiere tipos de resultado, fachada, editor-shell; helpers `editor-recovery.ts`/tests nuevos locales.
- **No puede modificar:** autorización BFF/API, expectedVersion para forzar overwrite, router global del shell, identidad del usuario.
- **Aceptación:** P10–P13/P29–P31; ninguna acción perdida/doble; dirty conservado en error; refresh no pisa un borrador; cache de otro actor no se usa.
- **Comprobaciones:** tests puros de state/recovery; V03; casos UI obligatorios T020.
- **Errores a evitar:** leer savedPath antiguo tras setState, lock recursivo save→validate, limpiar cache antes de éxito, aceptar ready de otra versión, deshabilitar solo campos y dejar botones mutantes activos.

### T016 — Completar vista previa y flujo editorial [B]

- **Objetivo:** cerrar revisión/aprobación/publicación/versiones con lenguaje claro y permisos existentes.
- **Inputs:** §8.9/8.10; hook T015; statusLabels y capabilities actuales.
- **Instrucciones:** implementar vista previa local y eliminar DTO confirmado; no montar componentes con tracking. Añadir ajustes de evaluación/notas cerrados en revisión, con copy standard/limited. Mostrar solo acciones permitidas por estado y rol, incluyendo archivedAt. Enviar a revisión guarda/comprueba si hace falta y no continúa con errores; aprobar/publicar siguen servidor y expectedVersion. Publicar requiere diálogo; crear versión usa endpoint existente con clonación corregida. Mostrar advertencia de metadata compartida cuando `savedPath.version.number > 1` y la versión sea editable: la creación de versión actual solo ocurre desde una publicada.
- **Output:** flujo completo nueva→review→approved→published→nueva versión y preview sin tracking.
- **Dependencias:** T015/T014/T005.
- **Puede modificar:** route-preview.tsx, review-panel.tsx, hook y fachada para comandos definidos.
- **No puede modificar:** permisos, transition state machine servidor, política de publicación, avance voluntario de matrículas.
- **Aceptación:** P15/P23/P25/P26/P32; warnings permiten continuar; archivedAt impide editar aunque status sea published; preview usa dirty.
- **Comprobaciones:** V03/V05; tests rutas existentes de transición; T020 estados rol/versión.
- **Errores a evitar:** dar Publicar a creador sin permiso, confundir revisión con publicación, sumar duración de todas las alternativas, prometer aislamiento de metadata que no existe.

### T017 — Aplicar diseño y responsive definitivo [C]

- **Objetivo:** llevar los componentes al aspecto limpio y a las medidas del plan.
- **Inputs:** §8.1/8.11 y CSS de ejemplo; componentes integrados; identity-v3.css y tokens vigentes.
- **Instrucciones:** consolidar route-editor.module.css; aplicar medidas, jerarquía y breakpoints exactos; selector modal adaptado a 100dvh móvil; estados focus/hover/disabled/error y data-state de Radix; definir estilos de portales independientemente del ancestro .editor; barra sticky con padding inferior suficiente; reduced-motion. Eliminar del uso de LearningRouteEditor las clases antiguas; borrar en learning.css únicamente reglas .learning-editor-* que rg confirme sin uso fuera del editor viejo, sin tocar .learning-* de alumnos/mapa.
- **Output:** UI estilizada sobre Radix ya instalado en T001, sin bibliotecas adicionales ni estilos globales que afecten otras pantallas.
- **Dependencias:** T010/T013/T016.
- **Puede modificar:** route-editor.module.css, className dentro de componentes editor, reglas legacy editor en learning.css con comprobación de uso.
- **No puede modificar:** identity-v3.css, fuentes/global tokens, AppShell, estilos de mapa/estudiante, estructura de datos ni mensajes para acortarlos arbitrariamente.
- **Aceptación:** medidas y jerarquía de §8.11; texto de 16 px en inputs móviles; ningún botón esencial solo icono sin nombre; solución de error completa visible.
- **Comprobaciones:** V04/V03; inspección responsive T021. No marcar visual PASS antes de captura/inspección.
- **Errores a evitar:** overflow hidden para ocultar overflow, valores fijos de ancho que rompen 320px, sticky que tapa CTA, gris de bajo contraste, sombras/degradados decorativos.

### T018 — Crear fixtures y entorno UI aislado [C]

- **Objetivo:** permitir a cualquier ejecutor comprobar la UI sin cuentas ni contenido de producción.
- **Inputs:** matriz P01–P41; patrón visual-fixtures/mapa; interfaz transport de T015.
- **Instrucciones:** crear editor-fixtures.ts con IDs UUID constantes y estados `new`, `ready`, `errors`, `limited`, `legacy`, `published`, `archived`, `empty-catalog`, `long`. ready contiene 1 unidad, 1 objetivo, 1 guía y 1 cuestionario con 5 IDs distintos y explicación completa. errors contiene objetivo sin comprensión y práctica con 3 ítems. legacy contiene 2 objetivos, config personalizada, alternativas y revision anterior. long incluye títulos de 200/240 caracteres y 30 unidades con contenido colapsado. Implementar transporte fixture en memoria con editVersion, espera configurable y errores deterministas; no importar ese transporte desde rutas de producción. Crear página fixture con NODE_ENV !== development→notFound. Configurar Playwright del editor en puerto 3100 según §11.1.
- **Output:** fixture accesible localmente, modo por `estado`, sin necesidad de API real.
- **Dependencias:** T016.
- **Puede modificar:** editor-fixtures.ts, `editor-fixture-workspace.tsx` local, página visual-fixtures/editor-rutas, playwright.editor.config.ts y gitignore para `.editor-test-results` si es necesario.
- **No puede modificar:** pruebas/config del mapa, endpoints de producción, sesiones, seeds en base real ni package.json para bibliotecas distintas de las ya aprobadas e instaladas en T001.
- **Aceptación:** fixtures renderizan cada estado; production→404; acciones de fixture mutan solo memoria y nunca envían solicitudes de publicación real.
- **Comprobaciones:** V03/V08; navegador local en fixture; test que verifica guard de entorno.
- **Errores a evitar:** mock que siempre responde éxito ignorando expectedVersion, fixture imposible según schemas, insertar contenido sintético en API real.

### T019 — Verificar contratos, API, persistencia y regresión [B]

- **Objetivo:** demostrar integridad del comportamiento más allá de la UI simulada.
- **Inputs:** cambios T002/T005/T006/T007/T008; pruebas existentes; matriz P.
- **Instrucciones:** completar tests contract/storage/routes nuevos. Reutilizar patrón PGlite/Kysely de guided-learning-catalog.test.ts con base propia por suite y migraciones existentes necesarias; no ejecutar SQL contra env de producción. Cubrir borrar unidad con PATCH+GET, rollback inducido, snapshots/clone, retiro, expectedVersion, detalles readonly/canonical, permisos y optionId ajeno. Añadir regresión a test de mapa para unidad eliminada en v2 conservando v1. Comprobar conteos de attempts/enrollments/rewards antes y después de operaciones editoriales sin avance.
- **Output:** suites automatizadas y evidencia de preservación de datos.
- **Dependencias:** T005/T006/T007/T008.
- **Puede modificar:** tests guided-learning-editor-*.test.ts, helper PGlite específico en test/helpers, test de mapa existente o nuevo `learning-map-editor-regression.test.ts`.
- **No puede modificar:** provider/reglas para acomodar expectativas incorrectas; migraciones aplicadas; tests antiguos para ocultar regresiones. Un defecto real se corrige volviendo a la tarea responsable.
- **Aceptación:** P01–P08, P11–P28 y P34 en sus capas aplicables; pruebas hacen asserts de datos, no solo HTTP 200.
- **Comprobaciones:** V02/V06/V07/V03/V04. Guardar resultados.
- **Errores a evitar:** pruebas espejo de implementación sin verificar persistencia, borrar asserts previos, usar mock de provider para afirmar prueba de rollback en base.

### T020 — Verificar interacción mediante E2E [B]

- **Objetivo:** probar el flujo cotidiano y la recuperación desde una interfaz renderizada.
- **Inputs:** fixtures T018; UI T017; transporte/hook; P01–P41 y Q.
- **Instrucciones:** crear route-editor.spec.ts; selectores getByRole/getByLabel con nombres de unidad/contexto; no depender de clases de CSS. Implementar secuencia nominal de datos→unidad/objetivo→guía/cuestionario→comprobar→revisión y casos de eliminación, avisos/CTA, errores, requests en orden, doble click, recuperación, modal teclado y largo responsive. Usar rutas interceptadas o transporte fixture determinista y documentar cuál. Crear test de ausencia de requests de estudiante durante preview. Integrar @axe-core/playwright como §8.12 en los estados obligatorios, incluyendo portales; fallar por violations y registrar incomplete para revisión en T021. Tomar capturas solo en estados estables; no aprobar automáticamente screenshots nuevas sin inspección.
- **Output:** E2E verde en desktop/móvil y captura de fallos si aparecen.
- **Dependencias:** T017/T018/T019.
- **Puede modificar:** route-editor.spec.ts, fixtures si falta un estado descrito, playwright.editor.config.ts solo detalles de ejecución coherentes con §11.1.
- **No puede modificar:** configuración E2E mapa ni código de app para desactivar validación durante tests; no sleep arbitrario como solución de race.
- **Aceptación:** P02/P04–P06/P08–P13/P18–P21/P25/P29–P39/P41 en UI; tiempos de respuesta tardía reproducibles; roles/labels estables; reportes axe conservados y cero violations en el alcance fijado.
- **Comprobaciones:** V09; documentar separación UI simulada frente a API PGlite.
- **Errores a evitar:** esperar tiempo fijo en vez de estado, afirmar persistencia de base usando memoria, usar snapshot visual como única prueba de eliminación.

### T021 — Inspeccionar diseño, contenido y accesibilidad [B]

- **Objetivo:** verificar que el resultado sea comprensible y profesional, no solo funcional.
- **Inputs:** capturas/fixture final; §8.1/8.2/8.8/8.11/8.12; Q28–Q31/Q38/Q40, P35–P37/P39 y reportes axe.
- **Instrucciones:** abrir fixture final y recorrer caso nominal a teclado. Capturar y examinar estados de §11.3 a los cinco anchos. Comprobar overflow con `scrollWidth <= clientWidth` a nivel de página, además de inspección visual; medir contraste; revisar los resultados axe incomplete sin excluir reglas ni nodos del editor; probar foco/escape y 200% zoom. Revisar copy de todos los códigos, los tres usos de ayuda y ausencia de tecnicismos expuestos. Corregir solo defectos concretos y repetir el caso afectado. No diseñar una alternativa nueva.
- **Output:** EDITOR-VALIDACION.md con evidencias y capturas aceptadas; lista de defectos resueltos o pendientes.
- **Dependencias:** T020.
- **Puede modificar:** estilos y copy de componentes editor si corrigen un FAIL del plan, tests afectados y documentos/evidencias.
- **No puede modificar:** arquitectura, política de evaluación, dependencia de herramientas, alcance de pantallas ni branding global.
- **Aceptación:** cada captura revisada; Q28–Q31/Q38/Q40 PASS; cada resultado axe incomplete resuelto por revisión con evidencia; todos los problemas y soluciones legibles sin cortar; caso nominal no abre avanzados.
- **Comprobaciones:** visual y teclado manual/asistido; V09 solo casos afectados por correcciones; V04/V03 si cambió código.
- **Errores a evitar:** aprobar solo por screenshot guardada, declarar cumplimiento WCAG total sin auditoría, ocultar mensajes para que quepan, inspeccionar únicamente 1440px.

### T022 — Cerrar entrega y documentación [C]

- **Objetivo:** entregar cambios verificables y un registro que permita mantenerlos.
- **Inputs:** resultados T001–T021; definición D y checklist Q.
- **Instrucciones:** revisar diff contra baseline; verificar que no hay archivos de producción fuera de permisos. Ejecutar V11 y después V03/V04/V07/V08/V10 finales; ejecutar V09 si hubo cambios desde la última ejecución completa. Completar todas las filas D/Q con enlaces a evidencia; no sustituir NO VERIFICADO por PASS. Registrar versiones/licencias y archivos importadores con las pruebas de uso efectivo de §8.12.5 para P40. Escribir en OPERACION.md solo instrucciones nuevas para crear rutas, corregir avisos, eliminar unidades y actualizar material; conservar documentación histórica. Resumir qué cambió y cómo se probó. Entregar rutas de docs y evidencias, sin desplegar ni publicar.
- **Output:** informe final de implementación, EDITOR-EJECUCION.md, EDITOR-VALIDACION.md y operación actualizada.
- **Dependencias:** T021.
- **Puede modificar:** docs de ejecución/validación/evidencias y docs/aprendizaje-guiado/OPERACION.md.
- **No puede modificar:** código funcional, tests para hacer verde el cierre, infraestructura ni contenido real.
- **Aceptación:** D01–D16 y Q01–Q41 verificadas; cero regresiones atribuibles pendientes; limitaciones expresas; sin afirmaciones de pruebas de producción no realizadas.
- **Comprobaciones:** comandos finales indicados y revisión del alcance; cada FAIL funcional vuelve a su tarea responsable.
- **Errores a evitar:** cerrar solo porque no quedan tokens/tiempo, omitir fallos de build, confundir plan completado con implementación completada, terminar con una oferta de implementar lo que ya estaba autorizado.

## 7. Orden de ejecución y paralelismo

| Fase | Tareas y orden |
|---|---|
| Base | T001 → T002. |
| Dominio | T003 → T004. T005 y T007 después de T002. T006 después de T005. |
| Transporte | T008 después de T006 y T007. |
| UI base | T009 después de T003. T010 y T011 después de T009; T011 necesita T004. |
| Actividades | T012 después de T006/T008/T011. T013 después de T012. |
| Flujos | T014 después de T007/T011; T015 después de T004/T008/T013/T014. T016 después de T015. |
| Acabado | T017 después de T010/T013/T016. T018 después de T016. |
| Verificación | T019 después de T005/T006/T007/T008. T020 después de T017/T018/T019. T021 después de T020. |
| Cierre | T022 después de T021. |

Paralelismo permitido si se asignan varios ejecutores: T003/T004, T005/T006 y T007 pueden avanzar en líneas distintas tras T002, pero `postgres-guided-learning.ts` pertenece temporalmente a T005/T006; T007 prepara su helper separado y el coordinador integra sus llamadas después. T010 y T011 pueden hacerse en paralelo con archivos propios. T019 puede ejecutarse mientras se termina CSS en T017. No editar simultáneamente contratos, componente raíz, BFF ni el mismo test. Este documento no inicia agentes ni crea tareas de Codex por sí mismo.

Orden simple para un solo ejecutor: T001, T002, T003, T004, T005, T006, T007, T008, T009, T010, T011, T012, T013, T014, T015, T016, T017, T018, T019, T020, T021, T022.

## 8. Instrucciones de implementación

### 8.1 Flujo y jerarquía visual definitivos

**Índice `/panel/rutas`:** cabecera «Rutas de aprendizaje», texto «Organiza materiales publicados para guiar el estudio», botón primario «Crear ruta». Lista vertical de rutas: título, estado, versión y «Editar»/«Ver». Sin formulario de creación intercalado. Si está vacío: «Crea tu primera ruta de aprendizaje». Mantener la autorización actual.

**Editor:** cabecera compacta con enlace «Volver a rutas», título, estado editorial y estado de guardado. Debajo, navegación de tres secciones. En móvil usar etiquetas cortas «Datos», «Actividades», «Revisión» y nombres accesibles completos. No son tres páginas con estados separados.

**Datos:** una tarjeta blanca con título, tema, descripción breve. Portada en disclosure «Personalizar portada», con imágenes/recursos reales existentes; mantener las ocho opciones actuales. Botón «Continuar con las actividades» cambia de sección y marca campos requeridos vacíos, pero no guarda por sí solo.

**Unidades y actividades:** texto único «Divide la ruta en unidades y añade los materiales en el orden de estudio». Lista vertical de tarjetas de unidad. Solo una unidad se abre inicialmente: la primera en rutas existentes o la nueva al crear. Dentro de una unidad, inicialmente solo una actividad expandida. Abrir otra unidad/actividad conserva todos los datos; se admite cerrar todas. No colapsar automáticamente mientras se edita un campo.

Cabecera de unidad: «Unidad 1», título, número de actividades, botón accesible de expandir y menú «Acciones de la unidad» con subir, bajar, eliminar. Dentro: nombre, «¿Qué aprenderá el estudiante?» y lista de objetivos; después actividades en orden. Título de ejemplo: «Pared torácica». Objetivo de ejemplo: «Identificar las estructuras principales de la pared torácica». Son placeholders, no texto académico persistido automáticamente.

Cada actividad colapsada muestra número, nombre, icono de formato, duración si conocida y distintivo «Opcional» únicamente si aplica. Expandida muestra título, tarjeta del material vinculado y acciones «Cambiar material», «Quitar actividad» y «Más opciones». No poner todos los inputs en una cuadrícula de cinco columnas.

**Revisar y publicar:** primero resumen «Comprueba que la ruta esté lista para revisión» y botón «Comprobar ruta». Después resultado agrupado en «Por resolver» y «Sugerencias». La acción editorial disponible aparece al final de ese resumen, con estado y explicación de un renglón. Los ajustes de evaluación y notas de versión quedan en disclosures cerrados debajo. Vista previa es botón secundario disponible desde todas las secciones.

Barra inferior sticky: estado de guardado a la izquierda y «Guardar borrador» a la derecha; móvil apilada. En sección revisión la acción primaria de proceso queda dentro del panel, no se duplica como otro botón de publicar en la barra. No repetir tres botones primarios idénticos en pantalla.

### 8.2 Inventario de campos y comportamiento

| Campo actual / dato | Nuevo comportamiento | Valor o regla |
|---|---|---|
| title ruta | «Título de la ruta», visible, requerido. | 1–200 caracteres recortados. |
| summary | «Descripción breve», visible, requerida. Ayuda en línea: «Explica qué se estudiará y para quién es útil». | 1–2000 caracteres. |
| topicContentId | «Tema», visible, requerido, placeholder «Selecciona un tema». | No elegir silenciosamente el primero. Si solo hay uno, seleccionarlo y mostrarlo explícitamente. |
| slug | Sin input ni disclosure. | Generar una vez al primer intento de creación válido; conservar tras guardado y en todas las ediciones. |
| coverKey | «Personalizar portada», opcional. | `lungs` por defecto; no afirmar que la portada representa el tema automáticamente. |
| evidenceLevel | «Ajustes de evaluación» en Revisión. | standard→«Práctica completa (recomendada)»; limited→«Práctica introductoria». Conservar existentes. |
| policyVersion | Interno. | `guided-v1` en nuevas; preservar en existentes. |
| releaseNotes | «¿Qué cambió en esta versión? (opcional)». | Mostrar en Revisión; max 4000. |
| stableKey unidad/actividad | Interno e inmutable en UI. | `unidad-${uuid}` / `actividad-${uuid}`; no usar el número de posición. |
| objectives | «¿Qué aprenderá el estudiante?» | Un objetivo al comenzar, «Añadir otro objetivo» como acción secundaria; todos los existentes visibles al abrir. |
| importance | Sin input cotidiano. | 3 para nuevos; conservar cualquier 1/2/3 existente. |
| purpose | «Uso de esta actividad» dentro de Más opciones. | Derivar solo al crear; opciones legibles: Comprender, Recordar, Comprobar, Integrar conocimientos, Evaluación inicial. |
| isEssential | «Actividad opcional» dentro de Más opciones. | false en UI equivale a isEssential=true. Ayuda en línea: «Las actividades opcionales no son necesarias para completar la ruta». |
| objectiveIds | No pedirlo si hay un único objetivo. | Asociar al único objetivo; con varios elegir por sus títulos, nunca por IDs. |
| projection | «Formato», en selector de material. | Video, Guía, Cuestionario, Tarjetas. Solo formatos que soporte el material. |
| sourceContentId | Selección contextual de material. | Título y formato, sin UUID. |
| label | Texto automático del botón; personalización en Más opciones. | Ver video / Leer guía / Responder cuestionario / Repasar tarjetas. 1–120 caracteres si se personaliza. |
| isDefault | Solo visible con >1 alternativa, «Formato recomendado». | Exactamente una mientras existan opciones; al quitarla promover la primera restante. |
| estimatedMinutes | Mostrar en tarjeta; editar en Más opciones como «Duración aproximada (min)». | Del material si 1–600; null si desconocida; no inventar 5 min. |
| selectedItemIds / objectiveMappings | Internos en flujo de un solo objetivo. Panel «Preguntas y objetivos» cuando haya >1 o una configuración heredada. | Conservar selección y relaciones; ver §8.5. |
| completionRule, videoRange, guideSectionIndexes | Conservar sin reconstruir. | Mostrar nota «Este material tiene una configuración personalizada» si existe; no añadir editor de rangos en este alcance. |
| rewardIdentity/rewardVersion/pedagogyVersion | Internos. | UUID compartido por alternativas de una actividad; versiones 1 para nuevos; conservar existentes. |
| recommendedAfter | «Orden recomendado» en Más opciones, con títulos de actividades. | Nuevas: []; orden visual por arrays. No fabricar dependencias a partir de posición. |

Ayudas «?» permitidas: objetivos, alternativas equivalentes y modalidad de práctica. Máximo tres familias de ayuda, una abierta a la vez. Usar Radix Popover con Trigger asChild sobre un botón de 44×44; mantener sus relaciones ARIA generadas y Escape para cerrar. No sustituir por Tooltip de hover: la ayuda se debe poder abrir con un toque. Preferir ayuda en línea para instrucciones necesarias. Ninguna decisión esencial queda oculta detrás de «?».

### 8.3 Estructura de archivos

```text
apps/web/src/components/learning/
  learning-route-editor.tsx                  # fachada/orquestador visual; mismo export
  editor/
    route-editor.module.css
    editor-shell.tsx
    route-basics.tsx
    unit-card.tsx
    activity-card.tsx
    material-picker.tsx
    activity-options.tsx
    objective-mapping-editor.tsx
    review-panel.tsx
    issue-card.tsx
    route-preview.tsx
    editor-dialog.tsx                    # Radix Dialog y AlertDialog
    editor-query-provider.tsx           # QueryClientProvider local
    editor-query-keys.ts                 # claves de consulta tipadas
    field-help.tsx
    use-route-editor.ts
    use-material-catalog.ts
    editor-model.ts
    editor-reducer.ts
    editor-serialization.ts
    editor-issues.ts
    editor-api.ts
    editor-fixtures.ts
    *.test.ts
apps/web/src/app/panel/rutas/nueva/page.tsx
apps/web/src/app/visual-fixtures/editor-rutas/page.tsx
apps/web/tests/e2e/route-editor.spec.ts
apps/web/playwright.editor.config.ts
apps/api/src/guided-learning/editor-material-details.ts
apps/api/src/guided-learning/editor-validation.ts
apps/api/test/guided-learning-editor-*.test.ts
docs/aprendizaje-guiado/EDITOR-EJECUCION.md
docs/aprendizaje-guiado/EDITOR-VALIDACION.md
```

Conservar los clientes y rutas existentes; extenderlos según §8.6. Los componentes hoja reciben valores y callbacks tipados: no hacen fetch ni navegan por su cuenta, excepto los hooks designados. No poner CSS de este editor bajo selectores globales `input`, `button`, `fieldset`, `main` o `:root`.

### 8.4 Estado e identidades

Separar `draft` local (puede contener texto incompleto) del request validado por Zod. Usar tipos `LearningPathCreateRequest` y derivados para el dominio, y propiedades UI fuera de ese objeto. Identificadores opcionales del contrato se rellenan en las fábricas locales; cualquier entidad persistida conserva su id. El reducer trabaja por id, nunca por índices capturados antes de un await.

```ts
type EditorSection = 'basics' | 'activities' | 'review';
type Operation = 'idle' | 'saving' | 'validating' | 'transitioning' | 'creating-version';
type ValidationStamp = {
  editVersion: number;
  localRevision: number;
  issues: LearningPathValidationIssue[];
  ready: boolean;
};
// Además: savedPath, draft, localRevision, dirty, section,
// expandedUnitId, expandedActivityId, validation: ValidationStamp | null.
// Cache y resultados de búsqueda NO forman parte de draft.

function makeStableKey(kind: 'unidad' | 'actividad', id: string) {
  return `${kind}-${id}`;
}

function makeSlug(title: string, creationId: string) {
  const base = title.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '').slice(0, 155).replace(/-+$/g, '') || 'ruta';
  return `${base}-${creationId}`; // UUID completo: longitud total <= 192.
}
```

`creationId` se genera una vez por sesión de creación y permanece en memoria incluso si falla la petición. El slug se congela antes de la primera petición POST y se reutiliza en reintentos. No regenerarlo en cada render ni por cambios posteriores del título. Rutas existentes mantienen sus slugs actuales, sin añadir sufijos.

Conversión para guardar: trim en campos de texto; omitir filas de objetivo en blanco solo si no están referenciadas; si un objetivo referenciado está vacío, mostrar error bajo su input y no enviar. Un borrador puede tener cero unidades, una unidad sin objetivos y actividades sin materiales. Una actividad solo se crea después de existir al menos un objetivo escrito, pues el contrato exige objectiveIds. No relajar schemas para permitir datos inválidos. No persistir IDs UI ni estados de búsqueda.

### 8.5 Actividades, selección y eliminación

**Añadir actividad:** abre selector sin crear todavía una actividad vacía. Elegir material, formato y «Añadir a [unidad]» crea una actividad con su título y la primera opción. Cancelar no muta draft. Si la unidad aún no tiene objetivo, enfocar el campo y mostrar «Escribe qué aprenderá el estudiante antes de añadir una actividad».

**Más de un objetivo:** seleccionar el objetivo de la nueva actividad por título. Por defecto solo se selecciona automáticamente cuando la unidad tiene uno. No decidir por similitud textual. El editor avanzado permite varios objetivos y una tabla de preguntas/tarjetas con checkbox por objetivo. Cada ítem seleccionado necesita al menos un objetivo de esa actividad. Mostrar el enunciado/frente del ítem desde el detalle editorial; no mostrar UUID. Permitir «Asignar las preguntas seleccionadas a [objetivo]» solo tras selección explícita del autor. Guías/videos permiten asociar varios objetivos por título sin inventar preguntas.

Para un objetivo único: usar todos los itemIds del formato elegido y mapearlos a ese objetivo. Preguntas convertidas a tarjetas mantienen sus mismos IDs; no duplicar el conteo de evidencia por cambiar formato. El contador es orientativo hasta validación del servidor; no mostrar «Listo para publicar» usando solo cálculos cliente.

**Alternativas:** «Añadir otra forma de completar esta actividad» en Más opciones abre el selector en modo alternativa. Explicación: «El estudiante elige una de estas opciones para completar la misma actividad». Para nuevas alternativas permitir guía/video entre sí o cuestionario/tarjetas entre sí, y los mismos objetivos. Un cambio entre lectura/video y práctica se realiza como nueva actividad. Conservar y mostrar alternativas mixtas heredadas sin convertirlas ni borrarlas.

**Cambiar material:** mantener id de actividad y sus campos; mostrar selección dentro del diálogo y aplicar al confirmar. Sustituir fuente/formato regenera únicamente la config de esa opción según la elección confirmada, elimina completionRule específica para que API recalcule y registra expectedSourceVersion. Si había selección/rangos personalizados, avisar dentro del diálogo «Cambiar el material restablecerá su selección y su configuración de reproducción». No cambiar el título personalizado ni purpose existente automáticamente; ofrecer en el mismo diálogo la casilla inicialmente desmarcada «Usar el nombre del nuevo material».

**Cambiar etiqueta, duración o recomendación:** aplicar solo ese campo. No tocar config, completionRule, sourceContentId, rewardIdentity ni versiones. Editar objetivos no reasigna silenciosamente ítems: el panel muestra qué asociaciones quedan por revisar.

**Eliminar unidad:** menú → diálogo titulado «¿Eliminar “[título]”?»; texto «Se quitarán esta unidad y sus N actividades del borrador. Los materiales seguirán en la biblioteca. Guarda el borrador para confirmar el cambio». Cancelar es foco inicial; botones «Cancelar» y «Eliminar unidad». Al confirmar, quitar la unidad y eliminar de `recommendedAfter` de las actividades restantes todas las claves de actividades eliminadas. Mantener el orden, IDs y claves de lo restante. Quitar cualquier selección/panel referido a la unidad eliminada y enfocar siguiente unidad, anterior si no existe siguiente, o «Añadir unidad» si queda vacío. La operación es local hasta Guardar; no requiere DELETE de API.

Eliminar actividad usa la misma limpieza de referencias. Eliminar alternativa mantiene exactamente una recomendada cuando quedan opciones. Cero opciones es borrador válido, pero produce una corrección antes de publicación. Eliminar objetivo referenciado requiere elegir otro objetivo destino o eliminar explícitamente sus actividades; no reasignar al primer objetivo. Cancelar no modifica nada. Al reasignar, sustituir ese ID en objectiveIds y mappings, deduplicando, sin alterar ítems ni revisiones.

```ts
function removeUnit(draft: LearningPathCreateRequest, unitId: string) {
  const removed = draft.definition.units.find(unit => unit.id === unitId);
  if (!removed) return draft;
  const deletedKeys = new Set(removed.steps.map(step => step.stableKey));
  return {
    ...draft,
    definition: {
      ...draft.definition,
      units: draft.definition.units.filter(unit => unit.id !== unitId).map(unit => ({
        ...unit,
        steps: unit.steps.map(step => ({
          ...step,
          recommendedAfter: step.recommendedAfter.filter(key => !deletedKeys.has(key)),
        })),
      })),
    },
  };
}
```

**Reordenar:** botones Subir/Bajar por unidad y actividad; deshabilitados en extremos. Solo permutar arrays. No añadir drag-and-drop en esta entrega, porque no resuelve un requisito adicional del usuario. Las dependencias explícitas heredadas se preservan al reordenar y se validan; si son incompatibles/cíclicas el panel «Orden recomendado» permite corregirlas por títulos.

### 8.6 Contratos y API: cambios exactos

Mantener todos los endpoints actuales y los campos existentes. Los siguientes cambios son aditivos. Los campos opcionales permiten que clientes anteriores sigan funcionando. Extender `packages/contracts/src/guided-learning.ts` y sus exports actuales, sin nueva versión del paquete ni renombrar tipos existentes.

**Request de opción:** añadir `refreshResource?: boolean` (default false) y `expectedSourceVersion?: number` (entero positivo). Son instrucciones de guardado, no columnas ni parte de la respuesta persistida. El cliente nuevo solo manda expectedSourceVersion para selección nueva, cambio o actualización explícita; lo quita tras un guardado confirmado.

**Comprobación:** añadir `LearningPathValidateRequestSchema = z.strictObject({ expectedVersion: z.number().int().positive().optional() })`. El POST validate acepta `{}` por compatibilidad. Añadir `validatedEditVersion?: number` a LearningPathValidationResponseSchema. El servidor nuevo siempre lo devuelve en éxito; el cliente nuevo exige que coincida con el editVersion que envió. Si no está, mostrar «Actualiza el editor para completar la comprobación» y no habilitar envío basándose en ese resultado.

El proveedor `validatePath` acepta expectedVersion opcional. Leer el detalle, comparar versión, calcular las incidencias de ese detalle y comprobar de nuevo que la última versión/id/editVersion no cambió antes de devolver. Un cambio concurrente devuelve version_conflict. La transición posterior sigue revalidando en servidor y usando expectedVersion; una comprobación previa no concede permiso de publicación. El cliente considera lista la ruta solo si ready=true y no existe ninguna incidencia error; una incidencia warning desconocida conserva su carácter no bloqueante.

**Contexto de incidencia:** conservar code/message/path/severity y agregar context opcional con estos campos opcionales estrictos: unitId, stepId, optionId, objectiveId, sourceContentId (UUID); unitStableKey/stepStableKey (mismas restricciones del dominio); actualCount/requiredCount (enteros ≥0). No incluir datos del alumno. Las incidencias asociadas a varios usos del mismo material se emiten por opción con contexto propio. Mantener los paths legacy existentes para clientes anteriores.

**Detalles de materiales:** añadir dos métodos a GuidedLearningProvider y registrar dos rutas, protegidas igual que el editor:

| Método/ruta API | Uso y entrada | Respuesta |
|---|---|---|
| GET `/v1/editor/learning-resources/:contentId?projection=quiz` | Material actual elegido del catálogo; UUID y enum estrictos. | LearningEditorMaterialDetailSchema, estado ready. 404 si no existe/no está publicado/no admite formato; 403 sin capacidad editorial. |
| GET `/v1/editor/learning-paths/:pathId/materials/:optionId` | Detalle del material fijado a una opción de la versión editorial accesible. Comprobar propietario/canEditAll y pertenencia de la opción a esa versión. | Mismo schema. Ready con snapshot fijado o unavailable si se retiró/no tiene snapshot válido. Opción ajena→404 sin revelar contenido. |

Definir el schema como unión discriminada por `status`:

```ts
type EditorMaterialItem = {
  id: string;                         // UUID canónico; no mostrarlo en UI
  kind: 'question' | 'flashcard';
  prompt: string;                     // enunciado o frente, máximo 10000 caracteres
};
type LearningEditorMaterialDetail = {
  status: 'ready';
  sourceContentId: string;             // fuente canónica resuelta
  sourceVersion: number;              // versión del contenido representado
  currentSourceVersion: number | null;
  resourceRevisionId: string | null;   // null en preview no persistida
  projection: 'video' | 'guide' | 'quiz' | 'flashcards';
  title: string;
  estimatedMinutes: number | null;
  items: EditorMaterialItem[];         // máx 500; [] para guía/video
  explanationCoverage: 'complete' | 'partial' | 'missing' | 'not_applicable';
} | {
  status: 'unavailable';
  sourceContentId: string;
  title: string;                      // «Material vinculado» si no es fiable
  reason: 'retired' | 'not_published' | 'invalid_revision';
};
```

Validar title 1–240, projection enum, versiones positivas, duración 1–600 o null, todos los IDs UUID. La respuesta no incluye respuestas correctas ni explicaciones completas; solo enunciados y metadatos necesarios para asociar objetivos. Un cuestionario usado como tarjetas conserva `kind: question` e IDs de pregunta, no crea identidades nuevas.

Para detalle actual, factorizar la lectura canónica de `content-resolver.ts` (incluida guía vinculada a video) en una función de lectura compartida; NO llamar desde GET a resolvePublishedRevision, pues ese método crea registros. Usar la misma conversión de formato y adapter.parse. Si el contenido no tiene identidades válidas, devolver resource_changed con mensaje presentacional del cliente. No inventar UUIDs para compensarlo.

Para detalle fijado y storedValidation, comprobar integridad de hash antes de invocar adapters; capturar fallo de parseo de cada revisión como recurso no disponible, sin transformar toda la comprobación en 503. Para detalle fijado, leer learning_step_options → learning_resource_revisions y validar hash con `hashLearningSnapshot`; usar payload.title y payload.sourceVersion originales. Nunca presentar la última versión del contenido como si fuese el snapshot seleccionado. currentSourceVersion solo contiene la versión publicada actual si está disponible.

Añadir BFF `/api/editor/learning-resources/[contentId]/route.ts`; extender GET del catch-all de learning-paths para exactamente tres segmentos `[pathId, materials, optionId]`, ambos UUID. Usar responseSchema y `forwardGuidedLearningRequest`; no permitir sufijos arbitrarios. Todos los detalles mantienen `Cache-Control: private, no-store`.

**Conservación de revisión:** antes de resolver una actualización, comprobar acceso a la ruta. Construir mapa de opciones existentes exclusivamente desde esa ruta/version. Para cada opción recibida:

1. Si conserva id, fuente canónica y formato y refreshResource no es true, reutilizar resourceRevisionId existente. Usar config/completionRule recibidas válidas; el cliente debe conservarlas en cambios cosméticos. No consultar la última publicación para sustituirla.
2. Si es nueva, cambió fuente/formato o pide refreshResource, resolver publicación actual. Cuando expectedSourceVersion existe, compararla con sourceVersion canónica resuelta; diferencia→resource_changed sin persistir la definición.
3. Para referencias reutilizadas que estén retiradas, permitir guardar la estructura del borrador conservando la referencia; validación/publicación siguen bloqueando su uso. No impedir eliminar otra unidad por un material antiguo que permanece pendiente de sustituir.
4. Obtener el estado autorizado antes de resolver y volver a comprobar propietario, estado editable y expectedVersion bajo la transacción de escritura. Nunca confiar en IDs de opciones de otras rutas.
5. La transacción PATCH sigue abarcando actualización de metadata, sustitución de unidades, incremento de versión y auditoría. Cualquier fallo revierte todos esos cambios. No devolver un fallo después de haber confirmado escrituras parciales.

Para crear una nueva versión, clonar las referencias fijadas y las configuraciones de la publicada; crear nuevos IDs de fila unidad/actividad/opción y conservar stableKeys, IDs de objetivos, rewardIdentity, versiones pedagógicas y de recompensa. No resolver todas las publicaciones a su versión más reciente. Actualizar material es una acción separada en el borrador, reutilizando el selector y la confirmación descritos en §8.5.

No tocar cálculos de recompensas o transferencia de progreso. Las reglas existentes comparan revisión y configuración: una sustitución real debe seguir siendo detectada como cambio. No incrementar versiones pedagógicas por un cambio puramente visual.

**Guardado inválido:** POST/PATCH que falle Zod devuelve 400 `invalid_request` con `fieldErrors` opcional, array de `{ path: string, code: string }`, sin volcar mensajes internos. No devolver input recibido. El cliente ya habrá hecho la validación local, pero debe mapear también este caso. Para resource_changed mostrar qué material debe volver a seleccionarse; cuando el proveedor conoce la opción, adjuntar una incidencia contextual `resource_changed` mediante resultado not_ready (422). Conservar el error legacy 409 cuando no hay contexto fiable.

### 8.7 Selector de materiales

Modos tipados: `{kind:'new-activity',unitId}`, `{kind:'replace',unitId,stepId,optionId}` y `{kind:'alternative',unitId,stepId}`. El modo determina título y CTA; no deducir destino de índices globales.

- Título: «Añadir actividad a [unidad]» / «Cambiar material de [actividad]» / «Añadir otra forma de completar [actividad]».
- Descripción fija: «Elige un material publicado de la biblioteca para usarlo en esta actividad».
- Filtros: búsqueda por título, «Formato» y «Tema». Botón Buscar y Enter; no búsqueda automática por cada tecla. limit=24 y Cargar más con cursor y filtros aplicados originales.
- Lista de tarjetas/filas con título, tema, formatos disponibles y duración conocida. Sin nombres internos de kind/projection ni número de revisiones como información principal.
- Elegir una fila carga detalle; si tiene varios formatos, escoger uno explícitamente. En creación no preseleccionar una fila ni añadirla con un click accidental sobre toda la tarjeta.
- CTA final explícito, deshabilitado hasta tener detalle válido y elección completa. Con un formato, se preselecciona ese formato. Guía/video sin preguntas no se muestran como «material sin calidad» por no tener práctica.
- «No encontramos materiales con estos filtros. Prueba otro título o quita los filtros» y botón «Limpiar filtros». Si no hay publicaciones: «Todavía no hay materiales publicados. Crea y publica uno en Contenido para añadirlo aquí» y enlace a `/panel/contenido` en otra pestaña.
- El cache de TanStack Query almacena catálogo y detalles en claves distintas; la selección provisional vive en state local. Derivar resultados exclusivamente de las páginas de la query activa. No mantener resultIds/detailsByKey mutables que dupliquen el cache ni colar seleccionados ajenos al filtro.
- Consumir el AbortSignal que TanStack Query entrega a queryFn y pasarlo hasta fetch. Cancelar queries del selector al cerrarlo/cambiar de destino; cada conjunto de filtros usa una queryKey distinta. Respuestas antiguas no reemplazan cursor/resultados ni el destino después de cerrar/reabrir; no añadir contador de consultas ni AbortController paralelos a TanStack Query.
- Deduplicar páginas por fuente canónica/formato según resultado; no multiplicar la misma pregunta al seleccionar quiz y tarjetas derivadas.
- Claves de cache de detalle actual y fijado según §8.12, siempre con actor/ruta. Incluir sourceVersion conocida en selección actual y resourceRevisionId en fijados; un refetch de lectura nunca reemplaza config del borrador. Cargar solo actividades abiertas, no 1800 actividades al montar.
- Al cambiar material y volver a abrir un borrador, obtener detalle fijado aunque esa fuente no aparezca en la primera página del catálogo.

### 8.8 Validación comprensible y catálogo de mensajes

Formato de cada aviso: título de máximo 90 caracteres, ubicación legible, explicación/solución de una o dos frases y un CTA. La redacción puede interpolar títulos con escape normal de React; no usar dangerouslySetInnerHTML. No mezclar error de red con un error pedagógico.

Ejemplo obligatorio: **«Faltan 2 preguntas o tarjetas para este objetivo»**. Ubicación: «Pared torácica · Identificar las estructuras principales». Texto: «Hay 3 de las 5 necesarias. Añade práctica que cubra este objetivo o revisa las preguntas asociadas». CTA: «Añadir práctica»; secundario «Revisar asociaciones». Solo usar el número cuando context lo confirme.

| code | Mensaje y solución final | Acción y destino |
|---|---|---|
| unit_required | «La ruta todavía no tiene unidades». «Añade una unidad para organizar las actividades». | Añadir unidad; sección Actividades. |
| objective_required | «Falta indicar qué se aprenderá». «Escribe al menos un objetivo en esta unidad». | Escribir objetivo; campo unidad. |
| essential_step_required | «Esta unidad necesita una actividad obligatoria». «Añade una actividad o desactiva “Actividad opcional” en una existente». | Revisar actividades; unidad. |
| option_required | «Esta actividad no tiene material». «Selecciona un video, guía, cuestionario o tarjetas». | Elegir material; actividad. |
| default_option_required | «Elige el formato recomendado». «Marca una de las alternativas de esta actividad». | Elegir recomendado; Más opciones. |
| unknown_objective | «La actividad está asociada a un objetivo que ya no existe». «Selecciona un objetivo de esta unidad». | Asociar objetivo; actividad. |
| unknown_resource_item | «La selección incluye preguntas o tarjetas que ya no están disponibles». «Abre el material y vuelve a seleccionar las que usarás». | Revisar selección; configuración de opción. |
| unknown_mapping_item | «Algunas asociaciones corresponden a preguntas o tarjetas que ya no están disponibles». «Revisa la selección y vuelve a asignar sus objetivos». | Revisar asociaciones; opción. |
| unknown_mapping_objective | «Una pregunta o tarjeta está asociada a un objetivo distinto al de la actividad». «Selecciona el objetivo correspondiente». | Revisar asociaciones; opción. |
| question_explanation_required | «Hay preguntas sin explicación de la respuesta». «En Contenido, busca “[material]”, añade las explicaciones y publica la corrección. Después actualiza el material de esta actividad». | Abrir Contenido en otra pestaña; conservar borrador. Acción secundaria Actualizar material. |
| unknown_prerequisite | «El orden recomendado incluye una actividad eliminada». «Quita esa referencia o elige otra actividad». | Revisar orden; actividad localizada por stepStableKey. |
| cyclic_recommendation | «Dos o más actividades se recomiendan unas después de otras». «Revisa el orden y quita una de esas relaciones». | Revisar orden; mostrar lista de dependencias por títulos en Más opciones de la unidad afectada. |
| objective_understanding_missing | «Falta una actividad para comprender este objetivo». «Añade una guía o un video. Si ya existe, comprueba que esté asociado a este objetivo y su uso sea Comprender o Integrar conocimientos». | Añadir explicación; selector guía/video en unidad. |
| objective_retrieval_missing | «Falta práctica para este objetivo». «Añade un cuestionario o tarjetas y asócialos a este objetivo». | Añadir práctica; selector quiz/flashcards. |
| objective_mapping_missing | «Las preguntas o tarjetas no están asociadas a este objetivo». «Indica qué preguntas o tarjetas lo practican». | Asociar práctica; panel de asociaciones. |
| insufficient_evidence | «Faltan preguntas o tarjetas para este objetivo». Con conteo: «Hay X de las 5 necesarias; añade M más que cubran el objetivo». Sin conteo: «Asocia al menos 5 preguntas o tarjetas distintas a este objetivo». | Añadir práctica; selector. Secundaria Revisar asociaciones. |
| limited_evidence | «Este objetivo tiene práctica introductoria». «Puedes continuar. Añade hasta completar 5 preguntas o tarjetas distintas si quieres ofrecer práctica completa». | Mejorar práctica; no bloquea. |
| resource_unavailable | «Este material ya no está disponible para la ruta». «Elige otro material publicado o publica su corrección en Contenido y actualízalo aquí». | Cambiar material; opción exacta. |
| topic_unavailable | «El tema de la ruta no está publicado». «Selecciona un tema publicado o publica el tema desde Contenido». | Elegir tema; Datos. |
| duplicate_objective | «No pudimos distinguir dos objetivos de la ruta». «Tus cambios siguen aquí. Reintenta la comprobación; si continúa, solicita ayuda al equipo del sitio». | Reintentar comprobación; conservar datos. Incidencia de integridad para equipo. |
| duplicate_step_key | «No pudimos distinguir dos actividades de la ruta». Misma solución de reintento y ayuda. | Reintentar comprobación; nunca regenerar claves persistidas silenciosamente. |
| duplicate_unit_key (nuevo) | «No pudimos distinguir dos unidades de la ruta». Misma solución de reintento y ayuda. | Reintentar comprobación; no editar claves en UI. |
| resource_changed (nuevo contextual) | «El material cambió mientras editabas». «Vuelve a seleccionarlo y revisa las preguntas antes de guardar». | Revisar material; selector de reemplazo. |
| código desconocido | «No pudimos completar esta comprobación». «Tus cambios siguen aquí. Reintenta; si continúa, solicita ayuda al equipo del sitio». | Reintentar comprobación. No convertirlo en warning ni asumir ready. |

Los tres errores de identidades duplicadas no tienen una corrección pedagógica segura para el autor: la solución de sistema corresponde al ejecutor si los reproduce. Se mantienen comprensibles y con una acción real. No enviar mensajes automáticamente a otras personas desde esos botones.

**Contexto:** resolver primero IDs del context. Fallback estricto para datos legacy: `version.units.N.steps.M.options.K`, `version.units.N`, `objective.UUID`, `resource.UUID`, `step.KEY.recommendedAfter`, `topicContentId`; aplicar índices únicamente contra el detalle inmutable que se validó. Mapearlos a IDs/títulos antes de mostrarlos. Si no puede resolverse, mostrar «Ruta completa» y volver al panel de revisión, sin navegar a un elemento erróneo. Para resource.UUID sin contexto encontrar opciones cuya resourceRevisionId coincida, nunca buscar por sourceContentId.

El conteo actual/required de evidencia se calcula en API usando el mismo conjunto de IDs canónicos que `validateLearningPathDefinition`. No sumar itemCount de tarjetas ni duplicados de formatos. No modificar esta política ni introducir criterios clínicos en el mensaje. Añadir detección de stableKey de unidad repetida antes de que una restricción SQL lo convierta en fallo genérico.

Agrupar «Por resolver (N)» primero, «Sugerencias (N)» después. Ordenar por posición de unidad/actividad y luego aparición del validador. Deduplicar únicamente code+context+path iguales. No ocultar el mismo problema cuando afecta a varias actividades distintas. Un banner resume «Hay N puntos por resolver antes de enviar a revisión»; con cero errores y warnings: «La ruta está lista para revisión. Hay N sugerencias opcionales».

La acción correctiva usa `setSection`, abre unidad/actividad/More según target, espera a que el componente destino se monte y llama focus mediante ref registrada. No usar timeout arbitrario para adivinar el render. `scroll-margin-top` evita que el encabezado tape el control. `tabIndex=-1` en encabezados que reciben foco programático.

```tsx
function IssueCard({ issue, onResolve }: {
  issue: { severity: 'error' | 'warning'; title: string;
    location: string; resolution: string; actionLabel: string };
  onResolve: () => void;
}) {
  return (
    <li className={styles.issue} data-severity={issue.severity}>
      <div>
        <span className={styles.issueKind}>
          {issue.severity === 'error' ? 'Por resolver' : 'Sugerencia'}
        </span>
        <h3>{issue.title}</h3>
        <p className={styles.location}>{issue.location}</p>
        <p>{issue.resolution}</p>
      </div>
      <button type="button" onClick={onResolve}>{issue.actionLabel}</button>
    </li>
  );
}
```

### 8.9 Guardado, concurrencia y estados editoriales

El hook único devuelve comandos async que devuelven datos confirmados, no solo actualizan setState. Es obligatorio usar el resultado de guardar para construir validate/transition; no leer savedPath inmediatamente después de setSavedPath esperando que ya cambió.

```ts
async function saveThenValidate() {
  if (operationRef.current !== 'idle') return;
  operationRef.current = 'saving';
  try {
    const request = buildValidatedRequest(); // error local enfoca campo y termina
    if (!request.ok) return;
    // persistIfNeeded no toma otra vez el mismo lock de operación.
    const confirmed = await persistIfNeeded(request.value);
    if (!confirmed) return;                 // cero validate si falló guardar
    operationRef.current = 'validating';
    const result = await api.validate(confirmed.id, confirmed.version.editVersion);
    if (!result.ok) return;
    if (result.value.validatedEditVersion !== confirmed.version.editVersion) {
      showValidationOutdated();
      return;
    }
    acceptValidation(confirmed, result.value);
  } finally {
    operationRef.current = 'idle';
  }
}
```

El código real sincroniza operationRef con el estado visible. Durante save/validate/transition bloquear todas las mutaciones del borrador y CTAs editoriales, incluyendo los botones que antes estaban fuera de fieldset. No bloquear leer la página. Ninguna petición modifica el draft desde una captura de un render anterior. Error de red conserva campos, selección y estado dirty; guardar exitoso reemplaza solo con respuesta validada por Zod.

En creación: tras POST exitoso usar `router.replace('/panel/rutas/'+id)` y no push repetido; conservar respuesta para el validate encadenado. La fachada recibe `key={path.id}` en edición para que cambiar a otra ruta reinicialice el estado. Un refresh de la misma ruta no sobreescribe dirty; si hay cambios del servidor, se presentan como conflicto.

Tras cualquier mutación local: incrementar localRevision, marcar dirty y poner validation=null. Mostrar «Hay cambios nuevos. Comprueba la ruta para actualizar los resultados». Nunca mostrar un check verde anterior como estado vigente.

Respuestas: 400→errores de campos legibles; 401→«Tu sesión terminó. Inicia sesión para guardar», conservar borrador y ofrecer acceso en otra pestaña; 403→«Tu cuenta no puede realizar esta acción», no fingir éxito; 404 de ruta→«La ruta ya no está disponible»; 409 version_conflict→«La ruta cambió en otra sesión. Conserva tus cambios y abre la versión guardada antes de continuar»; 422→incidencias; 429→«Hay demasiadas solicitudes. Espera un momento y vuelve a intentar»; 5xx/network→«No pudimos confirmar el guardado. Tus cambios siguen aquí. Vuelve a intentar».

Conflictos: nunca sobreescribir automáticamente. Ofrecer «Descargar mis cambios» (JSON de recuperación del borrador, descarga local explícita) y «Abrir versión guardada» en otra pestaña. No implementar merge automático. En los clicks sin modificadores que abandonen el editor mostrar diálogo con «Seguir editando», «Guardar y salir», «Salir sin guardar»; salida tras guardar ocurre solo si confirma éxito. Usar un listener capture montado únicamente por este editor, que reconoce links same-origin con pathname distinto y excluye descargas, target=_blank y navegación interna de secciones. No cambiar el shell. Registrar beforeunload mientras dirty o hay una mutación pendiente para recarga/cierre; el texto de ese aviso lo controla el navegador.

Para Atrás/Adelante del navegador no parchear el router ni fabricar entradas de historial: conservar recuperación local en sessionStorage. Pasar actorUserId desde getCurrentUser a la fachada y crear clave `cediah:route-editor:v1:[actorUserId]:[pathId|new]`. Guardar solo draft, slug/creationId, baseEditVersion, localRevision y savedAt con debounce de 400 ms; hacer flush en pagehide, popstate y antes de una navegación consentida. No guardar cookies, detalle de materiales ni respuestas de alumnos. El cache es de recuperación, no cola de peticiones ni sincronización automática. Si falla sessionStorage, mostrar «La recuperación local no está disponible; guarda antes de salir» y mantener guardas de salida.

Al volver, si existe cache de menos de 24 horas para el mismo actor/ruta, mostrar «Hay cambios de esta pestaña sin guardar» con Recuperar/Descartar, sin aplicarlos ni enviarlos automáticamente. Si baseEditVersion difiere del servidor, permitir inspeccionar/descargar ese borrador, pero impedir guardarlo sobre la versión nueva; se trata como conflicto. Parsear con schema local que admite campos incompletos y rechaza propiedades desconocidas; no usar el request Zod completo que rechazaría un título todavía vacío. Limpiar cache al guardar exitosamente, al descartar explícitamente o al expirar; trasladar la clave new al pathId confirmado si quedan cambios. Probar Back/Forward y Ctrl/Cmd+click. No prometer guardar campos de un cierre brusco anterior al último flush.

| Estado | Edición | Acción principal y comportamiento |
|---|---|---|
| nueva/draft/changes_requested | Sí | Guardar; Comprobar guarda y valida; Enviar a revisión exige resultado vigente ready=true y usa expectedVersion. Si dirty al intentar enviar, ejecutar guardar+comprobar antes, y enviar solo si listo. |
| in_review | No | Para quien puede revisar: Solicitar cambios / Aprobar. El servidor revalida al aprobar. Los demás ven «Esta ruta está en revisión». |
| approved | No | Publicar para canPublish. Diálogo «¿Publicar esta versión?» explica que será visible para estudiantes y que después se editará mediante nueva versión. |
| published | No | «Crear nueva versión para editar». Mantener texto breve sobre estudiantes que continúan en su versión actual. |
| archived | No | Mensaje «Esta ruta está archivada». Sin botón de editar/publicar. |

`archivedAt !== null` también implica solo lectura, aunque version.status permanezca published: el proveedor actual archiva la ruta sin cambiar necesariamente ese status. No habilitar crear versión en ese caso. Las capacidades de UI son orientación; API sigue siendo la autoridad.

En rutas con una versión publicada y borrador posterior, la metadata de learning_paths es compartida actualmente. Este alcance no convierte esa metadata en versionada. Informar en Datos «Los cambios de título, descripción, tema y portada se aplican a la ficha de la ruta al guardar». Las unidades/materiales del borrador sí permanecen separados de la publicada. No prometer aislamiento total de metadata que el modelo actual no ofrece.

### 8.10 Vista previa

Vista previa local del draft actual, accesible desde cualquier sección sin guardar y sin ejecutar attempts, enrollments, tracking ni recompensas. Mostrar título, descripción, portada existente, unidades, objetivos, actividades, formatos y alternativas en español. Texto «Vista previa de la estructura; no registra actividad de estudio». Los botones de material son presentacionales deshabilitados o enlaces de lectura explícitos; no crear una sesión real de alumno.

Eliminar el enlace «DTO confirmado». No reutilizar un componente de estudiante que dispare efectos de tracking. Reutilizar tokens/tarjetas presentacionales cuando se puedan separar de esos efectos. Si una duración falta, mostrar «Duración por definir» o no sumar ese tramo; no presentar la suma parcial como duración total exacta. Sumar una alternativa recomendada por actividad, no todas sus alternativas.

### 8.11 Diseño responsive y accesibilidad

Usar tokens actuales de `identity-v3.css`: primario #29356f, texto #1a2034, fondo #f6f7fc, borde #e2e6f2; los alias `--koraz-*` ya apuntan a ellos. Fuente heredada del shell; nada de descargar una nueva. Blanco para superficies; rojo/ámbar solo en incidencias y eliminación. No ilustraciones decorativas nuevas, degradados de fondo ni sombras grandes en cada tarjeta.

Medidas: ancho máximo 1120 px, espaciado 8/12/16/24/32, tarjetas radio 16 y controles radio 10, bordes 1 px. Cabecera 28–36 px; títulos de sección 22–24; título de tarjeta 18; texto/input 16; secundaria 14. Botones y controles ≥44 px de alto. Jerarquía por espacio y tipografía, no por numerosas cajas anidadas.

Desktop ≥1024: datos en dos columnas, descripción a todo ancho; unidades en una columna; ninguna columna lateral indispensable. 768–1023: tarjetas y formularios siguen fluidos, sin selector lateral permanente. <768: todo a una columna, margen 12 px, tarjetas padding 16, navegación de tres partes iguales con labels cortas; CTA final del diálogo a ancho completo. Selector ancho min(880px, viewport-32px), altura máxima 85dvh desktop; <768 ocupa 100dvw×100dvh con header/footer propios y solo contenido central desplazable.

```css
.editor { width: min(100%, 1120px); min-width: 0; margin-inline: auto;
  padding: 24px 24px calc(136px + env(safe-area-inset-bottom)); }
.card { min-width: 0; background: var(--koraz-surface); border: 1px solid var(--koraz-line);
  border-radius: 16px; padding: 24px; }
.fieldGrid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 20px; }
.field { display: grid; min-width: 0; gap: 8px; }
.field input, .field select, .field textarea { width: 100%; min-width: 0; min-height: 44px;
  border: 1px solid var(--koraz-line-strong); border-radius: 10px;
  padding: 10px 12px; font: inherit; font-size: 16px; color: var(--koraz-ink); background: white; }
.editor :is(button, a, input, select, textarea):focus-visible {
  outline: 3px solid var(--koraz-blue); outline-offset: 3px; }
.issue { display: flex; align-items: start; justify-content: space-between; gap: 16px;
  border: 1px solid #f3c4bd; background: #fff5f3; border-radius: 12px; padding: 16px; }
.issue[data-severity='warning'] { border-color: #ecd3a4; background: #fff8e8; }
.issue h3 { margin: 6px 0; font-size: 16px; }
.saveBar { position: sticky; bottom: max(12px, env(safe-area-inset-bottom));
  z-index: 25; display: flex; align-items: center; justify-content: space-between; gap: 16px;
  padding: 12px 16px; background: white; border: 1px solid var(--koraz-line); border-radius: 14px; }
.focusTarget { scroll-margin-top: calc(var(--topbar-height, 72px) + 80px); }
@media (max-width: 767px) {
  .editor { padding: 16px 12px calc(176px + env(safe-area-inset-bottom)); }
  .card { padding: 16px; }
  .fieldGrid { grid-template-columns: minmax(0, 1fr); }
  .issue, .saveBar { flex-direction: column; align-items: stretch; }
}
@media (prefers-reduced-motion: reduce) {
  .editor *, .dialog * { scroll-behavior: auto; transition: none; animation: none; }
}
```

Completar estilos de estado disabled/hover/error y del diálogo; el ejemplo fija la dirección, no sustituye T017. No usar overflow-x:hidden para ocultar un fallo de anchura. Texto largo con overflow-wrap:anywhere cuando corresponda; no truncar títulos de errores ni soluciones.

Tabs: Radix Tabs controlado con activationMode="manual" genera role=tablist/tab/tabpanel y relaciones ARIA; verificar flechas izquierda/derecha, Home/End y Enter/Espacio. No volver a implementar esos handlers ni sobrescribir IDs accesibles sin necesidad. No capturar flechas cuando se escribe en inputs. Patrón de referencia: [W3C APG Tabs](https://www.w3.org/WAI/ARIA/apg/patterns/tabs/).

Diálogo: al abrir mover foco dentro, impedir foco/interacción con fondo, Tab/Shift+Tab contenidos, Escape y Cerrar, restituir foco al disparador o sucesor lógico si fue eliminado. En eliminación enfocar Cancelar. Usar Radix Dialog modal/AlertDialog con Root controlado, Portal, Content, Title y Description; no combinarlo con dialog.showModal ni un segundo focus trap. Implementar onCloseAutoFocus solo para el caso en que el disparador desaparezca y deba enfocarse un sucesor lógico. No meter formularios anidados. Referencia: [W3C APG Dialog](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/).

Errores locales con aria-invalid y aria-describedby; resumen anunciado una vez en role=status aria-live=polite, no un role=alert por cada incidencia. Corregir debe dar una sugerencia accionable cuando se conoce: [W3C Error Suggestion](https://www.w3.org/WAI/WCAG22/Understanding/error-suggestion.html). Contraste de texto normal ≥4.5:1 y controles/foco distinguibles; comprobar con medición, no inferir de una captura. Objetivo de accesibilidad de este proyecto: operación completa a teclado, reflow a 320 px y zoom 200%, sin afirmar certificación WCAG completa.

### 8.12 Bibliotecas gratuitas: selección e integración obligatorias

Esta revisión incorpora la instrucción posterior del usuario de usar bibliotecas reconocidas y gratuitas. **El ejecutor debe instalarlas e integrarlas en los puntos indicados.** Sustituye la prohibición general de dependencias de la primera revisión. Se mantienen la arquitectura de datos, las tres secciones, el reducer del borrador y las reglas de publicación.

Se consultaron documentación oficial y metadatos del registro npm el 14 de septiembre de 2026. Las versiones de la tabla eran las estables marcadas latest en esa consulta; su existencia, licencias y peers se volvieron a verificar mediante sus manifiestos exactos el 19 de septiembre de 2026. Sus requisitos declarados son compatibles con React 19 del proyecto; axe declara compatibilidad con playwright-core >=1.0.0. No se ha instalado ni compilado ninguna biblioteca durante esta planificación: la compatibilidad ejecutada se demuestra en T001–T021, no se presume a partir del manifiesto.

#### 8.12.1 Paquetes elegidos y por qué

| Biblioteca | Versión exacta / categoría | Licencia declarada | Uso obligatorio | Qué trabajo evita |
|---|---|---|---|---|
| Radix UI Primitives, `radix-ui` | 1.6.7; dependencies de @cediah/web | MIT | Dialog, AlertDialog, Tabs, Accordion, DropdownMenu, Popover y Collapsible. | Escribir desde cero interacción de modales, navegación de pestañas, apertura de menús y gestión de foco. |
| TanStack Query, `@tanstack/react-query` | 5.102.8; dependencies de @cediah/web | MIT | useInfiniteQuery en catálogo; useQuery en detalle actual/fijado; QueryClientProvider local al editor. | Duplicar cache de GET, paginación y lógica de cancelación de consultas. |
| axe para Playwright, `@axe-core/playwright` | 4.13.0; devDependencies de @cediah/web | MPL-2.0 | Análisis automatizado de accesibilidad en los estados definidos en §8.12.5. | Mantener detectores propios de fallos de accesibilidad que axe ya comprueba. |

Son bibliotecas open source utilizables sin suscripción ni API de pago. Registrar y conservar los avisos de sus licencias distribuidas; no eliminar LICENSE/NOTICE de paquetes. Se utiliza únicamente axe-core y su integración local, no servicios comerciales de Deque. Fuentes de las versiones y licencias: [manifiesto radix-ui 1.6.7](https://registry.npmjs.org/radix-ui/1.6.7), [manifiesto TanStack Query 5.102.8](https://registry.npmjs.org/@tanstack/react-query/5.102.8), [manifiesto axe para Playwright 4.13.0](https://registry.npmjs.org/@axe-core/playwright/4.13.0).

Radix ofrece primitivas sin estilos y permite aplicar el CSS Module propio. Adoptar el paquete unificado `radix-ui` con imports nombrados; no instalar además todos los paquetes individuales ni Radix Themes. [Documentación oficial de Radix](https://www.radix-ui.com/primitives/docs/overview/introduction).

Reutilizar sin reinstalar ni actualizar: `zod@4.4.3` para contratos y errores de campo, `@phosphor-icons/react@2.1.7` para iconos, `vitest@4.1.11` y `@playwright/test@1.63.0` para pruebas, `@electric-sql/pglite@0.5.8` en API para persistencia de prueba. React y CSS Modules siguen cubriendo el estado local y los estilos. Las versiones existentes se verificaron en los package.json del repositorio; no se está indicando que deban reemplazarse por latest.

**Alternativas evaluadas y descartadas en este alcance:** React Hook Form 7.88.0 y @hookform/resolvers 5.9.1 son candidatos válidos (MIT; peers consultados compatibles con React 19 y Zod 4), pero aquí introducirían otra representación del formulario junto al reducer jerárquico y la recuperación del borrador. Se conserva el estado local único. La función de la biblioteca se puede consultar en su [repositorio oficial](https://github.com/react-hook-form/react-hook-form); esta exclusión es una decisión arquitectónica para este proyecto, no una afirmación de incompatibilidad. No añadir shadcn/Tailwind, un kit visual completo, otra biblioteca de iconos, notificaciones flotantes ni drag-and-drop: ninguna de esas piezas es necesaria para implementar las interacciones ya especificadas. No añadir Axios: fetch ya existe y admite la cancelación necesaria.

#### 8.12.2 Instalación y archivos autorizados

T001 debe ejecutar, desde la raíz y después de capturar baseline:

```powershell
pnpm --filter @cediah/web add --save-exact radix-ui@1.6.7 @tanstack/react-query@5.102.8
pnpm --filter @cediah/web add --save-dev --save-exact @axe-core/playwright@4.13.0
pnpm --filter @cediah/web list radix-ui @tanstack/react-query @axe-core/playwright --depth 0
pnpm install --frozen-lockfile
```

Autorizar cambios de instalación solo en apps/web/package.json y pnpm-lock.yaml. No modificar pnpm-workspace.yaml, engines, minimumReleaseAgeExclude, overrides o allowBuilds para forzar la instalación. Los paquetes transitivos de las tres bibliotecas son esperables; no confundirlos con dependencias directas elegidas por el ejecutor. No usar @latest en comandos de instalación ni actualizar versiones ya presentes del proyecto.

Antes de instalar, consultar `pnpm view PAQUETE@VERSION version license peerDependencies --json` para cada par fijado y registrar el resultado en `EDITOR-EJECUCION.md`. Si una versión no existe, ha sido retirada o produce un conflicto real con los peers del checkout, detener solo la instalación y documentar el conflicto exacto; no cambiar React/Next ni usar --force. Resolver primero errores triviales de acceso al registro; escalar la selección de una versión sustitutiva solo si la incompatibilidad está demostrada. No abrir una nueva búsqueda de bibliotecas por preferencia personal.

#### 8.12.3 Radix: componentes concretos y reglas de composición

| Archivo / superficie | Primitiva obligatoria | Instrucción |
|---|---|---|
| editor-shell.tsx | Tabs | Root controlado por section, activationMode="manual". Los tres paneles leen el estado único del editor. |
| unit-card.tsx y actividad desplegable | Accordion | Root type="single" collapsible; value es el ID abierto, no un índice. Usar Header/Trigger/Content. |
| Más opciones / ajustes de evaluación | Collapsible | Controlado cuando una incidencia deba abrirlo; cerrado al entrar por primera vez. |
| editor-dialog.tsx, selector y preview | Dialog | Root modal controlado, Portal, Overlay, Content, Title, Description y Close. |
| Confirmación de eliminación/publicación/salida | AlertDialog | Cancel enfocado inicialmente, Action para aceptar; no cerrar por un click accidental en el fondo. |
| Acciones de unidad y actividad | DropdownMenu | Trigger, Content e Item con disabled real en extremos de orden. |
| field-help.tsx | Popover | Trigger asChild sobre botón «?», Content con texto breve y Close accesible. Se abre por toque/teclado; máximo una ayuda abierta. |

Mantener inputs, textarea y selects HTML nativos para título, tema y filtros simples; no reemplazarlos por un componente complejo sin necesidad. Los botones de borrar/menú deben ser hermanos del Accordion.Trigger, nunca botones anidados dentro del trigger. Los componentes personalizados usados con asChild deben pasar props y ref al elemento DOM final; preferir un button nativo como hijo para evitar ese trabajo.

Radix gestiona el foco y el teclado de sus primitivas. El código propio solo decide destino, datos, apertura/cierre y el foco alternativo cuando desaparece el disparador. No combinar sus modales con showModal, useDialogFocus, focus traps locales o listeners globales de Escape. No desactivar el comportamiento modal para que un test pase. [Dialog](https://www.radix-ui.com/primitives/docs/components/dialog), [Alert Dialog](https://www.radix-ui.com/primitives/docs/components/alert-dialog), [Tabs](https://www.radix-ui.com/primitives/docs/components/tabs), [Accordion](https://www.radix-ui.com/primitives/docs/components/accordion) y [Popover](https://www.radix-ui.com/primitives/docs/components/popover).

Para diálogo abierto desde DropdownMenu.Item: guardar el destino en el estado padre, cerrar primero el menú y abrir la confirmación en el siguiente commit, usando estado/effect y no un timeout. Registrar como foco de retorno el botón del menú; al confirmar eliminación usar el sucesor lógico del plan. No abrir simultáneamente dos capas que compitan por foco. Para operaciones remotas de publicación/salida, AlertDialog controlado permanece abierto y muestra error si falla la operación; onClick del Action usa preventDefault y el hook cierra solo tras éxito. El borrado de una unidad es local y puede cerrar después de aplicar el reducer.

Los portales se renderizan fuera del contenedor principal: aplicar sus className del CSS Module directamente a Content/Overlay. Definir overlay z-index 100, diálogo 110 y contenido de Popover/DropdownMenu dentro de un diálogo 120; todos quedan por encima de la barra sticky z-index 25. No depender de `.editor .dialog` para estilos ni selectores de pruebas. Añadir `data-editor-surface` a raíz, contenido de diálogo y contenido de ayuda/menú.

Ejemplo de composición para el selector; el contenido y los botones de selección siguen las reglas de §8.7:

```tsx
import { Dialog } from 'radix-ui';

<Dialog.Root open={pickerOpen} onOpenChange={setPickerOpen}>
  <Dialog.Trigger asChild>
    <button type="button">Añadir actividad</button>
  </Dialog.Trigger>
  <Dialog.Portal>
    <Dialog.Overlay className={styles.dialogOverlay} />
    <Dialog.Content className={styles.dialog} data-editor-surface>
      <Dialog.Title>Añadir actividad a {unit.title}</Dialog.Title>
      <Dialog.Description>
        Elige un material publicado de la biblioteca.
      </Dialog.Description>
      {pickerContents}
      <Dialog.Close asChild>
        <button type="button">Cancelar</button>
      </Dialog.Close>
    </Dialog.Content>
  </Dialog.Portal>
</Dialog.Root>
```

El ejemplo no autoriza pasar un modal completo como pickerContents ni renderizar formularios anidados. Si la apertura está gestionada por otro elemento de la lista, el wrapper admite ausencia de Trigger y recibe ref de retorno; probar el cierre en ese modo. Cancelar descarta solo la selección provisional.

#### 8.12.4 TanStack Query: lecturas separadas del borrador

Crear `editor-query-provider.tsx` client component. Instanciar QueryClient una vez mediante useState; montar este provider dentro del editor con key por actorUserId+pathSessionId, donde pathSessionId es pathId o `new:[creationId]`. No ponerlo como singleton de módulo ni reemplazar providers globales. Al cambiar actor o ruta se crea una instancia distinta; las claves también incluyen esa identidad. No persistir el cache de Query en localStorage/sessionStorage ni enviarlo a otros tabs. Solo el borrador usa la recuperación de §8.9.

Opciones fijadas para GET: staleTime=30000, gcTime=300000, retry=false, refetchOnWindowFocus=false, refetchOnReconnect=false, networkMode="always". El modo de red hace que un intento offline produzca el error de conexión visible, sin dejarlo pausado para ejecutarse después. Abrir un selector o pulsar Buscar/Reintentar puede solicitar datos de forma explícita; un retorno de foco no debe modificar lo que el usuario está seleccionando. Estas son decisiones del proyecto frente a los [defaults documentados de TanStack Query](https://tanstack.com/query/latest/docs/framework/react/guides/important-defaults).

Las queryKey se crean exclusivamente mediante editor-query-keys.ts:

```ts
const scope = ['route-editor', actorUserId, pathSessionId] as const;
const catalogKey = [...scope, 'catalog', { q, projection, topic }] as const;
const currentDetailKey = [...scope, 'current-material', sourceContentId,
  projection, expectedSourceVersion ?? null] as const;
const fixedDetailKey = [...scope, 'fixed-material', optionId, resourceRevisionId] as const;
```

q se normaliza con trim al aplicar búsqueda; los campos de texto aún no aplicados no cambian la key. TanStack separa cache por clave, por lo que una respuesta de otro filtro no sustituye la consulta vigente. [Query Keys](https://tanstack.com/query/latest/docs/framework/react/guides/query-keys).

Catálogo: useInfiniteQuery, initialPageParam=null, getNextPageParam=lastPage.nextCursor ?? undefined, enabled mientras el selector esté abierto. El API acepta cursor opcional: omitirlo cuando pageParam es null. limit=24. Mostrar pages.flatMap(page=>page.items), deduplicando por item.id; no guardar otro array mutable de resultados. Cargar más solo si hasNextPage y !isFetching. No usar keepPreviousData/placeholderData para presentar resultados del filtro anterior como si pertenecieran al nuevo. Si se aprovechan initialResources, inyectar initialData una vez y únicamente para la key sin filtros, con `{pages:[respuestaCompleta],pageParams:[null]}`; no resembrarlo al borrar filtros. [Infinite Queries](https://tanstack.com/query/latest/docs/framework/react/guides/infinite-queries).

queryFn recibe signal y el adaptador editor-api lo pasa a fetch. Al cerrar selector cancelar las queries de catálogo/detalle actual de ese scope; al desmontarse una actividad cancelar su lectura fijada pendiente si ya no se usa. No abortar ni cancelar PATCH/POST por cerrar una ayuda. Consumir AbortSignal permite a TanStack cancelar también la petición subyacente; no atraparlo y convertirlo en un catálogo vacío. [Query Cancellation](https://tanstack.com/query/latest/docs/framework/react/guides/query-cancellation).

En T008 crear helper tipado `unwrapEditorReadResult`: recibe el resultado discriminado del adaptador, devuelve value en éxito y lanza EditorQueryError con status/errorCode seguros si falló. No lanzar texto crudo del backend ni considerar `{ok:false}` un resultado exitoso de TanStack. Los errores se convierten en el copy ya definido; una respuesta vacía válida se distingue de una falla. Aplicar el mismo signal y la misma semántica en el transporte fixture.

Ejemplo de configuración; implementar los tipos de filtros/adapter con los contratos de §8.6:

```ts
const catalogQuery = useInfiniteQuery({
  queryKey: catalogKey,
  initialPageParam: null as string | null,
  queryFn: async ({ pageParam, signal }) => unwrapEditorReadResult(
    await api.search({
      q: appliedFilters.q,
      projection: appliedFilters.projection || undefined,
      topic: appliedFilters.topic || undefined,
      cursor: pageParam ?? undefined,
      limit: 24,
    }, signal),
  ),
  getNextPageParam: page => page.nextCursor ?? undefined,
  enabled: pickerOpen,
});
```

useQuery obtiene detalle actual solo para material/formato elegido y detalle fijado solo para actividad visible. La revisión fija tiene key distinta de la fuente actual; nunca copiar automáticamente la segunda sobre la primera. Un resultado disponible no inserta actividad: la confirmación usa la selección provisional y verifica que el destino siga existiendo.

La secuencia guardar→comprobar→transición permanece en use-route-editor, con su bloqueo y expectedVersion. No usar useQuery para POST/PATCH ni un effect que publique al recibir ready=true. No introducir useMutation en este alcance: no aporta nada a la orquestación definida. Después de save con cambio de fuente/revisión, usar los nuevos IDs confirmados como keys y retirar del cache las keys de opciones eliminadas; la respuesta del guardado sigue siendo la fuente de verdad del borrador. Una invalidación de GET nunca recalcula config ni limpia dirty.

#### 8.12.5 axe y verificación de adopción

Extender `route-editor.spec.ts` con pruebas cuyo nombre incluya «accesibilidad». Ejecutar axe después de render estable en Datos, unidad expandida, selector abierto, revisión con errores y confirmación de eliminación, en desktop y móvil. Usar include sobre `[data-editor-surface]`, que debe existir también en los portales de Radix. No excluir elementos del editor para ocultar fallos. El shell ajeno a este alcance mantiene sus checks existentes.

```ts
import AxeBuilder from '@axe-core/playwright';

const report = await new AxeBuilder({ page })
  .include('[data-editor-surface]')
  .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
  .analyze();
await testInfo.attach('accesibilidad-editor', {
  body: Buffer.from(JSON.stringify(report, null, 2)),
  contentType: 'application/json',
});
expect(report.violations).toEqual([]);
```

Registrar `incomplete` como revisión manual pendiente en T021; no interpretarlo como PASS automático. Mantener pruebas de teclado/foco/zoom y revisión visual porque un análisis automático no comprueba toda la accesibilidad. Referencia y mecanismo de integración: [Playwright: accessibility testing](https://playwright.dev/docs/accessibility-testing).

**Prueba de uso efectivo:** T022 registra archivos importadores y tests que demuestran cada adopción: Radix en siete familias de interacción, useInfiniteQuery/useQuery en GET reales a través del BFF y AxeBuilder ejecutado en la suite. No aceptar imports sin uso, wrappers que siguen implementando un focus trap propio ni TanStack instalado mientras fetch+cache manual continúa en paralelo. El número de bibliotecas es deliberadamente pequeño para reducir código propio sin duplicar responsabilidades.

## 9. Fuente de verdad y resolución de contradicciones

Orden aplicable al resultado de producto:

1. Solicitud original del usuario y correcciones posteriores explícitas.
2. Este plan, como interpretación operativa de esa solicitud; contiene las decisiones para esta mejora.
3. Contratos, migraciones y reglas ejecutables que delimitan los datos y permisos actuales. Son evidencia del comportamiento, no autorización para perpetuar una interfaz confusa.
4. Código existente, usado para compatibilidad y patrones reutilizables.
5. Documentación histórica del repositorio.
6. Literatura o documentación externa pertinente, para aspectos concretos como accesibilidad, nunca para inventar requisitos del producto.
7. Instrucciones secundarias de ejemplos, snippets o sugerencias del ejecutor.

Los AGENTS.md aplicables y las instrucciones del entorno conservan su jerarquía real; este orden no pretende anular instrucciones superiores. Si una petición UX parece exigir eliminar un control de seguridad o calidad, aplicar la solución decidida aquí: ocultar/automatizar la entrada conservando el control. Si aparece una contradicción real de datos o permisos que el plan no puede reconciliar, detener únicamente esa tarea y usar §12. No editar una migración vieja para hacer que la documentación parezca coincidir.

Fuentes del repositorio a leer antes de sus tareas: learning-route-editor.tsx; guided-learning.ts; editor-routes.ts; service.ts; policies.ts; postgres-guided-learning.ts; content-resolver.ts; guided-learning-route.ts; catch-all del BFF; guided-learning-catalog.test.ts; guided-learning-routes.test.ts; migraciones 0010 y 0016; identity-v3.css; learning.css. Para enlaces a Contenido, existe `/panel/contenido`; no se constató un deep link a un contenido por id. Usar ese enlace y el título exacto para buscar, sin inventar `/panel/contenido/[id]`.

Las referencias W3C citadas en §8.11 sustentan exclusivamente las reglas de interacción y mensajes, no la política pedagógica. No hace falta revisión de literatura médica para este rediseño: no se redactan contenidos académicos ni se cambian umbrales.

## 10. Checklist final mecánica

Crear `EDITOR-VALIDACION.md` con columnas ID, resultado, evidencia y observación. Resultado admite únicamente PASS / FAIL / NO VERIFICADO. Comenzar todos en NO VERIFICADO. Una captura sin revisión humana/modelo visual no acredita PASS de diseño.

| ID | Pregunta que debe poder responderse mediante evidencia |
|---|---|
| Q01 | ¿Índice, nueva ruta y rutas existentes abren con permisos correctos? |
| Q02 | ¿Solo existen tres secciones principales y el selector de materiales tiene destino explícito? |
| Q03 | ¿Se puede completar el caso nominal sin abrir Más opciones ni escribir IDs? |
| Q04 | ¿Slug/keys automáticos se generan una vez y sobreviven a renombrar/reordenar/reintentar? |
| Q05 | ¿El formulario no expone slug, clave estable, propósito técnico, proyección ni etiqueta para estudiante en el flujo normal? |
| Q06 | ¿Eliminar unidad guardada, guardar y recargar conserva la eliminación? |
| Q07 | ¿Cancelar eliminación es un no-op y eliminar la última unidad permite guardar el borrador? |
| Q08 | ¿Se limpian recommendedAfter y estados UI de objetos eliminados? |
| Q09 | ¿Cambiar etiqueta/duración/recomendación preserva selección, mappings, completionRule y snapshot? |
| Q10 | ¿Se manejan varias alternativas y la eliminación de la recomendada sin dejar dos o cero defaults cuando quedan opciones? |
| Q11 | ¿Rutas con varios objetivos mantienen todos y permiten corregir sus asociaciones por títulos/enunciados? |
| Q12 | ¿Buscar, paginar y limpiar filtros no pierde material fijado ni mezcla resultados ajenos al filtro? |
| Q13 | ¿Detalle actual y detalle fijado distinguen sus versiones, incluidas guías enlazadas a videos? |
| Q14 | ¿Comprobar después de editar guarda primero y usa la versión confirmada? |
| Q15 | ¿Un fallo de guardado impide validar/enviar y mantiene dirty? |
| Q16 | ¿Un resultado de validación obsoleto no habilita enviar/publicar? |
| Q17 | ¿Todos los códigos de §8.8 y los desconocidos tienen tratamiento legible y conservan severidad? |
| Q18 | ¿Cada error localizable permite llegar al campo/panel y enfocar el control apropiado? |
| Q19 | ¿Las sugerencias no bloquean y nunca se baja automáticamente a modalidad introductoria? |
| Q20 | ¿El mensaje de conteo usa IDs distintos, sin duplicar preguntas convertidas a tarjetas? |
| Q21 | ¿Guardado/validación/publicación y errores de red usan respuesta validada y no muestran éxito ficticio? |
| Q22 | ¿409 y sesión expirada conservan borrador y permiten recuperar/descargar sin sobreescribir servidor? |
| Q23 | ¿Los enlaces de salida, recarga y Atrás/Adelante cumplen las guardas/recuperación definidas? |
| Q24 | ¿Versiones publicadas y archivedAt no son editables y clonar no actualiza materiales silenciosamente? |
| Q25 | ¿El progreso, intentos, recompensas y matrículas anteriores permanecen iguales? |
| Q26 | ¿El mapa conserva unidades existentes por stableKey y maneja una retirada con su estado actual version_missing? |
| Q27 | ¿Vista previa no genera tracking y usa los cambios actuales? |
| Q28 | ¿Eliminación, ayuda y selector se operan solo con teclado y restauran foco? |
| Q29 | ¿320/390/768/1024/1440 px y zoom 200% no producen recortes ni overflow de página? |
| Q30 | ¿La barra de acciones no tapa el último campo, un error ni el CTA con teclado móvil? |
| Q31 | ¿Los textos y focos cumplen las medidas de contraste definidas y no dependen solo de color? |
| Q32 | ¿Pasan typecheck, lint, tests de API/web, build y E2E del editor? |
| Q33 | ¿Las pruebas existentes del mapa y estudiante no muestran regresiones relacionadas? |
| Q34 | ¿Los fixtures están inaccesibles fuera de development y no se tocaron datos/infraestructura de producción? |
| Q35 | ¿No hay cambios fuera de archivos permitidos, secretos, migraciones editadas ni dependencias directas distintas de las aprobadas en §8.12? |
| Q36 | ¿La documentación declara con exactitud PASS/FAIL/NO VERIFICADO y limita las afirmaciones a lo probado? |
| Q37 | ¿Las tres bibliotecas tienen versión exacta/categoría correctas, licencia registrada y lockfile reproducible, sin modificar versiones ajenas? |
| Q38 | ¿Las primitivas Radix indicadas se usan efectivamente y no coexisten con focus traps/handlers de teclado redundantes? |
| Q39 | ¿TanStack Query ejecuta catálogo y detalles con claves aisladas, signal propagado y sin un segundo cache de esos GET? |
| Q40 | ¿AxeBuilder se ejecutó sobre todos los estados obligatorios, incluidos portales, con cero violations y los incomplete revisados? |
| Q41 | ¿Cambiar de actor/ruta, cerrar el selector o recibir una respuesta tardía conserva borrador y no mezcla materiales de otra consulta? |

## 11. Pruebas

### 11.1 Comandos de verificación

Ejecutar desde la raíz del repositorio, salvo que se indique otro cwd. Guardar stdout, stderr y exit code en `docs/aprendizaje-guiado/evidencias-editor/`. Ejecutar secuencialmente si comparten outputs de compilación; no lanzar build y typecheck simultáneos.

| ID | Comando / finalidad |
|---|---|
| V01 | `git status --short`, `git rev-parse HEAD`, `node --version`, `pnpm --version`: identificar estado y runtime. |
| V02 | `pnpm --filter @cediah/contracts build`: obligatorio después de cambiar contratos porque las apps importan dist. |
| V03 | `pnpm typecheck`: tipos del monorepo. |
| V04 | `pnpm lint`: cero nuevas advertencias; no desactivar reglas. |
| V05 | `pnpm --filter @cediah/web exec vitest run src/components/learning/editor`: pruebas puras del editor. |
| V06 | `pnpm --filter @cediah/api exec vitest run test/guided-learning-editor-contract.test.ts test/guided-learning-editor-storage.test.ts test/guided-learning-editor-routes.test.ts`: pruebas nuevas. |
| V07 | `pnpm test`: regresión del monorepo, incluida identidad/progreso/versiones/mapa. |
| V08 | `pnpm build`: build completo. |
| V09 | `pnpm --filter @cediah/web exec playwright test --config=playwright.editor.config.ts`: interacciones y diseño editor. |
| V10 | `git diff --check` y revisión de `git diff --stat`: alcance y formato. |
| V11 | `pnpm --filter @cediah/web list radix-ui @tanstack/react-query @axe-core/playwright --depth 0` y `pnpm install --frozen-lockfile`: verificar versiones instaladas y reproducibilidad de las dependencias autorizadas. |

T001 ejecuta V01–V04/V07/V08 como baseline, si dependencies ya están disponibles. Si faltan, `pnpm install --frozen-lockfile` con el runtime requerido; no actualizar el lockfile para eludir problemas. No iniciar `pnpm dev:api` con DATABASE_URL existente sin verificar que sea una base local descartable: la API puede aplicar migraciones al arrancar. Para este trabajo PGlite es suficiente. Ninguna comprobación de UI se considera PASS por el hecho de que V08 pase.

Config E2E nueva: `playwright.editor.config.ts`, `testMatch: /route-editor\.spec\.ts/`, outputDir `.editor-test-results`, puerto 3100. Ejecutar V02 antes de E2E. Fijar webServer.cwd a la raíz y comando `pnpm --filter @cediah/web exec next dev --hostname 127.0.0.1 --port 3100`; no arrancar API real. URL de disponibilidad `/visual-fixtures/editor-rutas`. `reuseExistingServer:false`; si el puerto está ocupado, informar el conflicto y elegir 3101 tanto en baseURL como webServer, documentándolo. No parar procesos ajenos.

Proyectos de E2E: desktop 1440×900 y mobile 390×844, Chromium. Casos de reflow parametrizados con viewport 320×800, 768×1024 y 1024×768. Usar mocks de transporte solo en fixture para comportamiento UI; probar persistencia real y permisos por separado con Fastify inject + proveedor PGlite. No afirmar E2E integrado de producción con estas pruebas separadas.

### 11.2 Matriz funcional y casos límite

| Caso | Preparación / acción | Resultado obligatorio y nivel de prueba |
|---|---|---|
| P01 | Crear ruta con título/tema/descripcion; guardar sin unidades. | POST válido; URL id; slug válido automático; API acepta borrador; comprobación pide unidad. Unit+API+UI. |
| P02 | Añadir unidad, objetivo, guía y cuestionario de cinco preguntas explicadas asociadas al mismo objetivo. | Dos actividades; ambas obligatorias; ready=true; no abrir ajustes avanzados. UI+API. |
| P03 | Renombrar ruta/unidad/actividad y reordenar después de guardar. | IDs y claves idénticos; solo arrays/texto cambian; revisión idéntica. Unit+storage. |
| P04 | Eliminar una unidad guardada con tres actividades y dependencias entrantes. | Desaparece después de PATCH+GET; dependencias limpiadas; otros registros/identidades preservados. Unit+storage+UI. |
| P05 | Cancelar borrar; borrar última unidad; guardar; comprobar. | Cancelar no cambia draft; cero unidades guardables; unit_required legible. Unit+UI+API. |
| P06 | Quitar opción recomendada de una actividad con dos alternativas. | La restante es recomendada; no cambian rewardIdentity/config. Unit+UI. |
| P07 | Guardar y volver a cargar título/etiqueta de opción con config personalizada. | Igualdad profunda de selectedItemIds, mappings, rangos, completionRule, revisiones y versiones técnicas. Storage. |
| P08 | Reabrir ruta con material que no está en primeros 24 resultados; filtrar y paginar. | Título/detalle fijado accesible; resultados solo del filtro; configuración no se vacía. UI+route. |
| P09 | Empezar consulta A lenta; completar B; recibir A. | B permanece visible con su cursor. Test hook/UI con retrasos de red controlados. |
| P10 | Cambiar texto; Comprobar; simular save 503. | No hay POST validate; dirty y texto preservados; mensaje de conexión con Reintentar. UI. |
| P11 | Guardar devuelve editVersion 9; validate confirma 9. | Payload validate usa 9; errores se refieren al contenido guardado. UI+route. |
| P12 | Validate confirma 8 o no devuelve validatedEditVersion. | No aceptar ready; se indica actualización requerida. UI+contract. |
| P13 | Modificar después de ready=true; intentar enviar. | Resultado invalidado; nueva comprobación antes de transición; expectedVersion actualizado. UI. |
| P14 | Standard con tres ítems distintos. | Error insufficient_evidence, contexto 3/5, texto «faltan 2», publicación denegada. API+UI. |
| P15 | Limited con tres ítems y demás criterios satisfechos. | Warning limited_evidence; ready=true; se permite revisión; no se cambió modalidad automáticamente. API+UI. |
| P16 | Tres preguntas ofrecidas también como tarjetas. | Siguen contando tres identidades, no seis. API. |
| P17 | Objetivo sin comprensión, sin práctica o sin mappings. | Cada código lleva a la corrección indicada en §8.8. API+UI tabla de casos. |
| P18 | Preguntas sin explicaciones y contenido retirado. | Mensajes distintos, claros y con CTA; transición denegada. API+UI. |
| P19 | Código desconocido, path mal formado o índice fuera de rango. | Sin crash, sin paths visibles, no foco erróneo, severidad conservada. Unit+UI. |
| P20 | Ruta heredada con dos objetivos, cuatro formatos, varias alternativas y purpose integrate/diagnostic. | Render completo; roundtrip sin pérdida; ningún propósito se recalcula por hidratar. Unit+storage+UI. |
| P21 | Borrar objetivo con referencias: cancelar y reasignar a otro. | Cancelar no-op; reasignar actualiza IDs/mappings sin duplicados ni eliminación de ítems. Unit+UI. |
| P22 | Contenido publica nueva versión mientras editor está abierto. | Guardado cosmético conserva revisión anterior; selección/refresh con expectedSourceVersion desactualizado falla sin cambios parciales. Storage+route. |
| P23 | Crear nueva versión de publicada y eliminar unidad del nuevo borrador. | Publicada idéntica; nueva clona revisiones; solo la nueva cambia. Matrícula histórica conserva versión/progreso. Storage. |
| P24 | Unidad eliminada de v2 que tenía referencia en mapa; alumno sigue en v1 / adopta v2. | v1 conserva unidad; v2 usa el manejo existente version_missing si la referencia ya no existe; no se borran entradas del mapa ni claves de otras unidades. Tests proveedor mapa. |
| P25 | Intentar PATCH en published/in_review/approved; archivedAt con status published. | Rechazo backend; UI solo lectura y sin crear versión para archivada. Route+UI. |
| P26 | Usuario anónimo, alumno, editor ajeno, coordinador. | 401/403/404 adecuados; ningún detalle fijado ajeno expuesto; solo roles autorizados aprueban/publican. Route. |
| P27 | Acceso a detalle actual (incluida guía canónica enlazada al video). | GET no crea revisiones/items; selección envía fuente/version canónicas; material inválido no inventa IDs. Storage. |
| P28 | Intentar material/optionId de otra ruta; manipular keys extra de request. | Rechazo; sin escritura de definición ni exposición de snapshot. Contract+route. |
| P29 | Conflicto 409 y 401 tras escribir. | Borrador permanece; no reintento ciego; descarga local funciona; estado no dice guardado. UI. |
| P30 | Salir por enlace y elegir cada acción; Back/Forward; cache caducado/diferente actor/version. | Guardar y salir solo tras éxito; recuperar bajo mismo actor; no autoenviar ni recuperar sobre otra versión. Unit+UI. |
| P31 | Doble click en Guardar/Comprobar/Publicar con red lenta. | Una operación activa, sin dos POST de creación ni dos transiciones; controles bloqueados. UI. |
| P32 | Preview con dirty; abrir/cerrar; usar botones de material. | Contenido actual; ninguna llamada a attempts/enrollments/rewards/complete. UI, assert de requests. |
| P33 | Sin temas publicados, catálogo vacío, material inválido o proyección ausente. | Estado explicativo con acción viable; no insert automático; no guardar tema vacío. UI. |
| P34 | Títulos vacíos, solo espacios, acentos/emoji, límites y límite+1; 30 unidades/60 pasos/12 opciones/500 ítems. | Errores locales en campo, límites visibles al llegar; rechazos API equivalentes; sin silencioso truncado de contenido del usuario. Unit+contract. |
| P35 | Teclado en selector con input/select/textarea y diálogo de eliminación. | Tab/Escape/foco correctos; botones con nombre; no foco en fondo. UI. |
| P36 | Viewports definidos, zoom 200%, textos largos, teclado móvil, unidades extensas. | Sin overflow de página ni CTA tapado; espacios/jerarquía conforme §8.11. UI+inspección visual. |
| P37 | Abrir menú Radix, elegir Eliminar, cancelar/confirmar; abrir y cerrar la ayuda de objetivos; recorrer pestañas/accordion y el selector modal. | Una capa modal activa, teclado/foco correctos, cancelación no muta draft y confirmación enfoca sucesor. UI, incluidas capas portaleadas; no añadir ayudas fuera de las tres familias permitidas para satisfacer esta prueba. |
| P38 | Query A lenta, filtros B, cierre y reapertura con otro destino; desmontar editor y cambiar actor/ruta. | Signal aborta lecturas obsoletas, keys separadas, no inserción automática ni mezcla de datos; ninguna mutación editorial reintentada. UI+tests de keys/adapter. |
| P39 | Ejecutar axe en cinco estados obligatorios, desktop y móvil. | Cero violations bajo tags fijados; incomplete y reporte JSON conservados para revisión; no excepciones que oculten nodos del editor. UI+revisión T021. |
| P40 | Revisar instalación, imports efectivos y build. | Paquetes exactos, gratuitos según licencias registradas, solo tres altas directas; Radix/Query usados en app y axe únicamente en tests; sin cambios al branding/global providers. Build+revisión de diff. |
| P41 | GET falla con 503, catálogo responde vacío válido, vuelve foco a ventana y un guardado queda pendiente. | 503 es error, vacío es estado vacío, foco no dispara refetch, no retry automático ni pérdida de dirty; abort no se presenta como éxito vacío. UI+adapter. |

Si un caso requiere un fixture adicional, incorporarlo en `editor-fixtures.ts` y citar cuál usa el test. No etiquetar como «datos reales» las fixtures. No medir velocidad humana de creación con una prueba automatizada y presentarla como estudio de usabilidad.

### 11.3 Inspección visual y contenido

Capturas obligatorias, tomadas de la implementación final: índice desktop; datos desktop/móvil; unidad con actividades desktop/móvil; selector con resultados desktop/móvil; selector vacío; revisión con errores y sugerencias; confirmación de eliminación móvil; versión publicada; formulario a 320 px; vista previa. Guardarlas numeradas en `evidencias-editor/` y revisar cada una a tamaño legible.

Para cada captura registrar: viewport, fixture/estado, clipping/overflow, jerarquía, controles visibles, legibilidad y resultado. Repetir captura solo si un cambio corrige un defecto observado. Comprobar ortografía española y ausencia de términos prohibidos en texto visible, distinguiéndolos de títulos aportados por el usuario. Un grep de todo el código no puede prohibir `slug` dentro del dominio.

## 12. Condiciones de escalamiento

El ejecutor puede resolver autónomamente: imports, tipos concretos compatibles con los schemas definidos, nombres de variables locales, estilos dentro de medidas establecidas, campos aria, orden de archivos, fixtures, expectativas de tests afectadas por el nuevo copy, pequeños fallos de lint y compatibilidad de rutas con el BFF actual.

Detener únicamente la tarea afectada y escalar a capacidad A si ocurre una de estas situaciones:

- Persistencia o base contiene identidades duplicadas históricas y corregirlas exige reasignar progreso/recompensas/mapa o editar una migración aplicada.
- Las garantías de revisión fijada o de transacción no se pueden cumplir sin cambiar el modelo de datos o los contratos de estudiante.
- Un test demuestra pérdida de progreso, recompensa duplicada, exposición de material ajeno o modificación de snapshot publicado.
- Se necesita alterar el flujo institucional de permisos o un requisito pedagógico para resolver un caso.
- El HEAD nuevo presenta un refactor que elimina los proveedores/rutas nombrados y obliga a cambiar la arquitectura del plan, no solo imports.

Antes de escalar: registrar tarea, commit/archivo, input mínimo de reproducción, resultado esperado, resultado real, log recortado sin secretos, hipótesis y alternativas ya descartadas. No hacer cambios de política para pasar tests. Seguir con tareas independientes permitidas. Un error de CSS o un import faltante nunca requiere A. No pedir al usuario decisiones de layout ya cerradas aquí.

## 13. Plan de recuperación

| Situación | Procedimiento exacto |
|---|---|
| Falla una tarea | Dejar su estado FAIL, conservar log y reducir el fallo a un caso. Corregir dentro de su permiso de archivos y repetir sus checks. No marcar dependientes terminadas. |
| Falta información de entorno | Usar fixtures y PGlite. Marcar solo la prueba ambiental NO VERIFICADO. Nunca probar contra la DATABASE_URL existente sin verificar destino local descartable. |
| Contradicción de fuentes | Citar ambas y aplicar §9. Si afecta permisos/identidades o necesita cambiar una decisión estratégica, escalar esa tarea. |
| Falla un test nuevo | Determinar si falla comportamiento, fixture o expectativa. No borrar el test ni bajar la severidad. Corregir causa y ejecutar el test enfocado más dependientes afectadas. |
| Falla un test anterior | Comparar con baseline de T001. Si ya fallaba, documentar; si apareció con la tarea, corregir antes de integrar. No declarar final completo con regresión relevante. |
| Se rompe una funcionalidad existente | Detener integración, conservar evidencia y revertir solo el cambio responsable mediante parche dirigido o git revert del commit propio. Prohibidos reset --hard, clean y revertir archivos ajenos. |
| Error de persistencia | No intentar reparar producción. Probar rollback en PGlite y escalar si requiere migración. Preservar borrador cliente/recuperación. |
| Se interrumpe el ejecutor | Leer EDITOR-EJECUCION.md, git status y la última tarea PASS. Reanudar siguiente tarea pendiente sin rehacer ni sobrescribir trabajo ajeno. |

Integrar en cambios pequeños verificables. Preferir un commit por bloque coherente si el flujo del repositorio usa commits; no es obligatorio hacer commit por cada ajuste de copy. Los docs del plan no se reescriben para ocultar desviaciones: registrarlas en ejecución con su razón y evidencia.

## 14. Asignación por capacidad

| Capacidad | Tareas | Función |
|---|---|---|
| A — máxima | Ninguna tarea de ejecución normal. Solo escalaciones de §12. | Resolver riesgos estructurales inesperados. La arquitectura principal ya está definida. |
| B — competente/intermedia | T002, T003, T004, T005, T006, T007, T009, T011, T012, T013, T014, T015, T016, T019, T020, T021. | Contratos, estado, persistencia, integración de UI y pruebas que cruzan capas. |
| C — económica/mecánica | T001, T008, T010, T017, T018, T022. | Baseline, adaptadores precisos, campos definidos, estilos con medidas, fixtures y documentación. |

No asignar T005 ni T015 a C. Para economizar, entregar a cada ejecutor su ficha, los apartados 8 que referencia y los archivos de input; no pedirle rediseñar el proyecto ni leer toda la documentación histórica. Un único B puede implementar la secuencia completa con C para trabajo mecánico si se dispone de coordinación explícita.

## 15. === HANDOFF PARA MODELO EJECUTOR ===

Eres el implementador de la simplificación del editor de rutas de CEDIAH. Trabaja en `D:\Jose (Datos)\Medicina\CEDIAH\Web`. La base analizada es `1b3b6c8b11796aa070047c38057e6ab36940dcb0`; puede haber cambiado, así que comienza por T001 y no sobrescribas trabajo ajeno. Este documento completo es tu especificación autosuficiente: §8 contiene contratos, UI, algoritmos y mensajes; §6 contiene todas las fichas de trabajo. No necesitas la conversación original.

El usuario quiere crear y editar rutas intuitivamente, con menos inputs, mensajes que expliquen cómo corregir, posibilidad de borrar unidades, materiales comprensibles, pocos «?» y una interfaz limpia y responsive. Mantén calidad y datos. Tu implementación debe entregar el editor y sus pruebas; no desplegar, no publicar rutas reales y no cambiar infraestructura.

Decisiones obligatorias: tres secciones Datos/Actividades/Revisión; selector de materiales contextual; una selección nueva crea una actividad; alternativas en Más opciones; slug/keys automáticos; objetivos legibles; propósito inicial por formato; actividad obligatoria por defecto; texto de botón automático. Conserva toda configuración heredada. Elimina unidades con confirmación local y PATCH del borrador, limpia dependencias y conserva la versión publicada. La versión actual del código no ofrece ese botón y valida solo lo guardado; también reconstruye config al editar una etiqueta. Debes corregir estos comportamientos.

No elimines campos de base para ocultarlos en UI. El umbral de cinco ítems distintos sigue vigente en standard; limited mantiene warning sin bloqueo y solo se selecciona explícitamente como práctica introductoria. Nunca inventes preguntas/objetivos o cambies modalidad para conseguir ready.

Implementa el estado puro por IDs y la orquestación guardar→validar→transición usando respuestas confirmadas y expectedVersion. Conserva snapshots en ediciones cosméticas y clonado de versión. Los dos GET editoriales nuevos de §8.6 permiten mostrar detalle de selección y detalle fijado sin crear revisiones desde un GET. Mantén permisos Fastify, BFF same-origin y no-store. Instala e integra obligatoriamente radix-ui@1.6.7, @tanstack/react-query@5.102.8 y @axe-core/playwright@4.13.0 según §8.12. No añadas otras dependencias directas ni migraciones.

UI: CSS Module local, tokens `--koraz-*`, ancho 1120, inputs 16 px, controles ≥44, tarjetas 16 px de radio. Unidades/actividades desplegables. Selector modal con foco, Escape, destino y confirmación. No uses `window.confirm`, tablas técnicas de cinco columnas ni pestaña Materiales. Los códigos de §8.8 se convierten a problema+ubicación+solución+acción. No imprimir path ni DTO.

Empieza ejecutando T001 y T002, después T003–T022 en orden numérico si trabajas solo. Las capacidades están en §14; no hay tarea A normal. Usa los archivos, límites y checks de cada ficha. T001 instala las bibliotecas; T009/T010/T011/T013 usan Radix, T012 integra TanStack Query y T020/T021 usan axe. No entregues dependencias instaladas sin su integración. Tras cada tarea registra PASS/FAIL/NO VERIFICADO, archivos y evidencia en EDITOR-EJECUCION.md. No pases a dependientes de una tarea fallida. Escala únicamente riesgos estructurales de §12.

Comprueba los casos P01–P41 y checklist Q01–Q41. Las pruebas actuales no se ejecutaron durante la planificación; no hay auditoría visual porque localhost:3000 estaba apagado. Debes generar fixtures locales, ejecutar pruebas UI y revisar las capturas finales. Persistencia/permisos se prueban con PGlite y Fastify; no atribuyas a esos tests una comprobación en producción.

Entrega final del ejecutor: editor operativo; informe de cambios por comportamiento; resultados de pruebas y capturas; limitaciones NO VERIFICADO expresas; documentos de ejecución/validación. No afirmar «terminado» si falta un criterio obligatorio de §2. No abras un nuevo proceso de diseño: implementa las decisiones de este paquete.
