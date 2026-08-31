import type {
  ContentCapabilities,
  ContentDraft,
  ContentItem,
  ContentStatus,
  PlatformRole,
} from "@cediah/contracts";

const creatorRoles = new Set<PlatformRole>([
  "community_contributor",
  "presenter",
  "academic_editor",
  "coordination",
  "administrator",
]);
const reviewerRoles = new Set<PlatformRole>([
  "academic_editor",
  "coordination",
  "administrator",
]);
const publisherRoles = new Set<PlatformRole>(["coordination", "administrator"]);

function hasAnyRole(roles: PlatformRole[], allowed: Set<PlatformRole>) {
  return roles.some((role) => allowed.has(role));
}

export function getContentCapabilities(roles: PlatformRole[]): ContentCapabilities {
  const canCreate = hasAnyRole(roles, creatorRoles);
  const canReview = hasAnyRole(roles, reviewerRoles);
  const canPublish = hasAnyRole(roles, publisherRoles);

  return {
    canCreate,
    canEditAll: canReview,
    canPublish,
    canReview,
    canUpload: canCreate,
  };
}

export function canEditContent(input: {
  actorUserId: string;
  authorUserId: string;
  roles: PlatformRole[];
  status: ContentStatus;
}) {
  const capabilities = getContentCapabilities(input.roles);
  if (input.status === "published") return false;
  if (input.status === "archived") return capabilities.canPublish;
  if (capabilities.canEditAll) return true;

  return (
    capabilities.canCreate &&
    input.actorUserId === input.authorUserId &&
    (input.status === "draft" || input.status === "changes_requested")
  );
}

export function isPublishedPermittedUpdate(
  current: ContentItem,
  next: ContentDraft,
) {
  if (
    current.kind !== next.kind ||
    current.slug !== next.slug ||
    current.summary !== next.summary ||
    current.estimatedMinutes !== next.estimatedMinutes ||
    current.featured !== next.featured
  ) {
    return false;
  }

  const currentContent = {
    ...current.content,
    regions: [],
    ...(current.kind === "guide" ? { linkedVideoId: null } : {}),
  };
  const nextContent = {
    ...next.content,
    regions: [],
    ...(next.kind === "guide" ? { linkedVideoId: null } : {}),
  };
  return JSON.stringify(currentContent) === JSON.stringify(nextContent);
}
