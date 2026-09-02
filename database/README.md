# Base de datos de CEDIAH

Este directorio es la fuente activa del esquema PostgreSQL. El esquema es independiente del proveedor y puede utilizarse con PostgreSQL local o administrado por Supabase u otro servicio compatible.

## Ejecución

La API aplica automáticamente los archivos de database/migrations al arrancar cuando DATABASE_URL está configurado y DATABASE_MIGRATIONS_ENABLED no es false.

El migrador:

- ordena los archivos por nombre;
- toma un advisory lock para evitar dos migraciones simultáneas;
- ejecuta cada archivo nuevo dentro de una transacción;
- registra nombre, checksum y fecha en public.cediah_schema_migrations;
- rechaza una migración aplicada cuyo contenido haya cambiado.

DATABASE_MIGRATIONS_PATH puede apuntar a otra copia del directorio, por ejemplo dentro de una imagen de despliegue. Si las migraciones se ejecutan en una etapa separada del arranque, configura DATABASE_MIGRATIONS_ENABLED=false en las demás instancias para que exista un único responsable operativo.

En la producción actual de CEDIAH, Render usa el Transaction Pooler de Supabase. Como ese modo no conserva el advisory lock de sesión, DATABASE_MIGRATIONS_ENABLED permanece en false. Las migraciones se aplican manualmente en Supabase antes del despliegue y se registra su nombre y checksum en public.cediah_schema_migrations. Nunca se debe desplegar código que requiera un esquema nuevo hasta completar y verificar ese paso.

## Orden actual

1. 0001_auth.sql crea las tablas requeridas por Better Auth.
2. 0002_platform.sql crea perfiles, roles y el dominio académico.
3. 0003_content.sql crea el catálogo y workflow editorial.
4. 0004_subjects.sql crea las asignaturas y sus relaciones.
5. 0005_restore_legacy_content.sql restaura el contenido del catálogo anterior.
6. 0006_simplify_platform_roles.sql simplifica los roles de la plataforma.
7. 0007_content_views.sql añade contadores agregados y deduplicación de visitas.

Las claves foráneas de identidad apuntan a public.auth_users. No dependen de auth.users ni de otros esquemas administrados por Supabase.

## Cómo añadir una migración

1. No modifiques archivos que ya hayan sido aplicados en ningún ambiente compartido.
2. Añade un archivo con el siguiente número y un nombre en minúsculas, por ejemplo 0005_add_example.sql.
3. Escribe SQL transaccional e idempotente solo cuando la operación realmente lo permita.
4. Añade índices para nuevas claves foráneas y rutas de consulta frecuentes.
5. Evita extensiones propietarias del hosting salvo que exista una alternativa documentada.
6. Prueba desde una base vacía y desde una copia con todas las migraciones anteriores.
7. Ejecuta tests, typecheck y build antes del despliegue.

No reutilices el mismo número y no renombres un archivo aplicado: el nombre forma parte del historial.

## Permisos

La cuenta usada durante el arranque necesita permisos para crear y alterar objetos del esquema public. No necesita ser superusuario. Si el proveedor separa una cuenta de migración de la cuenta de ejecución, aplica el esquema con la primera y concede a la segunda únicamente SELECT, INSERT, UPDATE y DELETE sobre las tablas, uso de secuencias si se incorporan y ejecución de las funciones necesarias.

La aplicación no expone estas credenciales al navegador. Fastify es el límite de autorización y todas las consultas del producto pasan por sus proveedores Kysely.

## Vistas del contenido

La migración 0007 debe aplicarse y verificarse **antes de desplegar la API** que consulta las nuevas tablas. En producción, con migraciones automáticas desactivadas, conserva el procedimiento transaccional y de checksum descrito arriba.

`content_view_counts` guarda un total por publicación; `content_view_receipts` guarda solo la última visita por pareja lector/contenido para no sumar recargas durante 30 minutos. La identidad se transforma en un HMAC específico de cada contenido: no se guardan correos, IP ni identificadores directos de usuarios. No hay un registro por evento. El contador empieza en cero; no reconstruye visitas históricas. Las guías integradas y su video comparten la publicación y el contador, sin duplicar documentos ni archivos.

La web registra una visita únicamente tras cuatro segundos de lectura visible y autenticada. Las vistas previas y la precarga de rutas no cuentan. La API comprueba el estado publicado y realiza la deduplicación y el incremento en una misma transacción. La consulta de destacados se ordena por vistas antes de aplicar el límite; los empates usan la fecha de publicación. El catálogo público tiene una caché de hasta 30 segundos.

Ambas tablas tienen RLS y no conceden acceso a la Data API. La migración concede los permisos y políticas necesarios al rol `cediah_runtime`, si existe. En instalaciones con otra cuenta de ejecución distinta del propietario, el operador debe conceder a esa cuenta los permisos y políticas equivalentes, nunca a `anon` o `authenticated`.

## Backups

Antes de una migración en un ambiente con datos:

- genera un pg_dump y verifica su checksum;
- prueba la restauración en una base aislada;
- registra el último archivo presente en cediah_schema_migrations;
- conserva un rollback compatible con la revisión anterior de la API.

Los objetos de video no están dentro de PostgreSQL. Se respaldan por separado desde el bucket S3, conservando sus claves.

## Material legado

supabase/migrations corresponde a la arquitectura anterior y no se debe aplicar junto con este directorio. Sus referencias a auth.users, RLS o Storage no describen el runtime actual. Consérvalo solo como referencia temporal hasta que se cierre la migración de los ambientes existentes.
