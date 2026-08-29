# Runbook de migración y cambio de proveedor

Estado: operativo para la arquitectura portable. Los valores concretos de capacidad, red y SLA deben completarse cuando se seleccione el proveedor destino.

## Estado de producción desde el 29 de agosto de 2026

- La web continúa en Vercel y la API en Render.
- Un proyecto gratuito de Supabase aloja el esquema PostgreSQL portable. No se usa Supabase Auth ni la Data API.
- Un segundo proyecto de Supabase conserva los buckets privados y los videos existentes mediante la interfaz S3.
- Render se conecta con un rol de aplicación propio a través del Transaction Pooler TLS de Supabase, en el puerto 6543.
- DATABASE_URL está guardada únicamente como secreto de Render.
- DATABASE_MIGRATIONS_ENABLED=false porque el pool transaccional no conserva el advisory lock de sesión que usa el migrador de la API.
- La antigua base gratuita de Render permanece intacta y sin tráfico como rollback temporal. No debe eliminarse hasta cerrar la verificación funcional.

Antes de desplegar una revisión que añada SQL, aplica manualmente los nuevos archivos de database/migrations en orden, dentro de transacciones. Después registra y compara sus checksums en public.cediah_schema_migrations, comprueba conteos y permisos, y solo entonces despliega la API. No apliques supabase/migrations: pertenece a la implementación anterior.

## Alcance

Este runbook cubre dos cortes distintos:

1. Activar la arquitectura portable después de abandonar Supabase Auth y el acceso directo mediante la Data API.
2. Mover en el futuro la web, la API, PostgreSQL o el bucket de videos a otro proveedor.

No se deben mezclar ambos cortes en producción. Primero se valida la aplicación portable en un ambiente aislado y después se programa cualquier cambio de hosting.

## Requisitos del proveedor destino

### API

- Node.js 24 o contenedores OCI.
- HTTPS mediante TLS administrado o reverse proxy.
- variables de entorno secretas;
- conectividad saliente hacia PostgreSQL, SMTP y almacenamiento;
- logs sin exponer cookies, tokens, URLs firmadas ni credenciales;
- health checks y apagado ordenado.

### PostgreSQL

- versión compatible con las migraciones SQL;
- UUID, JSONB, enums, triggers y advisory locks;
- conexiones TLS;
- backup lógico con pg_dump y restauración con pg_restore o psql;
- retención y restauración probadas;
- una cuenta de aplicación sin privilegios de superusuario; si el pooler no soporta locks de sesión, las migraciones deben ejecutarse por una conexión o etapa administrativa separada.

### Videos

- endpoint S3 compatible con URLs firmadas PUT y GET;
- HeadObject y DeleteObject;
- bucket privado;
- CORS por origen exacto;
- límites de tamaño y MIME configurables;
- exportación de objetos con sus claves.

## Activación inicial desde el sistema anterior

Como la plataforma sigue en pruebas, la opción recomendada es una base PostgreSQL nueva. Evita trasladar deuda de Supabase Auth, políticas RLS y objetos de esquema que ya no usa la aplicación.

### 1. Preparar el ambiente

1. Crea una base PostgreSQL vacía y una cuenta de aplicación.
2. Configura DATABASE_URL, BETTER_AUTH_URL y un BETTER_AUTH_SECRET nuevo.
3. Mantén AUTH_REQUIRE_EMAIL_VERIFICATION=false durante la primera verificación si SMTP todavía no está disponible.
4. Inicia la API con DATABASE_MIGRATIONS_ENABLED=true.
5. Confirma que public.cediah_schema_migrations contiene 0001_auth.sql a 0004_subjects.sql.
6. Ejecuta health check, typecheck, tests y una prueba funcional antes de conectar usuarios.

### 2. Recrear identidades

No exportes ni copies auth.users, refresh tokens, sesiones o hashes de contraseña de Supabase Auth. Better Auth tiene su propio esquema y política de sesión.

Para un ambiente de pruebas:

1. Pide a cada participante que vuelva a registrarse.
2. Crea el primer administrator con el procedimiento de README.md.
3. Asigna los demás roles desde /panel/administracion/roles.
4. Si SMTP está habilitado, prueba recuperación únicamente con una cuenta que ya exista en Better Auth.
5. Verifica inicio, cierre de sesión y revocación después de un cambio de contraseña.

Si en el futuro existen usuarios reales que deban conservarse, prepara una migración específica de perfiles basada en correo verificado y un flujo de invitación o alta compatible con Better Auth que obligue a crear una contraseña nueva. No intentes convertir hashes de un proveedor sin documentación y pruebas independientes.

### 3. Conservar datos académicos opcionales

No restaures un pg_dump completo del proyecto Supabase encima del nuevo esquema. La implementación anterior referencia auth.users y contiene objetos que ya no pertenecen a la aplicación.

Si hay datos de prueba que valga la pena conservar:

1. Exporta únicamente tablas de dominio necesarias a CSV o a un esquema temporal.
2. Registra primero las identidades nuevas.
3. Construye una tabla de correspondencia entre correo anterior y UUID nuevo de public.auth_users.
4. Transforma todas las claves de usuario: autoría, roles, inscripciones, progreso, revisiones y auditoría.
5. Importa respetando el orden de claves foráneas.
6. Compara conteos y relaciones huérfanas.
7. Reproduce manualmente una muestra de cada workflow.

Para pocas cuentas y contenido de prueba, recrear esos datos suele ser más seguro que escribir una transformación de una sola vez.

### 4. Configurar videos

1. Crea o conserva un bucket privado.
2. Genera credenciales S3 de alcance mínimo.
3. Configura STORAGE_S3_ENDPOINT, región, bucket y credenciales en la API.
4. Autoriza por CORS solo los orígenes exactos y los métodos necesarios.
5. Configura NEXT_PUBLIC_VIDEO_STORAGE_ORIGIN en la web.
6. Agrega UUID de Better Auth a VIDEO_TEST_UPLOADER_IDS.
7. Habilita VIDEO_TEST_UPLOAD_ENABLED solo durante la prueba.
8. Sube un archivo no sensible, confirma reproducción y verifica que otra cuenta no pueda solicitarlo.

Los UUID nuevos no coincidirán necesariamente con los usados en rutas históricas de video. Los videos de prueba anteriores pueden eliminarse o copiarse a nuevas claves bajo test-videos/{newUserId}/{videoId}.

## Cambio futuro de hosting

### Fase 1: inventario

Registra:

- versiones de Node.js y PostgreSQL;
- extensiones y tamaño de la base;
- conteos por tabla;
- migraciones y checksums aplicados;
- número, tamaño y claves de objetos de video;
- dominios, certificados, CORS y DNS;
- variables de entorno sin revelar sus valores;
- volumen de correo, logs y métricas;
- RPO, RTO y ventana de mantenimiento aceptada.

### Fase 2: ensayo aislado

1. Despliega la misma revisión de la API en el destino.
2. Restaura un backup reciente de PostgreSQL.
3. Apunta DATABASE_MIGRATIONS_PATH al directorio incluido con la aplicación.
4. Arranca una sola instancia para aplicar migraciones pendientes.
5. Prueba registro, login, recuperación, roles, catálogo, progreso y workflow editorial.
6. Valida aislamiento entre cuentas.
7. Prueba carga, HEAD, reproducción firmada y borrado de un video.
8. Mide latencia, concurrencia, conexiones y tiempo de restauración.

Cuando se reutilicen la misma base, el mismo BETTER_AUTH_SECRET y el mismo origen canónico de la web, las sesiones pueden continuar. Un cambio de dominio o de alcance de cookie exige un nuevo login. Por seguridad y simplicidad, un cambio sensible también puede rotar el secreto y forzarlo; esa decisión debe comunicarse antes del corte.

### Fase 3: datos

1. Crea un pg_dump con formato custom y guarda su checksum.
2. Restaura en una base vacía.
3. Ejecuta ANALYZE después de la carga.
4. Compara conteos, claves foráneas, administradores y migraciones.
5. Si cambia el servicio S3, copia objetos conservando exactamente las claves.
6. Compara número y tamaño total de objetos y prueba una muestra con HEAD.
7. No copie URLs firmadas: son temporales y deben regenerarse desde la API.

### Fase 4: corte

1. Reduce el TTL de DNS con antelación.
2. Congela escrituras o detén la API anterior.
3. Toma un backup final y aplica el delta de objetos.
4. Restaura y valida en el destino.
5. Configura BETTER_AUTH_URL, WEB_ORIGINS, API_BASE_URL y CSP con los dominios finales.
6. Cambia tráfico.
7. Observa errores de autenticación, conexiones PostgreSQL, latencia y respuestas S3.
8. Conserva el origen en modo lectura durante la ventana de rollback.

### Fase 5: rollback

El rollback se activa ante pérdida de datos, errores generalizados de login, migraciones fallidas o acceso cruzado entre usuarios.

1. Detén escrituras en el destino.
2. Revierte DNS o routing hacia el origen.
3. Restaura cualquier escritura aceptada durante el corte o declara explícitamente la ventana afectada.
4. Rota credenciales si pudieron exponerse.
5. Conserva logs y backups para el análisis.
6. No destruyas el ambiente destino hasta cerrar el incidente.

## Validación mínima

- /health responde correctamente.
- Registro, login y logout funcionan; recuperación también cuando SMTP está habilitado.
- Las cookies son Secure en producción y no son accesibles desde JavaScript.
- Una ruta protegida rechaza solicitudes sin sesión.
- Un estudiante no accede al panel editorial.
- Un editor solo ejecuta capacidades permitidas.
- Siempre queda al menos un administrator.
- Dashboard y progreso muestran únicamente matrículas propias.
- Solo aparece contenido published.
- Los uploads editoriales no-video permanecen deshabilitados.
- La prueba de video acepta MIME/tamaño válidos y rechaza archivos inválidos.
- No existen claves de Supabase Auth, anon ni service-role en la web o la API.
- La API guarda únicamente la DATABASE_URL del rol PostgreSQL y las claves S3 de alcance limitado; ninguna llega al navegador.

## Información que debe completar el proveedor

- panel, sistema operativo y acceso;
- soporte de Docker y versión de Node.js;
- versión, límites de conexión y extensiones de PostgreSQL;
- CPU, RAM, disco, tráfico y escalado;
- política de backups, restauración y retención;
- endpoint S3, CORS y proceso de exportación;
- SMTP, DNS, TLS y observabilidad;
- SLA, soporte, residencia de datos y costos;
- restricciones de pago y facturación aplicables en Venezuela.
