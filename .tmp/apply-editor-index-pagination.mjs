import { readFile, writeFile } from "node:fs/promises";

async function replaceOnce(path, before, after) {
  const source = await readFile(path, "utf8");
  if (!source.includes(before)) {
    throw new Error(`Expected source block not found in ${path}`);
  }
  const next = source.replace(before, after);
  if (next === source) throw new Error(`No change produced for ${path}`);
  await writeFile(path, next);
}

await replaceOnce(
  "packages/contracts/src/index.ts",
  `export const ContentWorkspaceResponseSchema = z.object({
  capabilities: ContentCapabilitiesSchema,
  items: z.array(ContentItemSchema),
  roles: z.array(PlatformRoleSchema),
  subjects: z.array(SubjectSchema).default([]),
  topics: z.array(ContentTopicSchema).default([]),
});

export type ContentWorkspaceResponse = z.infer<typeof ContentWorkspaceResponseSchema>;`,
  `export const ContentEditorIndexMetaSchema = z.object({
  nextCursor: z.string().nullable(),
  totalItems: z.number().int().nonnegative(),
  totalPublications: z.number().int().nonnegative(),
});

export type ContentEditorIndexMeta = z.infer<typeof ContentEditorIndexMetaSchema>;

export const ContentEditorIndexPageSchema = z.object({
  index: ContentEditorIndexMetaSchema,
  items: z.array(ContentItemSchema),
});

export type ContentEditorIndexPage = z.infer<typeof ContentEditorIndexPageSchema>;

export const ContentWorkspaceResponseSchema = z.object({
  capabilities: ContentCapabilitiesSchema,
  index: ContentEditorIndexMetaSchema.optional(),
  items: z.array(ContentItemSchema),
  roles: z.array(PlatformRoleSchema),
  subjects: z.array(SubjectSchema).default([]),
  topics: z.array(ContentTopicSchema).default([]),
});

export type ContentWorkspaceResponse = z.infer<typeof ContentWorkspaceResponseSchema>;`,
);

await replaceOnce(
  "apps/api/src/content-topic-editor-routes.ts",
  `import {
  ContentItemSchema,
  ContentWorkspaceResponseSchema,
  type ContentProvider,
  type IdentityProvider,
  type IdentityRequest,
} from "@cediah/contracts";`,
  `import {
  ContentEditorIndexPageSchema,
  ContentItemSchema,
  ContentKindSchema,
  ContentStatusSchema,
  ContentWorkspaceResponseSchema,
  type ContentProvider,
  type IdentityProvider,
  type IdentityRequest,
} from "@cediah/contracts";`,
);

await replaceOnce(
  "apps/api/src/content-topic-editor-routes.ts",
  `import {
  getEditorContentItem,
  listEditorContentIndex,
  listEditorSubjects,
  listEditorTopics,
} from "./editor-content-index.js";`,
  `import {
  decodeEditorContentCursor,
  EDITOR_CONTENT_INDEX_MAX_LIMIT,
  getEditorContentItem,
  listEditorContentIndex,
  listEditorSubjects,
  listEditorTopics,
} from "./editor-content-index.js";`,
);

await replaceOnce(
  "apps/api/src/content-topic-editor-routes.ts",
  `const ContentIdParamsSchema = z.object({ contentId: z.string().uuid() });`,
  `const ContentIdParamsSchema = z.object({ contentId: z.string().uuid() });

const EditorContentIndexQuerySchema = z.object({
  cursor: z.string().trim().min(1).max(512).optional(),
  includeWorkspace: z.enum(["0", "1"]).default("1"),
  kind: ContentKindSchema.optional(),
  limit: z.coerce.number().int().min(1).max(EDITOR_CONTENT_INDEX_MAX_LIMIT).default(500),
  q: z.string().trim().max(200).optional(),
  scope: z.enum(["all", "publications"]).default("all"),
  status: ContentStatusSchema.optional(),
});`,
);

const routePath = "apps/api/src/content-topic-editor-routes.ts";
const routeSource = await readFile(routePath, "utf8");
const routeStart = routeSource.indexOf(`  app.get("/v1/editor/content-index", async (request, reply) => {`);
const routeEnd = routeSource.indexOf(`  app.get<{ Params: { contentId: string } }>("/v1/editor/content/:contentId"`, routeStart);
if (routeStart < 0 || routeEnd < 0) throw new Error("Editorial index route boundaries not found");
const nextRoute = `  app.get("/v1/editor/content-index", async (request, reply) => {
    const editor = await resolveContentEditor(
      request,
      dependencies.identityProvider,
      dependencies.contentProvider,
    );
    if (editor.kind === "error") {
      return reply
        .status(editor.status)
        .header("Cache-Control", "no-store")
        .send({ error: editor.error });
    }
    if (!dependencies.database) {
      return reply.status(503).header("Cache-Control", "no-store").send({ error: "content_unavailable" });
    }

    const query = EditorContentIndexQuerySchema.safeParse(request.query);
    if (!query.success) {
      return reply.status(400).header("Cache-Control", "no-store").send({ error: "invalid_content_index_query" });
    }
    const cursor = query.data.cursor ? decodeEditorContentCursor(query.data.cursor) : undefined;
    if (query.data.cursor && !cursor) {
      return reply.status(400).header("Cache-Control", "no-store").send({ error: "invalid_content_index_query" });
    }

    const indexInput = {
      actorUserId: editor.user.id,
      canEditAll: editor.capabilities.canEditAll,
      cursor,
      kind: query.data.kind,
      limit: query.data.limit,
      query: query.data.q,
      scope: query.data.scope,
      status: query.data.status,
    };

    try {
      if (query.data.includeWorkspace === "0") {
        const page = await listEditorContentIndex(dependencies.database, indexInput);
        return reply
          .header("Cache-Control", "no-store")
          .send(ContentEditorIndexPageSchema.parse(page));
      }

      const [page, subjects, topics] = await Promise.all([
        listEditorContentIndex(dependencies.database, indexInput),
        listEditorSubjects(dependencies.database),
        listEditorTopics(dependencies.database),
      ]);
      return reply.header("Cache-Control", "no-store").send(
        ContentWorkspaceResponseSchema.parse({
          capabilities: { ...editor.capabilities, canUpload: false },
          index: page.index,
          items: page.items,
          roles: editor.roles,
          subjects,
          topics,
        }),
      );
    } catch (error) {
      request.log.error({ err: error }, "Content editor index request failed");
      return reply.status(503).header("Cache-Control", "no-store").send({ error: "content_unavailable" });
    }
  });

`;
await writeFile(routePath, routeSource.slice(0, routeStart) + nextRoute + routeSource.slice(routeEnd));

await replaceOnce(
  "apps/web/src/components/content-studio.tsx",
  `import { findVideoLinkedGuide, getIndependentPublications, getVideoGuideContent } from "@/lib/content-guide-links";
import { uniqueRegions } from "@/lib/content-regions";`,
  `import { findVideoLinkedGuide, getVideoGuideContent } from "@/lib/content-guide-links";
import { uniqueRegions } from "@/lib/content-regions";
import { useEditorPublicationIndex } from "@/lib/use-editor-publication-index";`,
);

await replaceOnce(
  "apps/web/src/components/content-studio.tsx",
  `function normalizeSearch(value: string) {
  return value
    .normalize("NFD")
    .replace(/\\p{Diacritic}/gu, "")
    .toLocaleLowerCase("es");
}

`,
  ``,
);

await replaceOnce(
  "apps/web/src/components/content-studio.tsx",
  `  const visibleItems = useMemo(() => {
    const text = normalizeSearch(query.trim());
    return getIndependentPublications(items)
      .filter((current) => {
        const regions = current.content.regions.length > 0
          ? current.content.regions
          : [current.topic];
        const haystack = normalizeSearch(
          \`${"${current.title} ${current.summary} ${current.topic} ${regions.join(\" \")} ${current.slug}"}\`,
        );
        return (
          (!text || haystack.includes(text)) &&
          (kindFilter === "all" || current.kind === kindFilter) &&
          (statusFilter === "all" || current.status === statusFilter)
        );
      })
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  }, [items, kindFilter, query, statusFilter]);`,
  `  const {
    hasMorePublications,
    loadMorePublications,
    publicationCount,
    publicationIndexBusy,
    publicationIndexError,
    visibleItems,
  } = useEditorPublicationIndex({
    initialWorkspace,
    items,
    kindFilter,
    query,
    statusFilter,
  });`,
);

await replaceOnce(
  "apps/web/src/components/content-studio.tsx",
  `            placeholder="Buscar por título, región o slug…"`,
  `            placeholder="Buscar en todo el contenido…"`,
);

await replaceOnce(
  "apps/web/src/components/content-studio.tsx",
  `              <small>{visibleItems.length}</small>`,
  `              <small>{publicationCount}</small>`,
);

await replaceOnce(
  "apps/web/src/components/content-studio.tsx",
  `          {visibleItems.length === 0 && (
            <p className="studio-empty">No hay contenido con estos filtros.</p>
          )}`,
  `          {publicationIndexBusy && visibleItems.length === 0 && (
            <p className="studio-empty">Buscando publicaciones…</p>
          )}
          {!publicationIndexBusy && visibleItems.length === 0 && (
            <p className="studio-empty">No hay contenido con estos filtros.</p>
          )}
          {publicationIndexError && (
            <p className="studio-empty">{publicationIndexError}</p>
          )}
          {hasMorePublications && (
            <button
              className="studio-item"
              disabled={publicationIndexBusy || busy !== null}
              type="button"
              onClick={() => void loadMorePublications()}
            >
              <strong>{publicationIndexBusy ? "Cargando…" : "Cargar más publicaciones"}</strong>
              <small>Mostrar la siguiente página</small>
            </button>
          )}`,
);

console.log("Editorial index pagination patch applied.");
