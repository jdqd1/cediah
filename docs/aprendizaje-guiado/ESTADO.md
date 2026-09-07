# Estado de implementación de Aprendizaje guiado

Última actualización: 7 de septiembre de 2026.

## Resumen

| Fase | Estado | Evidencia principal | Siguiente acción |
| --- | --- | --- | --- |
| 0. Verificación y preparación | Completa | Bandera servidor→UI; baseline, inventario y límites registrados | — |
| 1. Identidad y revisiones | Completa | Migración `0009`; resolver/adaptadores; T14–T16 y filtrado exclusivo cubiertos | — |
| 2. Catálogo y editor | Completa en desarrollo local | Migración `0010`; workflow, catálogo, inscripción, editor y preview persistentes | — |
| 3. Intentos y progreso | Completa en desarrollo local | Migración `0011`; cuatro formatos, reanudación, idempotencia, progreso de servidor y Biblioteca; API 126/126, web 76/76 | — |
| 4. Evidencia y recomendaciones | Completa en desarrollo local | Migración `0012`; evidencia, scheduler, repaso mixto e Inicio explicable; API 144/144, web 77/77 | — |
| 5. Experiencia visual | Completa en desarrollo local | Migración `0013`; Inicio, Hoy, progreso, mapa vertical, cierre, XP/hitos y fixtures visuales; API 145/145, web 79/79 | — |
| 6. Actualizaciones editoriales | Completa en desarrollo local | Preview/upgrade explícito, historial y mappings; catálogo editorial paginado, retiro seguro y adaptador extensible; API 151/151, web 79/79 | — |
| 7. Validación y lanzamiento | Esquema de producción listo; activación bloqueada | `0014`–`0015`, telemetría privada, 15 checksums, RLS/grants y advisors verificados en PostgreSQL 17.6 | Desplegar con bandera apagada y completar smoke/concurrencia/piloto |

## Fase 0 — Verificación y preparación

### Contraste con el repositorio

- Stack confirmado: Next.js 16.2.12/React 19.2.8, Fastify 5.11.0, Better Auth 1.7.2, Kysely 0.29.5 y PostgreSQL.
- La fuente activa de migraciones termina en `0008_content_reactions.sql`; `supabase/migrations` es legado.
- El repositorio estaba limpio al iniciar. No se detectó `AGENTS.md` aplicable ni cambios ajenos sin confirmar.
- La API concentra las rutas en `apps/api/src/app.ts` y resuelve la sesión en cada endpoint. El nuevo módulo se registrará por inyección como los proveedores existentes.
- La web usa App Router, `AuthenticatedAppLayout`, BFF de mismo origen y un shell persistente. `/aprendizaje` debe añadirse a `isPlatformPath`; la capacidad visual se deriva de `/v1/auth/me`.
- Las prácticas anexas se proyectan desde la guía canónica, pero las preguntas se identifican hoy por posición/texto y la corrección del reproductor existente ocurre en cliente.
- El progreso de cursos conserva su semántica de `watched_seconds`; no se reutilizará para rutas multimaterial.

### Cambios de preparación

- `GUIDED_LEARNING_ENABLED` se valida en configuración de API y permanece `false` por defecto.
- `/v1/auth/me` expone `features.guidedLearning`, derivado exclusivamente de configuración del servidor.
- El shell solo prepara las entradas de estudiante/editor cuando esa capacidad confirmada está activa.
- Los archivos `.env.example` documentan la bandera apagada. No se añadió una variable pública ni se confió en el navegador como autoridad.

### Inventario

Véase `INVENTARIO.md`. La fuente disponible es el snapshot de la migración histórica, no una consulta actual. No se eligió una ruta piloto publicable porque no hay tema estable ni banco/materiales suficientes revisados.

### Línea base antes de cambios funcionales

- `pnpm --filter @cediah/contracts build`: correcto.
- `pnpm --filter @cediah/api test`: 14 archivos, 99 pruebas correctas.
- `pnpm --filter @cediah/web test`: 15 archivos, 66 pruebas correctas.
- `pnpm lint`: correcto.
- `pnpm typecheck`: correcto.
- `pnpm build`: correcto; 20 páginas generadas.
- `pnpm audit --audit-level high`: falla previo a esta implementación con 11 vulnerabilidades transitivas (8 altas, 3 moderadas) en `fast-uri`, arrastradas por Fastify/Ajv. Se registró como baseline y no se atribuye a Aprendizaje guiado.

### Limitaciones demostradas

- `DATABASE_URL` no está definida, no existe `.env` local para la API y `http://127.0.0.1:4000/health` no responde. No es seguro ni posible obtener inventario del catálogo actual o aplicar migraciones externas desde este workspace.
- No hay revisión académica ni cuenta/coordinación disponible en el repositorio. Los fixtures automáticos solo se usarán en pruebas y nunca como publicación de lanzamiento.
- Las comprobaciones de PostgreSQL real, navegador móvil físico, respaldo/restore y preview corresponden a fase 7 y requieren ambientes externos explícitos.

## Decisiones vigentes

- Las recomendaciones V1 serán deterministas y explicables; no se incorporarán IA, vectores, cron ni microservicios.
- Progreso, corrección, prioridad, XP y autorización serán autoridad de Fastify/PostgreSQL.
- La apertura manual de actividades accesibles no dependerá de prerrequisitos académicos.
- IDs canónicos se persistirán antes de seguimiento; nunca se generarán UUID efímeros en lectura.
- `catalog_visibility = guided_only` se filtrará en todos los caminos genéricos y solo se resolverá dentro del dominio autorizado.

## Fase 1 — Identidad y revisiones de material

### Comportamiento implementado

- `0009_learning_content_identity.sql` añade `catalog_visibility`, hace backfill idempotente de UUID de preguntas/opciones/tarjetas y crea `learning_resources`, `learning_items` y revisiones de recurso inmutables.
- El resolver canónico fija la publicación y proyección (`video`, `guide`, `quiz` o `flashcards`), reutiliza el ID real de cada pregunta al proyectarla y reutiliza un snapshot cuando el hash SHA-256 canónico no cambió.
- Los DTO de ejecución pública eliminan respuestas correctas, explicaciones pendientes y reversos de tarjetas antes de llegar al estudiante.
- Todos los caminos genéricos del catálogo, búsquedas, reacciones, vistas y asignaturas excluyen `guided_only`; el resolver privilegiado solo se usa desde el dominio guiado autorizado.
- Los editores preservan `id`, `optionIds` y `memoryVersion`. Una escritura posterior que omite o duplica identidades se rechaza; reordenar conserva memoria y cambiar sustancialmente pregunta/respuesta/tarjeta incrementa `memoryVersion` en servidor.
- La conversión pregunta→flashcard conserva la identidad canónica, por lo que no crea evidencia duplicada.

### Evidencia

- Pruebas PGlite demuestran que el backfill conserva texto, respuesta y orden, incrementa una sola versión y es idempotente.
- Pruebas de proveedor demuestran revisión inmutable/reutilizable, hash verificado, DTO sin solución y ocultamiento de material exclusivo.
- Pruebas de contrato cubren T14, T15 y T16: proyección compartida, reordenación sin pérdida y nueva versión de memoria al cambiar significado/respuesta.

## Fase 2 — Catálogo y editor de rutas

### Comportamiento implementado

- `0010_guided_learning_catalog.sql` crea rutas, versiones, unidades, pasos, alternativas, inscripciones y pertenencia histórica a versiones con claves compuestas, restricciones, triggers de inmutabilidad, grants y RLS.
- Fastify ofrece catálogo/detalle autenticados, inscripción idempotente fijada a versión, pausa/reanudación optimista y endpoints editoriales separados por capacidades.
- El validador comprueba estructura, claves estables, objetivo/mapping, alternativas, opción predeterminada, DAG orientativo, cobertura de comprensión/recuperación y banco mínimo. Las referencias se resuelven y congelan antes de guardar/publicar.
- El workflow `draft → in_review → approved → published` exige validación y capacidades; publicar solicita confirmación explícita y la versión publicada queda inmutable. Los fixtures académicos son ficticios y viven solo en pruebas.
- Next.js incorpora `/aprendizaje`, catálogo, detalle con todas las unidades abiertas libremente, inscripción/pausa reales y BFF de mismo origen. No presenta porcentajes que aún no existan.
- `/panel/rutas` permite construir estructura con publicaciones reales, elegir alternativas/proyección/recomendación, guardar en PostgreSQL, validar, revisar, aprobar y publicar. Preview editorial no crea tracking.
- La capa visual es móvil primero: targets táctiles ≥44 px, reflujo, foco visible, barra de guardado segura, pestañas compactas, estados vacío/error y movimiento reducido.

### Evidencia

- `guided-learning-catalog.test.ts`: ruta ficticia completa con cuatro formatos y alternativa video/guía; publicación válida, rechazo por referencia/cobertura insuficiente, T02, inmutabilidad, RLS y T30.
- `guided-learning-routes.test.ts`: bandera apagada sin consultas, 401, caché privada, payload estricto sin `userId`, permisos editoriales y preview sin mutación.
- 5 de septiembre de 2026: `pnpm --filter @cediah/api test` — 18 archivos, 120 pruebas correctas.
- 5 de septiembre de 2026: `pnpm --filter @cediah/web test` — 15 archivos, 66 pruebas correctas.
- 5 de septiembre de 2026: contratos, typecheck y lint de API/web correctos después del editor.

### Limitaciones que no bloquean el trabajo local siguiente

- El paquete local `ui-ux-pro-max` no contiene el `scripts/search.py` indicado por su propia guía (los directorios `scripts` y `data` están vacíos). Se aplicó manualmente su checklist; la comprobación visual automatizada por ese script no está disponible.
- PGlite prueba DDL y lógica transaccional local, pero no sustituye PostgreSQL administrado con el rol runtime real. Queda como requisito de Fase 7.
- El selector editorial usa las primeras 200 publicaciones ya expuestas por el workspace; búsqueda paginada y operación de retiro corresponden a Fase 6.
- No se publicó ninguna ruta ni material académico real: falta inventario conectado y revisión académica.

## Fase 3 — Intentos y progreso reales

### Comportamiento implementado

- `0011_guided_learning_attempts.sql` añade intentos con manifest fijo, respuestas append-only, progreso por paso, recibos idempotentes y eventos con clave semántica única. El contexto y el manifest no pueden reescribirse desde SQL.
- Fastify crea y recupera intentos solo para la identidad de Better Auth y la inscripción activa fijada. Todas las mutaciones usan `Idempotency-Key`, hash canónico del payload y `rowVersion`; misma clave/mismo payload reproduce el resultado y una clave reutilizada con otro payload falla sin segunda escritura.
- El cuestionario se corrige exclusivamente en servidor y no entrega soluciones futuras. Las flashcards requieren revelar en servidor antes de calificarse. Guía y video externo exigen confirmación explícita; el video nativo acumula rangos reproducidos y saltar al final no satisface cobertura.
- Las reglas de cierre son específicas del formato. Completar una alternativa guía/video actualiza una sola fila del paso y no duplica el porcentaje. El porcentaje queda en 99 mientras falte cualquier paso esencial y solo llega a 100 con todos ellos completos.
- Next.js ofrece sesiones reanudables para los cuatro formatos, estados de guardado honestos y un panel final conectado al resumen persistido. Una falla al cargar progreso no abre un intento nuevo ni presenta cero como dato.
- La cola IndexedDB conserva cuerpo, cuenta y clave idempotente. Solo denomina `pendiente` a una escritura que realmente quedó persistida, separa claves locales por usuario y vuelve a enviar con la misma clave; el cambio confirmado por servidor prevalece aunque falle la limpieza local.
- Biblioteca muestra, sin reemplazar la práctica libre, accesos de “práctica con seguimiento” únicamente para rutas activas con coincidencia exacta de recurso, proyección, versión de contenido y revisión vigente. Una revisión nueva retira el acceso contextual hasta que exista una equivalencia válida.
- Los videos nativos solicitan una URL privada corta desde el intento autorizado; la URL firmada no se almacena en manifest, respuesta ni recibo. Un recurso retirado o una cuenta ajena no obtiene el archivo.

### Evidencia

- `guided-learning-catalog.test.ts` cubre T03–T08 y T10–T12: acceso a última unidad, alternativa contada una vez, cuestionario fallado y persistido, recarga, replay/conflicto idempotente, revelado de tarjetas y finalización explícita. También comprueba una sola respuesta/evento, manifest/respuestas inmutables y aislamiento de usuario.
- La misma suite demuestra integración estricta de Biblioteca: una ruta pausada o una cuenta no inscrita no ofrece seguimiento, y una revisión posterior no fijada invalida el enlace de equivalencia.
- `guided-learning-routes.test.ts` exige sesión, payload estricto sin `userId`, UUID idempotente, autorización de media y cache privada; los errores estables se resuelven antes de invocar el proveedor.
- `learning-mutation-queue.test.ts` fija la política de reintentos y la partición por cuenta que soportan T22–T23. La deduplicación decisiva se vuelve a verificar contra PostgreSQL/PGlite mediante recibos.
- 6 de septiembre de 2026: `pnpm --filter @cediah/api test` — 18 archivos, 126 pruebas correctas.
- 6 de septiembre de 2026: `pnpm --filter @cediah/web test` — 16 archivos, 76 pruebas correctas.
- 6 de septiembre de 2026: contratos, typecheck y lint de API/web correctos.

### Limitaciones que pasan a validación

- PGlite verifica restricciones, triggers y transacciones, pero no demuestra todavía carreras reales con dos conexiones PostgreSQL ni los grants del usuario runtime administrado. T09/T25 y esa parte de autorización requieren PostgreSQL real en fase 7.
- La política de cola y su aislamiento tienen pruebas unitarias; la caída física de red, cierre/reapertura del navegador e IndexedDB de Safari/Chrome quedan para QA de navegador. No se afirma aún compatibilidad móvil ejecutada.
- La firma S3 reutiliza el proveedor privado ya probado por separado; falta ejecutar expiración/reautorización contra el bucket de preview. No se usaron credenciales ni objetos de producción.
- La UI funcional ya es móvil primero, pero capturas sistemáticas, zoom 200 %, lector de pantalla y matriz de anchos pertenecen a las fases 5 y 7.

## Fase 4 — Evidencia, repasos y recomendaciones

### Comportamiento implementado

- `0012_guided_learning_evidence.sql` amplía los intentos con contexto global de repaso y añade `learning_review_states`, `learning_objective_progress`, `learning_preferences` y `learning_task_overrides`. Las tablas son privadas, tienen restricciones, índices, RLS y grants mínimos para `cediah_runtime`.
- `scheduler-v1` conserva memoria global por usuario, ítem canónico y `memoryVersion`, con intervalos `[1, 3, 7, 14, 30]`, cuatro valoraciones y hasta dos reapariciones de diez minutos antes de pasar a un día. Las fechas se calculan desde el reloj aceptado por servidor y se guardan en UTC.
- Las sesiones de 5 minutos congelan hasta 5 ítems y las de 10/20 hasta 10. Mezclan preguntas y tarjetas cuando ambas proyecciones existen, alternan unidades dentro de cada prioridad y deduplican el mismo ítem canónico aunque aparezca en varias rutas o formatos.
- Cada respuesta de repaso incluye la versión esperada del estado de memoria. Dos manifests abiertos pueden guardar su respuesta, pero solo el primero que conserva la versión aplica calendario y evento; el segundo recibe el estado vigente con `scheduleApplied=false`. El orden de bloqueo es estable y no se realizan llamadas externas dentro de la transacción.
- La evidencia de objetivo se recalcula desde comprobaciones finalizadas de cuestionario, usando solo la primera ronda calificable. Distingue `unassessed`, `practicing`, `developing` y `consolidated`, conserva estado histórico, marca repaso recomendado tras 30 días y no concede Consolidado con banco menor de cinco preguntas.
- Avance y evidencia permanecen separados: tarjetas, repasos, reintentos y tiempo visto no completan pasos ni inflan dominio. Un repaso actualiza la fecha de evidencia de todas las inscripciones activas realmente representadas por ese ítem compartido.
- `GET /v1/guided-learning/home` devuelve progreso confirmado, contadores, constancia, política y una cola lexicográfica con razones visibles. Filtra rutas pausadas/archivadas, fuentes no publicadas o retiradas, pasos omitidos y overrides vigentes; prioriza repaso/refuerzo importante, reanudación, siguiente paso y exploración con los desempates documentados.
- Inicio agrega los repasos como una sesión manejable sin ocultar el total pendiente. La selección mostrada y la que congela el servidor son idénticas para ese reloj y preferencia. Las primeras tres tareas se presentan primero en móvil y la persona puede desplegar el resto, abrir cualquier ruta o elegir otra actividad.
- Posponer u omitir una sugerencia persiste en PostgreSQL por clave estable y no cambia `next_due_at`. “Más tarde” admite hoy, mañana o fecha elegida. Omitir/restaurar un paso usa control optimista y nunca aumenta el porcentaje.
- Las preferencias de duración se aplican de inmediato; zona IANA y meta semanal cambian el lunes local siguiente. Los días activos se derivan de pasos realmente completados o repasos aplicados, no de sesiones abiertas. La pantalla de repaso permite elegir libremente 5, 10 o 20 minutos.
- Fastify y el BFF validan payloads estrictos, identidad Better Auth, `Idempotency-Key` y caché privada. Un fallo de `/home` se expone como estado recuperable/503 y la web no lo convierte en ceros ni recomendaciones ficticias.
- La práctica desde Biblioteca conserva la equivalencia estricta de fase 3. Las revisiones usan el mismo ID canónico y no crean evidencia duplicada al alternar cuestionario y flashcard.

### Evidencia

- `guided-learning-catalog.test.ts` aplica las migraciones `0001`–`0012` desde una base PGlite vacía y cubre una ruta relacional ficticia completa. La fase 4 verifica T09, T17–T20 y T26: conflicto optimista entre dos sesiones, un solo `review_applied`, reapariciones, pausa, posposición sin mover vencimientos, omisión reversible, cambios diferidos de constancia y ruta al 100 % con repasos posteriores separados.
- `review-scheduler.test.ts` fija reloj, intervalos, límites de etapa, identidad de ciclo, bandas/desempates y T21 con 80 vencidos: selecciona 10, conserva prioridad, diversidad de unidades e IDs únicos sin perder el total de la cola.
- `objective-evidence.test.ts` cubre umbral/recencia, separación mínima de 24 horas, cinco preguntas distintas, degradación visible de consolidación antigua y T27 para banco pequeño.
- `guided-learning-routes.test.ts` cubre sesión, campos desconocidos, identidad inyectada, idempotencia, minutos admitidos, caché privada y T24: una excepción del proveedor devuelve `learning_unavailable` sin fabricar progreso cero.
- 6 de septiembre de 2026: pruebas enfocadas de fase 4 — 4 archivos, 34 pruebas correctas.
- 6 de septiembre de 2026: suite completa API — 20 archivos, 144 pruebas correctas.
- 6 de septiembre de 2026: suite completa web — 16 archivos, 77 pruebas correctas.
- 6 de septiembre de 2026: build de contratos, typecheck y lint de API/web — correctos.
- 6 de septiembre de 2026: build emitido de API y build optimizado de Next.js — correctos usando directorios temporales aislados; Next compiló, verificó TypeScript y generó 20 páginas. Los temporales se eliminaron después de verificar.

### Limitaciones registradas antes de detenerse

- PGlite ejecuta DDL, transacciones e invariantes, pero su driver serial no demuestra una carrera simultánea con dos conexiones PostgreSQL. T09 queda probado como conflicto obsoleto secuencial; la prueba concurrente real de T09/T25, locks y rol runtime sigue siendo requisito de fase 7.
- `/home` está acotado e indexado, pero todavía hace lecturas de progreso por inscripción. No se ha medido p95 con un conjunto representativo ni se afirma el objetivo de 500 ms; la medición y el eventual batching pertenecen a fase 7.
- No se ejecutó QA de navegador en 320–1440 px, Safari iOS/Chrome Android, lector de pantalla, zoom 200 %, red física ni reapertura real de IndexedDB. Esas evidencias visuales y de dispositivo siguen en fases 5 y 7.
- Los directorios históricos `apps/api/dist` y `apps/web/.next` estaban bloqueados por Windows durante la verificación. Para no borrar artefactos ajenos ni interrumpir procesos, se validaron ambos builds en salidas temporales nuevas. El código compiló; queda por resolver el bloqueo local antes de volver a emitir sobre esas rutas concretas.
- No se aplicó ninguna migración a PostgreSQL externo, no se consultó el rol administrado, no se probó el bucket de preview y no se ejecutó despliegue. Tampoco se publicó material académico: solo se usaron fixtures ficticios automatizados.
- Al cerrar esta fase, la integración destacada en `/dashboard`, XP, hitos y el cierre visual completo seguían pendientes. Esa deuda quedó atendida posteriormente en la fase 5 descrita a continuación.

## Fase 5 — Experiencia visual y gamificación

### Comportamiento implementado

- `0013_guided_learning_rewards.sql` añade recompensas durables con clave única por usuario, evento de origen, fecha local, RLS, grants mínimos e índices. Los puntos se insertan en la misma transacción que acepta el aprendizaje; solo las filas nuevas se devuelven al cliente.
- El servidor concede 10 XP por guía/video esencial, 10 por flashcards esenciales, 15 por cuestionario esencial, 20 por unidad y 50 por ruta/version fijada. Diagnósticos, pasos opcionales y repeticiones no generan puntos. Los repasos aplicados conceden 2 XP por ítem con máximo de 20 al día según la zona del usuario.
- Las opciones equivalentes comparten `rewardIdentity` y `rewardVersion`, por lo que completar guía y después video no cobra dos veces. Se persisten una sola vez los hitos «Primera actividad», «Primera unidad», «Ruta completada» y «Volví a repasar».
- Los contratos de mutación incluyen exclusivamente recompensas recién insertadas; `/home` calcula desde PostgreSQL los puntos acumulados y los hitos persistidos. La UI no calcula ni acepta XP enviado por el navegador.
- `/dashboard` carga en paralelo aprendizaje, contenido reciente y destacados. Cuando la capacidad está activa, el bloque de aprendizaje aparece antes del descubrimiento y resume avance confirmado, próxima tarea, puntos, constancia opcional y acceso a preferencias.
- La vista «Hoy» separa la cola priorizada del progreso. Permite desplegar tareas, explicar cada recomendación y posponer u omitir mediante un diálogo con estados de envío/error honestos. Las preferencias permiten duración, meta semanal, zona horaria y ruta destacada sin presentar como efectivo un cambio que el servidor no confirmó.
- El detalle de ruta usa un mapa vertical de unidades y pasos con estados textuales, iconos y libertad de apertura. La unidad actual queda destacada; las demás siguen disponibles sin candados académicos.
- El panel final presenta avance actualizado, XP solo cuando hubo una recompensa nueva, hitos y dos acciones explícitas sin iniciar otra actividad automáticamente. Los estados nuevo, vacío, carga, error, progreso parcial, ruta completa y títulos largos tienen tratamiento propio.
- `learning.css` reutiliza los tokens Koraz, conserva el orden DOM móvil, respeta zona segura, foco visible y movimiento reducido. Los controles principales alcanzan al menos 44 px y ningún estado depende solo de color o `hover`.
- `/visual-fixtures/aprendizaje` reúne estados contractualmente válidos de dashboard, Hoy, catálogo, progreso, ruta, finalización y error para revisión local. La ruta devuelve 404 fuera de desarrollo y no publica contenido académico ficticio.

### Evidencia

- `guided-learning-catalog.test.ts` aplica `0001`–`0013` desde una base PGlite vacía y comprueba importes, hitos, deduplicación entre alternativas, clave de ruta/version, repaso obsoleto sin XP y tope diario de 20 XP. El recorrido completo termina con 170 puntos reales en `/home`.
- `learning-visual-fixtures.test.ts` valida contra los contratos los fixtures de avance parcial, usuario nuevo, ruta completa, títulos largos, mapa y recompensas.
- 6 de septiembre de 2026: `pnpm test` — API 20 archivos/145 pruebas y web 17 archivos/79 pruebas, todas correctas.
- 6 de septiembre de 2026: `pnpm lint` y `pnpm typecheck` — correctos en todo el monorepo.
- 6 de septiembre de 2026: `pnpm build` — contratos y API correctos; Next.js compiló, verificó TypeScript y generó 20 páginas con la salida normal del proyecto.
- QA local en Chromium inspeccionó dashboard, Hoy, preferencias, acciones de tarea, mapa y finalización. En 320, 360, 390, 430, 768, 1024 y 1440 px no hubo desbordamiento horizontal; los controles medidos conservaron 44 px como mínimo y el layout pasó de una a dos columnas con espacio suficiente.
- El diálogo cierra con Escape, mantiene el foco dentro mientras está abierto y lo devuelve al disparador. También se verificaron el estado activo del sidebar y los estados vacío/error sin porcentajes inventados.
- `pnpm audit --audit-level high` conserva el baseline anterior: 11 vulnerabilidades transitivas de `fast-uri` (8 altas y 3 moderadas) arrastradas por Fastify/Ajv; esta fase no añadió dependencias.

### Limitaciones que pasaban a las fases 6 y 7

- El upgrade entre versiones y el mapeo explícito que preserva premios ante cambios meramente cosméticos quedaron resueltos y probados posteriormente en fase 6.
- PGlite comprueba DDL e idempotencia, pero T25 requiere dos conexiones PostgreSQL reales para demostrar el lock y una sola recompensa bajo concurrencia efectiva.
- Las capturas se revisaron en Chromium local con anchos emulados. Safari iOS, Chrome Android físico, lector de pantalla, zoom de texto 200 %, orientación horizontal y red lenta continúan como evidencias obligatorias de fase 7.
- No se aplicó `0013` en un PostgreSQL externo, no se desplegó la bandera y no se publicó una ruta académica. Siguen faltando ambiente preview, inventario conectado y revisión de coordinación.

## Fase 6 — Actualizaciones y operación editorial

### Comportamiento implementado

- Los contratos, Fastify y el BFF incorporan vista previa privada y actualización explícita de una inscripción. Solo admiten una versión publicada posterior de la misma ruta; la mutación exige `Idempotency-Key`, `expectedVersion` y versión objetivo.
- La correspondencia se calcula por `stableKey` y `pedagogyVersion`, nunca por posición. También valida unidad, propósito, esencialidad, objetivos y la identidad/version de las opciones y recompensas: reordenar o retitular no invalida progreso; un cambio pedagógico sí.
- La actualización bloquea la inscripción, vuelve a validar su versión y ejecuta en una transacción el nuevo puntero, `learning_enrollment_versions`, el mapping aplicado y las copias de progreso/evidencia equivalentes. Los registros de versiones anteriores permanecen intactos.
- Un intento contextual en progreso impide la mutación con `409 active_attempt`; la interfaz ofrece retomarlo o aplazar la decisión y nunca lo abandona automáticamente. La misma clave y payload reproduce la respuesta; reutilizar la clave con otro payload no escribe de nuevo.
- `completed_at` se conserva cuando la nueva versión sigue completa y se reinicia cuando añade trabajo esencial pendiente. La emisión de la recompensa de ruta exige una transición real a completada, por lo que una actualización cosmética no repite XP ni hitos.
- El estudiante ve versión actual/objetivo, notas, cambios, progreso proyectado e historial antes de decidir. Los estados normal y bloqueado tienen acciones explícitas, errores honestos y no modifican el progreso mostrado antes de confirmación de servidor.
- `/v1/editor/learning-resources` ofrece búsqueda paginada por texto, tema y proyección con versión, IDs congelables, cobertura de explicaciones y brechas visibles. El editor conserva selecciones al paginar y puede crear un borrador `vN+1` desde una publicación sin mover inscripciones existentes.
- Un recurso retirado conserva intentos e historial ya guardados, pero deja de poder abrirse en una actividad nueva y su proyección desaparece del catálogo editorial. No se reexpone por los caminos genéricos ni por UUID conocido.
- El registro de adaptadores ahora es genérico y rechaza claves duplicadas. Una prueba registra y ejecuta `case-study-test` sin añadirlo a los contratos públicos ni fingir que existe material publicable de ese tipo.

### Evidencia

- `guided-learning-catalog.test.ts` publica una versión cosméticamente reordenada y demuestra T28: 6/6 pasos transferidos, 100 % y `completed_at` conservados, sin XP nuevo. Después publica un cambio pedagógico y transfiere solo 5/6, proyecta 83 %, reinicia la completitud vigente y conserva las tres versiones y todos los progresos históricos.
- La misma suite prueba bloqueo por intento activo, replay/conflicto idempotente y retiro: el intento histórico continúa legible, una apertura nueva devuelve `resource_changed` y el catálogo deja de ofrecer la proyección retirada.
- `guided-learning-routes.test.ts` cubre sesión, caché privada, cuerpo/query estrictos, capacidades editoriales, idempotencia y el `409 active_attempt`. `guided-learning-adapters.test.ts` cubre extensión aislada y clave duplicada.
- 6 de septiembre de 2026: suite completa API — 21 archivos, 151 pruebas correctas; suite completa web — 17 archivos, 79 pruebas correctas.
- 6 de septiembre de 2026: build de contratos, typecheck de API/web y lint de API/web — correctos. El build optimizado de Next.js compiló, verificó TypeScript y generó 20 páginas.
- QA local en Chromium revisó la actualización desplegada y el bloqueo en escritorio y móvil. No hubo errores de consola, overlays ni desbordamiento horizontal; las acciones móviles midieron 46 px de alto y el estado bloqueado ocultó correctamente la acción de actualizar.

### Limitaciones que pasan a fase 7

- PGlite cubre DDL, locks secuenciales e invariantes, pero aún falta ejecutar migraciones, RLS/grants y carreras con conexiones concurrentes en el PostgreSQL administrado de preview.
- No hay conexión al inventario real ni revisión académica/coordinación para seleccionar y publicar una ruta piloto. La bandera continúa desactivada por defecto y no se alteraron datos externos.
- Safari iOS, Chrome Android físico, lector de pantalla, zoom de texto 200 %, orientación horizontal, red lenta, reapertura real de IndexedDB, firma del bucket y métricas p95 requieren el ambiente y dispositivos de fase 7.
- El lanzamiento sigue condicionado a backup/restore, rollback, observabilidad, privacidad, seguridad, soporte y aprobación formal descritos en el plan.

## Fase 7 — Validación y lanzamiento controlado (en progreso)

### Primera porción local implementada

- Fastify registra para cada endpoint guiado una observación estructurada con superficie, operación estable, método, estado, resultado, código público de error, duración monotónica y presencia de idempotencia. La señal usa la plantilla de ruta y excluye usuario, parámetros, query, cuerpo, respuestas, soluciones, claves y URLs firmadas.
- Un hook común fuerza `Cache-Control: private, no-store` también en errores de estudiante y editor, cerrando el riesgo de que respuestas fallidas privadas dependieran de que cada handler recordara la cabecera.
- `0014_guided_learning_observability.sql` añade `replay_count` y `last_replayed_at` a los recibos idempotentes. El incremento es atómico y ocurre solo para la misma cuenta, clave y hash; un payload distinto conserva el contador y falla con conflicto.
- Los intentos y el resto de mutaciones usan ahora una sola implementación de recibos, evitando que los replays de actividades quedaran fuera de la nueva métrica.
- Posponer/omitir una recomendación crea el evento deduplicado `task_override_updated` con acción y cantidad, sin guardar claves de tarea en el payload analítico.
- `OPERACION.md` fija orden de preview, smoke tests, tablero mínimo, consultas agregadas, presupuestos iniciales y desactivación segura. `VALIDACION.md` separa evidencia local de las pruebas que todavía requieren ambiente, dispositivo o coordinación.

### Evidencia de esta continuación

- `guided-learning-routes.test.ts`: 11/11; comprueba observaciones de éxito/error, código estable, duración, presencia de idempotencia, ausencia de UUID/clave y caché privada en errores.
- `guided-learning-catalog.test.ts` integra ahora `0015` y comprueba los 21 índices de claves foráneas guiadas.
- 7 de septiembre de 2026: suite completa API — 21 archivos/153 pruebas; suite completa web — 17 archivos/79 pruebas; contratos, lint, typecheck y build completo correctos. Next.js generó 20 páginas.
- La primera ejecución completa lanzada a la vez que typecheck produjo timeouts de hooks PGlite y fallos encadenados por estado incompleto. Las suites afectadas pasaron aisladas y la repetición completa de API, ya sin competencia, terminó 152/152.
- `pnpm audit --audit-level high` confirmó inicialmente 8 vulnerabilidades altas y 3 moderadas en `fast-uri`. Los overrides compatibles a 3.1.6/4.1.3 eliminaron todas las altas; el resultado final conserva 3 moderadas.

### PostgreSQL de producción preparado con la bandera apagada

- `Koraz database`, PostgreSQL 17.6, coincidía con los checksums locales `0001`–`0008`, tenía 12 MB, cuatro publicaciones revisadas y el rol `cediah_runtime` sin superusuario ni bypass de RLS.
- `0009`–`0014` se ejecutaron primero en una transacción terminada con `ROLLBACK`. Después se aplicaron atómicamente, registrando los seis checksums y un respaldo privado de los cuatro contenidos normalizados.
- El advisor detectó 21 claves foráneas guiadas sin índice. `0015_guided_learning_foreign_key_indexes.sql` las cubre; pasó 153/153 pruebas de API, ensayo remoto con rollback y aplicación real.
- Verificación posterior: 15 migraciones sin discrepancias, 20 tablas guiadas con propietario correcto y RLS activa, cero grants Data API, cero constraints sin validar y cero preguntas sin identidad estable.
- Advisors posteriores: cero avisos de seguridad y cero claves foráneas guiadas sin índice. Los índices recién creados permanecen naturalmente sin uso mientras la bandera está apagada.

### Dependencias externas aún abiertas

- La base de producción ya está migrada, pero API/web aún no incluyen esta revisión desplegada y `GUIDED_LEARNING_ENABLED` continúa apagada.
- Continúan pendientes T09/T25 con concurrencia real contra el pool, prueba de restore completa, bucket privado, p95 representativo y dispositivos/navegadores de la matriz.
- Falta inventario actual, ruta piloto académicamente revisada, prueba de uso y aprobación formal. La bandera permanece desactivada por defecto y el producto no se declara listo para lanzamiento.

## Registro de pruebas posteriores

- Fase 0: `pnpm --filter @cediah/api test` — 14 archivos, 100 pruebas correctas.
- Fase 0: `pnpm --filter @cediah/web typecheck` — correcto.
- Fases 1–2: `pnpm --filter @cediah/contracts build` — correcto.
- Fases 1–2: `pnpm --filter @cediah/api test` — 18 archivos, 120 pruebas correctas.
- Fases 1–2: `pnpm --filter @cediah/web test` — 15 archivos, 66 pruebas correctas.
- Fases 1–2: lint y typecheck de API/web — correctos.
- Fase 3: `pnpm --filter @cediah/api test` — 18 archivos, 126 pruebas correctas.
- Fase 3: `pnpm --filter @cediah/web test` — 16 archivos, 76 pruebas correctas.
- Fase 3: contratos, lint y typecheck de API/web — correctos.
- Fase 4: pruebas enfocadas — 4 archivos, 34 pruebas correctas.
- Fase 4: `pnpm --filter @cediah/api test` — 20 archivos, 144 pruebas correctas.
- Fase 4: `pnpm --filter @cediah/web test` — 16 archivos, 77 pruebas correctas.
- Fase 4: contratos, lint, typecheck y builds aislados de API/web — correctos.
- Fase 5: `pnpm --filter @cediah/api test` — 20 archivos, 145 pruebas correctas.
- Fase 5: `pnpm --filter @cediah/web test` — 17 archivos, 79 pruebas correctas.
- Fase 5: contratos, lint, typecheck y build normal de API/web — correctos.
- Fase 5: QA Chromium en 320–1440 px — sin scroll horizontal, controles ≥44 px y foco de diálogos verificado.
- Fase 6: `pnpm --filter @cediah/api test` — 21 archivos, 151 pruebas correctas.
- Fase 6: `pnpm --filter @cediah/web test` — 17 archivos, 79 pruebas correctas.
- Fase 6: contratos, lint, typecheck y build optimizado de Next.js — correctos.
- Fase 6: QA Chromium de actualización normal/bloqueada en escritorio y móvil — sin errores, overlays ni scroll horizontal; acciones móviles de 46 px.
- Fase 7 local: `guided-learning-routes.test.ts` — 11 pruebas correctas.
- Fase 7 local: `guided-learning-catalog.test.ts` — 18 pruebas correctas con migraciones `0001`–`0014`.
- Fase 7 local: `pnpm --filter @cediah/api test` — 21 archivos, 152 pruebas correctas.
- Fase 7 local: `pnpm --filter @cediah/web test` — 17 archivos, 79 pruebas correctas.
- Fase 7 local: contratos, `pnpm lint`, `pnpm typecheck` y `pnpm build` — correctos; Next.js generó 20 páginas.
- Fase 7 local: audit remoto bloqueado por política del sandbox; no hubo cambios de manifiesto o lockfile y no se reescribió el baseline previo.
