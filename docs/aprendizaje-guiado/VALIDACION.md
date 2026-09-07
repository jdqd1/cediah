# Validación de Aprendizaje guiado

Última actualización: 7 de septiembre de 2026.

## Estado de salida

**Esquema de producción listo; activación aún bloqueada.** Las fases funcionales 0–6 están completas y PostgreSQL de producción ya tiene `0009`–`0015` con la bandera apagada. Antes de exponer la función siguen pendientes el despliegue de API/web, pruebas concurrentes y de rendimiento, dispositivos externos, bucket y la aprobación académica de una ruta piloto.

## Historia verificada

Una persona autenticada entra desde Inicio o Aprendizaje guiado, pasa por el BFF de mismo origen y Fastify, usa una ruta publicada fijada a su inscripción, persiste intentos/progreso en PostgreSQL y recibe un estado privado validado que la interfaz puede reanudar sin calcular dominio ni XP en el cliente.

| Límite | Estado | Evidencia disponible |
| --- | --- | --- |
| UI y navegación | Confirmado en Chromium local | Fixtures contractuales y QA registrado en `ESTADO.md` para 320–1440 px; no sustituye dispositivos reales |
| Navegador → BFF | Confirmado por pruebas | Allowlist de rutas, cookies de servidor, payloads estrictos e idempotencia |
| BFF → Fastify | Confirmado por pruebas | Sesión Better Auth revalidada, errores estables y caché privada |
| Fastify → datos | Confirmado local y en PostgreSQL administrado | PGlite ejecuta 0001–0015; producción ejecutó y verificó 0009–0015, RLS, propietarios, grants y checksums; falta concurrencia efectiva |
| Datos → respuesta | Confirmado por contratos | DTOs sin soluciones futuras, progreso/XP de servidor y reanudación persistida |
| Runtime desplegado | En progreso | Esquema de producción listo y bandera apagada; falta desplegar la revisión de API/web y ejecutar smoke tests antes de activarla |

## Matriz T01–T30

`Confirmado local` significa prueba automatizada o QA local reproducible. `Parcial` identifica exactamente la parte que exige otro ambiente.

| IDs | Estado | Evidencia o pendiente |
| --- | --- | --- |
| T01–T08 | Confirmado local | Estado nuevo, inscripción única, acceso libre, alternativas, cuestionario fallado, reanudación e idempotencia |
| T09 | Parcial | Conflicto obsoleto y un solo `review_applied` probados; falta carrera simultánea con dos conexiones PostgreSQL |
| T10–T21 | Confirmado local | Reglas de video/guía, biblioteca, identidad, versiones, pausa/omisión, repaso, cola de 80 y 100 % estable |
| T22 | Parcial | Cola/retry y clave persistida probados unitariamente; falta caída/reapertura real de navegador e IndexedDB |
| T23 | Parcial | Partición de cola por cuenta probada; falta cierre/cambio real de sesión en navegador |
| T24 | Confirmado local | Error de `/home` permanece recuperable y no se convierte en cero |
| T25 | Parcial | Unicidad de eventos/recompensas probada secuencialmente; falta concurrencia efectiva con dos conexiones |
| T26–T30 | Confirmado local | Zona/medianoche, banco pequeño, upgrade, retiro y preview sin tracking |

## Observabilidad incorporada en fase 7

- Fastify emite una observación estructurada por operación estudiante/editor con duración monotónica, estado, código público de error y presencia —no valor— de idempotencia.
- La observación usa la plantilla de ruta y no registra UUID, slugs, queries, cuerpos, respuestas, soluciones ni URLs firmadas.
- Todas las respuestas de los endpoints guiados, incluidos errores, fuerzan `Cache-Control: private, no-store`.
- `0014_guided_learning_observability.sql` conserva contador y última fecha de replay real en el recibo idempotente existente.
- `0015_guided_learning_foreign_key_indexes.sql` cubre las 21 claves foráneas que el advisor marcó en el dominio guiado.
- `task_override_updated` permite medir posponer/omitir de forma agregada con acción y cantidad, sin claves de tareas.
- El procedimiento, consultas agregadas, presupuestos iniciales y desactivación están en `OPERACION.md`.

## Evidencia ejecutada en esta continuación

| Comprobación | Resultado |
| --- | --- |
| `pnpm --dir apps/api test test/guided-learning-routes.test.ts` | 1 archivo, 11 pruebas correctas |
| `pnpm --filter @cediah/api test` | 21 archivos, 153 pruebas correctas; aplica 0001–0015 |
| `pnpm --filter @cediah/web test` | 17 archivos, 79 pruebas correctas |
| `pnpm --filter @cediah/contracts build` | Correcto |
| `pnpm lint` | Correcto en el monorepo |
| `pnpm typecheck` | Correcto en el monorepo |
| `pnpm build` | Contratos/API correctos; Next.js compiló y generó 20 páginas |
| `pnpm audit --audit-level high` | 0 vulnerabilidades altas; quedan 3 moderadas tras fijar `fast-uri` 3.1.6/4.1.3 |
| PostgreSQL administrado de producción | Ensayo 0009–0014 con `ROLLBACK` correcto; aplicación atómica posterior y 0015 ensayada/aplicada por separado |
| Integridad del esquema remoto | 15 checksums correctos; 20 tablas `learning_*`; 0 propietarios incorrectos, RLS desactivadas, grants Data API, constraints sin validar o preguntas sin identidad |
| Supabase advisors | 0 avisos de seguridad y 0 claves foráneas guiadas sin índice; índices nuevos aún figuran sin uso por no existir tráfico |

Una ejecución completa inicial en paralelo produjo timeouts de hooks PGlite por contención de recursos y, en consecuencia, fallos encadenados de estado en la suite relacional. No se considera un fallo funcional: las suites relevantes pasaron aisladas. La verificación final debe ejecutar PGlite sin competir con otro proceso pesado.

Antes de la corrección, el audit reportó 11 vulnerabilidades transitivas —8 altas y 3 moderadas— en `fast-uri` vía Fastify/Ajv. Los overrides compatibles eliminan las 8 altas sin cambiar Fastify ni Ajv.

## Pendientes obligatorios antes de activar producción

- Confirmar el despliegue de API/web con `GUIDED_LEARNING_ENABLED=false` y ejecutar smoke tests de regresión.
- Ejecutar T09/T25 mediante peticiones realmente concurrentes contra el pool administrado.
- Medir `home.read` p95 con volumen representativo y revisar planes/índices si supera 500 ms.
- Verificar expiración/reautorización del bucket y ausencia de acceso tras retiro/permisos vencidos.
- Ejecutar Safari iOS, Chrome Android, lector de pantalla, zoom 200 %, orientación, red lenta e IndexedDB tras cierre/reapertura.
- Generar inventario actual, seleccionar ruta piloto y completar revisión académica/coordinación.
- Ejecutar prueba de uso con aproximadamente cinco estudiantes y documentar denominadores y dificultades.
- Conservar el respaldo privado de los cuatro contenidos normalizados; probar restauración completa cuando el plan/proveedor ofrezca backup descargable.
- Confirmar activación, observación y desactivación de bandera siguiendo `OPERACION.md`.
