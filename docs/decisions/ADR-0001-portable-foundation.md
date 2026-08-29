# ADR-0001: Fundación portable para pruebas

- Estado: aceptada; detalles de hosting actualizados por ADR-0002
- Fecha: 2026-07-31
- Actualizada: 2026-08-27

ADR-0002 adopta posteriormente Supabase como hosting del PostgreSQL portable y consolida PostgreSQL y Storage en un único proyecto. Esa decisión no cambia los límites de Better Auth, Fastify ni los adaptadores definidos aquí.

## Contexto

La primera versión usó Supabase para PostgreSQL, Auth y Storage. Ese alcance facilitó las pruebas iniciales, pero trasladó al proveedor decisiones de identidad, sesión, acceso a datos y archivos. El proyecto necesita poder cambiar de hosting sin reescribir el dominio ni el navegador.

## Decisión

Usar Next.js para la web, Fastify dentro de Docker para la API y PostgreSQL estándar para la persistencia. Better Auth, ejecutado por Fastify, administra registro, login, sesiones mediante cookies y recuperación de contraseña sobre tablas propias en PostgreSQL.

La web se comunica con la API mediante contratos de `packages/contracts` y no consulta tablas directamente. Las implementaciones PostgreSQL usan Kysely detrás de interfaces de dominio. Las migraciones activas son los archivos SQL versionados de `database/migrations`.

Supabase permanece únicamente como proveedor S3 compatible del bucket privado de videos de prueba. Esta integración está detrás de un adaptador genérico que recibe endpoint, región, bucket y credenciales; no utiliza el SDK, Auth ni la Data API de Supabase. Documentos e imágenes no se cargan dinámicamente mientras no exista un proveedor independiente.

Vercel y Render son destinos actuales de despliegue, no requisitos del dominio. Otro proveedor puede alojar la web, la imagen Node/Docker y una base PostgreSQL compatible sin cambiar los contratos públicos.

## Consecuencias

- La identidad y los datos académicos ya no dependen de un proyecto Supabase. Cambiar de hosting requiere trasladar PostgreSQL y variables de entorno, no reescribir la aplicación.
- Las cuentas, hashes y sesiones anteriores de Supabase Auth no se reutilizan. Durante las pruebas los usuarios deben registrarse de nuevo en Better Auth.
- La sesión se mantiene en una cookie `HttpOnly` del origen web. El proxy same-origin reenvía las solicitudes de Better Auth y las rutas de servidor trasladan la cookie a Fastify; la autorización definitiva siempre ocurre en la API.
- El equipo asume responsabilidad directa por migraciones, respaldos, correo transaccional, rate limiting, rotación de secretos y actualizaciones de Better Auth.
- Una actualización de Better Auth puede requerir una migración SQL explícita. Su versión y esquema se revisan juntos.
- La dependencia restante de Supabase está limitada a objetos de video. Puede sustituirse por otro servicio S3 compatible mediante configuración; un servicio sin S3 requiere otro adaptador del mismo contrato.
- Las URLs firmadas reducen la exposición de credenciales, pero un `PUT` firmado puede reutilizarse hasta expirar. La API debe mantener vigencias cortas, rutas controladas y validación posterior, además de borrar objetos inválidos.
- La primera entrega requiere más disciplina de interfaces, pruebas de integración y migraciones, a cambio de una frontera de proveedores explícita.
