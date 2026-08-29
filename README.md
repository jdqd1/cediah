# CEDIAH - Plataforma educativa de anatomía

CEDIAH es una plataforma semivirtual compuesta por una web Next.js, una API Fastify y una base de datos PostgreSQL. La aplicación ya no usa Supabase para identidad ni para datos del dominio: la única integración restante es Supabase Storage mediante su interfaz compatible con S3, y está aislada al flujo privado de videos de prueba.

## Arquitectura actual

- apps/web: Next.js y TypeScript. Mantiene la sesión en cookies y reenvía las operaciones de autenticación a la API.
- apps/api: Fastify, Better Auth, Kysely y PostgreSQL. Es el límite de autenticación, autorización y reglas de negocio.
- packages/contracts: esquemas Zod y contratos independientes del proveedor.
- database/migrations: migraciones SQL versionadas y portátiles.
- docs: arquitectura, seguridad y procedimientos de migración.
- supabase: material legado de la implementación anterior. No es la fuente de migraciones activa.

La frontera restante con Supabase es deliberadamente pequeña:

~~~text
Navegador -> Next.js -> Fastify -> PostgreSQL
                          |
                          +-> S3 compatible -> Supabase Storage (solo videos)
~~~

## Requisitos

- Node.js 24.
- pnpm 11.9.0.
- PostgreSQL accesible desde la API.
- Un bucket privado compatible con S3 únicamente si se habilita la prueba de videos.
- Docker es opcional para comprobar la imagen de la API.

## Inicio local

1. Crea una base de datos PostgreSQL vacía para desarrollo.
2. Usa .env.example como guía y carga las variables de la API en el entorno del proceso. Para la web local puedes colocar sus variables en apps/web/.env.local.
3. Sustituye DATABASE_URL y genera un BETTER_AUTH_SECRET de al menos 32 caracteres. Por ejemplo: openssl rand -base64 32.
4. Ejecuta pnpm install.
5. Ejecuta pnpm dev.
6. Abre http://localhost:3000. La API responde en http://localhost:4000/health.

También se pueden iniciar por separado con pnpm dev:web y pnpm dev:api.

Al arrancar, la API aplica por defecto las migraciones de database/migrations. Cada archivo se ejecuta una sola vez y su checksum queda registrado en public.cediah_schema_migrations. Una migración ya aplicada no debe modificarse; cualquier cambio posterior requiere un archivo nuevo. DATABASE_MIGRATIONS_ENABLED=false desactiva esta ejecución automática y DATABASE_MIGRATIONS_PATH permite indicar otra ubicación.

## Variables esenciales

En la API:

~~~dotenv
DATABASE_URL=postgresql://cediah:replace_me@127.0.0.1:5432/cediah
DATABASE_MIGRATIONS_ENABLED=true
BETTER_AUTH_URL=http://localhost:3000
BETTER_AUTH_SECRET=replace_with_at_least_32_random_characters
AUTH_REQUIRE_EMAIL_VERIFICATION=false
WEB_ORIGINS=http://localhost:3000,http://127.0.0.1:3000
~~~

En la web:

~~~dotenv
API_BASE_URL=http://127.0.0.1:4000
NEXT_PUBLIC_SITE_URL=http://localhost:3000
~~~

DATABASE_URL, BETTER_AUTH_SECRET y BETTER_AUTH_URL son secretos o configuración de servidor y deben permanecer en la API. No uses el prefijo NEXT_PUBLIC_ para valores de base de datos, autenticación, SMTP o almacenamiento.

## Autenticación

Better Auth administra registro, inicio y cierre de sesión, recuperación de contraseña y sesiones persistidas en PostgreSQL. Las cookies son HTTP-only, SameSite=Lax y Secure en producción. La API valida la sesión en cada operación protegida; la web no consulta PostgreSQL directamente.

Para pruebas locales puede mantenerse AUTH_REQUIRE_EMAIL_VERIFICATION=false. Para exigir verificación de correo o habilitar recuperación de contraseña, configura SMTP_HOST y SMTP_FROM; SMTP_USER y SMTP_PASSWORD son opcionales pero deben definirse juntos. TURNSTILE_SECRET_KEY en la API y NEXT_PUBLIC_TURNSTILE_SITE_KEY en la web habilitan Cloudflare Turnstile.

Las cuentas de Supabase Auth no se migran automáticamente. En particular, no se copian contraseñas ni sesiones. Para este entorno de pruebas, la opción recomendada es que cada usuario vuelva a registrarse con Better Auth. La recuperación por correo solo funciona después de que la cuenta ya existe en el nuevo sistema y se configura SMTP.

### Bootstrap del primer administrador

Registra primero la cuenta mediante la aplicación. Después ejecuta el siguiente bloque en la base de datos PostgreSQL, cambiando el correo:

~~~sql
do $$
declare
  admin_id uuid;
begin
  select id into admin_id
  from public.auth_users
  where lower(email) = lower('admin@universidad.edu')
  limit 1;

  if admin_id is null then
    raise exception 'Primero registra la cuenta en CEDIAH';
  end if;

  insert into public.user_roles (user_id, role, assigned_by)
  values (admin_id, 'administrator', admin_id)
  on conflict (user_id, role) do nothing;
end;
$$;
~~~

Después inicia sesión y abre /panel/administracion/roles. La API vuelve a comprobar el rol en cada petición, audita las mutaciones y la base de datos impide eliminar al último administrador.

## Videos privados de prueba

El flujo /pruebas/video conserva Supabase exclusivamente como almacenamiento S3 compatible. La API genera URLs firmadas de carga PUT y reproducción; las credenciales S3 nunca llegan al navegador. Para habilitarlo configura solo en la API:

~~~dotenv
VIDEO_TEST_PROVIDER=s3
VIDEO_TEST_UPLOAD_ENABLED=true
VIDEO_TEST_UPLOADER_IDS=UUID_DE_UNA_CUENTA_BETTER_AUTH
STORAGE_S3_ENDPOINT=https://PROJECT_REF.storage.supabase.co/storage/v1/s3
STORAGE_S3_REGION=us-east-1
STORAGE_S3_ACCESS_KEY_ID=replace_me
STORAGE_S3_SECRET_ACCESS_KEY=replace_me
STORAGE_S3_FORCE_PATH_STYLE=true
CONTENT_STORAGE_BUCKET=content-assets
VIDEO_STORAGE_BUCKET=video-test
VIDEO_TEST_MAX_DURATION_SECONDS=900
VIDEO_TEST_MAX_FILE_BYTES=50000000
~~~

En la web, NEXT_PUBLIC_VIDEO_STORAGE_ORIGIN debe contener solo el origen del endpoint de Storage para que la política CSP permita cargar y reproducir los archivos. El bucket debe ser privado y su CORS debe autorizar los orígenes exactos de la web y los métodos PUT, GET y HEAD necesarios. No uses service-role ni claves de Supabase Auth/Database.

Los archivos se organizan por propietario bajo test-videos/{userId}/{videoId}. La API confirma existencia, MIME y tamaño antes de considerarlos listos. La prueba admite MP4, QuickTime y WebM, y sigue estando desactivada por defecto.

Las publicaciones históricas conservan sus objetos en el bucket privado content-assets. Cuando las credenciales S3 están configuradas, la API genera una URL GET de corta duración únicamente al abrir el detalle publicado; el catálogo nunca expone claves ni credenciales del almacenamiento.

## Contenido editorial

El catálogo, workflow, roles, auditoría, cursos, inscripciones y progreso viven en PostgreSQL. El contenido se crea como borrador, puede pasar por revisión y solo se expone públicamente después de ser publicado.

Los uploads dinámicos de archivos editoriales no-video están deshabilitados temporalmente. Guías basadas en texto, cuestionarios, flashcards, temas y videos referenciados mediante URL externa pueden seguir probándose. El flujo privado /pruebas/video es independiente y no publica contenido académico.

## Comprobaciones

- pnpm lint
- pnpm typecheck
- pnpm test
- pnpm audit --audit-level high
- pnpm build

## Despliegue

La web y la API pueden desplegarse en proveedores diferentes. En Vercel, apps/web debe ser el Root Directory y API_BASE_URL debe apuntar a la API pública. La API requiere conectividad TLS hacia PostgreSQL, BETTER_AUTH_URL con el origen canónico de la web, WEB_ORIGINS con orígenes exactos y un secreto de autenticación distinto por ambiente.

Los ambientes de desarrollo, preview y producción no deben compartir base de datos, secretos ni buckets. Consulta docs/architecture.md para los límites y docs/migration-runbook.md para mover PostgreSQL o reemplazar el almacenamiento de videos.

## Seguridad

No versiones secretos. El archivo local Cediah web.txt está ignorado por Git, pero eso no reemplaza la rotación de sus credenciales ni MFA. Consulta docs/security.md.

El nombre oficial confirmado es CEDIAH. La identidad visual y el contenido académico siguen sujetos a aprobación de coordinación.
