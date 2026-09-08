# Validación de Aprendizaje guiado

Última actualización: 8 de septiembre de 2026.

## Estado de salida

**Piloto técnico activo y verificado en producción.** PostgreSQL ejecuta `0009`–`0015`, Render expone la API con la bandera activa y Vercel sirve la web compatible. Inscripción, cuatro formatos, omisión de video, cobertura observada, concurrencia e idempotencia se comprobaron con una cuenta real. Antes de ampliar la promoción siguen pendientes dispositivos físicos, prueba de uso, rendimiento con volumen representativo, restore integral y revisión de la versión editorial vigente.

## Historia verificada

Una persona autenticada entra desde Inicio o Aprendizaje guiado, pasa por el BFF de mismo origen y Fastify, usa una ruta publicada fijada a su inscripción, persiste intentos/progreso en PostgreSQL y recibe un estado privado validado que la interfaz puede reanudar sin calcular dominio ni XP en el cliente.

| Límite | Estado | Evidencia disponible |
| --- | --- | --- |
| UI y navegación | Confirmado en Chromium local | Fixtures contractuales y QA registrado en `ESTADO.md` para 320–1440 px; no sustituye dispositivos reales |
| Navegador → BFF | Confirmado por pruebas | Allowlist de rutas, cookies de servidor, payloads estrictos e idempotencia |
| BFF → Fastify | Confirmado por pruebas | Sesión Better Auth revalidada, errores estables y caché privada |
| Fastify → datos | Confirmado local y en PostgreSQL administrado | PGlite ejecuta 0001–0015; producción verificó 0009–0015, RLS, propietarios, grants, checksums y conflicto optimista concurrente |
| Datos → respuesta | Confirmado por contratos | DTOs sin soluciones futuras, progreso/XP de servidor y reanudación persistida |
| Runtime desplegado | Confirmado en producción | Vercel `d162ff8`/`dpl_Dj8Tf3NszGZevzcUZ7rPtQpBoAxk`; Render `38b6a9f`/`dep-dafnh03bc2fs73df97g0`; bandera activa y smoke autenticado correcto |

## Matriz T01–T30

`Confirmado local` significa prueba automatizada o QA local reproducible. `Parcial` identifica exactamente la parte que exige otro ambiente.

| IDs | Estado | Evidencia o pendiente |
| --- | --- | --- |
| T01–T08 | Confirmado local | Estado nuevo, inscripción única, acceso libre, alternativas, cuestionario fallado, reanudación e idempotencia |
| T09 | Confirmado en producción | Carrera real: una mutación aceptada, la versión obsoleta recibió `version_conflict` y no avanzó memoria/progreso dos veces |
| T10–T21 | Confirmado local y smoke remoto | Reglas de video/guía, botón de video omitido (2 XP), cobertura observada (10 XP en primera recompensa), biblioteca, identidad, versiones, pausa/omisión, repaso, cola de 80 y 100 % estable |
| T22 | Parcial | Cola/retry y clave persistida probados unitariamente; falta caída/reapertura real de navegador e IndexedDB |
| T23 | Parcial | Partición de cola por cuenta probada; falta cierre/cambio real de sesión en navegador |
| T24 | Confirmado local | Error de `/home` permanece recuperable y no se convierte en cero |
| T25 | Confirmado en producción | Mutaciones repetidas/concurrentes conservaron una sola finalización, evento y recompensa por identidad/version |
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
| `pnpm --filter @cediah/api test` | 21 archivos, 154 pruebas correctas; aplica 0001–0015 |
| `pnpm --filter @cediah/web test` | 18 archivos, 82 pruebas correctas |
| `pnpm --filter @cediah/contracts build` | Correcto |
| `pnpm lint` | Correcto en el monorepo |
| `pnpm typecheck` | Correcto en el monorepo |
| `pnpm build` | Contratos/API correctos; Next.js compiló y generó 20 páginas |
| `pnpm audit --audit-level high` | 0 vulnerabilidades altas; quedan 3 moderadas tras fijar `fast-uri` 3.1.6/4.1.3 |
| PostgreSQL administrado de producción | Ensayo 0009–0014 con `ROLLBACK` correcto; aplicación atómica posterior y 0015 ensayada/aplicada por separado |
| Integridad del esquema remoto | 15 checksums correctos; 20 tablas `learning_*`; 0 propietarios incorrectos, RLS desactivadas, grants Data API, constraints sin validar o preguntas sin identidad |
| Supabase advisors | 0 avisos de seguridad y 0 claves foráneas guiadas sin índice; índices nuevos aún figuran sin uso por no existir tráfico |
| Vercel producción | `d162ff8`, despliegue `READY`; flujo autenticado completo y 0 errores runtime agrupados tras el smoke |
| Render producción | `38b6a9f`, despliegue `live`; `/health` 200 y 0 respuestas 5xx durante el smoke final |
| Video nativo histórico | Duración detectada/fijada en 70 s, cobertura persistida y `activity_completed` con `completionMethod=observed` |

Una ejecución completa inicial en paralelo produjo timeouts de hooks PGlite por contención de recursos y, en consecuencia, fallos encadenados de estado en la suite relacional. No se considera un fallo funcional: las suites relevantes pasaron aisladas. La verificación final debe ejecutar PGlite sin competir con otro proceso pesado.

Antes de la corrección, el audit reportó 11 vulnerabilidades transitivas —8 altas y 3 moderadas— en `fast-uri` vía Fastify/Ajv. Los overrides compatibles eliminan las 8 altas sin cambiar Fastify ni Ajv.

## Pendientes antes de ampliar el piloto

- Medir `home.read` p95 con volumen representativo y revisar planes/índices si supera 500 ms.
- Verificar en una sesión física la expiración/reautorización de la URL firmada y ausencia de acceso tras retiro/permisos vencidos.
- Ejecutar Safari iOS, Chrome Android, lector de pantalla, zoom 200 %, orientación, red lenta e IndexedDB tras cierre/reapertura.
- Revisar académicamente la versión editorial pública vigente: las versiones 2/3 aparecieron después de la versión 1 validada y no fueron sobrescritas por este despliegue.
- Ejecutar prueba de uso con aproximadamente cinco estudiantes y documentar denominadores y dificultades.
- Conservar el respaldo privado de los cuatro contenidos normalizados; probar restauración completa cuando el plan/proveedor ofrezca backup descargable.
- Ensayar una desactivación controlada de la bandera en una ventana de mantenimiento siguiendo `OPERACION.md`.
