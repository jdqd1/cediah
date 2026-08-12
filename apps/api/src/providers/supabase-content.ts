import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import {
  ContentAssetSchema,
  ContentAssetUploadResponseSchema,
  ContentDraftSchema,
  ContentItemSchema,
  ContentKindSchema,
  ContentStatusSchema,
  PlatformRoleSchema,
  type ContentAsset,
  type ContentAssetKind,
  type ContentItem,
  type ContentProvider,
  type ContentStatus,
  type ContentTransitionRequest,
  type PlatformRole,
} from "@cediah/contracts";
import { canEditContent, getContentCapabilities } from "../content-authorization.js";
import type { SupabaseStorageConfiguration } from "../config.js";

const assetSelection =
  "id, content_item_id, owner_user_id, kind, storage_bucket, storage_path, original_file_name, mime_type, size_bytes, status, finalized_at, created_at";
const contentSelection =
  "id, kind, slug, title, summary, topic, status, content, estimated_minutes, is_featured, author_user_id, published_at, created_at, updated_at, content_assets (" +
  assetSelection +
  ")";

const signedDownloadLifetimeSeconds = 60 * 60;
const maximumFileSizeBytes = 500_000_000;

function asArray(value: unknown) {
  return Array.isArray(value) ? value : [];
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function readString(value: unknown) {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function readInteger(value: unknown) {
  return typeof value === "number" && Number.isInteger(value) ? value : null;
}

function readBoolean(value: unknown) {
  return typeof value === "boolean" ? value : null;
}

function isUniqueConflict(error: unknown) {
  return asRecord(error)?.code === "23505";
}

function fileExtension(mimeType: string) {
  const extensions: Record<string, string> = {
    "application/pdf": "pdf",
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "video/mp4": "mp4",
    "video/quicktime": "mov",
    "video/webm": "webm",
  };

  return extensions[mimeType] ?? "bin";
}

function canAttachAsset(contentKind: string, assetKind: ContentAssetKind) {
  if (assetKind === "image") return true;
  if (contentKind === "video") return assetKind === "video";
  if (contentKind === "guide") return assetKind === "document";
  return false;
}

function validTransition(input: {
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
    return capabilities.canPublish && input.currentStatus === "approved";
  }

  return capabilities.canPublish && input.currentStatus === "published";
}

export function isContentReadyForTransition(
  item: ContentItem,
  targetStatus: ContentTransitionRequest["status"],
) {
  if (item.kind === "video") {
    if (targetStatus !== "in_review" && targetStatus !== "published") return true;

    const hasReadyVideo =
      item.asset?.status === "ready" && item.asset.kind === "video";
    const hasLegacyExternalVideo = Boolean(item.content.externalUrl);

    return (
      (hasReadyVideo || hasLegacyExternalVideo) &&
      item.content.keyPoints.length > 0 &&
      item.content.guide.sections.length > 0 &&
      item.content.quiz.questions.length > 0
    );
  }

  if (targetStatus === "published" && item.kind === "guide") {
    return (
      item.content.sections.length > 0 ||
      (item.asset?.status === "ready" && item.asset.kind === "document")
    );
  }

  return true;
}

export function createSupabaseContentProvider(
  configuration: SupabaseStorageConfiguration,
): ContentProvider {
  const client = createClient(configuration.url, configuration.secretKey, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
    },
  });

  async function parseAsset(
    row: Record<string, unknown>,
    includeDownloadUrl: boolean,
  ): Promise<ContentAsset> {
    let downloadUrl: string | null = null;
    const status = row.status === "ready" ? "ready" : "pending";

    if (includeDownloadUrl && status === "ready") {
      const bucketName = readString(row.storage_bucket);
      const path = readString(row.storage_path);
      if (bucketName && path) {
        const { data } = await client.storage
          .from(bucketName)
          .createSignedUrl(path, signedDownloadLifetimeSeconds);
        downloadUrl = data?.signedUrl ?? null;
      }
    }

    return ContentAssetSchema.parse({
      contentId: row.content_item_id,
      downloadUrl,
      fileName: row.original_file_name,
      id: row.id,
      kind: row.kind,
      mimeType: row.mime_type,
      sizeBytes: row.size_bytes,
      status,
    });
  }

  async function parseContentItem(
    rowValue: unknown,
    includeDownloadUrl: boolean,
  ): Promise<ContentItem> {
    const row = asRecord(rowValue);
    if (!row) throw new Error("Supabase returned an invalid content row");

    const assets = asArray(row.content_assets)
      .map(asRecord)
      .filter((asset): asset is Record<string, unknown> => Boolean(asset))
      .sort((left, right) => {
        const leftDate = Date.parse(readString(left.created_at) ?? "");
        const rightDate = Date.parse(readString(right.created_at) ?? "");
        return rightDate - leftDate;
      });
    const selectedAsset = assets.find((asset) => asset.status === "ready") ?? assets[0] ?? null;
    const asset = selectedAsset
      ? await parseAsset(selectedAsset, includeDownloadUrl)
      : null;
    const draft = ContentDraftSchema.parse({
      content: row.content,
      estimatedMinutes: row.estimated_minutes ?? null,
      featured: readBoolean(row.is_featured) ?? false,
      kind: row.kind,
      slug: row.slug,
      summary: row.summary,
      title: row.title,
      topic: row.topic,
    });

    return ContentItemSchema.parse({
      ...draft,
      asset,
      authorUserId: row.author_user_id,
      createdAt: row.created_at,
      id: row.id,
      publishedAt: row.published_at ?? null,
      status: row.status,
      updatedAt: row.updated_at,
    });
  }

  async function parseContentRows(data: unknown, includeDownloadUrl: boolean) {
    return Promise.all(
      asArray(data).map((row) => parseContentItem(row, includeDownloadUrl)),
    );
  }

  async function getItemById(contentId: string) {
    const { data, error } = await client
      .from("content_items")
      .select(contentSelection)
      .eq("id", contentId)
      .maybeSingle();
    if (error) throw error;
    return data ? parseContentItem(data, false) : null;
  }

  async function getStoredAccess(contentId: string) {
    const { data, error } = await client
      .from("content_items")
      .select("id, kind, author_user_id, status, version")
      .eq("id", contentId)
      .maybeSingle();
    if (error) throw error;

    const row = asRecord(data);
    const status = ContentStatusSchema.safeParse(row?.status);
    const kind = ContentKindSchema.safeParse(row?.kind);
    const authorUserId = readString(row?.author_user_id);
    const version = readInteger(row?.version);
    if (!row || !status.success || !kind.success || !authorUserId || !version) return null;

    return {
      authorUserId,
      kind: kind.data,
      status: status.data,
      version,
    };
  }

  async function writeAudit(input: {
    action: string;
    actorUserId: string;
    contentId: string;
    metadata?: Record<string, unknown>;
  }) {
    const { error } = await client.from("audit_log").insert({
      action: input.action,
      actor_user_id: input.actorUserId,
      metadata: input.metadata ?? {},
      target_id: input.contentId,
      target_type: "content_item",
    });
    if (error) throw error;
  }

  return {
    async createAssetUpload(input) {
      const access = await getStoredAccess(input.contentId);
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
      if (!canAttachAsset(access.kind, input.file.kind)) return { status: "conflict" };

      const assetId = randomUUID();
      const path =
        "content/" +
        input.contentId +
        "/" +
        assetId +
        "." +
        fileExtension(input.file.mimeType);
      const { data: assetData, error: assetError } = await client
        .from("content_assets")
        .insert({
          content_item_id: input.contentId,
          id: assetId,
          kind: input.file.kind,
          mime_type: input.file.mimeType,
          original_file_name: input.file.fileName,
          owner_user_id: input.actorUserId,
          size_bytes: input.file.fileSizeBytes,
          status: "pending",
          storage_bucket: configuration.bucket,
          storage_path: path,
        })
        .select(assetSelection)
        .single();
      if (assetError) throw assetError;

      const bucket = client.storage.from(configuration.bucket);
      const { data: uploadData, error: uploadError } = await bucket.createSignedUploadUrl(path, {
        upsert: false,
      });
      if (uploadError || !uploadData?.signedUrl || !uploadData.path || !uploadData.token) {
        await client.from("content_assets").delete().eq("id", assetId);
        throw uploadError ?? new Error("Supabase omitted signed-upload details");
      }

      if (access.status === "in_review" || access.status === "approved") {
        const { error: resetError } = await client
          .from("content_items")
          .update({
            reviewed_at: null,
            reviewed_by: null,
            status: "draft",
            version: access.version + 1,
          })
          .eq("id", input.contentId)
          .eq("version", access.version);
        if (resetError) throw resetError;
      }

      await writeAudit({
        action: "content_asset_reserved",
        actorUserId: input.actorUserId,
        contentId: input.contentId,
        metadata: { assetId, kind: input.file.kind },
      });

      return {
        status: "success",
        value: ContentAssetUploadResponseSchema.parse({
          asset: await parseAsset(asRecord(assetData) ?? {}, false),
          constraints: { maxFileSizeBytes: maximumFileSizeBytes },
          upload: {
            path: uploadData.path,
            token: uploadData.token,
            url: uploadData.signedUrl,
          },
        }),
      };
    },

    async createContent(input) {
      const { data, error } = await client
        .from("content_items")
        .insert({
          author_user_id: input.actorUserId,
          content: input.draft.content,
          estimated_minutes: input.draft.estimatedMinutes,
          is_featured: input.draft.featured,
          kind: input.draft.kind,
          slug: input.draft.slug,
          status: "draft",
          summary: input.draft.summary,
          title: input.draft.title,
          topic: input.draft.topic,
        })
        .select(contentSelection)
        .single();
      if (error) {
        if (isUniqueConflict(error)) return { status: "conflict" };
        throw error;
      }

      const item = await parseContentItem(data, true);
      await writeAudit({
        action: "content_created",
        actorUserId: input.actorUserId,
        contentId: item.id,
        metadata: { kind: item.kind },
      });
      return { status: "success", value: item };
    },

    async finalizeAsset(input) {
      const { data, error } = await client
        .from("content_assets")
        .select(assetSelection)
        .eq("id", input.assetId)
        .maybeSingle();
      if (error) throw error;

      const row = asRecord(data);
      const contentId = readString(row?.content_item_id);
      const ownerUserId = readString(row?.owner_user_id);
      const bucketName = readString(row?.storage_bucket);
      const path = readString(row?.storage_path);
      const expectedMimeType = readString(row?.mime_type);
      const expectedSize = readInteger(row?.size_bytes);
      if (
        !row ||
        !contentId ||
        !ownerUserId ||
        !bucketName ||
        !path ||
        !expectedMimeType ||
        !expectedSize
      ) {
        return { status: "not_found" };
      }

      const access = await getStoredAccess(contentId);
      if (!access) return { status: "not_found" };
      const canManageAll = getContentCapabilities(input.roles).canEditAll;
      if (input.actorUserId !== ownerUserId && !canManageAll) {
        return { status: "not_found" };
      }
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

      const { data: fileInfo, error: fileInfoError } = await client.storage
        .from(bucketName)
        .info(path);
      if (fileInfoError) throw fileInfoError;
      if (
        fileInfo.size !== expectedSize ||
        fileInfo.contentType !== expectedMimeType
      ) {
        return { status: "conflict" };
      }

      const finalizedAt = new Date().toISOString();
      const { data: finalizedData, error: finalizedError } = await client
        .from("content_assets")
        .update({ finalized_at: finalizedAt, status: "ready" })
        .eq("id", input.assetId)
        .eq("status", "pending")
        .select(assetSelection)
        .maybeSingle();
      if (finalizedError) throw finalizedError;
      const finalizedRow = asRecord(finalizedData);
      if (!finalizedRow) {
        if (row.status === "ready") {
          return { status: "success", value: await parseAsset(row, true) };
        }
        return { status: "conflict" };
      }

      await writeAudit({
        action: "content_asset_finalized",
        actorUserId: input.actorUserId,
        contentId,
        metadata: { assetId: input.assetId },
      });
      return { status: "success", value: await parseAsset(finalizedRow, true) };
    },

    async getPublishedBySlug(slug) {
      const { data, error } = await client
        .from("content_items")
        .select(contentSelection)
        .eq("slug", slug)
        .eq("status", "published")
        .maybeSingle();
      if (error) throw error;
      return data ? parseContentItem(data, true) : null;
    },

    async getRoles(userId) {
      const { data, error } = await client
        .from("user_roles")
        .select("role")
        .eq("user_id", userId);
      if (error) throw error;

      const roles: PlatformRole[] = [];
      for (const value of asArray(data)) {
        const role = PlatformRoleSchema.safeParse(asRecord(value)?.role);
        if (role.success && !roles.includes(role.data)) roles.push(role.data);
      }
      return roles;
    },

    async getWorkspace(input) {
      const capabilities = getContentCapabilities(input.roles);
      if (!capabilities.canCreate && !capabilities.canEditAll) return [];

      let query = client
        .from("content_items")
        .select(contentSelection)
        .order("updated_at", { ascending: false })
        .limit(200);
      if (!capabilities.canEditAll) query = query.eq("author_user_id", input.actorUserId);

      const { data, error } = await query;
      if (error) throw error;
      return parseContentRows(data, false);
    },

    async listPublished(input) {
      let query = client
        .from("content_items")
        .select(contentSelection)
        .eq("status", "published")
        .order("published_at", { ascending: false })
        .limit(Math.min(Math.max(input.limit, 1), 100));
      if (input.kind) query = query.eq("kind", input.kind);

      const { data, error } = await query;
      if (error) throw error;
      return parseContentRows(data, false);
    },

    async transitionContent(input) {
      const access = await getStoredAccess(input.contentId);
      if (!access) return { status: "not_found" };
      if (
        !validTransition({
          actorUserId: input.actorUserId,
          authorUserId: access.authorUserId,
          currentStatus: access.status,
          roles: input.roles,
          targetStatus: input.status,
        })
      ) {
        return { status: "forbidden" };
      }

      if (input.status === "in_review" || input.status === "published") {
        const item = await getItemById(input.contentId);
        if (!item) return { status: "not_found" };
        if (!isContentReadyForTransition(item, input.status)) {
          return { status: "not_publishable" };
        }
      }

      const now = new Date().toISOString();
      const patch: Record<string, unknown> = {
        status: input.status,
        version: access.version + 1,
      };
      if (input.status === "in_review") {
        patch.reviewed_at = null;
        patch.reviewed_by = null;
      }
      if (input.status === "changes_requested" || input.status === "approved") {
        patch.reviewed_at = now;
        patch.reviewed_by = input.actorUserId;
      }
      if (input.status === "published") {
        patch.published_at = now;
        patch.published_by = input.actorUserId;
      }

      const { data, error } = await client
        .from("content_items")
        .update(patch)
        .eq("id", input.contentId)
        .eq("status", access.status)
        .eq("version", access.version)
        .select(contentSelection)
        .maybeSingle();
      if (error) throw error;
      if (!data) return { status: "conflict" };

      const item = await parseContentItem(data, true);
      await writeAudit({
        action: "content_" + input.status,
        actorUserId: input.actorUserId,
        contentId: input.contentId,
        metadata: { from: access.status, to: input.status },
      });
      return { status: "success", value: item };
    },

    async updateContent(input) {
      const access = await getStoredAccess(input.contentId);
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

      const nextStatus =
        access.status === "in_review" || access.status === "approved" ? "draft" : access.status;
      const patch: Record<string, unknown> = {
        content: input.draft.content,
        estimated_minutes: input.draft.estimatedMinutes,
        is_featured: input.draft.featured,
        kind: input.draft.kind,
        slug: input.draft.slug,
        status: nextStatus,
        summary: input.draft.summary,
        title: input.draft.title,
        topic: input.draft.topic,
        version: access.version + 1,
      };
      if (nextStatus === "draft") {
        patch.reviewed_at = null;
        patch.reviewed_by = null;
      }

      const { data, error } = await client
        .from("content_items")
        .update(patch)
        .eq("id", input.contentId)
        .eq("version", access.version)
        .select(contentSelection)
        .maybeSingle();
      if (error) {
        if (isUniqueConflict(error)) return { status: "conflict" };
        throw error;
      }
      if (!data) return { status: "conflict" };

      const item = await parseContentItem(data, true);
      await writeAudit({
        action: "content_updated",
        actorUserId: input.actorUserId,
        contentId: input.contentId,
        metadata: { kind: item.kind },
      });
      return { status: "success", value: item };
    },
  };
}
