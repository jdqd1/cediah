# Validación del editor intuitivo de rutas

Los resultados se actualizan únicamente con evidencia ejecutada. Una comprobación ambiental o visual pendiente permanece como NO VERIFICADO.

## Definición de terminado

| ID | Resultado | Evidencia | Observación |
|---|---|---|---|
| D01 | PASS | T009/T010/T020 | Alta nominal con título/tema/descripción; slug y claves no son campos. |
| D02 | PASS | Capturas 02/04 y T013 | Flujo cotidiano reducido; Más opciones/portada/ajustes comienzan cerrados. |
| D03 | PASS | T012 y V09 | Selector muestra destino y requiere elección/confirmación; no usa el primer resultado automáticamente. |
| D04 | PASS | T011/T019/T020 | Cancelar es no-op; PATCH+GET/PGlite conservan la eliminación. |
| D05 | PASS | T019/T020 | Borrador con cero unidades persiste y devuelve `unit_required` presentado en español. |
| D06 | PASS | T015/T020 | Guardar→validar usa respuesta/editVersion confirmados; save fallido produce cero validate. |
| D07 | PASS | T007/T014/T021 | Códigos conocidos y fallback presentados sin path/UUID/DTO. |
| D08 | PASS | T007/T014/T020 | Error bloquea; warning limited no bloquea ni cambia modalidad. |
| D09 | PASS | T014/T020 | Acciones abren panel/accordion/selector y enfocan el destino. |
| D10 | PASS | T004/T005/T013/T019 | Identidades, config, mappings, completionRule y revisión se preservan. |
| D11 | PASS | T018/T019/T020 | Fixture legacy con dos objetivos/cuatro formatos/alternativas conserva roundtrip. |
| D12 | PASS | T005/T016/T019/T020 | Publicada solo crea borrador nuevo; historia/progreso permanece. |
| D13 | PASS | T020/T021 | Cinco anchos, zoom equivalente y geometría sticky sin overflow/acciones inaccesibles. |
| D14 | PASS | T020/T021 | Tabs/selector/confirmación/ayuda/correcciones operables a teclado y foco lógico. |
| D15 | PASS | T022, V07 final | Regresión completa verde: web 197/197 y API 201/201; typecheck, lint, build y E2E también pasan. |
| D16 | PASS | T001/T009–T013/T020/T021/T022 | Versiones exactas, imports efectivos, licencias y pruebas de Radix/Query/Axe acreditados. |

| ID | Resultado | Evidencia | Observación |
|---|---|---|---|
| Q01 | PASS | T009/T019 | Rutas Next aplican sesión/feature/rol y Fastify verifica propietario/roles con inject local. |
| Q02 | PASS | T009/T012, capturas 02/06 | Solo Datos/Actividades/Revisión; selector contextual nombra la unidad. |
| Q03 | PASS | V09 nominal | El recorrido ready no abre Más opciones ni solicita identificadores. |
| Q04 | PASS | T003/T004/T015 | Slug se congela tras primer guardado válido; IDs/keys se operan por identidad. |
| Q05 | PASS | T009/T010/T013, capturas | Campos técnicos ausentes del flujo normal; propósito/alternativas quedan avanzados. |
| Q06 | PASS | T019/T020 | Borrado confirmado por PATCH+GET Fastify y PGlite; UI guarda cero unidades. |
| Q07 | PASS | T011/T020 | Cancelar no-op y última unidad eliminable/guardable. |
| Q08 | PASS | T004/T011 | Reducer limpia `recommendedAfter`, selección y foco por ID. |
| Q09 | PASS | T005/T013/T019 | Parches cosméticos preservan selección/mappings/completionRule/snapshot. |
| Q10 | PASS | T004/T013 | Reducer reasigna recomendada sin duplicar defaults y conserva campos. |
| Q11 | PASS | T013/T018/T020 | Dos objetivos y asociaciones legibles por títulos/enunciados en legacy. |
| Q12 | PASS | T012/T020 | Material off-page, filtros, paginación, deduplicación y cursor aislados. |
| Q13 | PASS | T006/T008/T019 | GET actual/fijado separa versiones y guía canónica, sin escrituras. |
| Q14 | PASS | T015/T020 | Comprobar guarda antes y valida el `editVersion` confirmado. |
| Q15 | PASS | T015/T020 | Save 503 mantiene dirty/texto y no llama validate. |
| Q16 | PASS | T007/T015/T020 | Versión validada obsoleta/ausente no acepta ready ni transición. |
| Q17 | PASS | T014/T021 | Tabla completa y fallback mantienen severidad, problema/ubicación/solución/acción. |
| Q18 | PASS | T014/T020 | Acciones localizables abren y enfocan campo/panel apropiado. |
| Q19 | PASS | T007/T016/T020 | Limited es selección explícita; warning no bloqueante y sin downgrade automático. |
| Q20 | PASS | T007/T019 | Conteo usa Set de identidades; pregunta+tarjeta no duplica evidencia. |
| Q21 | PASS | T007/T008/T015/T019 | Schemas validan respuestas; lock único y mensajes sin éxito ficticio. |
| Q22 | PASS | T015/T020 | 409/401 conservan borrador; recuperación y descarga local sin overwrite. |
| Q23 | PASS | T015 | Guardas de enlaces, beforeunload, popstate y recuperación tienen pruebas puras. |
| Q24 | PASS | T005/T016/T019/T020 | Published/archived son readonly; clon conserva revisiones fijadas. |
| Q25 | PASS | T019 | Conteos PGlite de matrículas/intentos/recompensas/progreso permanecen iguales. |
| Q26 | PASS | T019 | Regresión mapa conserva v1 y pasa a `version_missing` al adoptar v2 retirada. |
| Q27 | PASS | T016/T020 | Preview usa dirty local y assert de cero requests de tracking. |
| Q28 | PASS | `evidencias-editor/t020-playwright.txt`, T021 | Selector, ayuda y eliminación funcionan por teclado; trap y retorno de foco pasaron en desktop/móvil. |
| Q29 | PASS | `evidencias-editor/12-formulario-mobile-320.png`, `14-datos-tablet-768.png`, `16-zoom-200-equivalente-1440.png`, `t021-mediciones.json` | Cinco anchos sin overflow y reflow equivalente al 200 % con 720=720. |
| Q30 | PASS | `evidencias-editor/t021-mediciones.json`, capturas 05/09/12 | Último campo y acción de error no intersectan la barra; el contenido conserva padding para desplazarse. |
| Q31 | PASS | `evidencias-editor/t021-mediciones.json` | Ratios medidos 6.07:1–16.15:1; foco de 3 px y errores combinan texto, borde, encabezado y acción. |
| Q32 | PASS | T022, V03/V04/V07/V08/V09 | Tipos, lint y build pasan; web 197/197, API 201/201 y E2E 30/30 pasan. |
| Q33 | PASS | T019/T022 | Ninguna regresión pendiente: mapa/validación focalizados y la regresión global completa pasan. |
| Q34 | PASS | `EDITOR-EJECUCION.md`, T001/T018 | No se conectó a producción, no se ejecutó API real ni migraciones; las fixtures añadidas son locales y deterministas. |
| Q35 | PASS | T022/V10 | Sin migraciones/secretos; solo tres dependencias directas autorizadas. Los dos documentos maestros ajenos se preservaron. |
| Q36 | PASS | Este documento y `EDITOR-EJECUCION.md` | Estados iniciales explícitos; no se atribuyen pruebas no ejecutadas. |
| Q37 | PASS | `evidencias-editor/baseline-v11.txt`, T022 | Versiones/categorías/licencias exactas, lockfile reproducible e integración funcional acreditada en Q38–Q40. |
| Q38 | PASS | `EDITOR-EJECUCION.md` T009–T016, `evidencias-editor/t021-inspeccion-visual.md` | Tabs/Accordion/Dialog/AlertDialog/Popover/Dropdown/Collapsible Radix integrados; traps nativos, sin handlers de Tab propios en la app. |
| Q39 | PASS | T012/T020 | Query keys incluyen actor/ruta/filtros/revisión; signal propagado, sin segundo cache mutable ni refetch de foco. |
| Q40 | PASS | `evidencias-editor/t020-playwright.txt`, `t021-mediciones.json` | AxeBuilder cubrió cinco estados×dos proyectos con cero violations; incomplete revisados con foco y contraste medido. |
| Q41 | PASS | T012/T015/T020 | Scope por actor/ruta, cancelación al cerrar, respuestas A tardías abortadas y dirty preservado. |

## Inspección visual T021

Las 16 capturas obligatorias y complementarias se revisaron visualmente a tamaño legible. El registro por captura, las dos correcciones realizadas y la resolución de `incomplete` están en `evidencias-editor/t021-inspeccion-visual.md`.

Casos T021: P35 PASS (Tab/Escape/foco y fondo no enfocable); P36 PASS (cinco anchos, zoom equivalente, textos límite y geometría sticky); P37 PASS (portales Radix, cancelación y retorno de foco); P39 PASS (diez análisis Axe, cero violations, incomplete revisados).
