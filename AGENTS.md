# Flujo de trabajo eficiente y seguro

- Antes de ejecutar comandos costosos, inspeccionar el estado de Git, el `pnpm-lock.yaml`, las dependencias ya presentes y solo los archivos relacionados con la solicitud.
- No ejecutar `pnpm install` de forma rutinaria. Usarlo únicamente para el primer arranque sin `node_modules`, cuando cambien manifiestos o lockfile, si falla la resolución de un paquete o si la persona usuaria lo solicita.
- Antes de iniciar un servidor de desarrollo, comprobar si ya existe uno utilizable y reutilizarlo. No introducir esperas fijas si se puede validar la disponibilidad mediante el proceso, el puerto o sus registros.
- Durante la iteración, ejecutar la comprobación más específica que cubra el cambio. Reservar `lint`, `typecheck`, `test`, `build` y `audit` completos para una entrega, una fusión, cambios transversales o cambios de dependencias, seguridad, configuración, contratos o migraciones.
- `CEDIAH Web Status.docx` solo se actualiza cuando la tarea incluye una migración de base de datos. Si no está disponible al realizar una migración, señalarlo antes de cerrar la tarea; no bloquear ni ampliar tareas no relacionadas.
- Mantener los cambios aislados, no tocar trabajo ajeno y comunicar de forma breve qué se comprobó y qué no fue necesario ejecutar.
