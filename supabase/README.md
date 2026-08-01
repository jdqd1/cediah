# Supabase local y migraciones

Esta carpeta fue creada con la CLI oficial de Supabase. La configuracion usa Postgres 17, no autoexpone tablas nuevas y aplica una politica local de contrasenas mas estricta.

## Convencion

1. Consultar `supabase migration new --help` antes de crear una migracion.
2. Crear el archivo con `supabase migration new <nombre_descriptivo>`; no inventar timestamps.
3. Usar identificadores `snake_case`, `timestamptz`, restricciones y UUID opacos para recursos publicos.
4. Indexar todas las claves foraneas y columnas usadas en filtros o RLS.
5. Habilitar RLS en cada tabla expuesta y conceder privilegios de Data API de forma explicita.
6. Escribir politicas con `TO authenticated` mas predicados de propietario; no usar `user_metadata` para autorizacion.
7. Probar acceso permitido y denegado, ejecutar asesores y verificar la lista de migraciones antes de cerrar el cambio.

La coordinacion aprobo el alcance de la plataforma el 1 de agosto de 2026. La primera migracion crea solo la fundacion de identidad, roles, cursos, lecciones, recursos, inscripciones, progreso y auditoria; no incluye contenido academico, estudiantes ni archivos reales.

Las tablas no otorgan acceso directo a `anon` ni `authenticated`. La API sera el limite inicial de autorizacion. Cada flujo que se abra al navegador debera incorporar grants minimos, politicas RLS y pruebas de acceso permitido y denegado en una migracion posterior.
