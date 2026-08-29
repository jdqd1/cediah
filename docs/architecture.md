# Arquitectura portable de CEDIAH

## Objetivo

Mantener el dominio de CEDIAH independiente del hosting. La web, la API, la identidad, la persistencia y el almacenamiento se comunican mediante límites propios para que cambiar Vercel, Render, PostgreSQL administrado o el proveedor de objetos no obligue a reescribir el producto.

El desacoplamiento ya está aplicado en identidad y datos. Supabase aloja actualmente PostgreSQL estándar y, en otro proyecto, el bucket S3 de videos; la aplicación no depende de Supabase Auth, del SDK ni de la Data API.

## Distribución

~~~text
Navegador
   |
   | HTTPS + cookies de sesión
   v
Next.js
   |
   | BFF/proxy: Cookie + contratos HTTP
   v
Fastify
   |             |                 |
   |             |                 +--> SMTP / Turnstile opcionales
   |             |
   |             +--> adaptador S3 --> Supabase Storage (proyecto de archivos)
   |
   +--> Kysely --> PostgreSQL estándar --> Supabase Postgres (proyecto de datos)
         |
         +--> Better Auth
         +--> dominio académico y editorial
~~~

## Responsabilidades

### Web

apps/web contiene la interfaz Next.js. El navegador habla con rutas del mismo origen para autenticación y la web reenvía las cookies a Fastify cuando renderiza recursos protegidos. La web puede ocultar superficies sin sesión como ayuda de experiencia, pero no es un límite de autorización.

La web no recibe DATABASE_URL, BETTER_AUTH_SECRET, credenciales SMTP ni credenciales S3. NEXT_PUBLIC_VIDEO_STORAGE_ORIGIN solo amplía la política CSP para el origen de carga y reproducción; no concede acceso por sí mismo.

### API

apps/api es el límite de confianza:

- valida la sesión de Better Auth;
- consulta roles desde PostgreSQL;
- aplica propiedad y capacidades editoriales;
- valida los contratos Zod;
- ejecuta las reglas de workflow;
- registra mutaciones relevantes en audit_log;
- emite URLs firmadas para videos privados;
- nunca confía en roles o identificadores enviados por el navegador.

La API es stateless fuera de PostgreSQL y de los servicios configurados. Puede ejecutarse como proceso Node.js o en un contenedor.

### Contratos

packages/contracts contiene formas de entrada, respuesta e interfaces de proveedores. Ningún contrato de dominio expone un cliente Supabase, una service-role key ni tipos de Auth específicos de un proveedor.

### PostgreSQL

PostgreSQL almacena identidad y dominio:

- auth_users, auth_sessions, auth_accounts, auth_verifications y auth_rate_limits para Better Auth;
- profiles y user_roles;
- cursos, módulos, lecciones, recursos, inscripciones y progreso;
- catálogo editorial, assets como metadatos, asignaturas y auditoría.

Los adaptadores de apps/api/src/providers realizan las consultas mediante Kysely. La API es el único camino de acceso previsto para la aplicación; el navegador no tiene credenciales de base de datos.

En producción, Supabase solo presta el servicio PostgreSQL administrado. La API se conecta con un rol propio mediante el Transaction Pooler; anon y authenticated no tienen privilegios sobre las tablas de CEDIAH y no se usa la Data API.

## Migraciones

La fuente activa está en database/migrations:

| Archivo | Responsabilidad |
| --- | --- |
| 0001_auth.sql | Tablas, índices y triggers de Better Auth |
| 0002_platform.sql | Perfiles, roles, cursos, inscripciones, progreso y auditoría |
| 0003_content.sql | Catálogo editorial, workflow y metadatos de assets |
| 0004_subjects.sql | Asignaturas y relación con contenido |

Cuando el proveedor ofrece una conexión de sesión, la API puede tomar un advisory lock, crear public.cediah_schema_migrations, comparar checksums y ejecutar en transacción cada archivo pendiente. Un checksum diferente para una migración aplicada detiene el arranque. Esta política evita cambios silenciosos de esquema durante un despliegue concurrente.

La producción actual usa el Transaction Pooler de Supabase, que no conserva estado de sesión para ese lock. Por ello el arranque automático está desactivado con DATABASE_MIGRATIONS_ENABLED=false. Un operador aplica cada migración pendiente antes del despliegue y confirma su nombre y checksum en public.cediah_schema_migrations.

Los archivos de supabase/migrations pertenecen a la implementación anterior. No deben aplicarse en instalaciones nuevas ni mezclarse con database/migrations.

## Identidad y sesión

Better Auth se ejecuta dentro de Fastify y persiste todo en PostgreSQL. Next.js expone un proxy de mismo origen bajo /api/auth para que el navegador reciba cookies HTTP-only sin conocer la ubicación interna de la API.

Características actuales:

- correo y contraseña con mínimo de 12 caracteres;
- cookies HTTP-only, SameSite=Lax y Secure en producción;
- rate limiting persistido en la base de datos;
- revocación de sesiones al restablecer la contraseña;
- verificación de correo configurable;
- SMTP y Cloudflare Turnstile opcionales;
- identidad revalidada por Fastify en toda operación protegida.

BETTER_AUTH_URL debe ser el origen canónico visible de la web, no la URL interna de PostgreSQL ni una antigua URL de Supabase. WEB_ORIGINS contiene una lista exacta de orígenes autorizados.

Las contraseñas y sesiones anteriores de Supabase Auth no forman parte de esta arquitectura. Las cuentas deben recrearse mediante Better Auth; la recuperación de contraseña solo está disponible para cuentas que ya existen en el nuevo esquema.

## Autorización

La creación de una cuenta genera su perfil y el rol student mediante un trigger de PostgreSQL. Los roles adicionales son administrados por un administrator a través de la API:

- community_contributor y presenter crean y editan contenido permitido;
- academic_editor revisa y aprueba;
- coordination y administrator publican y archivan;
- solo administrator administra roles;
- un trigger impide eliminar al último administrador.

El workflow editorial es draft -> in_review -> changes_requested o approved -> published -> archived. Las transiciones, propiedad y versión optimista se validan en la API y las acciones se auditan.

Las rutas de lectura académica también validan que cursos, lecciones, inscripciones y progreso pertenezcan al usuario autenticado. Una ausencia de autorización se responde sin revelar recursos ajenos.

## Almacenamiento de videos

Para archivos, Supabase se usa únicamente mediante su endpoint S3 compatible y un proyecto separado del PostgreSQL productivo. La implementación depende de las operaciones estándar PutObject, GetObject, HeadObject y DeleteObject, no del SDK de Supabase.

El flujo es:

1. Una cuenta autorizada solicita una carga de prueba.
2. La API crea un UUID y una URL firmada PUT bajo test-videos/{userId}/{videoId}.
3. El navegador carga directamente al bucket.
4. La API confirma existencia, tamaño y MIME mediante HEAD.
5. Para reproducir, la API emite una URL GET de duración limitada y ligada al propietario.

Cambiar Supabase Storage por otro servicio compatible con S3 debería requerir únicamente endpoint, región, bucket y credenciales. Un proveedor sin compatibilidad S3 requerirá un nuevo adaptador que implemente el mismo contrato de video.

Este flujo es deliberadamente independiente del catálogo académico. Los uploads dinámicos de assets editoriales no-video están deshabilitados hasta que exista una estrategia de almacenamiento portable y verificada. Los metadatos históricos de content_assets pueden permanecer en PostgreSQL, pero no se emiten nuevas cargas desde el estudio editorial.

## Ambientes

| Ambiente | Web | API | PostgreSQL | Videos |
| --- | --- | --- | --- | --- |
| Local | localhost:3000 | localhost:4000 | Base local o administrada de desarrollo | Desactivados por defecto |
| Preview | Preview aislado | API de prueba | Base de prueba | Bucket de prueba separado |
| Producción | Vercel | Render | Supabase Postgres, proyecto de datos | Supabase Storage, proyecto de archivos |

Los ambientes no deben compartir DATABASE_URL, BETTER_AUTH_SECRET, credenciales SMTP, cuentas S3 ni buckets. La verificación de correo puede permanecer desactivada solo durante pruebas controladas.

## Portabilidad lograda

Para mover la API o la web a otro hosting no se necesita modificar el dominio. Se trasladan el proceso Node.js, las variables y la conectividad. Para mover los datos se usa pg_dump/pg_restore y después se valida la tabla de migraciones. Para mover videos se copian objetos conservando sus claves o se introduce un adaptador equivalente.

Quedan tres dependencias operativas, no estructurales:

- un servicio PostgreSQL;
- un mecanismo de correo si se activa verificación o recuperación;
- un servicio de objetos S3 compatible para videos.

Supabase aloja los servicios PostgreSQL y S3 actuales, pero no define el modelo de identidad ni el acceso del producto. Registro, login y sesiones pertenecen a Better Auth; roles, auditoría y contenido pertenecen al esquema SQL portable y solo se exponen mediante Fastify.
