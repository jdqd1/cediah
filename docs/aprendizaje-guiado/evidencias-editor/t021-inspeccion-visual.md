# T021 — inspección visual, contenido y accesibilidad

Fecha local: 2026-09-20. Fixture exclusivamente local en `NODE_ENV=development`; transporte en memoria, sin API ni datos reales.

## Capturas revisadas a tamaño legible

| Captura | Viewport / estado | Revisión | Resultado |
|---|---|---|---|
| `01-indice-desktop-1440.png` | 1440×900, índice ready | CTA principal y estado visibles; jerarquía título→descripción→ruta clara; sin clipping. | PASS |
| `02-datos-desktop-1440.png` | 1440×900, Datos ready | Tres secciones, tres campos cotidianos, estado y preview visibles; portada cerrada; sin inputs técnicos. | PASS |
| `03-datos-mobile-390.png` | 390×844, Datos ready | Encabezado/estado apilados, pestañas legibles, controles a una columna y barra sticky desplazable. | PASS |
| `04-unidad-actividades-desktop-1440.png` | 1440×900, unidad ready | Objetivo y dos actividades legibles; recomendado, formato/duración y Más opciones cerrado mantienen jerarquía. | PASS |
| `05-unidad-actividades-mobile-390.png` | 390×844, unidad ready | Tarjetas y acciones apiladas, controles táctiles visibles, sin overflow de página; el valor de inputs largos sigue editable mediante comportamiento nativo del input. | PASS |
| `06-selector-resultados-desktop-1440.png` | 1440×900, selector | Destino en título/CTA, búsqueda y filtros claros, tres resultados comprensibles, foco inicial visible. | PASS |
| `07-selector-resultados-mobile-390.png` | 390×844, selector | Modal 100dvw×100dvh, header/footer fijos y zona central desplazable; CTA/cancelación accesibles. | PASS |
| `08-selector-vacio-desktop-1440.png` | 1440×900, catálogo vacío | Vacío no se confunde con error; explica qué hacer y enlaza a Contenido. | PASS |
| `09-revision-errores-desktop-1440.png` | 1440×900, errors | Ambos problemas muestran ubicación, solución y acción completas; no aparecen path, UUID ni DTO. | PASS |
| `10-confirmacion-eliminacion-mobile-390.png` | 390×844, AlertDialog | Título, consecuencia, conservación de materiales, Cancelar y acción destructiva visibles; una sola capa modal. | PASS |
| `11-version-publicada-desktop-1440.png` | 1440×900, published | Estado Publicada explícito y controles deshabilitados; no ofrece mutación directa del snapshot. | PASS |
| `12-formulario-mobile-320.png` | 320×800, new | Tras corrección, Datos/Actividades/Revisión no colisionan; campos y CTA conservan tamaño táctil y no hay overflow. | PASS |
| `13-vista-previa-desktop-1440.png` | 1440×900, preview | Portada, resumen, duración, objetivo, actividades y formatos legibles; aclara que no registra estudio. | PASS |
| `14-datos-tablet-768.png` | 768×1024, long | Tras corrección, título de 200 caracteres ocupa ancho útil y las acciones bajan; formulario conserva dos columnas sin overflow. | PASS |
| `15-unidad-tablet-1024.png` | 1024×768, unidad ready | Unidad, objetivos y actividades aprovechan el ancho; sticky no impide desplazar el contenido. | PASS |
| `16-zoom-200-equivalente-1440.png` | 720×900 CSS, equivalente a ventana 1440 al 200 % | Reflow en una columna donde corresponde; `scrollWidth=clientWidth=720`; controles y texto permanecen accesibles. | PASS |

## Mediciones y revisión asistida

- Reflow automatizado: 320/390/768/1024/1440 px en desktop y mobile, diez combinaciones con `scrollWidth === clientWidth` y CTA visible.
- Contraste medido: texto principal 16.15:1, texto secundario 6.07:1, pestaña activa 11.46:1, título de error 15.39:1 y descripción de confirmación 6.07:1.
- Geometría: `intersects=false` para el último campo a 320 px frente a la barra sticky y para «Añadir práctica» frente a esa barra.
- Axe: cero `violations` en los cinco estados obligatorios, desktop y mobile, con los tags fijados. La configuración usa `prefers-reduced-motion: reduce` para medir el estado estable y no una transición de navegación de 180 ms; no se excluyen reglas ni nodos.
- `incomplete aria-hidden-focus`: Radix aplica `aria-hidden` al fondo. Se recorrieron 12 Tab en selector y 4 Tab en AlertDialog, desktop y mobile; el foco permaneció dentro del portal en todos los pasos y Escape lo devolvió al disparador.
- `incomplete color-contrast` de la descripción móvil: Axe no pudo resolver el fondo por solapamiento geométrico; la medición directa confirmó `rgb(89,98,123)` sobre blanco, 6.07:1.
- Ayuda limitada a las tres familias acordadas: objetivos, uso de actividad y alternativas equivalentes. Enter/Escape y retorno de foco se probaron en navegador.
- Los 24 códigos conocidos y el fallback desconocido mantienen problema, ubicación, solución y acción legibles mediante `presentIssue`; las pruebas focalizadas cubren la tabla y la captura de errores confirma el resultado renderizado.
- Revisión de texto visible: español coherente; no se exponen slug, stable key, path, UUID, DTO, projection ni payload. Los títulos largos observados pertenecen al fixture de límites.

## Defectos concretos corregidos

1. A 320 px «Actividades» y «Revisión» colisionaban. Se redujo únicamente la tipografía de tabs bajo 380 px, manteniendo 44 px de alto.
2. A 768 px el título de 200 caracteres quedaba en una columna demasiado estrecha junto a las acciones. El encabezado se apila hasta 900 px sin cambiar la rejilla del formulario.
3. La auditoría Axe podía empezar durante la animación global de navegación. Playwright fija reduced motion y además espera animaciones documentales, por lo que mide el estado estable sin sleeps ni excepciones.

Checks posteriores: teclado/foco 2/2; reflow 2/2; Axe 2/2 tras estabilizar movimiento; typecheck web exit 0; lint web exit 0.
