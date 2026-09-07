# Inventario editorial para Aprendizaje guiado

Fecha de corte: 5 de septiembre de 2026.

## Alcance y procedencia

No hay una API local activa, un archivo de entorno de desarrollo ni una variable `DATABASE_URL` disponible en este espacio de trabajo. Por tanto, este inventario **no describe el catálogo actual de ningún ambiente** y no autoriza a publicar una ruta.

La única fuente reproducible disponible es el snapshot público incluido en `database/migrations/0005_restore_legacy_content.sql`. Se decodificó en memoria y se listaron únicamente metadatos editoriales; no se consultaron credenciales ni datos personales.

| ID | Título | Tipo | Tema textual | Estado del snapshot | Versión | Preguntas | Duración | Evaluación preliminar |
| --- | --- | --- | --- | --- | ---: | ---: | ---: | --- |
| `3539a03a-a1f4-4777-990d-76f1bbce0332` | Hombro | video | Cuello | published | 10 | 1 | desconocida | Texto y pregunta de relleno; no apto para piloto |
| `6ac1c0d6-e375-49f9-bc79-59da04965f22` | Abdomen | video | Abdomen | published | 22 | 1 | desconocida | Texto y pregunta de relleno; no apto para piloto |
| `84f082c4-6e64-4748-9a37-b89b6987ea03` | Peritoneo | guía | Abdomen | published | 29 | 3 | no informada | Contenido sustantivo, pero banco insuficiente y explicaciones vacías |
| `be0b42be-3d55-4cad-978e-9ff9acd7022f` | Triángulos del cuello | video | Cuello | published | 10 | 3 | 69 s | Banco pequeño; requiere revisión académica y de explicaciones |

## Identidad y proyecciones

- Las preguntas y tarjetas del snapshot no tienen `id`, `memoryVersion` ni IDs de opciones persistentes.
- Los videos y guías pueden proyectar sus mismas preguntas como cuestionario y flashcards. La identidad debe proceder de la fuente canónica y no del índice, slug o texto.
- No existe en el snapshot una publicación `topic` que pueda actuar como identidad estable de tema para una ruta piloto.
- Ningún recurso alcanza por sí solo las cinco preguntas canónicas distintas requeridas para poder otorgar el estado «Consolidado» de V1.

## Brechas para una ruta piloto

1. Consultar el catálogo real de un ambiente de desarrollo o preview mediante API/editor o consulta de solo lectura autorizada.
2. Crear o vincular una publicación `topic` estable mediante el workflow editorial.
3. Seleccionar materiales reales revisados para las cuatro proyecciones; no reutilizar como contenido académico los textos de relleno del snapshot.
4. Añadir explicaciones útiles y mapping explícito de cada pregunta a objetivos observables.
5. Completar revisión académica por coordinación antes de publicar.

La infraestructura y las pruebas automatizadas pueden avanzar con fixtures aislados. Una ruta creada con esos fixtures es solo material de prueba y debe permanecer fuera de publicación académica.
