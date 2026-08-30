# Design QA — Koraz landing papel + digital

- Referencia de escritorio: `D:\Jose (Datos)\UI Koraz Web\landing modo claro.png`
- Referencia móvil: `D:\Jose (Datos)\UI Koraz Web\landing modo claro movil.png`
- Superficies inspeccionadas: hero, recursos, plataforma, planes y footer
- Estado probado: visitante sin sesión
- Viewports verificados: 1263 × 698, 415 × 698 y 360 × 800 CSS px
- Resultado final: aprobado

## Dirección implementada

- La escena de escritorio y la escena móvil usan las imágenes suministradas como capa editorial de papel y lápiz.
- El encabezado, enlaces, CTA, selector de facturación, tarjetas de planes y acciones permanecen como controles digitales reales.
- El hero conserva “Estudia a tu manera. Llega más lejos.” y usa el texto solicitado “Combina tus apuntes de siempre con herramientas digitales.” dentro de un ancho controlado para evitar que invada la ilustración.
- El logo del encabezado, del footer y de las pantallas ilustradas corresponde a la identidad original de Koraz.
- Recursos se presenta como cinco módulos digitales independientes, sobrios y consistentes en escritorio y móvil.
- Se retiraron las cejas editoriales de Plataforma y Planes, así como los niveles numéricos de las tarjetas.
- La tarjeta Pro se distingue con un fondo, borde y sombra violetas de baja intensidad.
- El footer conserva únicamente Empresa y Ayuda; Facebook y los grupos Plataforma y Recursos fueron retirados.
- El resto de la landing adopta el fondo de escritorio ilustrado, con una capa tenue que evita competir con el contenido digital.

## Paridad funcional

- `Planes` conserva el desplazamiento suave y lleva la sección a 88 px del borde superior.
- `Iniciar sesión` conserva `/acceder`.
- El enlace redundante `Regístrate` fue retirado del encabezado; los CTA conservan `/acceder?modo=registro`.
- El selector de facturación conserva sus estados `aria-pressed`.
- Al activar Mensual, cada precio muestra a su lado la equivalencia mensual del pago anual; los enlaces cambian su parámetro a `facturacion=mensual`.
- La comparación acumulativa de ocho beneficios permanece intacta en los tres planes.

## Responsive y accesibilidad

- No existe desbordamiento horizontal en escritorio ni en móvil.
- El hero usa la composición de escritorio por encima de 700 px y la referencia móvil en anchos menores.
- La navegación móvil sigue visible y operable sin depender de un menú oculto.
- No se detectaron overlays de error ni errores de consola en la carga final.

## Comprobaciones ejecutadas

- `pnpm --filter @cediah/web typecheck`: aprobado.
- `pnpm --filter @cediah/web lint`: aprobado.
- `pnpm --filter @cediah/web build`: aprobado.
- Navegación y selector de facturación comprobados en navegador real: aprobados.
