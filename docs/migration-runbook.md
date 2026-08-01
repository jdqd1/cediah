# Runbook de migracion a proveedor venezolano

Estado: borrador tecnico. Debe completarse cuando el proveedor entregue sus especificaciones.

## Condiciones minimas del proveedor destino

- Node.js 24 o contenedores OCI/Docker.
- Postgres 17 o una version compatible confirmada.
- TLS administrado o reverse proxy con certificados renovables.
- Almacenamiento de objetos compatible con URLs firmadas, o adaptador implementable.
- Variables de entorno y copias de seguridad exportables.
- Logs de aplicacion sin revelar secretos.

## Procedimiento previsto

1. Inventariar versiones, extensiones y volumen de datos.
2. Crear un respaldo `pg_dump` y verificar su restauracion en un ambiente aislado.
3. Desplegar la misma imagen Docker de la API.
4. Implementar los adaptadores que cambien: identidad, almacenamiento, video, correo o pagos.
5. Ejecutar migraciones y pruebas de integridad.
6. Comparar conteos, relaciones y checksums de archivos.
7. Ejecutar pruebas funcionales, seguridad y rendimiento.
8. Reducir TTL de DNS, programar ventana y congelar escrituras.
9. Hacer sincronizacion final, cambiar trafico y observar.
10. Mantener rollback probado hasta cerrar la ventana de estabilizacion.

## Informacion pendiente

- Panel, sistema operativo y acceso disponible.
- Soporte de Docker y versiones de Node/Postgres.
- Limites de CPU, RAM, disco, trafico y procesos.
- Politica de backups, restauracion y retencion.
- Almacenamiento de objetos, SMTP, DNS y certificados.
- Metodos de pago aceptados en Venezuela y SLA del proveedor.
