# CEDIAH - Plataforma educativa de anatomia

Base tecnica de la plataforma semivirtual de CEDIAH. La Fase 0 separa la web, la API y los proveedores externos para poder comenzar con Vercel, Render y Supabase y migrar mas adelante sin reescribir el producto.

## Requisitos

- Node.js 24 o superior.
- pnpm 11.9.0.
- Docker, solo para verificar la imagen de la API.
- Supabase CLI, solo cuando se trabaje con una instancia local o remota.

## Inicio local

1. Copia `.env.example` a `.env.local` solo si necesitas cambiar los valores locales. No uses secretos reales en archivos versionados.
2. Ejecuta `pnpm install`.
3. Ejecuta `pnpm dev`.
4. Abre `http://localhost:3000`. La API queda en `http://localhost:4000/health`.

También se pueden iniciar por separado con `pnpm dev:web` y `pnpm dev:api`.

## Comprobaciones

- `pnpm lint`
- `pnpm typecheck`
- `pnpm test`
- `pnpm audit --audit-level high`
- `pnpm build`

## Estructura

- `apps/web`: Next.js y TypeScript, preparado para Vercel.
- `apps/api`: Fastify y TypeScript, preparado para Render mediante Docker.
- `packages/contracts`: esquemas y contratos independientes de proveedor.
- `docs`: arquitectura, decisiones, seguridad y migracion.
- `supabase`: configuracion y migraciones versionadas cuando se inicialice el CLI.

## Seguridad

El archivo local `Cediah web.txt` esta ignorado por Git, pero eso no reemplaza la rotacion de las credenciales que contiene. No debe eliminarse hasta confirmar la rotacion y MFA. Consulta `docs/security.md`.

El nombre oficial confirmado es CEDIAH. La identidad visual y los contenidos actuales siguen siendo provisionales hasta la aprobacion de la coordinacion.

## Despliegue en Vercel

El proyecto de Vercel debe usar `apps/web` como Root Directory. El archivo `apps/web/vercel.json`:

- identifica el frontend como Next.js;
- instala el monorepo desde la raiz con el lockfile congelado;
- compila primero `@cediah/contracts` y despues `@cediah/web`;
- deja que Vercel administre la salida nativa `.next`.

En el panel de Vercel selecciona el preset Next.js, configura Root Directory como `apps/web` y no fuerces `public` como Output Directory. La API se despliega por separado en Render.

## Configuración de acceso

La web usa Supabase Auth solo para crear y mantener la sesión. Los datos académicos siguen pasando por la API y no se conceden permisos directos a tablas desde el navegador.

- En Vercel: `API_BASE_URL`, `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.
- En Render: `WEB_ORIGINS`, `SUPABASE_URL` y `SUPABASE_SECRET_KEY`. La clave secreta no se copia a Vercel ni se declara con el prefijo `NEXT_PUBLIC_`.
- En Supabase Auth: define la URL del sitio y las URL de redirección exactas para `http://localhost:3000/auth/callback`, previews autorizados y `https://cediah.vercel.app/auth/callback`; configura SMTP antes del piloto.

Después de configurar los ambientes, prueba registro, confirmación de correo, inicio y cierre de sesión, recuperación de contraseña y el acceso a `/panel` con una cuenta de prueba. La API debe validar siempre el bearer token antes de servir datos protegidos.

## Pruebas privadas de video

La ruta `/pruebas/video` está pensada para que una cuenta de prueba autorizada suba un video propio y compruebe carga y reproducción antes de introducir contenido académico real. Está desactivada por defecto y no crea cursos, matrículas ni publicaciones.

Configura únicamente en el servidor de la API:

- `VIDEO_TEST_PROVIDER=supabase` para usar el flujo gratuito de prueba. El valor `cloudflare` queda disponible para una futura cuenta de Stream con plan activo.
- `SUPABASE_STORAGE_BUCKET=video-test`, un bucket privado creado en Supabase Storage con un límite de 50 MB y los MIME `video/mp4`, `video/quicktime` y `video/webm`.
- `SUPABASE_URL` y `SUPABASE_SECRET_KEY`; la clave secreta nunca se declara en Vercel ni con el prefijo `NEXT_PUBLIC_`.
- `VIDEO_TEST_UPLOAD_ENABLED=true`.
- `VIDEO_TEST_UPLOADER_IDS` con los UUID de Supabase, separados por coma, de las cuentas que podrán realizar la prueba.
- `VIDEO_TEST_MAX_DURATION_SECONDS` y `VIDEO_TEST_MAX_FILE_BYTES` si se requieren límites menores que los valores de prueba predeterminados (15 minutos y 50 MB).
- `WEB_ORIGINS` con cada origen exacto que podrá solicitar la prueba, incluido el sitio de Vercel y `localhost` durante la prueba local.

La API emite un enlace firmado de carga, asigna el archivo a la cuenta autorizada y vuelve a emitir una URL firmada de reproducción por 10 minutos. El navegador usa el reproductor nativo HTML5 sobre Supabase Storage; no es el iframe de Cloudflare, pero permite validar el flujo real de archivo privado sin contratar Stream.

Al terminar la validación, elimina manualmente los videos de prueba desde Supabase Storage. No se deben usar grabaciones de clases, datos de pacientes, materiales de terceros ni archivos que puedan confundirse con contenido académico publicado.
