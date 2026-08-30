# Design QA — Koraz landing papel + digital

- Referencia de escritorio: `D:\Jose (Datos)\UI Koraz Web\landing modo claro.png`
- Referencia móvil: `D:\Jose (Datos)\UI Koraz Web\landing modo claro movil.png`
- Superficies inspeccionadas: hero, recursos, plataforma, planes y footer
- Estado probado: visitante sin sesión
- Viewports de referencia: 1697 × 943 y 430 × 932 CSS px
- Resultado final: aprobado

## Dirección implementada

- La escena de escritorio y la escena móvil usan las imágenes suministradas como capa editorial de papel y lápiz.
- El encabezado, enlaces, CTA, selector de facturación, tarjetas de planes y acciones permanecen como controles digitales reales.
- El hero replica el texto de referencia: “Estudia a tu manera. Llega más lejos.” y “Combina tus apuntes de siempre con herramientas digitales que te hacen avanzar.”
- El logo del encabezado, del footer y de las interfaces mostradas corresponde a la identidad normal de Koraz.
- El resto de la landing adopta el fondo de escritorio ilustrado, con una capa tenue que evita competir con el contenido digital.

## Paridad funcional

- `Planes` conserva el desplazamiento suave y lleva la sección a 88 px del borde superior.
- `Iniciar sesión` conserva `/acceder`.
- `Regístrate` y los CTA conservan `/acceder?modo=registro`.
- El selector de facturación conserva sus estados `aria-pressed`.
- El cambio de anual a mensual actualiza el plan Básico de `$3.99` a `$4.99` y cambia el parámetro a `facturacion=mensual`.
- La comparación acumulativa de ocho beneficios permanece intacta en los tres planes.

## Responsive y accesibilidad

- No existe desbordamiento horizontal en escritorio ni en móvil.
- El hero usa la composición de escritorio por encima de 700 px y la referencia móvil en anchos menores.
- La navegación móvil sigue visible y operable sin depender de un menú oculto.
- El auditor axe-core reportó 0 violaciones WCAG 2 A/AA. La única comprobación inconclusa fue contraste automatizado sobre superficies con pseudo-elementos; los colores visibles mantienen contraste alto.
- No se detectaron overlays de error ni errores de consola en la carga final.

## Comprobaciones ejecutadas

- `pnpm --filter @cediah/web typecheck`: aprobado.
- `pnpm --filter @cediah/web lint`: aprobado.
- `pnpm --filter @cediah/web build`: aprobado.
- Navegación y selector de facturación comprobados en navegador real: aprobados.
