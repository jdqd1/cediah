# ADR-0002: Supabase como hosting del PostgreSQL portable

- Estado: aceptada
- Fecha: 2026-08-29

## Contexto

La base PostgreSQL gratuita de Render tenía fecha de expiración y su continuidad requería un plan de pago. CEDIAH debe mantenerse sin costo durante la fase de pruebas, pero ya contiene cuentas Better Auth, roles, sesiones, catálogo y referencias a videos que no deben perderse.

La arquitectura definida en ADR-0001 separa el producto del proveedor: el esquema activo usa SQL PostgreSQL estándar, Better Auth vive dentro de Fastify y el navegador nunca consulta la base directamente. Esto permite cambiar el hosting sin volver a Supabase Auth ni a la Data API.

## Decisión

Alojar el esquema portable en un proyecto gratuito de Supabase dedicado a datos. La API de Render se conecta por TLS con un rol propio y de privilegios limitados a través del Transaction Pooler en el puerto 6543. Los roles anon y authenticated no reciben permisos sobre las tablas de CEDIAH y una política de denegación explícita protege cada tabla expuesta por el esquema public.

El proyecto de Supabase que ya contiene los videos continúa separado y se consume exclusivamente mediante el adaptador S3. No se incorporan Supabase Auth, el SDK de Supabase ni consultas desde el navegador.

El corte conserva íntegramente las tablas de aplicación y cediah_schema_migrations. La base anterior de Render se mantiene temporalmente sin tráfico como fuente de rollback.

El pool transaccional no garantiza el estado de sesión requerido por el advisory lock del migrador. Por ello, la API productiva usa DATABASE_MIGRATIONS_ENABLED=false. Toda migración nueva se aplica y verifica manualmente en Supabase antes de desplegar código que dependa de ella.

## Consecuencias

- El costo mensual actual de la base es cero mientras el proyecto permanezca dentro de los límites del plan gratuito.
- Un proyecto gratuito puede pausarse por inactividad y tiene límites de capacidad; se debe vigilar su estado y conservar respaldos lógicos recuperables.
- La aplicación conserva portabilidad: cambiar de proveedor requiere mover PostgreSQL y DATABASE_URL, no modificar contratos ni reglas de negocio.
- Better Auth conserva cuentas, hashes, sesiones y roles porque todos viven en las tablas portátiles de la aplicación.
- La Data API queda fuera de la ruta de ejecución. Fastify sigue siendo el único límite autorizado para acceder a datos.
- Las migraciones productivas pasan a ser una operación previa al despliegue y deben incluir comparación de checksum, conteos y prueba funcional.
- El origen de Render no debe eliminarse hasta que se complete la ventana de verificación y exista un respaldo independiente comprobado.
