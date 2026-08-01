# ADR-0001: Fundacion portable para pruebas

- Estado: aceptada
- Fecha: 2026-07-31

## Decision

Usar Next.js en Vercel para la web, Fastify dentro de Docker en Render para la API y Supabase para Postgres/Auth/Storage durante las pruebas. El dominio se comunica con contratos propios para permitir el reemplazo gradual de proveedores.

## Consecuencias

- La primera entrega requiere mas disciplina de interfaces y migraciones.
- El proveedor venezolano debe soportar la imagen de API o un runtime Node compatible.
- El cambio de base de datos se limita a Postgres y evita funciones propietarias sin una justificacion documentada.
