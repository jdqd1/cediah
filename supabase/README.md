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

## Estudio de contenido dinámico

La migración `20260810211907_add_dynamic_content_studio.sql` crea el catálogo publicable, los assets privados y el rol `community_contributor`. El acceso desde navegador permanece revocado para `anon` y `authenticated`; `service_role` es utilizado únicamente por Fastify.

El bucket `content-assets` se crea o corrige como privado, con límite de 500 MB y una allowlist para MP4, MOV, WebM, PDF, JPEG, PNG y WebP. La API valida nuevamente clase, MIME, tamaño, propietario y estado editorial antes de finalizar cada carga.

Antes de promover la migración, ejecuta la lista y los asesores contra el proyecto de destino, prueba una carga con una cuenta colaboradora y confirma que una cuenta estudiante recibe `403` en `/v1/editor/content`.

## Administración de roles

La migración `20260810215000_add_administrator_role_guard.sql` protege el último administrador. Para el bootstrap inicial crea y confirma una cuenta en Auth y ejecuta en el SQL Editor:

```sql
insert into public.user_roles (user_id, role, assigned_by)
select id, 'administrator', id
from auth.users
where lower(email) = lower('admin@universidad.edu')
on conflict (user_id, role) do nothing;
```

Después de ese paso, la pantalla `/panel/administracion/roles` permite consultar por correo y asignar o revocar `student`, `community_contributor`, `presenter`, `academic_editor`, `coordination`, `finance_readonly` o `administrator`. Sólo `administrator` puede abrirla; nunca se puede eliminar el último administrador.