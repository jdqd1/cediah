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

- En Vercel: `API_BASE_URL`, `NEXT_PUBLIC_SITE_URL=https://koraz-app.vercel.app`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` y `NEXT_PUBLIC_TURNSTILE_SITE_KEY`. La cookie de sesión se marca `Secure` automáticamente en producción; `NEXT_PUBLIC_SUPABASE_COOKIE_SECURE=false` se reserva exclusivamente para probar `next start` sobre HTTP local.
- En Render: la API usa `WEB_ORIGINS=https://koraz-app.vercel.app,https://cediah.vercel.app`, `SUPABASE_URL`, `SUPABASE_SECRET_KEY` y `SUPABASE_CONTENT_BUCKET=content-assets`; el servicio web usa `NEXT_PUBLIC_SITE_URL=https://koraz-app.vercel.app`. La clave secreta no se copia a Vercel ni se declara con el prefijo `NEXT_PUBLIC_`.
- En Supabase Auth: define `https://koraz-app.vercel.app` como URL del sitio y autoriza `https://koraz-app.vercel.app/auth/callback`. Conserva temporalmente `https://cediah.vercel.app/auth/callback` para enlaces emitidos antes de la migración, además de `http://localhost:3000/auth/callback` y únicamente los previews necesarios. No uses comodines en producción.
- Activa confirmación de correo, cambio seguro de contraseña y SMTP propio. Configura una longitud mínima de 12, exige mayúscula, minúscula, número y símbolo y, en planes compatibles, activa la protección de contraseñas filtradas.
- Activa Cloudflare Turnstile en Supabase Auth con su clave secreta y coloca solo la site key pública en `NEXT_PUBLIC_TURNSTILE_SITE_KEY`. Los formularios de acceso, registro y recuperación enviarán el token a Supabase. Conserva los límites de Auth para inicio/registro y correo; ajústalos con datos reales sin penalizar redes universitarias compartidas.
- En planes compatibles, aplica sesiones con un máximo de 30 días y 7 días de inactividad. El access token permanece en una hora y la rotación de refresh tokens debe seguir activa con el intervalo de reutilización recomendado de 10 segundos.

`https://koraz-app.vercel.app` es el origen canónico. Vercel redirige permanentemente `https://cediah.vercel.app`, y la configuración de Next.js aplica la misma redirección al dominio legado y a `https://web-cediah.onrender.com`, conservando la ruta y los parámetros de consulta.

Después de configurar los ambientes, prueba registro, confirmación de correo, inicio y cierre de sesión, recuperación de contraseña y revocación de sesiones anteriores. Comprueba también que `/dashboard`, las rutas de estudio y `/panel` redirigen al acceso sin una sesión válida, incluso mediante navegación RSC o prefetch. La API debe validar siempre el bearer token antes de servir datos protegidos.

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

## Contenido dinámico y espacio editorial

Después de aplicar las migraciones de Supabase, una cuenta autorizada puede abrir `/panel/contenido` para crear videos, guías, cuestionarios, flashcards y temas. El contenido comienza como borrador, pasa por revisión y solo aparece en `/dashboard`, `/guias` y `/biblioteca` después de que coordinación o un administrador lo publique.

Los roles se asignan en `public.user_roles` desde un proceso administrativo de servidor o el SQL Editor de Supabase. Para autorizar a un miembro de la comunidad, usa UUID reales de `auth.users`:

```sql
insert into public.user_roles (user_id, role, assigned_by)
values ('UUID_DEL_COLABORADOR', 'community_contributor', 'UUID_DEL_ADMINISTRADOR')
on conflict (user_id, role) do nothing;
```

`community_contributor` y `presenter` administran contenido propio; `academic_editor` revisa y aprueba; `coordination` y `administrator` publican. No concedas `service_role` al navegador ni abras grants directos a `authenticated` para este flujo.

El bucket `content-assets` se crea privado con límites de MIME y tamaño. La API reserva la ruta, entrega una URL firmada y valida el objeto antes de finalizarlo. Configura `SUPABASE_CONTENT_BUCKET=content-assets` solo en Render o en el proceso local de la API.

### Bootstrap del primer administrador

La primera cuenta administradora se crea una sola vez desde el SQL Editor porque todavía no existe una cuenta con permiso para abrir la pantalla de roles:

1. Crea y confirma la cuenta en Supabase Auth (Authentication > Users).
2. Sustituye el correo del siguiente bloque y ejecútalo en el proyecto correcto:

```sql
do $$
declare
  admin_id uuid;
begin
  select id into admin_id
  from auth.users
  where lower(email) = lower('admin@universidad.edu')
  limit 1;

  if admin_id is null then
    raise exception 'Primero crea y confirma la cuenta en Supabase Auth';
  end if;

  insert into public.user_roles (user_id, role, assigned_by)
  values (admin_id, 'administrator', admin_id)
  on conflict (user_id, role) do nothing;
end;
$$;
```

3. Inicia sesión con esa cuenta y abre `/panel/administracion/roles` (también aparece en el menú de Gestión de contenido).
4. Escribe el correo exacto de una cuenta existente, pulsa **Consultar cuenta**, elige **Asignar rol** o **Revocar rol**, selecciona el rol y guarda.

El rol `administrator` es el máximo y es el único que puede gestionar roles. La API vuelve a comprobarlo en cada petición, registra la acción en `audit_log` y la migración `20260810215000_add_administrator_role_guard.sql` impide eliminar al último administrador. Asignar o revocar un rol no crea ni elimina cuentas; tampoco concede `service_role` al navegador.
