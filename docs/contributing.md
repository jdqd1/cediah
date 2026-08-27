# Flujo de contribución

## Ramas y protección

- `main` representa una versión verificable del producto.
- Al publicar el repositorio remoto, `main` debe protegerse: sin pushes directos, revisión obligatoria y CI verde antes de fusionar.
- Cada cambio se desarrolla en una rama breve con el prefijo `feat/`, `fix/`, `docs/` o `chore/`.

## Commits

Se usan Conventional Commits para que el historial sea legible y portable:

- `feat:` nueva capacidad visible o de dominio.
- `fix:` corrección de comportamiento.
- `docs:` documentación sin cambio funcional.
- `test:` pruebas nuevas o corregidas.
- `chore:` mantenimiento, configuración o dependencias.

No se incluyen secretos, credenciales, archivos `.env` ni datos reales de participantes.

## Migraciones de base de datos

La fuente activa de esquema es `database/migrations`. La carpeta `supabase/migrations` es material histórico y no debe aplicarse en ambientes nuevos.

1. Crear el siguiente archivo numerado `NNNN_nombre_descriptivo.sql` en `database/migrations`; mantener SQL compatible con PostgreSQL y evitar APIs propias de un proveedor salvo decisión documentada.
2. Revisar constraints, claves foráneas, índices, transacciones, concurrencia y compatibilidad con el esquema configurado de Better Auth. El navegador no recibe grants directos a las tablas.
3. Probar la migración desde una base vacía y desde la última versión aplicada mediante `pnpm db:migrate` usando una base de desarrollo aislada.
4. Ejecutar typecheck y pruebas de proveedores. Los cambios de autenticación deben comprobar registro, sesión, expiración, recuperación y autorización negativa.
5. No modificar una migración que ya fue aplicada: su checksum es inmutable. Corregirla mediante una migración nueva y documentar el procedimiento de recuperación.
6. Aplicar primero en preview, verificar un respaldo restaurable y después promover a producción. Nunca ejecutar SQL manual no versionado como sustituto de una migración.

Los cambios que alteren tablas de Better Auth deben compararse con el esquema requerido por la versión fijada en `apps/api/package.json`. Una actualización del paquete no se fusiona hasta generar y revisar las diferencias de esquema.

## Criterio mínimo antes de fusionar

- `pnpm lint`
- `pnpm typecheck`
- `pnpm test`
- `pnpm audit --audit-level high`
- `pnpm build`
- Verificación en navegador de los flujos modificados, en escritorio y móvil cuando afecten la interfaz.
- Para cambios de persistencia: migración probada sobre PostgreSQL real y restauración o estrategia de avance documentada.
