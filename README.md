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
