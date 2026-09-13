# Design QA — Ruta de aprendizaje en Inicio

## Evidencia

- Verdad visual de estructura: `C:\Users\josed\AppData\Local\Temp\codex-clipboard-c12a45b0-ae25-40cd-b64f-4b2ce951be69.png` (1536 × 1024 px; tablero con objetivos de escritorio y móvil).
- Estado previo señalado por el usuario: `C:\Users\josed\AppData\Local\Temp\codex-clipboard-e5217806-5d13-480a-bce0-271c9916ecb1.png` (733 × 667 px).
- Implementación de escritorio: `D:\Jose (Datos)\Medicina\CEDIAH\Web\tmp\design-qa\dashboard-learning-desktop-final.png` (739 × 696 px).
- Implementación móvil: `D:\Jose (Datos)\Medicina\CEDIAH\Web\tmp\design-qa\dashboard-learning-mobile-final.png` (586 × 1319 px).
- Ruta verificada: `http://localhost:3000/visual-fixtures/aprendizaje?estado=dashboard`.
- Estado: ruta activa con 3 de 7 actividades completadas, una actividad para continuar y un repaso recomendado.
- Captura de escritorio: override de 488 × 445 px; la página reportó 610 × 557 CSS px y DPR 0.8 por el escalado interno del panel.
- Captura móvil: override de 390 × 844 px; la página reportó 488 × 1055 CSS px y DPR 0.8 por el mismo escalado.
- Normalización: la referencia previa y la captura de escritorio tienen un encuadre y una densidad visual equivalentes. Para móvil se comparó la región del componente, descontando chrome de la aplicación, escala del panel y contenido posterior a la tarjeta; no se atribuyeron hallazgos a esas diferencias de densidad.

## Comparación completa

La implementación mantiene la arquitectura visual solicitada: identificación de la ruta, título y avance, anillo porcentual, secuencia de pasos y un bloque sólido “Para hoy”. La revisión conjunta de las referencias y las capturas finales confirma los cambios intencionales:

- El punto actual pasó de terracota a azul (`#2563eb`) y su aro exterior se ve completo, incluida la parte superior.
- El contenedor con desplazamiento reserva 6 px arriba del stepper, evitando que el estado actual sea recortado.
- “Para hoy” conserva el verde salvia sólido (`#f1f5ef`), sin degradado, y reduce notablemente altura, paddings, separaciones y tamaño de sus tarjetas.
- En escritorio ancho, actividad, repaso y CTA forman una sola franja. En anchos intermedios y móvil, la actividad principal ocupa la primera línea y repaso + CTA comparten la segunda; en pantallas muy estrechas se apilan sin desbordar.
- El CTA permanece en el campo táctil inferior derecho, dice “Ir a la actividad” y conserva un objetivo de 50 px en escritorio y 48 px en móvil.
- No aparece el cierre “Vas muy bien”.

## Superficies de fidelidad

- Tipografía: se conserva la familia y jerarquía del producto; título, porcentaje, etiquetas y metadatos siguen siendo legibles. Los textos largos se truncan dentro de sus tarjetas y no fuerzan el ancho del componente.
- Espaciado y ritmo: “Para hoy” ahora usa 15/22/17 px de padding en escritorio y 14/14/16 px en móvil, con tarjetas de 68 px y 56–62 px respectivamente. La reducción no comprime el encabezado ni la ruta de progreso.
- Color y tokens: la superficie principal es blanca, el área diaria usa un color plano y sutil, los pasos completados siguen en verde y el paso actual usa azul semántico. El anillo porcentual conserva su representación de datos; no se usa como fondo decorativo del contenedor.
- Imágenes e iconos: este componente no requiere recursos rasterizados. Los iconos visibles provienen de Phosphor y mantienen un grosor y una escala coherentes.
- Copy: aparecen “Ruta activa”, “Para hoy”, “Ver toda la ruta” e “Ir a la actividad”; no aparece “Vas muy bien” ni “Continuar mi ruta”.

## Comparación enfocada

No se necesitaron recortes adicionales: en la comparación conjunta, el stepper y el bloque “Para hoy” ocupan suficiente área para verificar el aro superior, el color azul, el fondo sólido, el CTA y el comportamiento de las etiquetas. Las capturas finales no muestran recortes, colisiones ni desbordamiento del componente.

## Historial de iteración

1. Revisión anterior: la estructura coincidía con el mock, pero el estado actual seguía en terracota y su aro superior quedaba cortado (P2). “Para hoy” conservaba tres filas visuales y una altura excesiva en relación con el resto de la tarjeta (P2).
2. Corrección: se cambió el estado actual a `#2563eb`, se amplió el espacio vertical seguro del scroll y se reorganizó “Para hoy” como una cuadrícula compacta con tarjetas horizontales, paddings menores y CTA alineado al extremo inferior derecho.
3. Evidencia posterior: las capturas `dashboard-learning-desktop-final.png` y `dashboard-learning-mobile-final.png` muestran el aro completo y azul. La actividad principal, el repaso y el CTA mantienen jerarquía y targets táctiles sin recuperar la altura anterior.

## Interacciones y consola

- El CTA “Ir a la actividad” se comprobó y navegó a `/aprendizaje/sesiones/a1000000-0000-4000-8000-000000000309`.
- “Ver toda la ruta” expone `/aprendizaje/rutas/bases-de-la-fisiologia-respiratoria`.
- Se comprobaron los estados `dashboard`, `dashboard-empty` y `dashboard-error` durante la implementación.
- Errores o advertencias de consola en la carga final: ninguno.

## Comprobaciones técnicas

- `pnpm --filter @cediah/web typecheck`: aprobado.
- `pnpm --filter @cediah/web lint`: aprobado.
- `pnpm --filter @cediah/web test`: 20 archivos y 92 pruebas aprobadas.
- `pnpm --filter @cediah/web build`: aprobado.

## Findings

No quedan hallazgos P0, P1 o P2. Como refinamiento opcional P3, el contrato podría enviar nombres específicos para todos los pasos futuros y sustituir las etiquetas genéricas “Actividad 5”, “Actividad 6”, etc.

## Open Questions

- Ninguna para este alcance.

## Implementation Checklist

- [x] Punto actual azul y sin recorte.
- [x] “Para hoy” sólido, compacto y responsive.
- [x] CTA “Ir a la actividad” abajo a la derecha.
- [x] Sin “Vas muy bien” ni fondo degradado.
- [x] Validación visual, responsive, funcional y técnica completada.

final result: passed
