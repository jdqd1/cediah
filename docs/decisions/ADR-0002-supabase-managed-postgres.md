# ADR-0002: Supabase como hosting del PostgreSQL portable

- Estado: aceptada
- Fecha: 2026-08-29

## Contexto

La base PostgreSQL gratuita de Render tenía fecha de expiración y su continuidad requería un plan de pago. CEDIAH debe mantenerse sin costo durante la fase de pruebas, pero ya contiene cuentas Better Auth, roles, sesiones, catálogo y referencias a videos que no deben perderse.

La arquitectura definida en ADR-0001 separa el producto del proveedor: el esquema activo usa SQL PostgreSQL estándar, Better Auth vive dentro de Fastify y el navegador nunca consulta la base directamente. Esto permite cambiar el hosting sin volver a Supabase Auth ni a la Data API.

## Decisión

Alojar el esquema portable y los buckets privados en un único proyecto gratuito de Supabase, llamado `Koraz database`, conservando interfaces y credenciales separadas para PostgreSQL y S3. La API de Render se conecta a PostgreSQL por TLS con un rol propio y de privilegios limitados a través del Transaction Pooler en el puerto 6543. Los roles anon y authenticated no reciben permisos sobre las tablas de CEDIAH y una política de denegación explícita protege cada tabla expuesta por el esquema public.

Los buckets `content-assets` y `video-test` se consumen exclusivamente mediante el adaptador S3. La consolidación conservó todas las claves, tamaños, tipos MIME y ETags; Render y Vercel se cambiaron al nuevo origen antes de eliminar `Web CEDIAH`. No se incorporan Supabase Auth, el SDK de Supabase ni consultas desde el navegador.

El corte conserva íntegramente las tablas de aplicación y cediah_schema_migrations. La base anterior de Render se mantiene temporalmente sin tráfico como fuente de rollback.

El pool transaccional no garantiza el estado de sesión requerido por el advisory lock del migrador. Por ello, la API productiva usa DATABASE_MIGRATIONS_ENABLED=false. Toda migración nueva se aplica y verifica manualmente en Supabase antes de desplegar código que dependa de ella.

## Consecuencias

- El costo mensual actual de PostgreSQL y Storage en Supabase es cero mientras el proyecto permanezca dentro de los límites del plan gratuito.
- PostgreSQL y Storage consumen las cuotas del mismo proyecto gratuito, por lo que deben vigilarse conjuntamente el tamaño de base, archivos y egreso.
- Un proyecto gratuito puede pausarse por inactividad y tiene límites de capacidad; se debe vigilar su estado y conservar respaldos lógicos recuperables.
- La aplicación conserva portabilidad: cambiar de proveedor requiere mover PostgreSQL y DATABASE_URL, no modificar contratos ni reglas de negocio.
- Better Auth conserva cuentas, hashes, sesiones y roles porque todos viven en las tablas portátiles de la aplicación.
- La Data API queda fuera de la ruta de ejecución. Fastify sigue siendo el único límite autorizado para acceder a datos.
- Las migraciones productivas pasan a ser una operación previa al despliegue y deben incluir comparación de checksum, conteos y prueba funcional.
- El origen de Render no debe eliminarse hasta que se complete la ventana de verificación y exista un respaldo independiente comprobado.
