# Design QA — App shell inspirado en Google Drive

Fecha: 2026-09-13

## Alcance

Actualización visual del dashboard de aprendizaje en modo claro: control del sidebar colapsado al extremo izquierdo, control de cierre a la derecha del logotipo, desplazamiento real del contenido al expandir el sidebar y sustitución de tarjetas flotantes con sombra por una jerarquía tonal semejante a Google Drive. Se conservaron el contenido, la marca y la funcionalidad de Koras.

## Verdad visual y evidencia

- Referencia principal, Drive claro: `C:\Users\josed\AppData\Local\Temp\codex-clipboard-fd42474e-c24e-408f-a22d-129c94235881.png` (1836 × 953 px).
- Referencia secundaria de contraste, Drive oscuro: `C:\Users\josed\AppData\Local\Temp\codex-clipboard-56886ee4-047d-4ac8-8f12-fa987539422c.png` (1846 × 953 px).
- Estado previo de Koras: `C:\Users\josed\AppData\Local\Temp\codex-clipboard-17223053-cb02-400b-9cac-61eda522b14c.png` (1800 × 1125 px).
- Comparación enfocada final: `C:\Users\josed\.codex\visualizations\2026\09\13\01a09b85-275b-7351-9ade-de2bf1c4e500\koras-drive-light-desktop-qa.png` (925 × 575 px).
- Vista expandida: `C:\Users\josed\.codex\visualizations\2026\09\13\01a09b85-275b-7351-9ade-de2bf1c4e500\koras-drive-light-desktop-header-route.png` (1100 × 650 px).
- Vista móvil cerrada: `C:\Users\josed\.codex\visualizations\2026\09\13\01a09b85-275b-7351-9ade-de2bf1c4e500\koras-drive-light-mobile.png` (312 × 675 px).
- Ruta verificada: `http://localhost:3000/visual-fixtures/aprendizaje?estado=dashboard`.
- Estado funcional: dashboard con ruta activa, 3 de 7 actividades completadas, actividad actual azul, actividad para continuar y repaso recomendado.

## Normalización de captura

El panel del navegador aplica un zoom interno de 0.8. La comprobación de escritorio se ejecutó con un viewport CSS de 1440 × 900 y la captura enfocada se recortó únicamente para retirar el área vacía generada por el escalado del panel. La comprobación móvil usó 390 × 844 CSS px y produjo una imagen de 312 × 675 px. Las conclusiones se basan en la comparación visual conjunta y en coordenadas CSS leídas del DOM, no en una superposición de píxeles sin normalizar.

La captura de Drive es una referencia de lenguaje visual, no una especificación de contenido. Las diferencias de copy, iconografía de marca y estructura de aprendizaje son intencionales.

## Comparación completa

- El chrome de header y sidebar usa un gris verdoso muy claro, mientras el workspace principal permanece blanco, reproduciendo la separación por tono de Drive.
- Ruta activa, accesos directos, destacados y controles secundarios usan superficies tonales relacionadas, sin el efecto de tarjetas blancas flotantes.
- Se eliminaron sombras y elevaciones de tarjetas, botones, buscador y contenedor principal. La elevación permanece únicamente en overlays reales, como el drawer móvil.
- El buscador ahora se integra en el header mediante un fondo tonal suave; al enfocarse cambia a blanco con outline visible.
- El contenedor principal mantiene una única gran superficie blanca con radio moderado y sin borde o sombra perceptible.
- La ruta activa conserva la jerarquía propia de Koras, pero se integra al workspace como una sección tonal y deja 18 px de separación respecto del borde superior del contenedor principal.

## Comparación enfocada

### Sidebar colapsado, escritorio

- Header: x=0, z-index=120.
- Botón visible de expansión: x=14, ancho=44 px.
- Buscador: x=74 px.
- Sidebar colapsado: x=0, ancho=72 px.
- Contenido principal: x=72 px y se amplía al espacio liberado.
- Desbordamiento horizontal: 0 px.

El primer pase colocó el botón en x=14, pero el header tenía z-index 100 y quedaba debajo del sidebar con z-index 110; el control se ocultaba parcialmente (P1). Se elevó el header colapsado a z-index 120 y la captura posterior confirma que el botón queda completamente visible al extremo izquierdo.

### Sidebar expandido, escritorio

- Logotipo: x=14, ancho=113 px.
- Botón de cierre: x=214, ancho=44 px; queda a la derecha del logotipo.
- Sidebar: ancho=272 px.
- Contenido principal: x=272 px y reduce su ancho sin overlay.
- Desbordamiento horizontal: 0 px.

### Superficies y elevación

Las únicas sombras no nulas visibles son el indicador inset del enlace activo del sidebar y el doble aro del paso actual azul. No se detectaron sombras en header, buscador, workspace, ruta activa, accesos directos, tareas ni CTA.

### Móvil

- Header, shell y main comparten exactamente `rgb(246, 248, 247)`.
- El main no tiene borde, radio exterior ni sombra de app shell.
- Las tarjetas se apoyan directamente sobre el fondo mediante contraste tonal.
- Viewport CSS: 390 × 844; desbordamiento horizontal: 0 px.
- Drawer cerrado: fuera del viewport y `body` con overflow restaurado.
- Drawer abierto: x=0, ancho=288 px, backdrop visible y bloqueo de scroll.
- En el drawer, el logotipo comienza en x=12 y el botón de cierre en x=232, por lo que el control queda a la derecha y dentro del área accesible.

## Superficies de fidelidad

- Tipografía: se conserva la familia, peso y jerarquía de Koras. No se imitó la tipografía de Google porque la referencia es estilística.
- Espaciado y layout: header y sidebar se leen como una unidad; el workspace comienza después del sidebar y responde a sus dos anchos.
- Color y tokens: chrome `#f6f8f7`, superficies tonales `#eef2f0`, hover `#e3ebe7`, workspace blanco y sección diaria `#e6eeea`.
- Imágenes y assets: se mantienen el logotipo y los iconos existentes, sin rasterización nueva ni degradación.
- Copy y contenido: sin cambios funcionales o editoriales.
- Iconos: conservan tamaño, grosor y labels accesibles existentes.
- Interacciones: expansión/colapso de escritorio, apertura/cierre del drawer móvil y bloqueo/restauración del scroll comprobados.
- Responsividad: comprobada en escritorio amplio, escritorio del panel y móvil de 390 px.
- Movimiento: el pulso azul del paso actual se conserva; los cambios de sidebar mantienen transición y no introducen desplazamientos en hover.

## Historial de iteración

1. Referencia y estado previo: exceso de superficies blancas con borde/sombra; botón colapsado separado del extremo izquierdo.
2. Primer pase: se aplicó la jerarquía tonal y se movió el control, pero el botón quedó bajo la capa del sidebar (P1).
3. Corrección: header colapsado elevado a z-index 120; botón confirmado en x=14 y completamente visible.
4. Pase final: revisión conjunta de Drive claro y Koras, verificación responsive, drawer móvil, sombras computadas, desbordamiento y consola.

## Comprobaciones técnicas

- `pnpm --filter @cediah/web lint`: aprobado.
- `pnpm --filter @cediah/web typecheck`: aprobado.
- `pnpm --filter @cediah/web test`: 20 archivos y 92 pruebas aprobadas.
- `git diff --check`: aprobado.
- Errores o advertencias de consola en la carga final: ninguno.

## Findings

No quedan hallazgos P0, P1 o P2 dentro del alcance solicitado.

## Open Questions

- Ninguna.

## Implementation Checklist

- [x] Botón de expansión completamente alineado a la izquierda.
- [x] Botón de cierre a la derecha del logotipo.
- [x] Sidebar expandido desplaza y reduce el workspace.
- [x] Header y sidebar forman una sola franja visual.
- [x] Tarjetas y botones sin sombra, diferenciados por tono.
- [x] Ruta activa separada del borde superior.
- [x] Móvil sin app shell exterior y con fondo continuo.
- [x] Validación visual, responsive, funcional y técnica completada.

final result: passed
