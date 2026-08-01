# Seguridad de la base tecnica

## Estado de la contencion

El responsable del proyecto confirmo el 1 de agosto de 2026 que las credenciales historicas fueron rotadas. No se registraron, copiaron ni utilizaron sus valores durante el trabajo de la plataforma.

El archivo local historico sigue ignorado por Git. El responsable confirmo que MFA ya esta activo en las cuentas criticas. Solo falta confirmar que el archivo nunca entro en un repositorio antes de eliminarlo. No registrar valores, capturas ni fragmentos del archivo en commits o en el documento de estado.

## Controles implementados

- Archivos `.env*` ignorados; solo se versionan ejemplos sin secretos.
- Variables del servidor validadas en tiempo de ejecucion.
- CSP por solicitud con nonce en la web, mas protecciones contra framing y MIME sniffing.
- Proxy same-origin para el health check; la URL privada de la API no se expone al navegador.
- API con limites de cuerpo, CORS allowlist, cabeceras seguras y redaccion de logs.
- La web usa solo URL y clave publicable de Supabase para sesiones; `SUPABASE_SECRET_KEY` queda únicamente en entornos de API, como Render, para validar tokens.
- Respuestas de error genericas y validacion con Zod.
- Dependencias reproducibles mediante lockfile despues de la instalacion.

## Antes de produccion

- Confirmar que el archivo local historico nunca entro en Git y eliminarlo de forma segura.
- Configurar secretos en Vercel, Render y Supabase, nunca en el repositorio.
- Configurar URL del sitio, redirecciones exactas y SMTP en Supabase Auth antes de habilitar registro real.
- Separar proyectos y claves de preview/produccion.
- Habilitar RLS en cada tabla expuesta y probar acceso negativo.
- Agregar rate limiting a autenticacion y operaciones costosas.
- Ejecutar asesores de seguridad de Supabase y pruebas de cabeceras en las URLs reales.
