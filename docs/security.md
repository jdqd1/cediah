# Seguridad de la base tecnica

## Estado de la contencion

El responsable del proyecto confirmo el 1 de agosto de 2026 que las credenciales historicas fueron rotadas. No se registraron, copiaron ni utilizaron sus valores durante el trabajo de la plataforma.

El archivo local historico sigue ignorado por Git. Antes de eliminarlo debe confirmarse que MFA esta activo en las cuentas criticas y que el archivo nunca entro en un repositorio. No registrar valores, capturas ni fragmentos del archivo en commits o en el documento de estado.

## Controles implementados

- Archivos `.env*` ignorados; solo se versionan ejemplos sin secretos.
- Variables del servidor validadas en tiempo de ejecucion.
- CSP por solicitud con nonce en la web, mas protecciones contra framing y MIME sniffing.
- Proxy same-origin para el health check; la URL privada de la API no se expone al navegador.
- API con limites de cuerpo, CORS allowlist, cabeceras seguras y redaccion de logs.
- Respuestas de error genericas y validacion con Zod.
- Dependencias reproducibles mediante lockfile despues de la instalacion.

## Antes de produccion

- Confirmar MFA en correo, GitHub, Supabase, alojamiento y proveedor de video.
- Eliminar el archivo local historico solo despues de confirmar MFA y ausencia de copias en Git.
- Configurar secretos en Vercel, Render y Supabase, nunca en el repositorio.
- Separar proyectos y claves de preview/produccion.
- Habilitar RLS en cada tabla expuesta y probar acceso negativo.
- Agregar rate limiting a autenticacion y operaciones costosas.
- Ejecutar asesores de seguridad de Supabase y pruebas de cabeceras en las URLs reales.
