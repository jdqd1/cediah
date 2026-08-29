# Seguridad de la base técnica

## Estado de la contención

El responsable del proyecto confirmó el 1 de agosto de 2026 que las credenciales históricas fueron rotadas. No se registraron, copiaron ni utilizaron sus valores durante el trabajo de la plataforma.

El archivo local histórico sigue ignorado por Git. El responsable confirmó que MFA ya está activo en las cuentas críticas. Solo falta confirmar que el archivo nunca entró en un repositorio antes de eliminarlo. No se deben registrar valores, capturas ni fragmentos del archivo en commits o documentos de estado.

## Límites de confianza

- La web Next.js es el origen público. Las operaciones de autenticación pasan por `/api/auth/*` para que las cookies se creen en ese mismo origen.
- Fastify es el límite de identidad y autorización. Cada ruta protegida vuelve a resolver la sesión; una comprobación de interfaz nunca sustituye la autorización de la API.
- PostgreSQL conserva usuarios, sesiones, verificaciones, límites de autenticación y datos de dominio. El navegador no se conecta directamente a la base de datos.
- Supabase aloja PostgreSQL y el almacenamiento S3 del proyecto `Koraz database`, pero no actúa como límite de identidad ni de acceso de la aplicación. No se usan Supabase Auth, Data API, Realtime ni el SDK de Supabase; las tablas de CEDIAH mantienen RLS de denegación y Fastify es el único camino de acceso previsto.

## Controles implementados

- Los archivos `.env*` están ignorados; solo se versionan ejemplos sin secretos. Las variables del servidor se validan al iniciar.
- Better Auth emite cookies `HttpOnly` con `SameSite=Lax`. La web no guarda ni reenvía access tokens y las llamadas protegidas trasladan la cookie solo de servidor a servidor.
- `BETTER_AUTH_URL` y `WEB_ORIGINS` fijan el origen canónico y los orígenes confiables. Las redirecciones posteriores al acceso se limitan a rutas internas verificadas.
- Registro, acceso, recuperación y cambio de contraseña comparten validaciones y mensajes que evitan enumeración. La contraseña requiere al menos 12 caracteres y el restablecimiento revoca las sesiones existentes.
- La verificación de correo puede exigirse por ambiente. Al activarla, la configuración obliga a proporcionar SMTP. Cloudflare Turnstile puede proteger los endpoints de autenticación.
- Better Auth guarda el rate limiting en PostgreSQL. La resolución de IP debe probarse detrás de la cadena real Vercel/Render antes de producción para evitar un bucket compartido o confiar en cabeceras falsificables.
- Las migraciones activas viven en `database/migrations`, se ejecutan bajo un advisory lock y se verifican mediante checksum. Una migración aplicada no debe modificarse.
- La API aplica límites de cuerpo, CORS con allowlist, cabeceras seguras y redacción de cookies y encabezados de autorización en logs.
- La web genera CSP por solicitud con nonce, además de protecciones contra framing y MIME sniffing.
- Las credenciales S3 solo existen en la API. El navegador recibe una URL firmada limitada a la ruta del usuario y nunca recibe el access key o secret key.
- Una URL firmada de carga `PUT` no es de un solo uso: puede reutilizarse para sobrescribir la misma ruta hasta que expire. Por eso su vigencia es corta, la ruta no es elegida por el cliente y la API vuelve a validar propietario, tamaño y MIME al confirmar. Si el objeto no cumple las restricciones, la confirmación lo marca como fallido y lo elimina del bucket.
- Las cargas dinámicas de documentos e imágenes permanecen desactivadas hasta disponer de un proveedor y un proceso de validación independientes. El uso actual de Storage se limita a videos privados de prueba y a los objetos de video de publicaciones existentes.
- Las dependencias están fijadas en el lockfile para obtener instalaciones reproducibles.

## Antes de producción

- Confirmar que el archivo local histórico nunca entró en Git y eliminarlo de forma segura.
- Separar base de datos, secretos de Better Auth, SMTP, Turnstile y credenciales S3 por ambiente. No reutilizar credenciales de preview en producción.
- Usar una conexión PostgreSQL cifrada, un rol dedicado con los privilegios mínimos necesarios y respaldos restaurables. Probar las migraciones sobre una copia antes de desplegarlas.
- Generar `BETTER_AUTH_SECRET` con entropía criptográfica, documentar su rotación y asumir que cambiarlo puede invalidar sesiones.
- Activar `AUTH_REQUIRE_EMAIL_VERIFICATION=true`, configurar SMTP y comprobar registro, confirmación, recuperación, expiración y revocación con URLs reales.
- Validar cómo Vercel y Render construyen `X-Forwarded-For` y configurar proxies confiables antes de depender de la IP para rate limiting o auditoría.
- Mantener el bucket de videos privado, limitar CORS a los orígenes y métodos exactos, usar credenciales S3 exclusivas por ambiente y rotarlas periódicamente. Las claves S3 de Supabase son credenciales de servidor con acceso amplio y no sustituyen la autorización de la aplicación.
- Añadir inspección real del archivo —cabeceras mágicas, duración, códecs y, si el alcance lo requiere, análisis antimalware— antes de aceptar material de usuarios finales. `HeadObject` solo confirma metadatos declarados y tamaño.
- Definir una política de ciclo de vida y reconciliación para eliminar cargas abandonadas o inválidas, además de monitorear consumo y errores de Storage.
- Ejecutar pruebas negativas de autorización, cabeceras, cookies, CSRF, rate limiting, restauración de respaldos y URLs firmadas en los dominios alojados.
