# Arquitectura de la Fase 0

## Objetivo

Evitar acoplar el dominio de CEDIAH a Vercel, Render, Supabase o un proveedor de pagos. La aplicacion consume contratos propios y cada proveedor se integra mediante adaptadores.

## Distribucion inicial

```text
Navegador
   |
   v
Next.js / Vercel  ----->  Fastify / Render  ----->  Postgres / Supabase
   |                              |                         |
   +-- proxy de salud             +-- reglas de dominio     +-- RLS y migraciones
```

## Limites

- La web nunca recibe secretos de servidor ni claves `service_role`.
- La API es stateless y se configura mediante variables de entorno.
- Los contratos de identidad, almacenamiento, video, correo y pagos viven en `packages/contracts`.
- Las migraciones usan SQL compatible con Postgres y se versionan en `supabase/migrations`.
- Los archivos de usuario no se guardaran en el filesystem efimero de Render.

## Fundacion de datos

La primera migracion de Supabase crea perfiles minimos, roles gestionados por servidor, cursos, modulos, lecciones, recursos, inscripciones, progreso y auditoria. No incorpora contenido academico, estudiantes ni archivos reales.

Todas las tablas de `public` tienen RLS activado y no conceden privilegios a `anon` ni `authenticated`. La API sera el unico limite inicial de autorizacion; una pantalla no accedera a una tabla directamente hasta que su migracion incorpore grants minimos, politicas RLS y pruebas de acceso positivo y negativo.

## Identidad y sesión

La web crea la sesión de Supabase Auth con la clave publicable y la conserva en cookies SSR. El proxy refresca claims verificados con `getClaims`; el servidor reenvía el access token a `GET /v1/auth/me` y Fastify lo valida de nuevo mediante `auth.getUser` con una clave secreta que solo existe en Render. Ninguna decisión de autorización usa `user_metadata`, una sesión sin token validado no habilita el panel y la web no consulta tablas directamente.

El registro, confirmación por callback, recuperación y actualización de contraseña requieren que Supabase tenga autorizadas las URL de redirección del ambiente y SMTP configurado antes de probar con usuarios reales.

Las migraciones iniciales son `20260801172906_initial_platform_foundation.sql` y `20260801173029_add_platform_foreign_key_indexes.sql`. Sus indices cubren todas las claves foraneas y los asesores de Supabase no reportan defectos de seguridad ni claves foraneas sin indice.

## Ambientes

| Ambiente | Web | API | Datos | Uso |
| --- | --- | --- | --- | --- |
| Local | localhost:3000 | localhost:4000 | Supabase local o proyecto de desarrollo | Desarrollo |
| Preview | Vercel Preview | Render de prueba | Proyecto Supabase de pruebas | QA por cambio |
| Produccion | Vercel | Render | Proyecto Supabase de produccion | Piloto aprobado |

Los ambientes no comparten bases de datos, buckets ni secretos.
