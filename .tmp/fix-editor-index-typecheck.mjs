import { readFile, writeFile } from "node:fs/promises";

const routePath = "apps/api/src/content-topic-editor-routes.ts";
const routeSource = await readFile(routePath, "utf8");
const before = `    const cursor = query.data.cursor ? decodeEditorContentCursor(query.data.cursor) : undefined;\n    if (query.data.cursor && !cursor) {\n      return reply.status(400).header("Cache-Control", "no-store").send({ error: "invalid_content_index_query" });\n    }`;
const after = `    const decodedCursor = query.data.cursor ? decodeEditorContentCursor(query.data.cursor) : null;\n    if (query.data.cursor && !decodedCursor) {\n      return reply.status(400).header("Cache-Control", "no-store").send({ error: "invalid_content_index_query" });\n    }\n    const cursor = decodedCursor ?? undefined;`;
if (!routeSource.includes(before)) throw new Error("Cursor block not found");
await writeFile(routePath, routeSource.replace(before, after));

const studioPath = "apps/web/src/components/content-studio.tsx";
const studioSource = await readFile(studioPath, "utf8");
const insertionPoint = `function topicsForSubjects(\n`;
const helper = `function normalizeSearch(value: string) {\n  return value\n    .normalize("NFD")\n    .replace(/\\p{Diacritic}/gu, "")\n    .toLocaleLowerCase("es");\n}\n\n`;
if (!studioSource.includes(insertionPoint)) throw new Error("Topic helper insertion point not found");
if (!studioSource.includes("function normalizeSearch(value: string)")) {
  await writeFile(studioPath, studioSource.replace(insertionPoint, helper + insertionPoint));
}

console.log("Editorial cursor narrowed and shared search helper restored.");
