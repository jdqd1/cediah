# Seguridad de la base tecnica

## Bloqueo actual

Existe un archivo local con credenciales historicas. Git lo ignora, pero las credenciales deben rotarse y protegerse con MFA antes de eliminarlo. No registrar valores, capturas ni fragmentos de ese archivo en commits o en el documento de estado.

## Controles implementados

- Archivos `.env*` ignorados; solo se versionan ejemplos sin secretos.
- Variables del servidor validadas en tiempo de ejecucion.
- CSP por solicitud con nonce en la web, mas protecciones contra framing y MIME sniffing.
- Proxy same-origin para el health check; la URL privada de la API no se expone al navegador.
- API con limites de cuerpo, CORS allowlist, cabeceras seguras y redaccion de logs.
- Respuestas de error genericas y validacion con Zod.
- Dependencias reproducibles mediante lockfile despues de la instalacion.

## Antes de produccion

- Rotar credenciales y activar MFA.
- Configurar secretos en Vercel, Render y Supabase, nunca en el repositorio.
- Separar proyectos y claves de preview/produccion.
- Habilitar RLS en cada tabla expuesta y probar acceso negativo.
- Agregar rate limiting a autenticacion y operaciones costosas.
- Ejecutar asesores de seguridad de Supabase y pruebas de cabeceras en las URLs reales.
