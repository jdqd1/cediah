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

1. Crear una migración con Supabase CLI; no editar producción manualmente.
2. Revisar constraints, índices, RLS y grants explícitos.
3. Aplicar y probar localmente antes de preview.
4. Documentar el cambio y su reversión en `CEDIAH Web Status.docx`.
5. Ejecutar la migración en preview y después en producción con respaldo verificado.

## Criterio mínimo antes de fusionar

- `pnpm lint`
- `pnpm typecheck`
- `pnpm test`
- `pnpm audit --audit-level high`
- `pnpm build`
- Verificación en navegador de los flujos modificados, en escritorio y móvil cuando afecten la interfaz.
