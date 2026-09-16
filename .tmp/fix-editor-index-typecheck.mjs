import { readFile, writeFile } from "node:fs/promises";

const path = "apps/api/src/content-topic-editor-routes.ts";
const source = await readFile(path, "utf8");
const before = `    const cursor = query.data.cursor ? decodeEditorContentCursor(query.data.cursor) : undefined;\n    if (query.data.cursor && !cursor) {\n      return reply.status(400).header("Cache-Control", "no-store").send({ error: "invalid_content_index_query" });\n    }`;
const after = `    const decodedCursor = query.data.cursor ? decodeEditorContentCursor(query.data.cursor) : null;\n    if (query.data.cursor && !decodedCursor) {\n      return reply.status(400).header("Cache-Control", "no-store").send({ error: "invalid_content_index_query" });\n    }\n    const cursor = decodedCursor ?? undefined;`;
if (!source.includes(before)) throw new Error("Cursor block not found");
await writeFile(path, source.replace(before, after));
console.log("Editorial cursor type narrowed.");
