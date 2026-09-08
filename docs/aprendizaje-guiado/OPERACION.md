# Operación de Aprendizaje guiado

Procedimiento de activación, observabilidad y desactivación para la fase 7. El piloto técnico quedó activo en producción el 7 de septiembre de 2026 por autorización explícita del operador; ampliar su promoción todavía requiere las validaciones humanas y editoriales de `VALIDACION.md`.

## Principios

- La API y PostgreSQL son la autoridad. La web solo muestra la capacidad que devuelve `/v1/auth/me`.
- `GUIDED_LEARNING_ENABLED` permanece `true` en producción mientras las señales de este documento estén sanas; cualquier ambiente nuevo comienza en `false` hasta verificar migraciones, permisos, contenido y pruebas.
- Los ambientes no comparten base de datos, secretos, bucket ni cuentas de prueba.
- Una regresión se contiene apagando la bandera y corrigiendo hacia adelante. No se eliminan tablas ni progreso como rollback.
- Logs y reportes no incluyen respuestas, soluciones, correos, UUID de usuarios, claves idempotentes, parámetros de ruta ni URLs firmadas.

## Secuencia de preview

1. Registrar revisión Git, responsable, ventana y URL del ambiente.
2. Restaurar un respaldo reciente en una base aislada y comprobar su checksum y tiempo de restauración.
3. Aplicar `database/migrations` en orden hasta `0015_guided_learning_foreign_key_indexes.sql` con una conexión administrativa de sesión. No usar el Transaction Pooler para el advisory lock del migrador.
4. Comparar nombres y checksums con `public.cediah_schema_migrations` y comprobar que no se mezcló `supabase/migrations`.
5. Verificar con el rol runtime `cediah_runtime` las operaciones necesarias y confirmar denegación para `anon`, `authenticated` y una cuenta ajena.
6. Desplegar la API con `GUIDED_LEARNING_ENABLED=false`; comprobar `/health`, autenticación, catálogo general y ausencia de rutas guiadas registradas.
7. Desplegar la web compatible. Confirmar que el shell no muestra Aprendizaje guiado mientras la capacidad está apagada.
8. Preparar una ruta piloto con material real, revisión académica y workflow completo, todavía limitada al equipo interno.
9. Cambiar solo la API de preview a `GUIDED_LEARNING_ENABLED=true` y reiniciarla de forma controlada.
10. Ejecutar la matriz de `VALIDACION.md`, capturar resultados y revisar las señales operativas descritas abajo.

No se activa producción hasta que todos los P0 estén cerrados y exista una decisión explícita de coordinación.

### Registro de esquema de producción — 7 de septiembre de 2026

- `Koraz database` (PostgreSQL 17.6) recibió `0009`–`0015` con la función apagada.
- Antes del cambio se creó `private.guided_learning_content_backup_20260907` con los cuatro contenidos que podía normalizar `0009`.
- La ejecución se ensayó primero dentro de una transacción revertida. La aplicación posterior registró 15/15 checksums sin discrepancias.
- Las 20 tablas guiadas pertenecen a `cediah_runtime`, tienen RLS activa y no conceden acceso a `anon`, `authenticated` ni `service_role`.
- Los advisors posteriores reportaron cero avisos de seguridad y cero claves foráneas guiadas sin índice.

### Registro de activación y video flexible — 7 y 8 de septiembre de 2026

- Ruta piloto: `peritoneo-fundamentos-anatomicos`; la inscripción usada para smoke quedó fijada a la versión 1 de tres pasos.
- Activación base: `c303227` desplegado por Vercel (`dpl_fYqR4dPKSiu9xE6fFqePpovSVX3J`) y Render (`dep-dafmqm3bc2fs73deoh70`).
- Compatibilidad de videos sin duración editorial: API `38b6a9f`, validada inicialmente en Render como `dep-dafnh03bc2fs73df97g0` y heredada por los despliegues automáticos posteriores de `main`.
- Reproductor final: web `d162ff8`, Vercel `dpl_Dj8Tf3NszGZevzcUZ7rPtQpBoAxk` en estado `READY`.
- El botón **Omitir video y completar** termina el paso con método `self_reported` y 2 XP de actividad. La cobertura mínima observada conserva método `observed` y 10 XP cuando esa identidad de recompensa aún no fue concedida. Repetir o cambiar de método no duplica XP.
- El smoke de un activo histórico de 69,252 s fijó 70 s en el intento, persistió la cobertura y terminó `observed`. No hubo 5xx de Render ni errores runtime agrupados en Vercel tras el recorrido.
- Las versiones editoriales 2 y 3 de la ruta aparecieron después del smoke inicial. No se revierten automáticamente: coordinación debe revisar su selección de fuentes antes de promover la ruta más allá del piloto.

## Smoke test con la bandera activa

- `/v1/auth/me` devuelve `features.guidedLearning: true` únicamente a partir de la configuración de la API.
- Una persona sin sesión recibe `401` y una cuenta estudiante no abre rutas editoriales.
- Inicio, catálogo, ruta, progreso e intentos devuelven `Cache-Control: private, no-store`, incluidos sus errores.
- La inscripción repetida conserva una sola fila y la versión fijada.
- Una mutación repetida con la misma clave y cuerpo reproduce el resultado; con otro cuerpo devuelve `409 idempotency_conflict`.
- Cuestionario, flashcards, guía y video guardan/reanudan desde otra sesión sin exponer soluciones futuras.
- Un recurso retirado conserva historial, bloquea aperturas nuevas y devuelve `resource_changed` cuando corresponda.
- El cierre devuelve avance y premios confirmados por servidor; un replay no duplica evento ni recompensa.

## Señales HTTP

Cada operación guiada terminada genera un log `Guided-learning operation completed` con el objeto `guidedLearning`:

| Campo | Uso |
| --- | --- |
| `surface` | `student` o `editor` |
| `operation` | Nombre estable, por ejemplo `home.read` o `attempt_response.create` |
| `method` | Método HTTP |
| `statusCode` | Estado final |
| `outcome` | `success`, `client_error` o `server_error` |
| `errorCode` | Código público conocido, sin mensaje interno ni payload |
| `durationMs` | Tiempo monotónico de la operación |
| `idempotencyKeyPresent` | Solo presencia; nunca el valor de la clave |

Los nombres de operación proceden de la plantilla de ruta Fastify. No incluyen `attemptId`, `enrollmentId`, `stepId`, slug ni query string. El `reqId` que Fastify añade al log permite correlación técnica dentro de su retención, sin convertirlo en identidad de producto.

### Tablero mínimo

Usar ventanas de 5 minutos para diagnóstico inmediato y de 24 horas para tendencia:

- volumen y porcentaje de `server_error` por `surface + operation + errorCode`;
- p50, p95 y máximo de `durationMs`, especialmente `student/home.read`;
- conflictos `version_conflict` e `idempotency_conflict` por mutación;
- `resource_changed` por apertura/guardado;
- fallos de guardado en `attempt_resume.update`, `attempt_response.create`, `attempt_item.reveal` y `attempt.complete`;
- proporción de mutaciones sin clave idempotente. Un `400 invalid_request` con `idempotencyKeyPresent=false` es una señal del cliente, no una caída de PostgreSQL.

Presupuestos iniciales, no SLA: `home.read` p95 menor o igual a 500 ms en el conjunto representativo de preview; alerta de investigación si los 5xx superan 1 % con al menos 20 solicitudes en 15 minutos, si una mutación de guardado produce dos 5xx consecutivos o si aparece acceso cruzado entre cuentas. Estos umbrales deben recalibrarse con tráfico real.

## Replays idempotentes

`0014_guided_learning_observability.sql` añade `replay_count` y `last_replayed_at` a `learning_mutation_receipts`. El contador aumenta atómicamente solo cuando usuario, clave y hash normalizado coinciden. Una clave reutilizada con otro payload conserva el contador y responde conflicto.

El reporte operativo debe ser agregado y respetar la retención del recibo:

```sql
select
  date_trunc('day', coalesce(last_replayed_at, created_at)) as day,
  count(*) as receipts,
  count(*) filter (where replay_count > 0) as receipts_replayed,
  coalesce(sum(replay_count), 0) as total_replays,
  count(*) filter (where http_status = 409) as stored_conflicts
from public.learning_mutation_receipts
where created_at >= now() - interval '30 days'
group by 1
order by 1;
```

No exportar filas individuales. El recibo contiene resultados privados de mutaciones y solo debe consultarse con el rol operativo autorizado.

## Métricas de producto

Los eventos aceptados permiten medir comportamiento sin usar duración pasiva ni XP como sustituto de aprendizaje. `task_override_updated` guarda únicamente acción y cantidad de tareas, nunca sus claves.

Ejemplo de activación por cohorte semanal:

```sql
with first_completion as (
  select enrollment_id, min(occurred_at) as completed_at
  from public.learning_events
  where event_type = 'activity_completed' and enrollment_id is not null
  group by enrollment_id
)
select
  date_trunc('week', enrollment.started_at) as cohort_week,
  count(*) as enrollments,
  count(first_completion.completed_at) as activated,
  round(100.0 * count(first_completion.completed_at) / nullif(count(*), 0), 1) as activation_percent,
  percentile_cont(0.95) within group (
    order by extract(epoch from (first_completion.completed_at - enrollment.started_at))
  ) filter (where first_completion.completed_at is not null) as p95_seconds_to_first_activity
from public.learning_enrollments as enrollment
left join first_completion on first_completion.enrollment_id = enrollment.id
group by 1
order by 1;
```

Ejemplo de uso de controles de recomendación:

```sql
select
  occurred_at::date as day,
  payload_json ->> 'action' as action,
  count(*) as accepted_mutations,
  sum((payload_json ->> 'taskCount')::integer) as affected_tasks
from public.learning_events
where event_type = 'task_override_updated'
  and occurred_at >= now() - interval '30 days'
group by 1, 2
order by 1, 2;
```

Para activación, continuación, retorno a siete días y resultados diferidos se deben declarar cohorte, periodo maduro y denominador. Las consultas exploratorias que devuelvan UUID, respuestas o `grading_json` no se copian a tableros generales.

## Desactivación y recuperación

Desactivar ante acceso cruzado, pérdida/corrupción de datos, migración incompleta, errores generalizados de guardado o exposición de contenido/soluciones.

1. Cambiar `GUIDED_LEARNING_ENABLED=false` en la API del ambiente afectado y reiniciar/deplegar según el procedimiento del proveedor.
2. Confirmar que `/v1/auth/me` devuelve la capacidad apagada, que el shell oculta las entradas y que Fastify responde `404` sin consultar proveedores guiados.
3. Mantener tablas, intentos, eventos, recibos y recompensas intactos.
4. Conservar logs, revisión desplegada, checksums y ventana del incidente.
5. Corregir hacia adelante y repetir preview completo. No reactivar solo porque `/health` responda.

La bandera no revierte migraciones ni vuelve seguro un esquema parcialmente aplicado. Si el problema es de integridad o permisos, se resuelve antes de reactivar.

## Evidencia que debe adjuntarse

- revisión Git y variables presentes por nombre, nunca sus valores;
- checksum y resultado de restore/migraciones;
- consultas de permisos/RLS con los roles reales;
- ejecución de T09 y T25 con dos conexiones PostgreSQL;
- p50/p95 de `home.read` indicando ubicación, volumen y datos usados;
- pruebas de bucket privado, expiración y reautorización;
- capturas y matriz de Safari iOS/Chrome Android, teclado, lector de pantalla, zoom 200 %, orientación y red lenta;
- aprobación académica de la ruta piloto y resultado de la prueba de uso;
- hora de activación/desactivación y responsable.
