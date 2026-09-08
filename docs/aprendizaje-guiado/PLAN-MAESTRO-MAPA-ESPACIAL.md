# Plan maestro de ejecución · Mapa de aprendizaje KORAS

Fecha: 8 de septiembre de 2026. Versión del plan: 1.0.

**Resultado de esta entrega:** especificación para implementar posteriormente, acompañada de una referencia visual navegable. La aplicación no se modifica en esta fase de planificación.

**Repositorio inspeccionado:** D:/Jose (Datos)/Medicina/CEDIAH/Web. HEAD: d162ff8d007ad9a7ce292ee550c29a6db92f281a. Antes de esta entrega ya tenían cambios locales ESTADO.md, OPERACION.md y VALIDACION.md dentro de docs/aprendizaje-guiado; conservarlos.

**Paquete:** este Markdown y la carpeta referencias-mapa. Abrir referencias-mapa/ejemplo-visual-mapa.html para comparar las vistas. referencia-01.png corresponde a “flujo aprendizaje guiado 2.png”; referencia-02.png corresponde a “Flujo aprendizaje guiado.png”. El HTML es una maqueta de diseño con datos ficticios y navegación ilustrativa; no implementa React Flow, persistencia ni la aplicación.

[Abrir ejemplo visual](referencias-mapa/ejemplo-visual-mapa.html) · [Referencia 01](referencias-mapa/referencia-01.png) · [Referencia 02](referencias-mapa/referencia-02.png). La subcarpeta assets contiene el logo y las fuentes locales que necesita la maqueta; conservarla al trasladar el paquete.

## 1. Objetivo, entregables y alcance

Convertir Aprendizaje guiado en un mapa privado, espacial, jerárquico y personalizable. El estudiante debe identificar su contenido, avance, relaciones y próximo paso; entrar en agrupaciones sin perder orientación; añadir bloques o lecciones; organizar posiciones; comenzar las actividades existentes y regresar al mismo contexto.

La solución añade organización por encima del sistema académico actual. Conserva las identidades, versiones, inscripciones, intentos, alternativas, reglas de finalización, repaso, evidencia, puntos y permisos que ya existen.

### Entregables de la implementación

1. Mapa funcional con @xyflow/react, nodos propios y conexiones derivadas de relaciones verificables.
2. Vistas de mapa general, nodo con contenido mixto, bloque y panel de lección.
3. Navegación jerárquica, URLs profundas, historial, restauración espacial y adaptación móvil.
4. Buscador contextual, incorporación inmediata, agrupaciones personales y detección de bloques incompletos.
5. Persistencia de estructura y posiciones en PostgreSQL; progreso calculado por servidor.
6. Integración con lanzamiento/reanudación de las cuatro actividades existentes.
7. Contratos, migración aditiva, endpoints Fastify, BFF Next.js y bandera de activación independiente.
8. Fixtures aislados, pruebas funcionales, comprobación visual y registro de evidencias.
9. Procedimiento de activación y recuperación que permita volver a la experiencia anterior.

### Fuera del alcance obligatorio

- Rediseñar todo el shell, cambiar la marca, instalar otro sistema de autenticación o sustituir Fastify.
- Crear contenido médico, publicar los temas ficticios de las imágenes o alterar reglas académicas.
- Convertir cada recurso de Biblioteca en una lección sin una estructura editorial de actividades.
- Crear nuevos reproductores de identificación anatómica, casos clínicos o evaluación: solo se muestran si el sistema dispone del formato real. Los formatos actuales son video, guía, cuestionario y flashcards; el repaso ya dispone de su flujo.
- Colaboración simultánea, mapas públicos, edición multiusuario, IA generativa de recomendaciones, vectores, dibujo libre de líneas, lienzo de unidades o arrastre entre ventanas.
- Funcionamiento totalmente offline, sincronización en tiempo real entre dispositivos y pagos por React Flow Pro.
- Una pantalla nueva para editar taxonomías médicas. Las relaciones editoriales futuras necesitan una especificación aparte.
- Notas personales: mejora deseable T036, separada del cierre obligatorio. No mostrar una pestaña vacía que simule esa función.

## 2. Hechos, inferencias y supuestos

### Hechos comprobados en archivos locales

| Área | Evidencia | Implicación |
| --- | --- | --- |
| Monorepo | package.json: Node 24.x, pnpm 11.9.0 | Usar pnpm; no introducir npm-lock ni actualizar el stack completo. |
| Web | apps/web/package.json: Next 16.2.12, React 19.2.8, TypeScript, Phosphor, Vitest | Integración en App Router y CSS existente. @xyflow/react aún no figura como dependencia directa. |
| API | apps/api/package.json: Fastify 5.11.0, Kysely, pg, Better Auth | El navegador consume BFF; Fastify autentica y autoriza. |
| Contratos | packages/contracts/src/guided-learning.ts | Existen ruta/version → unit → step → options e inscripción fijada a versión. |
| Entrada actual | apps/web/src/app/aprendizaje/page.tsx | Hoy, Rutas y Progreso ya existen; se conservan accesibles. |
| Ruta interna | components/learning/learning-path-screen.tsx | Unidades y alternativas están disponibles sin bloqueos por orden académico. |
| Actividades | activity-launcher.tsx y activities/activity-shell.tsx | Ya hay creación idempotente, reanudación y confirmación de progreso. |
| Progreso | providers/postgres-learning-activities.ts, readLearningEnrollmentProgress | Cuenta pasos esenciales; omitir un esencial no lo completa; 100 requiere totalidad real. |
| Persistencia | database/migrations/0001–0015 | Migraciones activas portátiles; supabase/migrations es legado. |
| Marca real | apps/web/src/components/cediah-logo.tsx; app/layout.tsx; koras-theme.css | La interfaz actual dice KORAS, usa #0F3D32 y Plus Jakarta Sans local. No cambiar a CEDIAH por una frase histórica del README. |
| Shell | platform-frame.tsx, app-shell.tsx, platform-chrome.css | Shell persistente, rail de 72 px en escritorio y topbar de 76 px; aprovecharlos. |
| Fixtures | app/visual-fixtures/aprendizaje/page.tsx | Solo habilitados en development; patrón para una ruta de prueba nueva. |

**Documentación histórica, no verificación remota de esta entrega:** el tramo final de ESTADO.md y VALIDACION.md registra piloto activo, 15 migraciones y pruebas previas. Los párrafos antiguos sobre ausencia de producción corresponden a fases anteriores. No afirmar que se volvió a comprobar producción, ni reutilizar aquellos PASS como evidencia de este rediseño.

### Inferencias adoptadas

- La referencia 01 es la principal para tarjetas neutrales, iconos y etiquetas; la 02 aporta orientación, conectores y composición del panel.
- “Más o menos” permite adaptar tamaño, marca, accesibilidad y contenido real sin copiar cada píxel.
- Un nodo personal es una agrupación; no equivale a una nueva inscripción ni a un curso editorial.
- El panel de lección es la forma elegida de revelar su ruta interna. No hace falta crear un cuarto lienzo con tarjetas de actividades.

### Supuestos explícitos

- V1 tendrá un mapa privado por cuenta, muchos nodos y posiciones compartidas entre los dispositivos de esa cuenta.
- Las posiciones se guardan en servidor; viewport, selección e historial visual se guardan por pestaña/dispositivo. No se sincroniza el encuadre entre teléfono y ordenador.
- El catálogo real puede ser pequeño y no contener Anatomía/Tórax/Corazón. La interfaz debe funcionar con las rutas existentes sin fabricar esos contenidos.
- El orden publicado de las unidades puede representarse como recorrido recomendado; no como requisito obligatorio.
- Cuando no exista una relación verificable entre dos áreas, no se dibuja una conexión inventada.

### Información desconocida y resolución prevista

| Desconocido | Cómo resolverlo | Qué puede avanzar |
| --- | --- | --- |
| Catálogo real del ambiente de implementación | T001: lectura autenticada y autorizada de metadatos; si no hay ambiente, marcar NO VERIFICADO y usar fixtures | Contratos, componentes, pruebas locales. |
| Compatibilidad exacta de la versión disponible de React Flow | T001: consultar versión estable 12.x, peers y licencia; fijarla en manifiesto/lockfile | Diseño y contratos independientes del paquete. |
| Dispositivos físicos y rendimiento de red representativos | T032–T034: registrar equipo, navegador, volumen y condiciones | QA emulado y pruebas automatizadas. |
| Relaciones académicas entre materias distintas | Usar solo relaciones ya declaradas; mostrar estado sin conexiones donde corresponda | Todos los niveles y relaciones de pertenencia/orden. |
| Aprobación para activar el nuevo mapa en producción | Preparar T034 completo; usar la autorización vigente para ese ambiente | Implementación y preview. Esta solicitud de plan no constituye un despliegue. |

## 3. Requisitos y trazabilidad completa del brief

### Obligatorios

O01. React Flow como motor, Custom Nodes y edges reales.

O02. Jerarquía y zoom manual independientes; solo un nivel de contenido montado.

O03. Nodos personales o derivados de una plantilla; contenido de tipo bloque, lección o mezcla.

O04. Divulgación progresiva, clic principal directo, breadcrumbs, atrás y URLs recuperables.

O05. Transiciones de 180–300 ms cuando los datos estén preparados; movimiento reducido sin animación espacial.

O06. Guardar y restaurar posiciones, viewport, selección y contexto; arrastre y organización automática estable.

O07. Añadir mediante búsqueda y sugerencias, selección múltiple y completar agrupación de un bloque.

O08. Progreso jerárquico confirmado y deduplicado, estados semánticos y próximo paso explicable.

O09. Conservación de actividades, alternativas, inscripciones, versiones, permisos y recompensas.

O10. Móvil, teclado, lectores de pantalla, zoom de texto, estados de error y mapas grandes.

### Deseables

D01. MiniMap solo en niveles de más de 24 elementos y cuando existe contenido fuera del encuadre; oculto inicialmente en móvil.

D02. Precarga adicional en reposo si la red y el volumen lo permiten; precarga por intención sí forma parte de O05.

D03. Aviso discreto de contenido completado y continuación recomendada, sin nuevas recompensas.

D04. Notas privadas mediante T036. Exportación de imagen y nuevas taxonomías no se añaden implícitamente.

### Restricciones

- Plus Jakarta Sans local, Phosphor para controles e iconos SVG propios limitados para anatomía.
- Mantener el modelo de seguridad Better Auth → Fastify → PostgreSQL; reutilizar el BFF y contratos estrictos.
- Migraciones aditivas; respetar versiones publicadas y conservar los cambios locales de otras tareas.
- No importar la cola de actividad para mezclarla con posiciones del mapa.
- Ningún porcentaje, estado académico, XP o inscripción proviene de sessionStorage.
- Descripciones y recursos solo en cabecera/panel; no dentro de cada tarjeta.

### Prohibiciones

- Apariencia predeterminada de React Flow como producto final, handles editables, delete por tecla o doble clic como requisito para entrar.
- Zoom por rueda que cambie de nivel, fitView después de cada arrastre, reordenamiento global al añadir.
- Colorear toda la tarjeta por progreso, candado para “No iniciado”, etiquetas “Completado” con menos de 100 %.
- Copiar los números incongruentes de las imágenes, inferir contenido médico por parecido de nombres o usar ID derivado del título.
- Consultar todas las lecciones/actividades desde el navegador para sumar porcentajes, exponer soluciones o URLs firmadas en el mapa.
- Desactivar permisos, autenticación, RLS, origin checks o pruebas para hacer funcionar la nueva pantalla.

### Preferencias visuales del usuario

Superficie marfil clara, tarjetas blancas suaves, ilustraciones lineales verde oscuro, conexiones finas, contenido legible y espacio libre. El elemento seleccionado puede llevar borde terracota; la finalización se comunica con etiqueta/check. Panel derecho en escritorio y hoja inferior en móvil.

### Correspondencia con las 46 secciones del documento original

| Secciones originales | Requisito preservado | Implementación / verificación |
| --- | --- | --- |
| 1, 4, 7, 9, 43, 46 | Mapa espacial y divulgación progresiva | O02–O04; T013, T020–T023; F01–F05. |
| 2, 3, 27, 45.1–2 | React Flow, Custom Nodes e infraestructura común | T019–T020; V01. |
| 5, 10, 11, 30, 34 | Zoom jerárquico separado y transición inversa | T021; F03, F04, F11. |
| 6, 15–19, 42 | Contenedores flexibles y agrupaciones | T002–T008, T026; F06–F08. |
| 8, 28, 29 | Tarjetas concisas, estados, iconos #0F3D32 | T017–T019; V02–V04. |
| 12–14, 37 | Persistencia, historial, URL, atrás, breadcrumb | T013–T015, T024; F02–F05, F16. |
| 20 | Agregar contextual con pocos pasos | T025; F06. |
| 21, 22, 40 | Sugerencias según contexto y siguiente actividad | T009, T023, T027; F09, F14. |
| 23 | Bloques incompletos | T008, T027; F08. |
| 24–26 | Relaciones, arrastre y layout incremental | T009, T016, T020; F10–F12. |
| 31, 32, 35, 36 | Precarga, DOM acotado, pan y fitView oportuno | T014, T020–T021, T032; P01–P04. |
| 33 | Controles propios y MiniMap condicional | T020, T028; V05. |
| 38 | Clic entra y menú para acciones secundarias | T019, T026; F01, F10. |
| 39 | Propagación de progreso | T006; F13–F15. |
| 41 | Móvil con la misma jerarquía | T028, T031–T033; A01–A05. |
| 44 | Ejemplo del recorrido completo | Secciones 4, 7 y 13; F01. Los nombres del ejemplo no crean una jerarquía adicional. |
| 45.3–20 | Reglas transversales | O02–O10 y controles F, V, A, P, S, R. |

## 4. Decisiones de arquitectura cerradas

| ID | Decisión | Razón y alternativas descartadas | Consecuencia operativa |
| --- | --- | --- | --- |
| A01 | Una capa de organización sobre el dominio actual | Rehacer seguimiento duplicaría inscripciones e historia | Tablas nuevas solo para mapa; actividades siguen usando los endpoints existentes. |
| A02 | Bloque = LearningPath; lección = LearningPathUnit; actividad = LearningPathStep | Resuelve la colisión con “unidad” en el brief | DTO/UI traducen nombres. No renombrar las tablas ni esquemas académicos existentes. |
| A03 | Identidad de lección = pathId + unit.stableKey | Los UUID de unit y step pertenecen a una versión | Resolver a la versión de inscripción; sin inscripción, a la publicada. Nunca actualizar inscripción automáticamente. |
| A04 | El clic en nodo/bloque entra; el clic en lección abre su panel | Coincide con los estados 4/6 de las imágenes y conserva la ruta | El panel ya es el destino de la lección. Su CTA ejecuta una actividad, no otro paso intermedio de navegación. |
| A05 | Un ReactFlowProvider y lienzo controlado por workspace | Mantiene el contexto y evita desmontaje por cada clic | Componentes cliente; React Flow cargado dinámicamente dentro de un componente cliente. |
| A06 | URL canónica con query en /aprendizaje/mapa | Da profundidad y Back sin añadir rutas físicas redundantes | node, item, unit describen jerarquía; cambiar query mediante History API. Los slugs del brief eran ejemplos. |
| A07 | Posiciones en servidor; viewport/selección por pestaña | Organizar se conserva entre dispositivos; el encuadre depende de la pantalla | PostgreSQL para estructura/layout; sessionStorage para encuadre validado y cuenta aislada. |
| A08 | Layout determinista por bandas; inserción local | El grafo visual incluye relaciones no arbóreas; un motor de fuerzas movería todo | No añadir Dagre/ELK/Zustand/Framer Motion en V1. Algoritmo en sección 8. |
| A09 | Progreso por unión de pasos esenciales únicos | Un bloque y una lección pueden referenciar el mismo aprendizaje | Se cuenta cada paso una vez en cada agregado; nunca media simple de porcentajes. |
| A10 | Añadir no inscribe; comenzar sí puede inscribir expresamente | Organizar un plan y empezar estudio son acciones diferentes | Un CTA inicia/reanuda con los contratos actuales y revalida la versión resultante. |
| A11 | Sugerencias deterministas de metadatos autorizados | No existe una taxonomía completa de relaciones entre materias | Mismo topic, contenido compartido u orden publicado; explicación visible. Nada se deduce clínicamente del título. |
| A12 | Un solo panel derecho contextual | Sugerencias y detalle simultáneos restarían espacio al mapa | Sin selección: sugerencias; al abrir detalle: resumen o lección. Sugerencias relacionadas al final del panel. |
| A13 | Bandera GUIDED_LEARNING_MAP_ENABLED separada | El piloto académico existente debe continuar si falla el mapa | guidedLearningMap exige también guidedLearning; apagada devuelve experiencia actual y endpoints nuevos 404. |
| A14 | Mutaciones con versión e idempotencia | Arrastre, doble clic, dos pestañas y respuestas perdidas requieren determinismo | Reutilizar withLearningReceipt y conflictos 409; no último escritor silencioso. |
| A15 | El shell y marca actuales se reutilizan | Las capturas son inspiración, no una solicitud de navegación global nueva | No duplicar barras ni añadir enlaces “Plan/Favoritos/Descargas” que no existan. |
| A16 | Las conexiones no son bloqueos de acceso | La política actual ofrece elección libre | Una dependencia orientativa nunca pone un candado ni impide abrir una actividad. |
| A17 | Información adicional solo si tiene respaldo | Las capturas incluyen Notas y formatos que no siempre existen | V1: Actividades y Recursos. T036 incorpora Notas de forma completa si se selecciona. |

### Resolución concreta de contradicciones

1. “Seleccionar entra” prevalece para contenedores. “Seleccionar lección muestra sidebar” define la última capa. Un menú “Ver información” permite consultar un bloque sin alterar el clic principal.
2. Anatomía es nodo; Tórax es bloque; Corazón es lección; Introducción/Guía/Video son actividades. “Irrigación” solo será otra lección si así está editada como unit; no inventar sublecciones.
3. 80 % se etiqueta En progreso. Si una captura enseña 1/8 y dos checks, corregir los checks a un solo completado; 1/8 se redondea a 13 %.
4. La presencia de candados en una imagen no introduce prerrequisitos. No iniciado sigue siendo accesible con la inscripción requerida.
5. “Completar bloque” añade contenido faltante; no completa aprendizaje. El texto distingue añadido, empezado y completado.
6. La imagen 02 colorea más los iconos y muestra MiniMap pequeño. Se aplican los límites explícitos del brief: icono principal verde y MiniMap condicional.

## 5. Modelo de datos, contratos y persistencia

### 5.1 Modelo conceptual

~~~text
LearningMap privado
  └─ MapNode personal o creado desde tema
      ├─ blockRef(pathId) → versión vigente para esta cuenta
      │    └─ lessonRef(pathId, unitStableKey)
      │         └─ step → options → intento existente
      └─ lessonRef(pathId, unitStableKey) independiente
~~~

Un nodo no contiene otros nodos en V1. Esto mantiene una profundidad máxima predecible y permite bloques y lecciones mezclados. Un mismo contenido puede aparecer en nodos diferentes sin crear un segundo progreso.

~~~ts
type ContentRef =
  | { kind: 'block'; pathId: string }
  | { kind: 'lesson'; pathId: string; unitStableKey: string };

type MapItemProgress = {
  status: 'not_started' | 'in_progress' | 'completed' | 'empty' | 'unavailable';
  percentage: number | null;
  completedEssentialSteps: number | null;
  totalEssentialSteps: number | null;
  started: boolean;
};

type MapEntry = {
  id: string; nodeId: string; ref: ContentRef; order: number;
};

type MapNodeRecord = {
  id: string; title: string; iconKey: MapIconKey;
  originTopicId: string | null; order: number;
};

type ResolvedMapItem = {
  occurrenceId: string; canonicalKey: string;
  kind: 'node' | 'block' | 'lesson';
  title: string; iconKey: MapIconKey;
  progress: MapItemProgress;
  childCount: number;
  childCountLabel: string;
  availability: 'available' | 'retired' | 'version_missing';
  enrollmentState: 'none' | 'active' | 'paused' | 'archived';
  pathId: string | null; pathVersionId: string | null;
  unitStableKey: string | null;
};

type MapRoute = {
  nodeId: string | null;
  entryId: string | null;
  unitStableKey: string | null;
};

type LevelLayout = {
  schemaVersion: 1; levelKey: string; rowVersion: number;
  positions: Record<string, { x: number; y: number }>;
};

type SpatialSnapshot = {
  schemaVersion: 1; viewport: { x: number; y: number; zoom: number };
  selectedOccurrenceId: string | null; focusedOccurrenceId: string | null;
  navigationPath: MapRoute[]; containerWidth: number; containerHeight: number;
};
~~~

MapIconKey es una enumeración: anatomy, molecule, heart, tissue, pill, stethoscope, head, arm, chest, abdomen, pelvis, leg, brain, skin, lungs, vessel, diaphragm, kidney, endocrine, droplet, folder. Nunca SVG/HTML/URL arbitrarios recibidos del usuario.

**IDs de ocurrencia:** root: node UUID; dentro de nodo: entry UUID; dentro de bloque: “lesson:” + unit.stableKey. Estos últimos solo son únicos dentro de su levelKey. Identidad canónica de lección: pathId + “:” + unitStableKey. El bloque abierto desde dos nodos tendrá dos layouts, pero un mismo progreso.

**levelKey:** root; node:<nodeId>; block:<entryId>. La versión resuelta se almacena como metadato del resultado y de caché. Al cambiar de versión se conservan posiciones cuyas claves estables siguen existiendo, se eliminan las ausentes del resultado renderizado y se añaden las nuevas sin mover las anteriores. No incluir versionId en la identidad de un layout para perderlo en cada upgrade.

### 5.2 Esquema nuevo

Crear una migración SQL aditiva en database/migrations con el próximo número libre, hoy previsto 0016_learning_maps.sql. Comprobar el número justo antes de crearla; jamás editar 0001–0015 ni utilizar supabase/migrations. Este proyecto usa su propio runner portable, aunque PostgreSQL esté alojado en Supabase.

| Tabla | Columnas y claves | Restricciones |
| --- | --- | --- |
| learning_maps | id UUID PK, user_id FK auth_users UNIQUE, row_version int, created_at, updated_at | Un mapa por usuario. row_version ≥ 1. Propietario siempre desde sesión. |
| learning_map_nodes | id UUID PK, map_id FK, title text, icon_key text, origin_topic_id FK content_items nullable, sort_order int, timestamps | UNIQUE(id,map_id); título trim 1–80; icono de enum; orden ≥ 0. |
| learning_map_entries | id UUID PK, map_id, node_id, kind, path_id FK learning_paths, unit_stable_key nullable, sort_order int, timestamps | FK(node_id,map_id) a nodo; kind block/lesson; block exige key NULL, lesson exige clave estable; índices únicos parciales por node/path y node/path/key. |
| learning_map_layouts | map_id FK, level_key text, row_version int, schema_version int, positions_json JSONB, updated_at | PK(map_id,level_key); objeto validado; no progreso ni contenidos dentro del JSON. |

La relación semántica entre lección y versión se verifica en el resolver: una stableKey existe en varias versiones, por lo que no puede apuntarse a un unit UUID fijo. path_id sí tiene FK. Un retiro conserva referencias para mostrar estado recuperable; no borra silenciosamente el mapa.

RLS activa en tablas nuevas. Copiar el patrón de acceso del runtime de 0010: permisos exclusivamente al rol de backend, sin grants a PUBLIC/anon/authenticated ni políticas basadas en Supabase Auth. En este patrón el aislamiento por usuario lo impone Fastify/Kysely en cada operación; probarlo expresamente. Añadir índices a todas las FK y a búsquedas por map_id/node_id/path_id. No añadir SECURITY DEFINER.

**Límites V1:** 200 nodos principales, 200 entradas directas por nodo y 5.000 entradas por mapa. Son límites de edición, no razones para truncar silenciosamente un mapa existente. En una petición: máximo 200 selecciones/posiciones; cuerpo máximo 128 KiB; títulos 80; búsqueda 120; coordenadas finitas entre -100.000 y 100.000; zoom entre 0,65 y 1,35. Rechazar límites con error explícito recuperable. T032 comprueba 200 elementos por nivel y 5.000 referencias totales sin montar descendientes.

### 5.3 DTO de lectura

LearningMapSummaryResponse: map nullable, nodos resumidos, progreso global, structuralVersion. Un mapa inexistente no se representa como error.

LearningMapLevelResponse: mapId, route validada, levelKey, ancestry, layout, items, edges, selectedLesson nullable, containerSummary, nextActivity nullable, generatedAt, resolvedVersionIds. Contiene el nivel actual; selectedLesson añade únicamente la unidad elegida y sus pasos/opciones seguras.

LearningMapCatalogResponse: items de tipo topic_template/block/lesson, reason opcional, membership (absent/direct/covered), nextCursor. No incluir soluciones, explicaciones protegidas, manifests o medios privados.

LearningMapMutationResponse: mapId, structuralVersion, affectedLevelKeys, changed IDs, undo nullable. Las lecturas posteriores reconstruyen los agregados. Validar todas las respuestas con Zod.

### 5.4 API y BFF exactos

Prefijo de API: /v1/guided-learning/map. Prefijo de navegador: /api/guided-learning/map. Registrar rutas explícitas; no convertir el catch-all en proxy genérico.

| Método y sufijo | Entrada | Salida / efecto |
| --- | --- | --- |
| GET / | Sin userId | Summary; map:null si nunca se creó. |
| POST /ensure | Objeto vacío + Idempotency-Key | Crea una vez y agrupa inscripciones no archivadas por topic en nodos; no crea inscripciones. Devuelve mapa existente en repeticiones. |
| GET /level | node, item, unit opcionales | Valida toda la ascendencia y devuelve LevelResponse; root sin parámetros. |
| GET /catalog | q, kind, node, item, unit opcionales; limit 24, máximo 50; cursor | Catálogo contextual y pertenencia; paginación estable por título normalizado + tipo + identidad. |
| GET /suggestions | node, item, unit opcionales; máximo 3 resultados | Relaciones, motivo y candidatos para completar bloque. |
| POST /nodes | expectedVersion, title, iconKey, items opcionales o topicTemplateId | Nodo vacío, personalizado o copia de plantilla publicada. Dos formas de contenido mutuamente excluyentes. |
| PATCH /nodes/:id | expectedVersion; title/iconKey | Solo metadatos personales; nunca nombre editorial. |
| POST /entries | expectedVersion, nodeId, ref | Incorpora referencia. En raíz, la UI usa POST /nodes con una referencia. |
| POST /group | expectedVersion, title, iconKey, selections | Resuelve selección a refs canónicas y crea nodo en raíz; conserva las ubicaciones de origen. |
| POST /complete-block | expectedVersion, nodeId, pathId | Coalesce lecciones sueltas de ese path en una blockRef; añade acceso al conjunto y mantiene progreso. |
| POST /remove | expectedVersion, target:{kind:'node'|'entry',id} | Quita agrupación o referencia personal; nunca datos académicos. Devuelve undo. |
| POST /restore | expectedVersion, undoReceiptKey | Revierte remove o complete-block desde su recibo propio, durante 30 s; valida permisos y límites otra vez. |
| PATCH /layout | levelKey, expectedVersion, positions:[{id,x,y}] | Upsert parcial solo para elementos autorizados de ese nivel; layoutVersion independiente. |

POST/PATCH siempre llevan Idempotency-Key. El hash de recibo incluye nombre de operación, IDs de ruta y payload; no solo body. Usar withLearningReceipt con esquema de respuesta propio. expectedVersion de estructura y layout no son intercambiables.

Cada operación de estructura bloquea la fila learning_maps de su usuario y comprueba row_version; aplica cambios atómicos y aumenta versión una vez. Duplicado semántico ya existente se devuelve como éxito con la referencia existente, si no hay conflicto de versión; no añade una segunda tarjeta. Mismo recibo reproduce la respuesta. Una clave con otro payload da idempotency_conflict.

Undo conserva en el recibo de servidor la operación inversa y las referencias/posiciones previas necesarias. La respuesta solo lleva undoReceiptKey y expiresAt, no autoriza al cliente a enviar un snapshot arbitrario. restore exige propietario, plazo, operación admitida y expectedVersion actual; si existe una edición posterior que afecta los mismos elementos, devuelve conflicto sin sobreescribirla.

Errores: 400 estructura inválida; 401 sesión; 403 origen prohibido; 404 recurso inexistente/ajeno/bandera apagada; 409 version_conflict, resource_changed, idempotency_conflict o invalid_state; 422 límite/contenido no utilizable; 503 fallo temporal. Todos con Cache-Control: private, no-store. Ningún GET escribe.

### 5.5 Persistencia, concurrencia y recuperación

- Crear mapa con POST /ensure solo tras GET confirmado como inexistente. StrictMode o dos pestañas no duplican mapa: UNIQUE(user_id), transacción e idempotencia.
- No volver a importar inscripciones automáticamente en cada apertura: una referencia retirada por el alumno no debe reaparecer. Nuevas rutas se añaden con búsqueda/sugerencias.
- Posiciones locales actualizadas durante drag; envío al terminar y debounce de 500 ms para movimiento por teclado. Pan/zoom no generan escrituras de base de datos.
- Una cola de layout por levelKey, con un solo envío en vuelo. Si el usuario mueve otra vez, conservar su posición nueva hasta enviar el siguiente lote. Una respuesta antigua no repone posiciones anteriores.
- Ante respuesta perdida, repetir misma clave y payload. Ante 409, leer la versión actual, conservar el borrador y ofrecer “Aplicar mis posiciones” o “Usar las guardadas”. No hacer overwrite automático.
- “Aplicar mis posiciones” es una nueva operación con nueva clave y versión recién leída. Si hay segundo conflicto, mantener el aviso.
- Estructura es optimista solo en la tarjeta incorporada, marcada Guardando; confirmar o retirar esa tarjeta ante error. No modificar porcentajes anticipadamente.
- Guardar encuadre en sessionStorage usando identidad de usuario + mapId + levelKey + modo compact/wide. Solo serializar números e IDs validados; limpiar referencias locales al cerrar/cambiar cuenta. No almacenar sesiones, contenido privado o progreso.
- Recuperar al refrescar: primero permisos/estructura del servidor; después layout confirmado; finalmente viewport compatible con el tamaño. Si las dimensiones difieren >20 %, centrar la selección conservando zoom legible.
- Navegar con posiciones pendientes conserva borrador y cola en el provider. Al salir con cambios sin confirmar, mostrar estado real y usar beforeunload solo si hay un cambio de posición pendiente. Nunca afirmar “Guardado” sin respuesta.

## 6. Progreso, identidad y convivencia con lo existente

### Fórmula obligatoria

Para cada elemento construir el conjunto S de pasos esenciales únicos accesibles en su versión resuelta. Clave de deduplicación: pathId + pathVersionId + stepId.

~~~text
T = tamaño de S
C = cantidad de pasos de S con state = completed
porcentaje =
  null                       si el contenido es vacío o no se pudo obtener
  100                        si T > 0 y C = T
  min(99, round(100 * C / T)) si T > 0 y C < T
~~~

Sin inscripción, el contenido publicado conocido tiene C=0 y denominador real. Un fallo de lectura es unavailable y porcentaje null; no 0. Un nodo vacío es empty con “Agrega contenido”. started deriva de intentos/progreso de servidor, incluyendo avance parcial sin pasos finalizados. Con C=0 y started=true, mostrar 0 % · En progreso.

Completado exige T>0 y C=T. Opcionales y pasos omitidos no inflan C. La evidencia de conocimiento y XP siguen separados del porcentaje.

**Ejemplo:** lección A tiene 1/2, B tiene 3/6. El bloque suma 4/8 = 50 %. Si A se añade además individualmente al mismo agregado, permanece 4/8, no 5/10. En dos nodos diferentes ambos muestran su avance propio; el total del mapa une identidades.

No transferir finalización entre rutas distintas por usar el mismo recurso: la identidad académica del paso/inscripción sigue siendo la actual. La deduplicación evita duplicar referencias al mismo paso, no sustituye las reglas de evidencia.

### Resolver de versiones

1. Comprobar propietario y pertenencia de node/entry.
2. Obtener path y su inscripción de la cuenta en una consulta por lote.
3. Si existe inscripción, usar pathVersionId fijado, también para una lección independiente.
4. Si no existe, usar versión publicada accesible.
5. Encontrar unit por stableKey; no por título o posición.
6. Si falta tras upgrade, mostrar “Esta lección cambió de versión” con acceso a la ruta y opción de quitar referencia; no elegir otra automáticamente.
7. Retiro de material/ruta respeta el resolver actual. Un mapa guardado no otorga permisos adicionales.

### Actividades y regreso al mapa

Extraer la orquestación del launcher actual a un helper/hook reutilizable sin cambiar su política. El panel usa los mismos endpoints y comprobaciones:

1. Clic expreso “Comenzar lección” o “Continuar actividad”.
2. Si no hay inscripción activa, mostrar la acción precisa: Comenzar / Reanudar ruta. Ejecutar inscripción o cambio de estado existente; no crear tracking al navegar por el mapa.
3. Después de la respuesta de inscripción, resolver de nuevo stableKey, step y opción en la versión devuelta; nunca iniciar con un optionId precargado de otra versión.
4. Consultar progreso/intentado existente. Si hay intento compatible, reanudar. Si falla esta consulta, detener lanzamiento con Reintentar.
5. Crear intento con clientAttemptId e Idempotency-Key persistentes para ese clic. Deshabilitar CTA mientras está en vuelo.
6. Abrir /aprendizaje/sesiones/:attemptId conservando origen de mapa en parámetro local validado.
7. ActivityShell recibe returnHref opcional; su header y cierre vuelven al mismo panel. Sin origen, conserva sus enlaces actuales.
8. El origen solo admite pathname /aprendizaje/mapa y la query permitida. Validar URL con origen local y reconstruirla; rechazar //, hosts externos, javascript y rutas arbitrarias.
9. Al volver, invalidar caché de progreso de las referencias del path, refrescar desde servidor y mantener posiciones/viewport.

El roadmap enseña todos los pasos de la unit seleccionada, sus alternativas y duración real disponible. Recomendación: intento en curso compatible, después primer esencial incompleto no omitido por orden publicado, después esencial omitido pendiente; si terminó, repaso o siguiente lección disponible. No bloquear otras actividades. Opciones alternativas accesibles desde la fila; no contarlas como actividades adicionales.

## 7. Navegación y máquina de estados

### URLs canónicas

~~~text
/aprendizaje/mapa
/aprendizaje/mapa?node=<nodeUUID>
/aprendizaje/mapa?node=<nodeUUID>&item=<blockEntryUUID>
/aprendizaje/mapa?node=<nodeUUID>&item=<blockEntryUUID>&unit=corazon
/aprendizaje/mapa?node=<nodeUUID>&item=<lessonEntryUUID>
~~~

Si item es una lección independiente, no se admite unit adicional. Si item es bloque, unit debe pertenecer a ese bloque resuelto. Normalizar orden de parámetros mediante un único buildMapHref; encodear valores con URLSearchParams.

detail=1 abre el resumen del contenedor como estado secundario. No agregar coordenadas, progreso o datos privados a la URL. El root /aprendizaje lleva al mapa solo cuando su bandera está activa y no hay tab explícita. /aprendizaje?tab=hoy, rutas y progreso siguen funcionando.

Las URLs del mapa son privadas. Compartir contenido con otra cuenta usa la ruta editorial /aprendizaje/rutas/<slug>?leccion=<stableKey>, resuelta contra lo que esa cuenta puede ver. T024 añade foco opcional de unidad en esa ruta convencional; no comparte organización ni progreso privado.

### Historial

- La URL es autoridad del nivel; el controlador deriva navigationPath y comprueba toda la cadena con el servidor.
- Entrar o seleccionar lección usa pushState; seleccionar otra lección desde el mismo panel usa replaceState para que Atrás cierre el panel sin recorrer diez selecciones.
- Abrir/cerrar resumen o cambiar pestaña del panel no crea una capa académica; replaceState.
- Back/Forward del navegador solo procesa la nueva URL; no vuelve a empujarla.
- Atrás de la aplicación cierra primero lección, después bloque, después nodo. Si la entrada previa del historial de este workspace coincide con el padre, usa history.back; si llegó por enlace directo, replaceState al padre.
- Breadcrumb a un antecesor usa navegación explícita y restaura su snapshot. En raíz, Atrás jerárquico no existe.
- La selección múltiple es un modo separado. En él el clic marca/desmarca y no entra; botón “Terminar selección” devuelve navegación normal.

### Transición

~~~text
idle
 ├─ navigate → preparing
 │    ├─ datos listos → exiting (120 ms)
 │    │    → swapLevel → entering (120 ms) → idle
 │    └─ error → idle + aviso recuperable, nivel anterior intacto
 ├─ manualPanZoom → idle, misma URL
 └─ drag → dragging → savingLayout → idle/unsaved
~~~

Cada navegación tiene navigationToken incremental. Una acción nueva invalida fetch/animaciones previos. Comprobar token al resolver cada promesa; no aplicar un nivel antiguo ni dejar un overlay capturando clics.

Entrada: guardar snapshot, medir centro del elemento, setCenter con aumento moderado del zoom y opacidad de hermanos durante 120 ms; intercambiar datos; preparar viewport destino; revelar durante 120 ms. Salida: montar datos del padre desde caché, mantener su posición original y animar el encuadre hasta el snapshot previo. Un solo lienzo; no conservar todos los descendientes hidden.

Si falta información, iniciar la carga al clic y mantener el nivel actual. A los 160 ms mostrar estado pequeño “Abriendo…” sobre el seleccionado. La animación de 240 ms comienza cuando hay datos suficientes; no prometer latencia total de 240 ms con red lenta.

Reduced motion: duración 0, conservar lógica/foco/URL. Al cambiar de nivel enfocar el h1 con tabindex=-1; al volver enfocar el botón de entrada del elemento de origen. Si dejó de existir, enfocar el título. Anunciar “Anatomía, 8 bloques” en región polite.

### Caché y precarga

Cache cliente por account/mapId/structuralVersion/levelKey/resolvedVersionIds; TTL de metadatos 60 s, progreso 15 s, máximo 12 niveles y 2 MiB. El TTL es de caché en memoria privada, no de HTTP. En cambio de cuenta vaciarla.

Precargar después de 120 ms de hover o focus en contenedor, y al pointerdown táctil. Máximo dos peticiones simultáneas; cancelar la intención obsoleta. En saveData o conexión lenta, solo intención explícita. Precarga nunca descarga medios, inicia intentos ni crea inscripciones. En reposo puede prepararse un solo siguiente recomendado.

Un resultado tras add/remove/upgrade o actividad confirmada invalida las claves afectadas, aunque no haya vencido TTL. No suscribir todo el panel al array de posiciones del lienzo.

## 8. Layout, conexiones y rendimiento

### Distribución inicial

- Dimensiones del nodo general: 168 × 184 px. Bloque/lección: 156 × 172 px. Tarjeta de contexto dentro del lienzo: no se utiliza; el contexto va en cabecera.
- Separación base: 56 px horizontal y 64 px vertical. Coordenadas en unidades de Flow, no píxeles escalados.
- Por nivel, ancho disponible real = contenedor del lienzo después de reservar panel. Columnas iniciales = clamp(2,4,floor((ancho+56)/(anchoTarjeta+56))) en escritorio; 2 en compacto. Distribuir por orden publicado/guardado en bandas; centrar cada banda respecto del ancho máximo.
- Seis nodos generales: dos bandas de tres con leve énfasis del nodo recomendado, sin cambiar su tamaño de hit target. Ocho contenidos: dos bandas de cuatro cuando caben. Títulos largos usan tres líneas y altura uniforme de variante larga para todos los nodos del nivel.
- No imponer a mapas nuevos una posición fija de Anatomía si el catálogo no contiene ese nodo.

### Inserción y organización

1. Conservar posiciones existentes como obstáculos, expandiendo su rectángulo 24 px.
2. Elegir ancla: relacionado visible más cercano; en ausencia, último elemento del orden.
3. Buscar celda libre en anillos de la cuadrícula, desde derecha, abajo, izquierda, arriba, con paso anchoTarjeta+56 y altoTarjeta+64.
4. Probar hasta 200 celdas; si todas ocupadas, añadir banda debajo del límite inferior. Desempatar por coordenada y clave estable.
5. Insertar solo el nuevo elemento. No alterar posiciones previas ni invocar fitView; si queda fuera, ofrecer “Ver añadido”.
6. En drag, actualizar conexiones con React Flow. Al soltar, si hay solapamiento, desplazar únicamente el elemento arrastrado a la celda libre más próxima. Conservar movimientos válidos exactos, sin snap obligatorio.
7. “Organizar este nivel” recalcula solo ese nivel por orden; mostrar Deshacer durante 30 s mediante snapshot de posiciones y la misma API de layout con versión nueva.
8. Cambiar de tamaño no relayouta coordenadas guardadas. Ajusta viewport si se necesita orientación y preserva zoom legible.

### Edges

MapRelation contiene sourceOccurrenceId, targetOccurrenceId, kind (sequence/related/prerequisite), provenance y label. El servidor/adaptador los deriva de metadatos; la UI no envía source/target arbitrarios.

sequence: orden publicado dentro de bloque, o recommendedAfter existente cuando se pueda proyectar inequívocamente. related: mismo topic o referencia compartida. prerequisite: reservado a metadato explícito futuro; no convertir recommendedAfter en prerrequisito obligatorio.

No usar una flecha de secuencia entre áreas distintas solo por la disposición. Para pertenencia visual, la cabecera describe el contenedor; si no hay relación entre hijos, mostrar las tarjetas sin conectores falsos.

Render: SmoothStep con radio 20 px y stroke 1,25 px #BACBC5. Sequence con punta pequeña; related sin flecha. Máximo dos relaciones related por tarjeta, elegidas por prioridad, distancia y ID; el resto se consulta en detalle. No podar una secuencia académica y fingir que no existe: indicar “Ver relaciones” cuando se reduzca su representación.

Handles de entrada/salida invisibles por opacity, no display:none; isConnectable=false. nodesConnectable=false, edgesReconnectable=false, deleteKeyCode=null. Sin líneas animadas ni puntos circulando.

### Configuración del mapa

ReactFlowProvider a nivel workspace; nodeTypes y edgeTypes declarados fuera del render; nodos memoizados. Lienzo con dimensiones explícitas y min-height:0 en su contenedor flex/grid.

minZoom=0.65; maxZoom=1.35; zoomOnDoubleClick=false; nodeDragThreshold=6. Botones -/+ usan zoomTo para variar 0,1 y mostrar porcentaje real redondeado. “Ajustar vista” centra; “100 %” devuelve zoom 1 alrededor del centro actual.

No mostrar Background inicialmente. MiniMap: >24 elementos y bounds excediendo viewport; control para alternarlo; en móvil permanece oculto salvo petición. A partir de 60 elementos activar onlyRenderVisibleElements después de verificarlo en T032.

fitView solo en primera apertura sin snapshot, nivel nuevo sin layout/encuadre, o clic “Ajustar vista”. Si para ver todo haría falta zoom inferior a 0,65, conservar mínimo y centrar en siguiente recomendado; permitir pan y búsqueda. No volver ilegibles los títulos por encajar 200 tarjetas.

Separar contexts de navegación/detalle y de posiciones; calcular progreso en API por lotes y traer solo resúmenes. No una petición HTTP por tarjeta ni una consulta de progreso por cada aparición repetida.

Para agregados grandes, resolver las referencias autorizadas en una relación SQL y contar DISTINCT sobre path/version/step por contenedor y para el mapa completo. Los pasos se unen con learning_step_progress de la cuenta; los denominadores proceden del catálogo resuelto. Evitar materializar todos los objetivos/opciones de todas las rutas en memoria para sumarlos. El detalle de pasos se carga únicamente para la lección elegida.

Objetivos medibles de T032: 50 y 200 elementos por nivel; 5.000 referencias totales; transición preparada p95 ≤350 ms incluyendo la animación de 240 ms; handler de interacción p95 ≤50 ms; lectura de nivel API p95 ≤500 ms en preview representativo. Son presupuestos nuevos a medir, no resultados existentes.

## 9. Especificación visual: cómo la diseñaría

### 9.1 Dirección y composición

La interfaz debe parecer un lugar de estudio tranquilo: espacio central claro, tarjetas pequeñas pero legibles, iconos con significado y un único foco de atención. Tomaría la neutralidad de la referencia 01, la sensación de mapa de la 02 y la tipografía/marca reales del proyecto.

La relación visual principal es “contenido → progreso → siguiente acción”. El lienzo no necesita un hero con degradado ni métricas decorativas. El gráfico organiza; el panel explica.

Mantener el shell real. Dentro del contenido: toolbar de 64 px, cabecera contextual de 96–120 px y cuerpo que usa la altura restante. En raíz la cabecera contiene “Mi mapa de aprendizaje” y una frase corta. Dentro de nodo/bloque: icono de 56 px, título, porcentaje/conteo y descripción de dos líneas como máximo.

En workspace de ancho ≥1.180 px, usar grid minmax(0,1fr) 344px si hay panel. Entre 768 y 1.179 px, panel como drawer derecho de min(360px,90vw), cerrado por defecto. Por debajo de 768 px, hoja inferior modal de hasta 82dvh. Estas medidas se toman sobre el workspace después del rail global, no sobre el ancho completo del navegador.

El panel de escritorio reserva espacio y no tapa nodos. Abrirlo conserva coordenadas; un ajuste mínimo de viewport mantiene visible la tarjeta seleccionada. Su cierre recupera el encuadre previo. Cabecera/CTA permanecen visibles; el centro del panel tiene scroll propio.

### 9.2 Tokens exactos

Definirlos en learning-map.module.css, bajo .workspace; no sustituir :root, learning.css ni tokens globales.

~~~css
.workspace {
  --map-canvas: #FAF7F2;
  --map-surface: #FFFFFF;
  --map-ink: #17382F;
  --map-muted: #52665F;
  --map-primary: #0F3D32;
  --map-line: #DFE5E0;
  --map-connector: #BACBC5;
  --map-icon-well: #F0F6F2;
  --map-accent: #C75A3A;
  --map-selected-soft: #FFF8F4;
  --map-success: #116B50;
  --map-success-soft: #E8F5EE;
  --map-progress: #9A471E;
  --map-progress-soft: #FFF1E8;
  --map-neutral: #52615B;
  --map-neutral-soft: #EDF0EE;
  --map-card-shadow: 0 2px 4px rgb(15 61 50 / 3%),
                     0 12px 28px rgb(15 61 50 / 5%);
  color: var(--map-ink);
  background: var(--map-canvas);
  font-family: var(--font-plus-jakarta), system-ui, sans-serif;
}
~~~

Tipografía: h1 24/32 px peso 700; título del panel 20/28; tarjeta 14/20 peso 650–700; cuerpo 14/22; metadata 12/18; etiquetas 11/16 peso 600; controles 13/20. Porcentaje con font-variant-numeric: tabular-nums. Usar pesos disponibles de la fuente local; 650 puede resolverse a 600/700, sin descargar otra fuente.

Espaciado: 4, 8, 12, 16, 24, 32, 48, 64 px. Radio: tarjetas 18 px; botones 10; buscador 12; panel sin redondeo contra el borde, hoja móvil 24 arriba. Máximo dos sombras en esta superficie: tarjeta y flotante.

El texto normal debe alcanzar contraste 4,5:1; foco y controles identificables 3:1. Medir las parejas efectivamente utilizadas, no dar por accesible todo un color porque una pareja pasó.

### 9.3 Tarjeta común y ejemplos

~~~text
┌────────────────────────┐
│  ··                 ⋯  │  agarre / menú, sin competir con título
│        [icono]          │  SVG lineal verde de 48–56 px
│        Corazón          │  título, máximo 3 líneas
│          13 %           │
│     [ En progreso ]     │  estado escrito, fondo suave
└────────────────────────┘
~~~

Nodo general: icono 56 px; título; porcentaje; “8 bloques” o “2 bloques · 3 lecciones”; estado discreto. Bloque: icono 48 px; título; porcentaje; “8 lecciones”; estado. Lección: icono 48 px; título; porcentaje; estado; no añadir la lista de actividades ni otra barra duplicada.

Cuando el conteo mixto no cabe, usar “5 contenidos” y exponer “2 bloques y 3 lecciones” en el nombre accesible/panel. El título completo se conserva en aria-label y detalle. No sustituir un nombre largo por un tooltip inaccesible en móvil.

~~~css
.card {
  box-sizing: border-box;
  width: 156px;
  min-height: 172px;
  border: 1px solid var(--map-line);
  border-radius: 18px;
  background: var(--map-surface);
  box-shadow: var(--map-card-shadow);
}
.card[data-selected="true"] {
  border-color: var(--map-accent);
  box-shadow: 0 0 0 1px var(--map-accent), var(--map-card-shadow);
}
.iconWell {
  display: grid;
  place-items: center;
  width: 64px;
  height: 64px;
  margin-inline: auto;
  border-radius: 18px;
  background: var(--map-icon-well);
  color: var(--map-primary);
}
.openButton {
  width: 100%;
  min-height: 140px;
  border: 0;
  border-radius: inherit;
  background: transparent;
  color: inherit;
  padding: 12px 12px 16px;
  cursor: pointer;
}
.openButton:focus-visible {
  outline: 3px solid var(--map-primary);
  outline-offset: 4px;
}
.badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 22px;
  border-radius: 999px;
  padding: 3px 9px;
  font-size: 11px;
  line-height: 16px;
  font-weight: 600;
}
~~~

Estos fragmentos ilustran el tratamiento; la implementación final debe incorporar todas las dimensiones y estados descritos, sin pegar estilos globales.

**Ejemplo A · No iniciado:** Pulmones, 0 %, etiqueta gris “No iniciado”, icono verde sin candado. La tarjeta sigue siendo operable.

**Ejemplo B · En progreso:** Corazón, 13 %, etiqueta melocotón “En progreso”. Borde terracota únicamente si está seleccionado. El borde no comunica porcentaje.

**Ejemplo C · Completado:** Pared torácica, 100 %, etiqueta verde con check. Fondo de tarjeta blanco, icono verde oscuro; sin relleno verde de toda la tarjeta.

**Ejemplo D · Error:** “Progreso no disponible”, guion en lugar de 0 %, acción Reintentar en el panel. Un contenido retirado conserva su título solo si continúa siendo autorizable; en otro caso muestra “Contenido no disponible”.

Hover: borde ligeramente más definido y elevación máxima translateY(-2px) en el contenido interno; no transformar el wrapper posicionado por React Flow. Pressed: eliminar esa elevación. Disabled solo para una acción realmente indisponible; nunca por avance 0.

### 9.4 Iconografía

Controles: Phosphor existente a 18–20 px, peso regular. Nodos médicos: MedicalMapIcon con SVG locales y viewBox consistente; color currentColor, trazos redondeados y grosor visual uniforme. No instalar otra biblioteca general.

Dibujaría un tórax con caja costal, un corazón anatómico simplificado, pulmones bilaterales y una molécula sencilla. La silueta permite reconocer el tema sin fotos recortadas ni emojis. No usar pulmones para representar esqueleto solo porque son el cover actual de una ruta.

Mapear por iconKey editorial/plantilla, nunca por includes(title). Ante icono desconocido, folder. Los iconos son orientativos, no material para enseñar anatomía; no introducir detalles clínicos no revisados. El fondo del icono puede tener el mismo verde muy pálido en todas las materias.

### 9.5 Seis estados de referencia

| Estado | Qué se ve | Clic y contenido preciso |
| --- | --- | --- |
| Mapa general | Seis nodos de ejemplo, conexiones verificables, título y “Agregar nodo” | Anatomía entra directamente; panel discreto de sugerencias cuando hay espacio. |
| Dentro de Anatomía | Cabecera Anatomía; ocho bloques distribuidos por bandas | Tórax entra; menú “Ver información” abre resumen sin entrar. |
| Dentro de Tórax | Cabecera Tórax; ocho lecciones; breadcrumb completo | Corazón selecciona y abre panel; el resto permanece en el mapa. |
| Lección Corazón | Borde en Corazón y panel con 1/8, descripción y ocho actividades | Guía de estudio puede ser siguiente; intro tiene un check. CTA comienza o continúa. |
| Nodo con lecciones directas | Fisiología con lecciones cardiovasculares, respiratorias, etc. | Se omite la capa bloque sin inventar uno ficticio; misma tarjeta/panel. |
| Resumen de bloque | Panel Tórax, listado compacto de lecciones, porcentajes y siguiente recomendación | Una fila selecciona lección y reemplaza el contenido del mismo panel. |

La maqueta HTML muestra los mismos patrones y sirve para discutir estética. Las cifras de su ejemplo Tórax son coherentes: Pared 8/8, Mediastino 6/9, Corazón 1/8 y otras cinco lecciones 0/3 cada una; total 15/40 → 38 %. Para Anatomía se suman los denominadores de sus ocho bloques; no se copia el 72 % de la imagen.

### 9.6 Panel de lección

~~~text
┌─────────────────────────────────┐
│ [corazón]  Corazón            ×  │
│            13 % · 1/8           │
│ Descripción breve real           │
│ Actividades        Recursos      │
├─────────────────────────────────┤
│ ✓ Introducción          5 min   │
│ 2 Guía de estudio      10 min   │ ← siguiente recomendado
│ 3 Anatomía coronaria   12 min   │
│ 4 ...                           │
│ ...                             │
├─────────────────────────────────┤
│ Siguiente actividad             │
│ Guía de estudio                 │
│ [ Comenzar actividad      → ]   │
└─────────────────────────────────┘
~~~

Roadmap vertical de una columna, no dos columnas estrechas. Filas mínimo 52 px; número/check en círculo de 24; tipo y duración debajo del nombre; estado anunciado. Nombre a 13–14 px. Separador fino entre filas, sin tarjeta elevada por cada actividad.

CTA verde sólido, texto blanco, alto 44–48 px y ancho completo. Bajo descripción puede incluir objetivos en desplegable; recursos muestra alternativas y recursos ya autorizados. Si no hay recursos, mostrar una frase explicativa real. Notas aparece únicamente al completar T036.

### 9.7 Móvil y accesibilidad

- Lienzo de altura restante de pantalla mediante 100dvh con fallback. No congelar toda la página si el contenido necesita reflujo por zoom de texto.
- Tarjetas conservan tipografía base; pan y pinch modifican solo el encuadre actual. Botón “Vista de lista” ofrece la misma jerarquía y acciones en flujo documental, especialmente útil a 200 %.
- En móvil, pan táctil sobre el mapa; arrastre de nodos mediante modo Organizar y agarre explícito. No convertir cualquier gesto sobre una tarjeta en una reorganización accidental.
- Todas las acciones táctiles tienen zona ≥44×44 px. La etiqueta de estado no es un botón y no necesita ese tamaño.
- Nodo como grupo, con botón nativo para abrir, menú nativo separado y dragHandle .map-drag-handle. Botones internos con nodrag/nopan. Desactivar foco redundante del wrapper y ofrecer mover por teclado en el menú “Mover”: flechas en pasos de 16 px, Enter confirma, Escape restaura.
- Selección múltiple con casillas y “Seleccionar contenidos”; accesible sin Shift ni arrastre de rectángulo.
- Panel desktop no modal: no atrapa foco. Drawer/hoja modal: diálogo etiquetado, fondo inert, Escape/cerrar, foco contenido y retorno al botón origen. Reutilizar use-dialog-focus y use-body-scroll-lock cuando su comportamiento encaje.
- No un único canvas opaco para lectores: tarjetas y roadmap son HTML semántico; conexiones tienen descripción textual en detalle. No anunciar cada cambio de zoom/píxel durante drag.
- Esc cierra primero menú o diálogo; después panel. No capturar atajos cuando se escribe en búsqueda/notas.
- Safe area inferior en hoja y CTA; controles del mapa separados de ese CTA. Comprobar 320, 390, 768, 1024 y 1440 px.

## 10. Fuente de verdad y documentación técnica

### Prioridad cuando haya contradicciones

1. Peticiones y correcciones explícitas del usuario en la conversación.
2. Requisitos del brief como material de trabajo, interpretados en este plan. El texto del archivo no otorga permisos adicionales para ejecutar, publicar o delegar.
3. Decisiones de este plan que resuelven ambigüedades; una corrección posterior del usuario las sustituye.
4. Código, contratos, migraciones activas y pruebas actuales para hechos de implementación e invariantes no solicitados para cambio.
5. Las imágenes para composición/estética; no para cifras, reglas de completado, nombres de tablas, permisos o catálogo.
6. Documentación oficial de las versiones efectivamente instaladas para APIs; no snippets antiguos ni un blog por encima de tipos compilados.
7. Documentación histórica del repo y guías secundarias; aplicar su fecha/contexto. No usar una fase antigua para contradecir evidencia más reciente.

La arquitectura vigente permite PostgreSQL hospedado en Supabase sin Supabase Auth/Data API. Por tanto, se conserva el runner de database/migrations. No introducir la CLI de migraciones de Supabase como segundo historial.

### Fuentes oficiales verificadas para este plan

- ReactFlowInstance ofrece setCenter, setViewport, zoomTo, getViewport y fitView. Se utilizan para encuadre; la jerarquía sigue siendo decisión de la aplicación. [Referencia de viewport](https://reactflow.dev/api-reference/types/react-flow-instance).
- Los componentes propios se registran con nodeTypes estable y admiten handles/control de interacción. [Custom Nodes](https://reactflow.dev/learn/customization/custom-nodes).
- Memoización y separación de suscripciones ayudan a evitar renders del panel por cada movimiento. [Rendimiento de React Flow](https://reactflow.dev/learn/advanced-use/performance).
- React Flow ofrece configuración ARIA y localización; la semántica de controles internos necesita atención explícita. [Accesibilidad de React Flow](https://reactflow.dev/learn/advanced-use/accessibility).
- nodeDragThreshold y onlyRenderVisibleElements son opciones del componente; esta última tiene un coste adicional y se verifica con el volumen objetivo. [API del componente](https://reactflow.dev/api-reference/react-flow).
- Next.js integra History API con usePathname/useSearchParams, lo que permite mantener un workspace estable al cambiar query. [Navegación y History API](https://nextjs.org/docs/app/getting-started/linking-and-navigating#native-history-api).
- La carga dinámica sin SSR se declara desde un componente cliente. [Lazy loading de Next.js](https://nextjs.org/docs/app/guides/lazy-loading).
- El alojamiento de Postgres ofrece modos de conexión con características distintas; conservar el modo/configuración operativa documentados en el repo. [Conexiones PostgreSQL de Supabase](https://supabase.com/docs/guides/database/connecting-to-postgres).
- Se consultó el changelog oficial como respaldo al índice Markdown que no respondió. No se requiere cambiar Auth, Realtime ni el proveedor para esta propuesta. [Changelog de Supabase](https://supabase.com/changelog).

Estas referencias explican APIs; las decisiones de UX, algoritmo, límites y contratos de este documento son propuestas propias para este proyecto. Revalidar la versión del paquete en T001.

## 11. Descomposición operativa

### Convenciones comunes para todas las tareas

Las rutas siguientes son relativas a la raíz del repositorio inspeccionado. “Permite” es una lista cerrada de modificaciones, incluyendo sus pruebas específicas. “No tocar” incluye siempre secretos, datos de producción, migraciones ya aplicadas y archivos ajenos con cambios locales.

Cada tarea termina con un registro en docs/aprendizaje-guiado/MAPA-EJECUCION.md: ID, archivos, comprobaciones ejecutadas, resultado PASS/FAIL/NO VERIFICADO, limitación y siguiente tarea. Ese registro no convierte pruebas históricas en pruebas nuevas.

Capacidad A = máxima; B = intermedia competente; C = económica/mecánica. La arquitectura está resuelta aquí, por lo que ninguna tarea normal necesita A. Escalar solo con los disparadores de la sección 14.

### T001 · Línea base y compatibilidad — B

- **Objetivo / entradas:** confirmar repositorio, catálogo disponible y dependencias desde este plan, package.json y docs actuales.
- **Instrucciones:** leer AGENTS aplicables, registrar git status/HEAD y número final de migración. Ejecutar baseline secuencial. Consultar la última versión estable 12.x de @xyflow/react y sus peerDependencies con pnpm view; confirmar compatibilidad con React 19 y Node 24. Registrar versión exacta elegida. Inventariar paths/units/stableKeys autorizados si existe ambiente; separar contenido real de fixtures.
- **Salida:** MAPA-EJECUCION.md con baseline, versión elegida y hechos desconocidos.
- **Dependencias:** ninguna.
- **Permite:** documento nuevo de ejecución.
- **No tocar:** código, lockfile, documentos con cambios previos, catálogo/editor de producción.
- **Aceptación / comprobación:** comandos tienen salida y fecha; cada dato remoto identifica ambiente o NO VERIFICADO.
- **Errores a evitar:** actualizar Next/React por rutina; declarar inexistente un piloto por leer solo la fase 0.

### T002 · Contratos del mapa — B

- **Objetivo / entradas:** convertir sección 5 en tipos y Zod estrictos.
- **Instrucciones:** crear learning-map.ts, definir refs discriminadas, iconos, lectura, catálogo, rutas, mutaciones, layouts, límites y proveedor LearningMapProvider. Exportar desde index.ts. Definir schema de selections y undo según T008 antes de otras implementaciones.
- **Salida:** contratos compilables y casos válidos/invalidables reproducibles.
- **Dependencias:** T001.
- **Permite:** packages/contracts/src/learning-map.ts, index.ts; apps/api/test/learning-map-contract.test.ts.
- **No tocar:** significados de esquemas guided-learning existentes.
- **Aceptación / comprobación:** build de contratos; prueba de payloads extras, refs incompletas, NaN/Infinity, límites, pares query incompatibles.
- **Errores a evitar:** permitir userId, progreso editable o HTML de icono desde cliente.

### T003 · Migración y tipos Kysely — B

- **Objetivo / entradas:** persistir las cuatro tablas de sección 5.2.
- **Instrucciones:** crear siguiente migración libre, añadir restricciones, FK compuestas, índices, RLS/grants siguiendo 0010. Añadir interfaces a CediahDatabase. Montar harness PGlite específico reutilizando el patrón existente, sin tocar su historia de migraciones.
- **Salida:** DDL aditivo y prueba de estructura.
- **Dependencias:** T002.
- **Permite:** nueva migración, apps/api/src/db/database.ts, apps/api/test/learning-map-storage.test.ts y test/helpers/learning-map-db.ts.
- **No tocar:** 0001–0015, supabase/migrations, conexiones/credenciales.
- **Aceptación / comprobación:** migrar una DB local desde cero y otra al nivel previo; rechazar FK/duplicados inválidos; comprobar índices/grants. PostgreSQL real se comprueba en T034.
- **Errores a evitar:** usar auth.uid() de Supabase o dar acceso Data API.

### T004 · Proveedor y creación inicial — B

- **Objetivo / entradas:** GET resumen y ensure del mapa privado.
- **Instrucciones:** crear postgres-learning-map.ts. Inyectar DB/reloj/proveedor sin globals. GET no escribe. ensure toma inscripciones propias no archivadas, agrupa por topic y crea referencias una vez en transacción. Nodo de tema es copia editable; no sincronización automática.
- **Salida:** mapa inicial real o vacío.
- **Dependencias:** T003.
- **Permite:** apps/api/src/providers/postgres-learning-map.ts; pruebas storage.
- **No tocar:** creación de inscripciones, contenidos o versiones.
- **Aceptación / comprobación:** dos ensure producen un mapa; repetir tras quitar entrada no la resucita; otra cuenta no lo lee.
- **Errores a evitar:** sembrar seis asignaturas ficticias, escribir desde GET.

### T005 · Resolver de niveles y versiones — B

- **Objetivo / entradas:** resolver sección 5.3 y 6 con pertenencia/versión correctas.
- **Instrucciones:** crear learning-map/resolver.ts; validar cadena root/node/entry/unit. Consultar por lotes paths, inscripciones y unidades. Responder únicamente nivel actual y detalle de lección seleccionada. Utilizar comprobaciones de acceso académico existentes.
- **Salida:** LevelResponse real y estados de retiro/clave ausente.
- **Dependencias:** T004.
- **Permite:** apps/api/src/learning-map/resolver.ts, proveedor nuevo, apps/api/test/learning-map-resolver.test.ts.
- **No tocar:** autorización académica, contenido-resolver o upgrades salvo importación de helpers existentes.
- **Aceptación / comprobación:** misma lección desde dos nodos resuelve versión idéntica; deep link inválido/ajeno 404; no soluciones/URLs firmadas.
- **Errores a evitar:** resolver unit por título o usar siempre la versión publicada.

### T006 · Agregación de progreso — B

- **Objetivo / entradas:** aplicar conjunto S y fórmula de sección 6.
- **Instrucciones:** crear learning-map/progress.ts con contador puro y consultas por lote. Compartir la fórmula con readLearningEnrollmentProgress mediante extracción mínima a helper si se necesita; conservar su DTO. No llamar un lector completo por tarjeta. Agrupar por versiones/stepIds y proyectar a múltiples ocurrencias.
- **Salida:** progreso nodo/bloque/lección/mapa consistente.
- **Dependencias:** T005.
- **Permite:** progress.ts, helper puro en guided-learning si necesario, tramo de cálculo en postgres-learning-activities.ts, pruebas progress y regresión existing.
- **No tocar:** mutaciones de actividades, XP, evidencia, scheduling.
- **Aceptación / comprobación:** F13–F15, igualdad del lector antiguo antes/después, 199/200 nunca 100, 0/0 empty.
- **Errores a evitar:** media de porcentajes, duplicar mismo paso o convertir error en 0.

### T007 · Mutaciones personales y layout — B

- **Objetivo / entradas:** nodes/entries/remove/restore/layout según sección 5.4.
- **Instrucciones:** implementar operaciones con validación de identidad, receipt que incluye operación y versión de estructura/layout separada. Guardar solo posiciones parciales autorizadas. remove conserva snapshot propio mínimo para undo en el recibo.
- **Salida:** edición persistente y conflictos explícitos.
- **Dependencias:** T005.
- **Permite:** proveedor nuevo, apps/api/src/learning-map/mutations.ts, apps/api/test/learning-map-mutations.test.ts.
- **No tocar:** tablas de tracking ni helper de receipts salvo reutilización.
- **Aceptación / comprobación:** rollback transaccional, misma clave reproduce, otra cuenta falla, retirada no borra inscripción; undo caduca a 30 s.
- **Errores a evitar:** overwrite silencioso o usar IDs del cliente sin comprobar pertenencia.

### T008 · Agrupación y bloque incompleto — B

- **Objetivo / entradas:** selections canónicas y complete-block.
- **Instrucciones:** selections admite rootNodeId, entryId o {blockEntryId,unitStableKey}, todas del nivel actual. Expandir selecciones a refs; si incluye bloque y lección del mismo path, conservar bloque. Crear nodo en raíz sin borrar origen. complete-block actúa dentro de un nodeId: reemplaza refs de lección de ese path por blockRef atómicamente, conserva el resto y permite undo.
- **Salida:** grupo mixto y consolidación sin progreso artificial.
- **Dependencias:** T007.
- **Permite:** mutations.ts, apps/api/src/learning-map/grouping.ts, pruebas mutations.
- **No tocar:** orden/composición editorial de LearningPath.
- **Aceptación / comprobación:** selección transversal produce unión determinista; agregar contenido ≠ estudiarlo; falla total si una ref pierde permiso.
- **Errores a evitar:** copiar lecciones como nuevos recursos o trasladar versiones de inscripción.

### T009 · Catálogo, relaciones y sugerencias — B

- **Objetivo / entradas:** búsquedas paginadas y motivos comprobables.
- **Instrucciones:** implementar filtros tipo/texto y acceso por versión. Root sugiere temas publicados no representados; nodo ofrece mismos topics y completar bloques; lección prioriza lecciones del mismo bloque y mismo topic aún ausentes. Desempate por título/identidad, máximo tres sugerencias. related exige tema compartido o contenido compartido; sequence orden publicado.
- **Salida:** catalog.ts, relations.ts y suggestions.ts deterministas.
- **Dependencias:** T005, T006, T008.
- **Permite:** nuevos archivos apps/api/src/learning-map y pruebas learning-map-catalog.test.ts.
- **No tocar:** motor de recomendaciones Hoy, taxonomías/editoriales reales.
- **Aceptación / comprobación:** misma entrada produce mismo orden; q vacía, acentos y paginación sin repetir; contenido retirado no se ofrece.
- **Errores a evitar:** deducir “ECG relacionado con corazón” por texto sin metadato.

### T010 · Endpoints Fastify — B

- **Objetivo / entradas:** exponer exactamente tabla de API.
- **Instrucciones:** crear learning-map/routes.ts usando resolveGuidedUser y schemas. Registrar dependencias en app.ts. Usar namespace /v1/guided-learning/map para observabilidad privada existente; plantilla de ruta y códigos estables.
- **Salida:** rutas autenticadas y probadas con app.inject.
- **Dependencias:** T006–T009.
- **Permite:** routes.ts, apps/api/src/app.ts, apps/api/test/learning-map-routes.test.ts.
- **No tocar:** endpoints anteriores, logs con datos personales.
- **Aceptación / comprobación:** S01–S04; flag aún deshabilitada hasta T012; header privado también en errores.
- **Errores a evitar:** devolver 200 con error embebido o aceptar userId en query.

### T011 · BFF y lectores servidor web — B

- **Objetivo / entradas:** puente de mismo origen y DTOs verificados.
- **Instrucciones:** añadir allowlist exacta map al catch-all existing. Reutilizar forwardGuidedLearningRequest sin convertirlo en proxy abierto. Crear lib/server/learning-map-api.ts para lecturas SSR; conservar cookie server-only y schemas.
- **Salida:** navegador puede llamar APIs nuevas sin host/secreto de backend.
- **Dependencias:** T010.
- **Permite:** apps/web/src/app/api/guided-learning/[...path]/route.ts, lib/server/learning-map-api.ts, prueba del BFF nueva.
- **No tocar:** proxy genérico, autenticación, método DELETE del forwarder; se usan POST remove/restore.
- **Aceptación / comprobación:** ruta no permitida 404, POST cross-origin 403, propagación de Idempotency-Key y respuesta inválida 502.
- **Errores a evitar:** pasar cookies como prop cliente o aceptar segmentos extra.

### T012 · Bandera y entrada del workspace — B

- **Objetivo / entradas:** activación gradual sin quitar Hoy/Rutas/Progreso.
- **Instrucciones:** añadir GUIDED_LEARNING_MAP_ENABLED default false y capacidad privada guidedLearningMap, siempre subordinada a guidedLearning. Propagar en actual user/session bridge/shell manteniendo compatibilidad de mocks. Crear mapa/page.tsx con guard server y summary inicial; redirect de /aprendizaje sin tab solo con flag.
- **Salida:** entrada nueva aislada y fallback anterior.
- **Dependencias:** T011.
- **Permite:** config.ts/app.ts, contracts/index.ts, web current-user.ts, platform-frame.tsx, app-shell.tsx si precisa puente, aprendizaje/page.tsx y mapa/page.tsx, .env.example y pruebas de bandera.
- **No tocar:** render.yaml ni activar entornos; nombres de otras entradas del shell.
- **Aceptación / comprobación:** 4 combinaciones de flags, 404 directo cuando apagada, tabs antiguas conservadas.
- **Errores a evitar:** confiar en localStorage o NEXT_PUBLIC como autorización.

### T013 · URLs y controlador de navegación — B

- **Objetivo / entradas:** MapRoute y reglas de sección 7.
- **Instrucciones:** crear map-route.ts con parse/build/parent; controlador aislado del viewport. Conectar useSearchParams y History API dentro de la misma página; query desconocida se elimina por normalización, identidad inválida se trata como error. Implementar historial interno por pestaña para back a padre.
- **Salida:** jerarquía verificable sin React Flow todavía.
- **Dependencias:** T002, T012.
- **Permite:** apps/web/src/components/learning/map/map-route.ts, map-navigation.ts, tests junto a esos helpers.
- **No tocar:** rutas de sesiones o mutaciones académicas.
- **Aceptación / comprobación:** F02–F05; Back/Forward no duplican entradas; deep link funciona en pestaña nueva.
- **Errores a evitar:** interpretar zoom<1 como salir de nivel o construir URL concatenando texto sin encodear.

### T014 · Estado y caché de niveles — B

- **Objetivo / entradas:** servidor/BFF y contrato de caché.
- **Instrucciones:** crear MapWorkspaceProvider, separar estado de datos, navegación, selección y posiciones. Añadir precarga por intención, TTL/LRU/límites, AbortController y navigationToken. Estado preparado se valida con Zod; no almacenar DTO académico en sessionStorage.
- **Salida:** store local limitado y actualizaciones consistentes.
- **Dependencias:** T011, T013.
- **Permite:** map/map-provider.tsx, map-level-cache.ts, use-map-level.ts, pruebas cache.
- **No tocar:** stores globales, cola de actividad.
- **Aceptación / comprobación:** petición tardía no sustituye nivel nuevo; cuenta distinta no recibe caché previa; máximo dos precargas.
- **Errores a evitar:** array completo de posiciones como dependencia de paneles o caché ilimitada.

### T015 · Guardado espacial — B

- **Objetivo / entradas:** snapshots y PATCH layout.
- **Instrucciones:** implementar cola por nivel, debounce, progreso de guardado y reconciliación descritos en 5.5. Guardar viewport tras onMoveEnd y selección al navegar. Validar sessionStorage y versión de schema; descartar snapshot corrupto sin fallar todo el mapa.
- **Salida:** restauración al volver/refrescar y conflictos recuperables.
- **Dependencias:** T007, T014.
- **Permite:** map/map-spatial-state.ts, use-map-layout-save.ts y sus tests.
- **No tocar:** IndexedDB/learning-mutation-queue de actividades.
- **Aceptación / comprobación:** F04, F10, F16, S05; respuesta perdida reutiliza clave.
- **Errores a evitar:** enviar en cada pixel o borrar un movimiento reciente por respuesta vieja.

### T016 · Layout incremental — B

- **Objetivo / entradas:** algoritmo sección 8 con medidas reales.
- **Instrucciones:** implementar funciones puras initialLayout/findFreePosition/resolveDropOverlap/organizeLevel. Entradas ordenadas y tamaños explícitos; sin Math.random ni tiempo del reloj. Restore no llama initialLayout cuando ya hay posiciones.
- **Salida:** posiciones estables y deshacer de organización.
- **Dependencias:** T002.
- **Permite:** map/map-layout.ts y tests.
- **No tocar:** progreso, orden editorial, persistencia.
- **Aceptación / comprobación:** añadir 1 conserva N posiciones anteriores; misma entrada produce mismo resultado; 200 nodos no se solapan.
- **Errores a evitar:** forzar layout radial/physics o reordenar al abrir panel.

### T017 · Tokens y estructura visual — C

- **Objetivo / entradas:** sección 9 y ejemplo HTML.
- **Instrucciones:** crear learning-map.module.css y componentes presentacionales de toolbar/cabecera/panel base. Aplicar medidas, variables locales y estados. Reutilizar fuente/shell; reservar lienzo con min-height:0.
- **Salida:** estructura sin lógica académica y sin hero sobredimensionado.
- **Dependencias:** T002.
- **Permite:** map/learning-map.module.css, map-header.tsx, map-panel-frame.tsx.
- **No tocar:** globals.css, koras-theme.css, platform-chrome.css.
- **Aceptación / comprobación:** V01–V06 con datos locales; ninguna regla altera fuera del workspace.
- **Errores a evitar:** degradados, sombras fuertes o cuerpo a 10 px para encajar.

### T018 · Iconos — C

- **Objetivo / entradas:** MapIconKey y sección 9.4.
- **Instrucciones:** crear MedicalMapIcon; reutilizar Phosphor para herramientas y dibujar los SVG médicos enumerados con viewBox común. Hacer lámina visual de iconos en fixture. Fallback folder y aria-hidden cuando título identifica.
- **Salida:** registry cerrado de iconos uniformes.
- **Dependencias:** T017.
- **Permite:** map/medical-map-icon.tsx y, si se usan archivos, apps/web/public/learning-map/icons/.
- **No tocar:** imágenes anatómicas editoriales ni logos.
- **Aceptación / comprobación:** no URLs remotas/HTML arbitrario; todos legibles a 48 y 24 px; tórax no se confunde con pulmones.
- **Errores a evitar:** emojis, otra librería de iconos, matching por título.

### T019 · Custom Nodes y controles — B

- **Objetivo / entradas:** estado y diseño común.
- **Instrucciones:** crear LearningMapItem base con LearningNode, BlockNode y LessonNode memoizados. Botón de abrir y menú separados; agarre explícito; selección múltiple controlada. Añadir handles invisibles y conexiones deshabilitadas.
- **Salida:** tres nodos con misma gramática visual.
- **Dependencias:** T017, T018.
- **Permite:** map/nodes/*.tsx, map/map-controls.tsx y stylesheet propio.
- **No tocar:** fetch, progreso o estado de inscripción dentro del nodo.
- **Aceptación / comprobación:** porcentaje/estado coherentes, menú no navega, drag no activa clic, teclado opera cada botón.
- **Errores a evitar:** botones anidados, foco doble wrapper/botón, transformar el wrapper de Flow.

### T020 · Lienzo React Flow — B

- **Objetivo / entradas:** dependencia fijada en T001 y nodos/layout/provider.
- **Instrucciones:** instalar exactamente versión elegida con pnpm --filter @cediah/web add --save-exact @xyflow/react@<versión-validada>. Crear wrapper cliente y dynamic import con ssr:false desde cliente. Importar CSS del paquete una sola vez en frontera del mapa; aplicar configuración sección 8. Renderizar solo items del nivel.
- **Salida:** mapa real con pan, zoom, edges y drag.
- **Dependencias:** T014–T019.
- **Permite:** apps/web/package.json, pnpm-lock.yaml, map/learning-map-workspace.tsx, map/learning-map-canvas.tsx, mapa/page.tsx.
- **No tocar:** versiones de Next/React u otras dependencias, rutas académicas.
- **Aceptación / comprobación:** F10–F12; viewport con altura correcta; sin avisos de hidratación; MiniMap condicional.
- **Errores a evitar:** todos los descendientes hidden, nodeTypes dentro de render o SSR false desde Server Component.

### T021 · Zoom jerárquico — B

- **Objetivo / entradas:** controlador, snapshots y lienzo.
- **Instrucciones:** implementar máquina de sección 7; medir centro seleccionado, esperar datos preparados, animar 120+120 ms y restaurar padre. Mantener token cancelable y foco. Reduced motion duration=0.
- **Salida:** entrada/salida espacial con back consistente.
- **Dependencias:** T020.
- **Permite:** map/use-map-transition.ts, integración en workspace/canvas y pruebas navegación.
- **No tocar:** reglas de URL ni zoom manual para cambiar jerarquía.
- **Aceptación / comprobación:** F01–F05, F11; diez clics rápidos no dejan nivel/URL divergentes.
- **Errores a evitar:** setTimeout sin cancelación o overlay que sigue interceptando clics.

### T022 · Resumen de nodo y bloque — C

- **Objetivo / entradas:** containerSummary/items.
- **Instrucciones:** panel con descripción, lista real de hijos, progreso y recomendado; abrir con Ver información o detail=1. Filas navegan mediante controlador. Un solo panel contextual.
- **Salida:** estado 6 de referencias.
- **Dependencias:** T017, T021.
- **Permite:** map/container-detail-panel.tsx y estilos propios.
- **No tocar:** agregar una segunda columna simultánea de sugerencias.
- **Aceptación / comprobación:** selección de fila corresponde a tarjeta; no scroll de toda página al desplazar lista.
- **Errores a evitar:** barras calculadas en UI o listado de descendientes no pertenecientes.

### T023 · Lección y roadmap — B

- **Objetivo / entradas:** selectedLesson y progreso real.
- **Instrucciones:** crear lesson-detail-panel.tsx, activity-roadmap.tsx y lesson-resources.tsx. Mostrar pasos en orden, alternativas reales, estado omitido diferenciado, duraciones nullable y próximo paso de sección 6. No crear formatos inexistentes.
- **Salida:** panel completo en un clic de lección.
- **Dependencias:** T006, T021, T022.
- **Permite:** componentes map citados y estilos.
- **No tocar:** reglas de completado, módulos de activity-shell.
- **Aceptación / comprobación:** F01, F14; 1/8 implica un solo completado; alternativa no crea segundo paso.
- **Errores a evitar:** copiar ocho títulos fijos de la maqueta a producción o candados para 0 %.

### T024 · Lanzamiento y retorno a contexto — B

- **Objetivo / entradas:** launcher actual y sección 6.
- **Instrucciones:** extraer hook compartido manteniendo comportamiento anterior; revalidar inscripción/versión/opción antes de crear intento. Añadir returnHref validado a sesión/header/cierre. Añadir query leccion en detalle tradicional solo como foco a unit autorizada.
- **Salida:** actividad actual accesible desde mapa y retorno exacto.
- **Dependencias:** T023.
- **Permite:** activity-launcher.tsx, nuevo hook use-learning-activity-launcher.ts, activities/activity-shell.tsx y learning-completion-panel.tsx solo retorno; páginas sesiones/[attemptId] y rutas/[slug] y learning-path-screen.tsx para foco; pruebas existentes/nuevas relevantes.
- **No tocar:** grading, video coverage, manifests, queue/rewards ni endpoints de actividad.
- **Aceptación / comprobación:** F14–F17 y regresión cuatro formatos; URL maliciosa rechazada; doble clic no duplica intento.
- **Errores a evitar:** asumir que add ya inscribió o perder el origen al recargar la sesión.

### T025 · Búsqueda y agregado contextual — B

- **Objetivo / entradas:** catalog y mutations.
- **Instrucciones:** diálogo con input enfocado, debounce 200 ms, cancelar consultas viejas, tabs Todo/Bloques/Lecciones y lista paginada. Mostrar título, tipo y tema; botón + añade inmediatamente en nodo. En raíz crea wrapper con título del contenido. Crear nodo vacío usa nombre/icono.
- **Salida:** agregado con un clic desde resultado y feedback guardando/guardado.
- **Dependencias:** T009, T020.
- **Permite:** map/add-content-dialog.tsx, map/use-map-mutation.ts y estilos.
- **No tocar:** buscador global del shell ni catálogo de Biblioteca.
- **Aceptación / comprobación:** F06, S03; estados vacío/error/cargando; duplicado “Ya añadido” y cubierto “Incluido en Tórax”.
- **Errores a evitar:** modal adicional por cada + o inscripción automática.

### T026 · Menús y agrupación — B

- **Objetivo / entradas:** nodes/entries/group/remove/restore.
- **Instrucciones:** menú de nodo Renombrar/Agregar/Ver información/Quitar; contenido editorial no admite renombrado. Modo selección y Crear nodo con título obligatorio. Quitar grupo presenta descripción concreta; undo disponible 30 s. “Organizar” y “Mover” son accesibles por teclado.
- **Salida:** personalización completa.
- **Dependencias:** T008, T015, T025.
- **Permite:** map/map-item-menu.tsx, group-selection-dialog.tsx, map-selection-toolbar.tsx y estilos.
- **No tocar:** contenido académico ni acciones editoriales globales.
- **Aceptación / comprobación:** F07, F10; agrupación copia referencias, no elimina fuentes; selección deja de navegar mientras está activa.
- **Errores a evitar:** función de borrar por tecla o menú que propaga clic al nodo.

### T027 · Sugerencias y bloques incompletos — C

- **Objetivo / entradas:** suggestions response.
- **Instrucciones:** tarjetas de texto compactas con motivo y + de 44 px. Una sección de completar agrupación por nodo. Texto: “Añadiste X de Y lecciones de Tórax”; si además hay estudio confirmado, mostrarlo por separado. CTA “Completar bloque” explica que añade faltantes y agrupa.
- **Salida:** panel contextual sin segunda barra lateral.
- **Dependencias:** T009, T022, T025, T026.
- **Permite:** map/suggestions-panel.tsx, incomplete-block-notice.tsx y estilos.
- **No tocar:** recomendaciones Hoy ni progreso.
- **Aceptación / comprobación:** F08–F09; + desaparece/se actualiza al confirmar; si no hay recomendación, mensaje honesto.
- **Errores a evitar:** “has estudiado” por mera pertenencia o sugerencias aleatorias.

### T028 · Responsive y accesibilidad funcional — B

- **Objetivo / entradas:** todos los componentes y sección 9.7.
- **Instrucciones:** añadir drawer/hoja, lista equivalente, modo Organizar móvil, foco/aria/texto vivo, safe areas y scroll interno. Reutilizar hooks existentes; no aplicar focus trap a aside no modal.
- **Salida:** flujos completos sin ratón y en pantalla estrecha.
- **Dependencias:** T024, T026, T027.
- **Permite:** map/map-mobile-sheet.tsx, map/map-list-view.tsx, componentes/estilos del mapa para integración.
- **No tocar:** zoom del navegador, viewport meta global o drawer principal.
- **Aceptación / comprobación:** A01–A05 a 320/390/768/1024/1440 y zoom de texto 200 %.
- **Errores a evitar:** impedir scroll del roadmap, blanco sin salida por modal o labels reducidas por debajo de especificación.

### T029 · Fixtures de diseño y casos límite — C

- **Objetivo / entradas:** seis estados y contadores coherentes.
- **Instrucciones:** crear fixtures separados para mapa general, Anatomía, Tórax, Corazón, nodo directo, mixto, vacío, error, retirado, título largo y 200 elementos. Generar porcentajes con helper de test de contadores, no números aislados. Nueva página /visual-fixtures/mapa solo development.
- **Salida:** catálogo visual reproducible sin DB de producción.
- **Dependencias:** T002, T019; integración tras T028.
- **Permite:** map/map-visual-fixtures.ts, test asociado, app/visual-fixtures/mapa/page.tsx.
- **No tocar:** fixture anterior, semillas de base productiva.
- **Aceptación / comprobación:** contratos válidos; página 404 en producción; fixtures nunca importados por mapa real.
- **Errores a evitar:** ocultar un mock fallback dentro de una petición fallida.

### T030 · Pruebas de dominio y regresión — B

- **Objetivo / entradas:** APIs, almacenamiento, progreso y suite previa.
- **Instrucciones:** cubrir F06–F09/F13/S01–S05 con dos cuentas, versiones publicadas distintas y recibos repetidos. Ejecutar suites existentes, aislar fallos previos, comprobar equivalencia de tracking.
- **Salida:** evidencia automatizada y defectos corregidos en tarea propietaria.
- **Dependencias:** T010, T011, T024.
- **Permite:** apps/api/test/learning-map-*.test.ts, apps/web tests relacionados; correcciones mínimas devueltas al propietario de cada módulo.
- **No tocar:** reducir umbrales/desactivar pruebas anteriores.
- **Aceptación / comprobación:** suite API/web completa pasa secuencial; invariantes de progreso/recompensa mantienen resultado.
- **Errores a evitar:** llamar concurrencia real a una prueba secuencial PGlite.

### T031 · Pruebas de navegador — B

- **Objetivo / entradas:** app de preview local y fixtures.
- **Instrucciones:** añadir @playwright/test como devDependency exacta solo si no existe, registrar versión; crear playwright.config.ts y tests/e2e/learning-map.spec.ts. Fixtures validan UI; un segundo grupo usa API/DB de test para persistencia real. Probar Back/Forward, recarga, drag, zoom, modal, doble clic, cancelación y retorno desde actividad.
- **Salida:** evidencia E2E reproducible, capturas desktop/móvil y consola limpia.
- **Dependencias:** T028–T030.
- **Permite:** apps/web package, lockfile, playwright.config.ts, tests/e2e; script test:e2e.
- **No tocar:** credenciales productivas ni persistencia fake para declarar aprobado E2E real.
- **Aceptación / comprobación:** F01–F17/A01–A05; mismos IDs/coords tras recarga; no peticiones a servicio externo en fixtures.
- **Errores a evitar:** verificar solo screenshot o confiar en mocks para confirmar DB.

### T032 · Rendimiento con volumen — B

- **Objetivo / entradas:** presupuestos sección 8 y datasets 50/200/5.000.
- **Instrucciones:** medir build producción con cuenta de prueba en preview; 5 calentamientos y 30 repeticiones por escenario. Registrar mediana/p95, navegador, equipo, red, payload y número de queries. Confirmar DOM del nivel actual y onlyRenderVisibleElements a partir de 60. Corregir suscripciones/N+1 antes de añadir librerías.
- **Salida:** informe medible y perfiles.
- **Dependencias:** T031.
- **Permite:** pruebas/perfiles y componentes/proveedor del mapa afectados por medición.
- **No tocar:** bajar presupuestos para ocultar regresión ni cambiar algoritmo pedagógico.
- **Aceptación / comprobación:** P01–P04, sin animaciones perpetuas ni leak de caché al recorrer 30 niveles.
- **Errores a evitar:** medir dev/HMR como resultado final o montar 5.000 tarjetas para “probar escala”.

### T033 · Revisión visual final — C

- **Objetivo / entradas:** sección 9, imágenes originales, HTML y capturas reales.
- **Instrucciones:** comparar seis vistas a 1440×900 y móvil 390×844, además 320 px y zoom 200 %. Revisar tipografía, iconos, estados, densidad, coordenadas, foco y CTA. Documentar cada diferencia intencional respecto de las imágenes.
- **Salida:** MAPA-VALIDACION.md con captura/evidencia por fila.
- **Dependencias:** T031, T032.
- **Permite:** CSS/componentes presentacionales propios y documento de validación.
- **No tocar:** contratos o lógica para hacer coincidir un porcentaje de la referencia.
- **Aceptación / comprobación:** V01–V06 y A01–A05 sin FAIL; repetir pruebas solo si hubo cambio que afecte comportamiento.
- **Errores a evitar:** declarar pixel-perfect o validado móvil físico por emulación.

### T034 · Preview, recuperación y activación — B

- **Objetivo / entradas:** implementación verificada y permisos vigentes del ambiente.
- **Instrucciones:** preparar plan de migración aditiva, backup/restore probado en preview, roles runtime, carreras con dos conexiones PostgreSQL y smoke autenticado. Desplegar con flag apagada cuando esté autorizado; activar piloto nuevo solo tras gates. Probar desactivación de guidedLearningMap dejando guidedLearning activo.
- **Salida:** release revisable, evidencias operativas y activación si fue autorizada.
- **Dependencias:** T030–T033.
- **Permite:** nuevo MAPA-OPERACION.md y configuración de despliegue explícitamente autorizada.
- **No tocar:** flags/producción sin autoridad vigente, tablas académicas para recuperar mapa.
- **Aceptación / comprobación:** S01–S05/R01–R03 en preview, rollback a UI anterior conserva datos. Registrar dispositivo físico pendiente como NO VERIFICADO.
- **Errores a evitar:** borrar tablas al desactivar o confundir este documento de planificación con permiso de publicar.

### T035 · Handoff y cierre — C

- **Objetivo / entradas:** todos los resultados obligatorios.
- **Instrucciones:** actualizar documentos nuevos con tareas completadas, comandos, artefactos y límites. Verificar diff final, lockfile, archivos permitidos y ausencia de fixtures productivos. Separar “implementado”, “verificado en preview” y “activo en producción”.
- **Salida:** paquete que permite mantener y operar el mapa sin conocer esta conversación.
- **Dependencias:** T034.
- **Permite:** MAPA-EJECUCION.md, MAPA-VALIDACION.md, MAPA-OPERACION.md.
- **No tocar:** reescribir este plan como si una prueba no ejecutada hubiera pasado.
- **Aceptación / comprobación:** toda fila obligatoria de sección 13 tiene evidencia; ningún NO VERIFICADO se presenta como PASS.
- **Errores a evitar:** cerrar solo porque compila o porque una fase anterior tenía muchas pruebas.

### T036 · Notas privadas, opcional — B

- **Objetivo / entradas:** deseo de notas del panel, solo si se incorpora expresamente al alcance.
- **Instrucciones:** tabla aditiva learning_map_notes(user_id,path_id,unit_stable_key,text,row_version,updated_at), UNIQUE de esas tres identidades; texto plano 20.000 caracteres; misma política runtime/propietario. GET/PATCH notes con expectedVersion/idempotencia; autosave 800 ms y error visible; resolver misma nota desde varias ocurrencias.
- **Salida:** pestaña Notas completa con sincronización y conflictos.
- **Dependencias:** T023, T030; requiere nueva migración posterior al mapa.
- **Permite:** contratos/rutas/proveedor del mapa, nueva migración, map/lesson-notes.tsx, pruebas correspondientes.
- **No tocar:** documento académico ni contenido compartido, almacenamiento HTML libre.
- **Aceptación / comprobación:** otra cuenta no lee nota; recarga conserva texto; conflicto no borra borrador; funcionamiento sin nota vacía inventada.
- **Errores a evitar:** enseñar tab sin persistencia o mezclar notas del usuario con explicación médica oficial.

## 12. Orden de ejecución y trabajo paralelo futuro

~~~text
T001 → T002 → T003 → T004 → T005
                         ├→ T006 ─────────┐
                         └→ T007 → T008 → T009 → T010 → T011 → T012 → T013
T002 → T016                                               T013 → T014 → T015
T002 → T017 → T018 → T019 → T029
T014 + T015 + T016 + T019 → T020 → T021 → T022 → T023 → T024
T009 + T020 → T025 → T026
T009 + T022 + T025 + T026 → T027
T024 + T026 + T027 → T028
T010 + T011 + T024 → T030
T028 + T029 + T030 → T031 → T032 → T033 → T034 → T035
~~~

T010 también espera T006; T014 espera T011; T026 espera T008/T015; T034 espera T030. El diagrama es orientativo; la lista de dependencias de cada tarea es autoridad.

Paralelizable si el responsable decide delegar en una ejecución futura:

- Tras T002: datos T003–T009, layout puro T016 y visual T017–T019.
- Tras T005: agregación T006 y mutaciones T007 pueden avanzar con archivos separados.
- T029 puede preparar datos mientras se integra mapa; su verificación visual espera T028.
- Durante la UI se puede completar cobertura backend T030, pero su cierre espera launcher T024.

Un único responsable integra index.ts, app.ts, package.json, pnpm-lock.yaml, database.ts y el catch-all. No dos modelos editando esos archivos a la vez. La identificación de tareas paralelas no ordena iniciar agentes durante esta entrega de planificación.

## 13. Definición de terminado, pruebas y control de calidad

La implementación obligatoria está terminada cuando T001–T035 concluyen y los criterios aplicables a ese hito están en PASS con evidencia. Un build correcto no sustituye pruebas de persistencia, permisos, recorrido real y revisión visual.

**Hito local:** contratos, migración/harness, funcionalidad, E2E local, visual y regresión. **Hito preview:** además PostgreSQL real, concurrencia, rendimiento y recuperación. **Hito producción:** además autorización/activación y smoke del ambiente. Un NO VERIFICADO externo no impide entregar código local, pero impide declarar comprobado ese hito externo.

### Matriz mecánica

Cada fila debe contestarse PASS / FAIL / NO VERIFICADO y adjuntar archivo de prueba, captura o registro; no llenar por deducción.

| ID | Acción / escenario | Resultado exigido | Método |
| --- | --- | --- | --- |
| F01 | Root → Anatomía → Tórax → Corazón → actividad → regresar | Niveles correctos, panel en un clic, misma selección al volver | E2E con API test + captura. |
| F02 | Abrir URL de bloque y lección en pestaña nueva | Mismo contexto sin navegación previa | E2E real. |
| F03 | Usar Back/Forward 5 veces y breadcrumbs | URL, cabecera, panel y contenido coinciden; sin duplicación de historial | E2E. |
| F04 | Mover tarjeta, pan/zoom, entrar/salir y recargar | Misma posición con tolerancia ≤1 unidad de Flow; zoom ≤0,01 de diferencia en igual contenedor | E2E + datos DB. |
| F05 | Deep link eliminado/ajeno, cerrar panel desde enlace directo | Error seguro con salida al mapa; cerrar va al padre, no fuera del sitio | API + E2E. |
| F06 | Añadir bloque, lección, duplicado y contenido cubierto | Una ref correcta; sin inscripción implícita; + confirma estado o revierte | API + UI. |
| F07 | Grupo mixto, renombrar, quitar y deshacer | Refs canónicas, origen intacto, datos académicos intactos | API + DB. |
| F08 | Dos lecciones de un bloque, Complete-block | Denominador/conteo cambia por nueva cobertura; no se marcan pasos completados | API + UI. |
| F09 | Cambiar root/nodo/bloque/lección en sugerencias | Candidatos y motivo corresponden a metadatos del contexto | Prueba determinista. |
| F10 | Drag, click, menú, selección múltiple y mover con flechas | Cada gesto cumple su acción y no dispara otra | Navegador mouse/táctil/teclado. |
| F11 | Zoom manual, doble clic, clic rápido de navegación y reduced motion | Zoom no cambia nivel; no respuesta obsoleta; sin animación con preferencia reducida | E2E y media query. |
| F12 | Añadir nodo a un nivel organizado | Todas las coordenadas existentes idénticas; edges siguen extremos | Test puro + E2E. |
| F13 | 1/8; 199/200; 0/0; duplicación de bloque/lección | 13; 99; null/empty; unión sin doble conteo | Tests de progreso. |
| F14 | Actividad alternativa, omitida, opcional, finalizada | Roadmap conserva semántica actual y CTA apunta a opción válida | API + 4 formatos. |
| F15 | Error de progreso y retiro/upgrade de versión | null/error visible; no falsa finalización ni cambio silencioso de lección | API + UI. |
| F16 | Dos pestañas editan posiciones y una respuesta se pierde | 409 recuperable; retry idempotente; borrador reciente conservado | PostgreSQL dos conexiones + E2E. |
| F17 | Crear/reanudar desde panel y completar dos veces | Un intento compatible, progreso y premios según política existente, regreso válido | Integración + regresión. |
| V01 | Comparar seis estados con referencias | Misma gramática visual, shell único, jerarquía legible | Capturas 1440×900/390×844. |
| V02 | Estados 0/13/100 | Tarjeta neutra, etiqueta correcta, seleccionado independiente | Inspección + assert texto. |
| V03 | Tipografía, márgenes, iconos y títulos largos | Tokens sección 9, sin texto cortado esencial ni solapamientos | Medición DOM + captura. |
| V04 | Botón CTA y contraste | Texto ≥4,5:1; foco/controles ≥3:1; acción principal visible | Cálculo de color + inspección. |
| V05 | Zoom/fit/MiniMap | Controles propios, porcentaje real, MiniMap solo bajo condición | E2E. |
| V06 | Vacío, error, cargando y guardando | Mensaje preciso y acción de salida/retry; sin datos ficticios | Fixtures + red fallida. |
| A01 | Tab/Enter/Escape/flechas en flujo completo | Foco visible, orden lógico, ningún bloqueo | Manual + E2E teclado. |
| A02 | Drawer/hoja móvil y panel desktop | Foco atrapado solo en modal; retorno al origen; scroll correcto | Manual + E2E. |
| A03 | 320–1440 px y texto 200 % | Sin scroll horizontal de documento; lista equivalente conserva acciones; mapa puede tener pan | Capturas/medición. |
| A04 | Objetivos táctiles y safe areas | Botones ≥44 px, CTA no tapado, drag solo en modo previsto | DOM + teléfono. |
| A05 | Lector de pantalla y reduced motion | Nombre/estado anunciado; detalle accesible; transición sin movimiento si se solicita | Lector real + media query. |
| P01 | Dataset 5.000 refs, nivel 200 | Solo nivel actual en DOM; datos sin manifests/medios; máximo caché especificado | Perfil DOM/network. |
| P02 | 30 transiciones preparadas tras 5 warmups | p95 ≤350 ms y sin overlay residual | Marcas Performance API. |
| P03 | 30 lecturas API con volumen representativo | p95 ≤500 ms; consultas por lotes sin N+1 por ocurrencia | Logs sin PII + contador de consultas. |
| P04 | Drag/pan y 30 niveles alternados | Handler p95 ≤50 ms, panel no rerender por pixel, caché acotada | Performance/React profiler. |
| S01 | Cuenta A usa IDs de B en todos los endpoints | Sin lectura/escritura ajena; respuesta segura uniforme | Tests parametrizados. |
| S02 | Runtime/anon/authenticated y tablas nuevas | Runtime previsto, RLS activa, Data API sin grants | SQL preview con roles reales. |
| S03 | Payloads extras, URL de retorno maliciosa y origen externo | Rechazo, sin open redirect ni acceso a paths arbitrarios | Contratos + BFF + E2E. |
| S04 | Prefetch/detalle/búsqueda/error | Caché privada, sin soluciones, URLs firmadas ni datos sensibles en logs | Inspección de DTO/logs. |
| S05 | Cierre/cambio de cuenta y sessionStorage corrupto | No contexto privado de otra cuenta; fallback seguro | Navegador real. |
| R01 | Flags apagadas, rutas antiguas y sesiones actuales | UI anterior funcional y APIs nuevas cerradas | Regresión. |
| R02 | Migración desde estado previo y restore preview | Sin pérdida académica, restricciones aplicadas y rollback de UI viable | Backup/restauración y consultas. |
| R03 | Suite completa y diff final | Sin fallos nuevos, archivos ajenos intactos, fixtures no públicos | Comandos + revisión. |

### Comandos de comprobación

Desde la raíz, ejecutar uno después de otro. No ejecutar builds/typecheck y PGlite simultáneamente: el historial del proyecto ya registra timeouts bajo competencia de recursos.

~~~powershell
pnpm --filter @cediah/contracts build
pnpm --filter @cediah/api test
pnpm --filter @cediah/web test
pnpm lint
pnpm typecheck
pnpm build
git diff --check
~~~

Después de T031, añadir el script test:e2e al paquete web y ejecutar:

~~~powershell
pnpm --filter @cediah/web test:e2e
~~~

La instalación/configuración de navegadores queda en T031; el comando no existe todavía. Los tests de fixture usan desarrollo porque su ruta se bloquea en producción; rendimiento y pruebas contra datos reales usan build de preview. Mantener estos dos proyectos/configuraciones diferenciados.

Validar cambios de dependencia mediante el audit del proyecto y registrar hallazgos previos/nuevos; no actualizar paquetes ajenos para “limpiar” un problema sin relación. Las pruebas se amplían o repiten cuando cambios/fallos lo justifiquen, no para acumular recuentos.

## 14. Escalamiento y recuperación

### Decisiones autónomas del ejecutor

Ajustar hasta 4 px un espaciado para evitar clipping, corregir labels/aria, elegir una celda libre según algoritmo, corregir tipos, añadir tests de un caso real, reintentar una lectura transitoria y adaptar un import a la API tipada de la versión fijada. Registrar toda divergencia visual material.

No escalar un error de TypeScript, un acento en el buscador, una propiedad renombrada del paquete o un fallo de foco que se resuelva dentro de los contratos establecidos.

### Escalar esa tarea a capacidad A

| Disparador verificable | Entregar al modelo A | Trabajo que continúa |
| --- | --- | --- |
| Una lección no tiene stableKey única o no se puede mapear a unidad existente sin perder significado | Caso mínimo, filas/DTO anonimizados, versiones afectadas y alternativas de mapping | Componentes y contratos no afectados. |
| La solución exige cambiar progreso, identidad de intento, equivalencia entre versiones o reglas de recompensa | Test que demuestra incompatibilidad y diff mínimo propuesto | Layout, iconos, fixtures y endpoints de lectura independientes. |
| Hay lectura/escritura entre cuentas o bypass de autorización | Endpoint, test reproducible con cuentas de prueba, impacto | Trabajo visual; bloquear activación del mapa. |
| Después de dos correcciones localizadas el historial/animación sigue dejando URL y nivel divergentes | Secuencia exacta, trace y controlador aislado | Persistencia y paneles independientes. |
| Presupuestos siguen fallando tras quitar N+1, acotar DOM y separar suscripciones | Perfil con cuello de botella y mediciones antes/después | QA de funciones correctas; no bajar el objetivo unilateralmente. |
| Migración requiere reescribir tablas académicas o pierde integridad existente | Ensayo local, constraints afectadas, plan de reversión | UI sobre fixtures. |

Pedir al usuario solo una decisión de producto que cambie alcance o una autorización de ambiente que efectivamente falte. No repetir permisos ya otorgados. No presentar una habilidad/guía genérica como bloqueo si el trabajo ya está autorizado.

### Recuperación paso a paso

- **Falla una tarea:** conservar cambios de otras tareas; reproducir el fallo mínimo; corregir dentro de su allowlist; repetir la prueba afectada y luego las dependientes. No reiniciar el proyecto.
- **Falta catálogo real:** marcar NO VERIFICADO; usar fixtures aislados. No publicar ni afirmar que Anatomía/Tórax están disponibles.
- **Fuentes se contradicen:** aplicar sección 10 y registrar hecho/propuesta. Si es cambio de semántica académica, escalar solo el mapping.
- **Falla una prueba anterior:** comparar con T001; si es regresión, corregir antes de seguir con tareas dependientes. No desactivar test ni atribuirlo a baseline sin evidencia.
- **Se rompe una pantalla existente:** apagar bandera de mapa en ambiente de prueba, revertir solo el cambio causante y verificar ruta antigua; conservar datos nuevos para diagnóstico.
- **Fracasa una migración:** transacción rollback; no editar migración aplicada. Si ya fue aplicada, nueva migración correctiva aditiva después de ensayo.
- **Se pierde una respuesta:** misma clave idempotente y payload; obtener estado confirmado antes de generar otra operación.
- **Conflicto de dos pestañas:** mantener borrador, leer versión actual y pedir elección concreta de posiciones; jamás overwrite silencioso.
- **Falla al completar bloque:** transacción completa revierte; las refs sueltas permanecen. No borrar primero y añadir después en peticiones distintas.
- **Rollback de producto:** guidedLearningMap=false, guidedLearning permanece como estaba. Ocultar entrada nueva y servir UI previa; no borrar mapas, inscripciones, intentos ni notas.

## 15. === HANDOFF PARA MODELO EJECUTOR ===

### Misión

Implementa el mapa espacial de Aprendizaje guiado descrito en este documento. Es una ampliación de la aplicación existente KORAS en D:/Jose (Datos)/Medicina/CEDIAH/Web, no una aplicación nueva. Este documento contiene decisiones, contratos, tareas y criterios; no necesitas haber participado en la conversación. Los PNG y el HTML de referencias-mapa ilustran el diseño; los contratos y fórmulas del Markdown prevalecen.

### Base técnica que debes conservar

Monorepo pnpm 11.9.0, Node 24.x, Next.js 16.2.12, React 19.2.8, Fastify 5.11.0, Better Auth, Kysely/PostgreSQL, Zod y Vitest. Verifica el manifiesto en T001 por si cambió después del corte. @xyflow/react será la única dependencia nueva obligatoria de producción; fijar versión compatible 12.x. Phosphor y Plus Jakarta Sans locales ya existen.

Autorización: navegador → BFF Next → Fastify → PostgreSQL. Supabase solo hospeda infraestructura en la arquitectura actual; no añadir Supabase Auth ni Data API. Migraciones activas en database/migrations, hasta 0015 en el corte inspeccionado. No modificar historia aplicada.

Archivos existentes que debes leer antes de integrar:

~~~text
packages/contracts/src/guided-learning.ts
packages/contracts/src/index.ts
apps/api/src/guided-learning/http.ts
apps/api/src/guided-learning/authorization.ts
apps/api/src/guided-learning/mutation-receipt.ts
apps/api/src/providers/postgres-guided-learning.ts
apps/api/src/providers/postgres-learning-activities.ts
apps/api/src/db/database.ts
apps/api/test/guided-learning-catalog.test.ts
apps/web/src/app/aprendizaje/page.tsx
apps/web/src/components/learning/learning-path-screen.tsx
apps/web/src/components/learning/activity-launcher.tsx
apps/web/src/components/learning/activities/activity-shell.tsx
apps/web/src/app/api/guided-learning/[...path]/route.ts
apps/web/src/lib/server/guided-learning-route.ts
apps/web/src/components/platform-frame.tsx
apps/web/src/components/app-shell.tsx
apps/web/src/app/platform-chrome.css
apps/web/src/app/koras-theme.css
~~~

### Correspondencia de dominio innegociable

Mapa privado → nodo personal → bloque (LearningPath) → lección (LearningPathUnit por stableKey) → actividad (LearningPathStep con opciones existentes). Un nodo admite blockRef y lessonRef mezclados. Una lección puede aparecer directamente sin bloque intermedio. No renombrar las entidades académicas para acomodar el lenguaje visual.

Las referencias se resuelven a la versión fijada en inscripción; sin inscripción a la publicada. La identidad es pathId + stableKey, no UUID temporal ni título. Quitar del mapa no borra progreso. Añadir no inscribe. Comenzar/reanudar utiliza acciones e idempotencia existentes.

### Contratos funcionales mínimos

Persistir cuatro tablas: learning_maps, learning_map_nodes, learning_map_entries, learning_map_layouts. Estructura con row_version propio, layout con versión independiente; propietario derivado de sesión. Aplicar sección 5 literalmente para columnas, límites, endpoints y errores.

API nueva bajo /v1/guided-learning/map; BFF bajo /api/guided-learning/map. Lecturas summary/level/catalog/suggestions; escrituras ensure/nodes/entries/group/complete-block/remove/restore/layout. No GET con efectos. POST/PATCH con Idempotency-Key y validación estricta. Reutilizar receipts, sin alterar tracking.

Progreso = unión de pasos esenciales por path/version/step. C/T confirmado por servidor, round, cap99 hasta totalidad; empty/unavailable usan null. No medias de porcentajes ni datos visuales hardcodeados.

### Interacción y estética obligatorias

Un workspace persistente y un lienzo React Flow. Clic de nodo o bloque entra con 120+120 ms; clic de lección abre panel derecho. El botón del panel empieza una actividad real. Back restaura encuadre y selección; pinch/rueda solo cambia zoom manual.

URL base /aprendizaje/mapa con node, item, unit; construir mediante URLSearchParams y validar ascendencia. History API dentro de la misma ruta; nuevo enlace funciona tras refrescar. Viewport/sessionStorage por cuenta y pestaña; posiciones/estructura en PostgreSQL.

Blanco y marfil #FAF7F2; iconos #0F3D32; seleccionado con borde #C75A3A; estado en etiquetas suaves. Tipografía Plus Jakarta Sans, títulos de tarjeta 14 px, cuerpo 14 px. Nodo general 168×184; bloque/lección 156×172; gaps 56×64. SVG médicos consistentes, Phosphor en controles. No hero degradado, tarjeta completamente coloreada, candado de no iniciado ni conexiones ficticias.

Panel desktop de 344 px cuando cabe; drawer intermedio y hoja modal móvil. Roadmap de una columna; CTA ≥44 px. Teclado, lector, reduced motion, lista equivalente y reflujo a 200 % son parte del resultado.

### Orden y cierre

Empieza por T001 y T002. Sigue dependencias de T003–T035. T036 es opcional y no justifica pestañas sin función. Los contratos se cierran antes de implementar consumidor/proveedor; integraciones de archivos compartidos tienen un solo responsable.

Antes de cualquier edición vuelve a comprobar git status: ya había cambios ajenos en ESTADO.md, OPERACION.md y VALIDACION.md. No los reviertas. No instales dependencias ni despliegues como parte de leer este plan: esas acciones pertenecen a las tareas de implementación correspondientes y a su autorización.

Registra por tarea objetivo cumplido, archivos y evidencia en MAPA-EJECUCION.md. Usa literalmente PASS/FAIL/NO VERIFICADO en sección 13 y en MAPA-VALIDACION.md. Ejecuta contratos, API test, web test, lint, typecheck, build y diff --check secuencialmente; después E2E. No declares que fixtures prueban persistencia real.

No cierres con “funciona” si falta retorno al mapa, URLs, guardado, grupo mixto, errores o validación visual. Entrega código, pruebas, capturas, limitaciones y procedimiento de flag/rollback. El cierre local, preview y producción son hitos distintos; identifica cuál se completó.
