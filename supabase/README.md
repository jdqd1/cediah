# Material legado de Supabase

Esta carpeta conserva la configuración y las migraciones de la arquitectura
anterior únicamente como referencia temporal. No forma parte del build, no se
ejecuta al iniciar la aplicación y no debe usarse para instalaciones nuevas.

La fuente activa del esquema es `database/migrations`. Allí, identidad,
sesiones, roles y datos del dominio viven en PostgreSQL estándar y todas las
referencias de usuario apuntan a `public.auth_users`, administrada por Better
Auth.

## Único uso vigente

Supabase permanece únicamente como proveedor S3 compatible para el bucket
privado de videos de prueba. La aplicación usa el endpoint y las credenciales
`STORAGE_S3_*`; no usa Supabase Auth, Data API, RLS, `auth.users`,
`service_role` ni el SDK de Supabase.

Las credenciales S3 se configuran solo en la API. El navegador recibe URLs
firmadas de duración limitada y nunca recibe las claves del bucket.

## No aplicar estas migraciones

Los archivos de `supabase/migrations` contienen referencias históricas a
`auth.users`, roles de Data API y Storage. Aplicarlos junto con
`database/migrations` crearía dos modelos de identidad incompatibles.

Para activar o mover la arquitectura actual, sigue `README.md`,
`database/README.md` y `docs/migration-runbook.md`. Cuando ya no sea
necesario consultar el esquema anterior, esta carpeta puede retirarse en un
cambio separado y revisable.
