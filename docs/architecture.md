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

## Recorrido academico inicial

La primera lectura academica se expone como `GET /v1/learning/dashboard` y solo devuelve cursos cuya matricula esta activa y dentro de su ventana de acceso. `PATCH /v1/learning/lessons/{lessonId}/progress` valida la identidad, comprueba la matricula del mismo usuario antes de persistir el progreso y responde como recurso inexistente cuando la leccion no le corresponde. La web solo reenvia el bearer token desde su componente de servidor; no recibe la clave secreta ni consulta tablas. Las superficies publicas de contenido y el espacio editorial se incorporan en la migracion y el corte descritos a continuacion.

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

## Contenido editorial dinámico

La migración `20260810211907_add_dynamic_content_studio.sql` incorpora `content_items`, `content_assets`, el rol `community_contributor` y un bucket privado `content-assets`. Guías, videos, cuestionarios, flashcards y temas comparten metadatos publicables, mientras su contenido específico permanece tipado y validado por los contratos Zod de la plataforma.

Fastify sigue siendo el único límite de autorización. La web obtiene la sesión SSR y la reenvía mediante rutas BFF; el navegador nunca recibe `SUPABASE_SECRET_KEY` ni escribe directamente en Postgres. La matriz de capacidades es:

- `community_contributor` y `presenter`: crean, editan y adjuntan archivos a contenido propio; pueden enviarlo a revisión.
- `academic_editor`: edita cualquier contenido, solicita cambios y aprueba.
- `coordination` y `administrator`: además pueden publicar y archivar.
- `student`, `finance_readonly` y cuentas anónimas: no acceden al espacio editorial.

El workflow permitido es `draft -> in_review -> changes_requested|approved -> published -> archived`. Toda mutación vuelve a consultar `user_roles`, aplica control de propiedad, usa versión optimista y registra una entrada en `audit_log`.

Los videos y PDF se cargan directamente al bucket privado con una URL firmada reservada por la API. El endpoint de finalización verifica propietario, permiso, existencia, tamaño y MIME reales antes de marcar el asset como listo. Las lecturas públicas solo devuelven elementos con estado `published` y emiten URLs de descarga temporales.

Las rutas públicas `/dashboard`, `/guias`, `/biblioteca` y `/biblioteca/[slug]` consumen el catálogo real. El área protegida `/panel/contenido` ofrece bandeja, filtros, formularios por tipo, carga con progreso y controles de workflow según las capacidades del usuario.

La administración de roles está separada del estudio editorial. `/panel/administracion/roles` sólo se renderiza para una identidad validada cuyo `user_roles` incluye `administrator`; permite consultar cuentas por correo y asignar o revocar un único rol por operación. La cuenta debe existir en Supabase Auth. La primera cuenta se bootstrappea una vez mediante el SQL Editor; después todas las mutaciones pasan por Fastify, se auditan y mantienen al menos un administrador.