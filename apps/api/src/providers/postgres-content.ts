import { sql, type Selectable, type Transaction, type Updateable } from "kysely";
import {
  ContentAssetSchema,
  ContentDraftSchema,
  ContentItemSchema,
  PlatformRoleSchema,
  PublishableContentDraftSchema,
  type ContentAsset,
  type ContentDraft,
  type ContentItem,
  type ContentProvider,
  type ContentStatus,
  type ContentTopic,
  type ContentTransitionRequest,
  type PlatformRole,
  type RichTextDocument,
  type RichTextNode,
} from "@cediah/contracts";
import {
  canEditContent,
  getContentCapabilities,
  isPublishedPermittedUpdate,
} from "../content-authorization.js";
import type {
  CediahDatabase,
  ContentAssetTable,
  ContentItemTable,
  DatabaseClient,
  JsonValue,
} from "../db/database.js";
import type { S3ObjectStorage } from "./s3-object-storage.js";

type QueryDatabase = DatabaseClient | Transaction<CediahDatabase>;
type ContentRow = Selectable<ContentItemTable>;
type AssetRow = Selectable<ContentAssetTable>;
type ContentAssetDownloadStorage = Pick<S3ObjectStorage, "bucket" | "createDownloadUrl">;

export type PostgresContentProviderConfiguration = {
  assetStorage?: ContentAssetDownloadStorage;
  signedDownloadLifetimeSeconds?: number;
};

const defaultSignedDownloadLifetimeSeconds = 60 * 60;

function toIsoString(value: Date | string) {
  return (value instanceof Date ? value : new Date(value)).toISOString();
}

function errorCode(error: unknown) {
  if (!error || typeof error !== "object") return null;
  const code = (error as Record<string, unknown>).code;
  return typeof code === "string" ? code : null;
}

function isUniqueConflict(error: unknown) {
  return errorCode(error) === "23505";
}

function richTextNodeHasBody(node: RichTextNode, insideHeading = false): boolean {
  const nextInsideHeading = insideHeading || node.type === "heading";
  if (node.type === "text") return !nextInsideHeading && node.text.trim().length > 0;
  return "content" in node && Boolean(
    node.content?.some((child) => richTextNodeHasBody(child, nextInsideHeading)),
  );
}

function richTextDocumentHasBody(document: RichTextDocument | null): boolean {
  return Boolean(document?.content.some((node) => richTextNodeHasBody(node)));
}

function companionQuestionsAreComplete(questions: Array<{
  correctOptionIndex: number;
  options: string[];
  prompt: string;
}>) {
  return questions.every(
    (question) =>
      question.prompt.trim().length > 0 &&
      question.options.length >= 2 &&
      question.options.every((option) => option.trim().length > 0) &&
      question.correctOptionIndex >= 0 &&
      question.correctOptionIndex < question.options.length,
  );
}

export function isContentTransitionAllowed(input: {
  actorUserId: string;
  authorUserId: string;
  currentStatus: ContentStatus;
  roles: PlatformRole[];
  targetStatus: "in_review" | "changes_requested" | "approved" | "published" | "archived";
}) {
  const capabilities = getContentCapabilities(input.roles);
  if (input.targetStatus === "in_review") {
    return (
      (input.currentStatus === "draft" || input.currentStatus === "changes_requested") &&
      (capabilities.canEditAll || input.actorUserId === input.authorUserId)
    );
  }
  if (input.targetStatus === "changes_requested" || input.targetStatus === "approved") {
    return capabilities.canReview && input.currentStatus === "in_review";
  }
  if (input.targetStatus === "published") {
    return (
      capabilities.canPublish &&
      (input.currentStatus === "approved" || input.currentStatus === "archived")
    );
  }
  return capabilities.canPublish && input.currentStatus === "published";
}

export function isContentReadyForTransition(
  item: ContentItem,
  targetStatus: ContentTransitionRequest["status"],
) {
  const requiresCompleteContent = ["in_review", "approved", "published"].includes(targetStatus);
  if (!requiresCompleteContent) return true;
  if (!PublishableContentDraftSchema.safeParse(item).success) return false;

  if (item.kind === "video") {
    const hasReadyVideo = item.asset?.status === "ready" && item.asset.kind === "video";
    const hasExternalVideo = Boolean(item.content.externalUrl);
    return (
      (hasReadyVideo || hasExternalVideo) &&
      item.content.keyPoints.length > 0 &&
      item.content.keyPoints.every((point) => point.trim().length > 0) &&
      (item.content.guide.sections.length > 0 ||
        richTextDocumentHasBody(item.content.guide.document)) &&
      item.content.quiz.questions.length > 0 &&
      companionQuestionsAreComplete(item.content.quiz.questions)
    );
  }
  if (item.kind === "guide") {
    return (
      (item.content.sections.length > 0 ||
        richTextDocumentHasBody(item.content.document) ||
        (item.asset?.status === "ready" && item.asset.kind === "document")) &&
      item.content.keyPoints.every((point) => point.trim().length > 0) &&
      companionQuestionsAreComplete(item.content.quiz.questions)
    );
  }
  return true;
}

function parseAsset(row: AssetRow, downloadUrl: string | null = null): ContentAsset {
  return ContentAssetSchema.parse({
    contentId: row.content_item_id,
    downloadUrl,
    fileName: row.original_file_name,
    id: row.id,
    kind: row.kind,
    mimeType: row.mime_type,
    sizeBytes: Number(row.size_bytes),
    status: row.status,
  });
}

export async function createContentAssetDownloadUrl(
  input: Pick<AssetRow, "status" | "storage_bucket" | "storage_path">,
  storage: ContentAssetDownloadStorage | undefined,
  expiresInSeconds = defaultSignedDownloadLifetimeSeconds,
) {
  if (
    !storage ||
    input.status !== "ready" ||
    input.storage_bucket !== storage.bucket
  ) {
    return null;
  }
  if (!Number.isInteger(expiresInSeconds) || expiresInSeconds < 60 || expiresInSeconds > 604_800) {
    throw new Error("Invalid content-asset download lifetime");
  }

  try {
    return await storage.createDownloadUrl({
      expiresInSeconds,
      key: input.storage_path,
    });
  } catch {
    // A storage outage must not hide the publication itself. The caller can
    // still render its text metadata while playback remains unavailable.
    return null;
  }
}

async function parseContentItem(
  row: ContentRow,
  assets: AssetRow[],
  subjectIds: string[],
  configuration: PostgresContentProviderConfiguration = {},
  includeDownloadUrl = false,
): Promise<ContentItem> {
  const selectedAsset = [...assets].sort((left, right) => {
    if (left.status !== right.status) return left.status === "ready" ? -1 : 1;
    return new Date(right.created_at).getTime() - new Date(left.created_at).getTime();
  })[0];
  const downloadUrl = selectedAsset && includeDownloadUrl
    ? await createContentAssetDownloadUrl(
        selectedAsset,
        configuration.assetStorage,
        configuration.signedDownloadLifetimeSeconds,
      )
    : null;
  const draft = ContentDraftSchema.parse({
    content: row.content,
    estimatedMinutes: row.estimated_minutes,
    featured: row.is_featured,
    kind: row.kind,
    slug: row.slug,
    subjectIds,
    summary: row.summary,
    title: row.title,
    topic: row.topic,
  });

  return ContentItemSchema.parse({
    ...draft,
    asset: selectedAsset ? parseAsset(selectedAsset, downloadUrl) : null,
    authorUserId: row.author_user_id,
    createdAt: toIsoString(row.created_at),
    id: row.id,
    publishedAt: row.published_at ? toIsoString(row.published_at) : null,
    status: row.status,
    updatedAt: toIsoString(row.updated_at),
  });
}

async function hydrateRows(
  database: QueryDatabase,
  rows: ContentRow[],
  configuration: PostgresContentProviderConfiguration = {},
  includeDownloadUrls = false,
) {
  if (rows.length === 0) return [];
  const ids = rows.map((row) => row.id);
  const [assets, subjects, views] = await Promise.all([
    database
      .selectFrom("content_assets")
      .selectAll()
      .where("content_item_id", "in", ids)
      .execute(),
    database
      .selectFrom("content_subjects")
      .select(["content_item_id", "subject_id"])
      .where("content_item_id", "in", ids)
      .execute(),
    database
      .selectFrom("content_view_counts")
      .select(["content_item_id", "view_count"])
      .where("content_item_id", "in", ids)
      .execute(),
  ]);
  const assetsByContent = new Map<string, AssetRow[]>();
  for (const asset of assets) {
    assetsByContent.set(asset.content_item_id, [
      ...(assetsByContent.get(asset.content_item_id) ?? []),
      asset,
    ]);
  }
  const subjectsByContent = new Map<string, string[]>();
  for (const subject of subjects) {
    subjectsByContent.set(subject.content_item_id, [
      ...(subjectsByContent.get(subject.content_item_id) ?? []),
      subject.subject_id,
    ]);
  }
  const viewsByContent = new Map(views.map((view) => [view.content_item_id, Number(view.view_count)]));
  return Promise.all(rows.map(async (row) => ({
    ...await parseContentItem(
      row,
      assetsByContent.get(row.id) ?? [],
      subjectsByContent.get(row.id) ?? [],
      configuration,
      includeDownloadUrls,
    ),
    viewCount: viewsByContent.get(row.id) ?? 0,
  })));
}

async function getItemById(database: QueryDatabase, contentId: string) {
  const row = await database
    .selectFrom("content_items")
    .selectAll()
    .where("id", "=", contentId)
    .executeTakeFirst();
  if (!row) return null;
  return (await hydrateRows(database, [row]))[0] ?? null;
}

async function getStoredAccess(
  database: QueryDatabase,
  contentId: string,
  lock = false,
) {
  const row = await database
    .selectFrom("content_items")
    .select(["author_user_id", "kind", "status", "version"])
    .where("id", "=", contentId)
    .$if(lock, (query) => query.forUpdate())
    .executeTakeFirst();
  return row
    ? {
        authorUserId: row.author_user_id,
        kind: row.kind,
        status: row.status,
        version: row.version,
      }
    : null;
}

async function writeAudit(
  database: QueryDatabase,
  input: {
    action: string;
    actorUserId: string;
    contentId: string;
    metadata?: { [key: string]: JsonValue };
  },
) {
  await database
    .insertInto("audit_log")
    .values({
      action: input.action,
      actor_user_id: input.actorUserId,
      metadata: input.metadata ?? {},
      target_id: input.contentId,
      target_type: "content_item",
    })
    .execute();
}

async function subjectIdsExist(database: QueryDatabase, subjectIds: string[]) {
  const ids = [...new Set(subjectIds)];
  if (ids.length === 0) return true;
  const result = await database
    .selectFrom("subjects")
    .select((expression) => expression.fn.countAll<number>().as("count"))
    .where("id", "in", ids)
    .executeTakeFirstOrThrow();
  return Number(result.count) === ids.length;
}

function normalizeTopic(value: string) {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .trim()
    .toLocaleLowerCase("es");
}

function contentTopics(content: JsonValue, fallback: string) {
  const regions =
    content && typeof content === "object" && !Array.isArray(content)
      ? content.regions
      : null;
  const values = Array.isArray(regions) ? regions : [];
  const topics = values.filter((value): value is string => typeof value === "string");
  if (fallback.trim()) topics.push(fallback);

  const unique = new Map<string, string>();
  for (const topic of topics) {
    const cleaned = topic.trim();
    const normalized = normalizeTopic(cleaned);
    if (cleaned && normalized && !unique.has(normalized)) unique.set(normalized, cleaned);
  }
  return [...unique.values()];
}

async function listTopics(database: QueryDatabase): Promise<ContentTopic[]> {
  const rows = await database
    .selectFrom("content_items")
    .select(["content", "id", "topic"])
    .execute();
  if (rows.length === 0) return [];

  const links = await database
    .selectFrom("content_subjects")
    .select(["content_item_id", "subject_id"])
    .where("content_item_id", "in", rows.map((row) => row.id))
    .execute();
  const subjectsByContent = new Map<string, Set<string>>();
  for (const link of links) {
    const subjectIds = subjectsByContent.get(link.content_item_id) ?? new Set<string>();
    subjectIds.add(link.subject_id);
    subjectsByContent.set(link.content_item_id, subjectIds);
  }

  const topics = new Map<string, { name: string; subjectIds: Set<string> }>();
  for (const row of rows) {
    for (const name of contentTopics(row.content, row.topic)) {
      const key = normalizeTopic(name);
      const current = topics.get(key) ?? { name, subjectIds: new Set<string>() };
      for (const subjectId of subjectsByContent.get(row.id) ?? []) {
        current.subjectIds.add(subjectId);
      }
      topics.set(key, current);
    }
  }

  return [...topics.values()]
    .map((topic) => ({
      name: topic.name,
      subjectIds: [...topic.subjectIds].sort(),
    }))
    .sort((left, right) => left.name.localeCompare(right.name, "es"));
}

export function areContentTopicsAllowed(input: {
  draft: ContentDraft;
  roles: PlatformRole[];
  topics: ContentTopic[];
}) {
  if (input.roles.includes("administrator")) return true;
  if (input.draft.kind === "topic") return false;

  const requested = contentTopics(input.draft.content as JsonValue, input.draft.topic);
  if (requested.length === 0) return true;
  if (input.draft.subjectIds.length === 0) return false;

  const allowedSubjectsByTopic = new Map(
    input.topics.map((topic) => [normalizeTopic(topic.name), new Set(topic.subjectIds)]),
  );
  return requested.every((topic) => {
    const allowedSubjects = allowedSubjectsByTopic.get(normalizeTopic(topic));
    return Boolean(
      allowedSubjects && input.draft.subjectIds.every((subjectId) => allowedSubjects.has(subjectId)),
    );
  });
}

async function draftUsesExistingTopics(
  database: QueryDatabase,
  draft: ContentDraft,
  roles: PlatformRole[],
) {
  return areContentTopicsAllowed({
    draft,
    roles,
    topics: await listTopics(database),
  });
}

async function replaceSubjectLinks(
  database: QueryDatabase,
  contentId: string,
  subjectIds: string[],
) {
  const ids = [...new Set(subjectIds)];
  if (!(await subjectIdsExist(database, ids))) return false;
  await database.deleteFrom("content_subjects").where("content_item_id", "=", contentId).execute();
  if (ids.length > 0) {
    await database
      .insertInto("content_subjects")
      .values(ids.map((subjectId) => ({ content_item_id: contentId, subject_id: subjectId })))
      .execute();
  }
  return true;
}

export function createPostgresContentProvider(
  database: DatabaseClient,
  configuration: PostgresContentProviderConfiguration = {},
): ContentProvider {
  return {
    async createAssetUpload(input) {
      const access = await getStoredAccess(database, input.contentId);
      if (!access) return { status: "not_found" };
      if (
        !canEditContent({
          actorUserId: input.actorUserId,
          authorUserId: access.authorUserId,
          roles: input.roles,
          status: access.status,
        })
      ) {
        return { status: "not_found" };
      }
      // Dynamic document/image uploads stay disabled until an independent
      // object-storage provider is configured. Video tests use VideoProvider.
      return { status: "conflict" };
    },

    async createContent(input) {
      if (!getContentCapabilities(input.roles).canCreate) return { status: "forbidden" };
      try {
        return await database.transaction().execute(async (transaction) => {
          if (!(await subjectIdsExist(transaction, input.draft.subjectIds))) {
            return { status: "conflict" };
          }
          if (!(await draftUsesExistingTopics(transaction, input.draft, input.roles))) {
            return { status: "forbidden" };
          }
          const row = await transaction
            .insertInto("content_items")
            .values({
              author_user_id: input.actorUserId,
              content: input.draft.content as JsonValue,
              estimated_minutes: input.draft.estimatedMinutes,
              is_featured: input.draft.featured,
              kind: input.draft.kind,
              published_at: null,
              published_by: null,
              reviewed_at: null,
              reviewed_by: null,
              slug: input.draft.slug,
              status: "draft",
              summary: input.draft.summary,
              title: input.draft.title,
              topic: input.draft.topic,
            })
            .returningAll()
            .executeTakeFirstOrThrow();
          await replaceSubjectLinks(transaction, row.id, input.draft.subjectIds);
          await writeAudit(transaction, {
            action: "content_created",
            actorUserId: input.actorUserId,
            contentId: row.id,
            metadata: { kind: row.kind, subjectIds: input.draft.subjectIds },
          });
          const item = await getItemById(transaction, row.id);
          return item ? { status: "success", value: item } : { status: "not_found" };
        });
      } catch (error) {
        if (isUniqueConflict(error)) return { status: "conflict" };
        throw error;
      }
    },

    async deleteContent(input) {
      return database.transaction().execute(async (transaction) => {
        const access = await getStoredAccess(transaction, input.contentId, true);
        if (!access) return { status: "not_found" };
        if (
          !["guide", "video"].includes(access.kind) ||
          !getContentCapabilities(input.roles).canDeleteContent
        ) {
          return { status: "not_found" };
        }
        const deleted = await transaction
          .deleteFrom("content_items")
          .where("id", "=", input.contentId)
          .where("version", "=", access.version)
          .returning("id")
          .executeTakeFirst();
        if (!deleted) return { status: "conflict" };
        await writeAudit(transaction, {
          action: "content_deleted",
          actorUserId: input.actorUserId,
          contentId: input.contentId,
          metadata: { kind: access.kind, status: access.status },
        });
        return { status: "success", value: { id: deleted.id } };
      });
    },

    async deleteAsset(input) {
      return database.transaction().execute(async (transaction) => {
        const asset = await transaction
          .selectFrom("content_assets")
          .selectAll()
          .where("id", "=", input.assetId)
          .forUpdate()
          .executeTakeFirst();
        if (!asset) return { status: "not_found" };
        const access = await getStoredAccess(transaction, asset.content_item_id, true);
        if (!access) return { status: "not_found" };
        if (
          !canEditContent({
            actorUserId: input.actorUserId,
            authorUserId: access.authorUserId,
            roles: input.roles,
            status: access.status,
          })
        ) {
          return { status: "not_found" };
        }
        if (access.status === "in_review" || access.status === "approved") {
          const reset = await transaction
            .updateTable("content_items")
            .set({
              reviewed_at: null,
              reviewed_by: null,
              status: "draft",
              version: access.version + 1,
            })
            .where("id", "=", asset.content_item_id)
            .where("version", "=", access.version)
            .returning("id")
            .executeTakeFirst();
          if (!reset) return { status: "conflict" };
        }
        await transaction.deleteFrom("content_assets").where("id", "=", input.assetId).execute();
        await writeAudit(transaction, {
          action: "content_asset_deleted",
          actorUserId: input.actorUserId,
          contentId: asset.content_item_id,
          metadata: { assetId: input.assetId, storageCleanupSkipped: true },
        });
        const item = await getItemById(transaction, asset.content_item_id);
        return item ? { status: "success", value: item } : { status: "not_found" };
      });
    },

    async finalizeAsset(input) {
      const asset = await database
        .selectFrom("content_assets")
        .select("id")
        .where("id", "=", input.assetId)
        .executeTakeFirst();
      return asset ? { status: "conflict" } : { status: "not_found" };
    },

    async getPublishedBySlug(slug) {
      const row = await database
        .selectFrom("content_items")
        .selectAll()
        .where("slug", "=", slug)
        .where("status", "=", "published")
        .executeTakeFirst();
      return row
        ? (await hydrateRows(database, [row], configuration, true))[0] ?? null
        : null;
    },

    async getRoles(userId) {
      const rows = await database
        .selectFrom("user_roles")
        .select("role")
        .where("user_id", "=", userId)
        .execute();
      const roles: PlatformRole[] = [];
      for (const row of rows) {
        const role = PlatformRoleSchema.safeParse(row.role);
        if (role.success && !roles.includes(role.data)) roles.push(role.data);
      }
      return roles;
    },

    async getWorkspace(input) {
      const capabilities = getContentCapabilities(input.roles);
      if (!capabilities.canCreate && !capabilities.canEditAll) return [];
      const rows = await database
        .selectFrom("content_items")
        .selectAll()
        .$if(!capabilities.canEditAll, (query) =>
          query.where("author_user_id", "=", input.actorUserId),
        )
        .orderBy("updated_at", "desc")
        .limit(200)
        .execute();
      return hydrateRows(database, rows);
    },

    async listPublished(input) {
      const rows = await database
        .selectFrom("content_items")
        .$if(Boolean(input.subjectId), (query) =>
          query
            .innerJoin(
              "content_subjects",
              "content_subjects.content_item_id",
              "content_items.id",
            )
            .where("content_subjects.subject_id", "=", input.subjectId ?? ""),
        )
        .selectAll("content_items")
        .$if(input.sort === "views", (query) => query
          .leftJoin("content_view_counts", "content_view_counts.content_item_id", "content_items.id")
          .orderBy(sql<number>`coalesce(content_view_counts.view_count, 0)`, "desc"),
        )
        .where("content_items.status", "=", "published")
        .$if(Boolean(input.kind), (query) =>
          query.where("content_items.kind", "=", input.kind ?? "topic"),
        )
        .$if(Boolean(input.linkedVideoId), (query) =>
          query.where(
            (expression) =>
              expression.fn("jsonb_extract_path_text", [
                "content_items.content",
                expression.val("linkedVideoId"),
              ]),
            "=",
            input.linkedVideoId ?? "",
          ),
        )
        .orderBy("content_items.published_at", "desc")
        .orderBy("content_items.id", "asc")
        .limit(Math.min(Math.max(input.limit, 1), 100))
        .execute();
      return hydrateRows(database, rows);
    },

    async recordView(input) {
      return database.transaction().execute(async (transaction) => {
        const item = await transaction.selectFrom("content_items")
          .select("id")
          .where("id", "=", input.contentId)
          .where("status", "=", "published")
          .forShare()
          .executeTakeFirst();
        if (!item) return { status: "not_found" };

        const receipt = await transaction.insertInto("content_view_receipts")
          .values({ content_item_id: item.id, viewer_key: input.viewerKey })
          .onConflict((conflict) => conflict.columns(["content_item_id", "viewer_key"])
            .doUpdateSet({ last_viewed_at: sql<Date>`now()` })
            .where("content_view_receipts.last_viewed_at", "<=", sql<Date>`now() - interval '30 minutes'`),
          )
          .returning("content_item_id")
          .executeTakeFirst();
        if (!receipt) return { status: "success", value: { counted: false } };

        await transaction.insertInto("content_view_counts")
          .values({ content_item_id: item.id, view_count: 1 })
          .onConflict((conflict) => conflict.column("content_item_id")
            .doUpdateSet({ view_count: sql<string>`content_view_counts.view_count + 1` }),
          )
          .execute();
        return { status: "success", value: { counted: true } };
      });
    },

    listTopics() {
      return listTopics(database);
    },

    async transitionContent(input) {
      return database.transaction().execute(async (transaction) => {
        const access = await getStoredAccess(transaction, input.contentId, true);
        if (!access) return { status: "not_found" };
        if (
          !isContentTransitionAllowed({
            actorUserId: input.actorUserId,
            authorUserId: access.authorUserId,
            currentStatus: access.status,
            roles: input.roles,
            targetStatus: input.status,
          })
        ) {
          return { status: "forbidden" };
        }
        if (["in_review", "approved", "published"].includes(input.status)) {
          const current = await getItemById(transaction, input.contentId);
          if (!current) return { status: "not_found" };
          if (!isContentReadyForTransition(current, input.status)) {
            return { status: "not_publishable" };
          }
        }

        const now = new Date();
        const update: Updateable<ContentItemTable> = {
          status: input.status,
          version: access.version + 1,
        };
        if (input.status === "in_review") {
          update.reviewed_at = null;
          update.reviewed_by = null;
        }
        if (input.status === "changes_requested" || input.status === "approved") {
          update.reviewed_at = now;
          update.reviewed_by = input.actorUserId;
        }
        if (input.status === "published") {
          update.published_at = now;
          update.published_by = input.actorUserId;
        }
        const row = await transaction
          .updateTable("content_items")
          .set(update)
          .where("id", "=", input.contentId)
          .where("version", "=", access.version)
          .returningAll()
          .executeTakeFirst();
        if (!row) return { status: "conflict" };
        await writeAudit(transaction, {
          action: `content_${input.status}`,
          actorUserId: input.actorUserId,
          contentId: input.contentId,
          metadata: { from: access.status, to: input.status },
        });
        const item = await getItemById(transaction, input.contentId);
        return item ? { status: "success", value: item } : { status: "not_found" };
      });
    },

    async assignSubjects(input) {
      if (!getContentCapabilities(input.roles).canEditAll) return { status: "forbidden" };
      return database.transaction().execute(async (transaction) => {
        const access = await getStoredAccess(transaction, input.contentId, true);
        if (!access) return { status: "not_found" };
        const current = await getItemById(transaction, input.contentId);
        if (!current) return { status: "not_found" };
        const draft = ContentDraftSchema.parse({ ...current, subjectIds: input.subjectIds });
        if (!(await draftUsesExistingTopics(transaction, draft, input.roles))) {
          return { status: "forbidden" };
        }
        if (!(await replaceSubjectLinks(transaction, input.contentId, input.subjectIds))) {
          return { status: "conflict" };
        }
        await writeAudit(transaction, {
          action: "content_subjects_updated",
          actorUserId: input.actorUserId,
          contentId: input.contentId,
          metadata: { subjectIds: [...new Set(input.subjectIds)] },
        });
        const item = await getItemById(transaction, input.contentId);
        return item ? { status: "success", value: item } : { status: "not_found" };
      });
    },

    async updateContent(input) {
      try {
        return await database.transaction().execute(async (transaction) => {
          const access = await getStoredAccess(transaction, input.contentId, true);
          if (!access) return { status: "not_found" };
          if (
            (access.kind === "topic" || input.draft.kind === "topic") &&
            !input.roles.includes("administrator")
          ) {
            return { status: "forbidden" };
          }
          const canEdit = canEditContent({
            actorUserId: input.actorUserId,
            authorUserId: access.authorUserId,
            roles: input.roles,
            status: access.status,
          });
          const canUpdatePublishedMetadata =
            access.status === "published" && getContentCapabilities(input.roles).canEditAll;
          if (!canEdit && !canUpdatePublishedMetadata) return { status: "not_found" };
          if (access.status === "published" && !input.roles.includes("administrator")) {
            const current = await getItemById(transaction, input.contentId);
            if (!current || !isPublishedPermittedUpdate(current, input.draft)) {
              return { status: "not_found" };
            }
          }
          if (
            (access.status === "published" || access.status === "archived") &&
            !PublishableContentDraftSchema.safeParse(input.draft).success
          ) {
            return { status: "not_publishable" };
          }
          if (!(await subjectIdsExist(transaction, input.draft.subjectIds))) {
            return { status: "conflict" };
          }
          if (!(await draftUsesExistingTopics(transaction, input.draft, input.roles))) {
            return { status: "forbidden" };
          }
          const nextStatus =
            access.status === "in_review" || access.status === "approved"
              ? "draft"
              : access.status;
          const row = await transaction
            .updateTable("content_items")
            .set({
              content: input.draft.content as JsonValue,
              estimated_minutes: input.draft.estimatedMinutes,
              is_featured: input.draft.featured,
              kind: input.draft.kind,
              reviewed_at: nextStatus === "draft" ? null : undefined,
              reviewed_by: nextStatus === "draft" ? null : undefined,
              slug: input.draft.slug,
              status: nextStatus,
              summary: input.draft.summary,
              title: input.draft.title,
              topic: input.draft.topic,
              version: access.version + 1,
            })
            .where("id", "=", input.contentId)
            .where("version", "=", access.version)
            .returning("id")
            .executeTakeFirst();
          if (!row) return { status: "conflict" };
          await replaceSubjectLinks(transaction, input.contentId, input.draft.subjectIds);
          await writeAudit(transaction, {
            action: "content_updated",
            actorUserId: input.actorUserId,
            contentId: input.contentId,
            metadata: { kind: input.draft.kind, subjectIds: input.draft.subjectIds },
          });
          const item = await getItemById(transaction, input.contentId);
          return item ? { status: "success", value: item } : { status: "not_found" };
        });
      } catch (error) {
        if (isUniqueConflict(error)) return { status: "conflict" };
        throw error;
      }
    },
  };
}
