# Arquitectura de la Fase 0

## Objetivo

Evitar acoplar el dominio de CEDIAH a Vercel, Render, Supabase o un proveedor de pagos. La aplicacion consume contratos propios y cada proveedor se integra mediante adaptadores.

## Distribucion inicial

```text
Navegador
   |
   v
Next.js / Vercel  ----->  Fastify / Render  ----->  Postgres / Supabase
   |                              |                         |
   +-- proxy de salud             +-- reglas de dominio     +-- RLS y migraciones
```

## Limites

- La web nunca recibe secretos de servidor ni claves `service_role`.
- La API es stateless y se configura mediante variables de entorno.
- Los contratos de identidad, almacenamiento, video, correo y pagos viven en `packages/contracts`.
- Las migraciones usan SQL compatible con Postgres y se versionan en `supabase/migrations`.
- Los archivos de usuario no se guardaran en el filesystem efimero de Render.

## Ambientes

| Ambiente | Web | API | Datos | Uso |
| --- | --- | --- | --- | --- |
| Local | localhost:3000 | localhost:4000 | Supabase local o proyecto de desarrollo | Desarrollo |
| Preview | Vercel Preview | Render de prueba | Proyecto Supabase de pruebas | QA por cambio |
| Produccion | Vercel | Render | Proyecto Supabase de produccion | Piloto aprobado |

Los ambientes no comparten bases de datos, buckets ni secretos.
