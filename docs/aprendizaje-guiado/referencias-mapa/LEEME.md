# Referencia visual del mapa de aprendizaje

Abrir **ejemplo-visual-mapa.html** en un navegador. Mantener la carpeta **assets** junto al HTML; contiene el logo y las fuentes locales. No necesita instalación ni conexión a una API.

El documento de implementación es **../PLAN-MAESTRO-MAPA-ESPACIAL.md**.

## Qué explorar

- Mi mapa → Anatomía → Tórax → Corazón.
- “Ver resumen” dentro de Tórax para comparar el panel de bloque.
- “Lecciones directas” para un nodo sin bloque intermedio.
- “Vista móvil” para observar la composición estrecha.
- Agregar contenido, filtrar el catálogo de ejemplo y añadir una tarjeta local.
- Controles de zoom y pestañas Actividades/Recursos.

La maqueta ejemplifica composición, color, tarjetas, iconos, selección y roadmap. Las agrupaciones secundarias son ilustrativas. Comenzar actividad muestra la integración prevista; no ejecuta contenido académico. Los cambios desaparecen al recargar.

React Flow, drag, historial profundo, persistencia, autenticación y cálculo académico pertenecen a las tareas del plan. La maqueta no sustituye esas implementaciones ni sus pruebas de aceptación.

## Archivos de referencia

- referencia-01.png: copia íntegra de “flujo aprendizaje guiado 2.png”.
- referencia-02.png: copia íntegra de “Flujo aprendizaje guiado.png”.

Los SHA-256 de las copias coinciden con los originales suministrados. Se conservaron sin edición.

## Comprobaciones de esta entrega

Fecha: 8 de septiembre de 2026.

- Markdown: 36 tareas, 35 obligatorias y una opcional; sin referencias a IDs de tarea inexistentes; todos los campos operativos presentes.
- JavaScript de la maqueta: sintaxis comprobada con node --check.
- Navegador Chromium: revisadas composición de escritorio a 1440 px, navegación al nodo y panel de lección.
- Vista de 390 px: revisado ancho del documento y posición del CTA dentro de la hoja; corregido el scroll interno para conservar el botón.
- Consola observada durante esa revisión: sin errores JavaScript.

Estas comprobaciones corresponden a los documentos y a la maqueta. No se ejecutaron las pruebas del sistema de aprendizaje como parte de esta entrega, porque no se modificó su implementación. La matriz funcional, de seguridad y de rendimiento del plan queda para la ejecución posterior.
