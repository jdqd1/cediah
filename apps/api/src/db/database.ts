import {
  Kysely,
  PostgresDialect,
  type ColumnType,
  type Generated,
} from "kysely";
import { Pool, type PoolConfig } from "pg";
import type {
  ContentAssetKind,
  ContentKind,
  ContentStatus,
  LearningProgressStatus,
  PlatformRole,
} from "@cediah/contracts";

export type JsonValue =
  | boolean
  | null
  | number
  | string
  | JsonValue[]
  | { [key: string]: JsonValue };

type GeneratedTimestamp = ColumnType<
  Date,
  Date | string | undefined,
  Date | string
>;
type NullableTimestamp = ColumnType<Date | null, Date | string | null, Date | string | null>;
type GeneratedJsonDocument = ColumnType<
  JsonValue,
  JsonValue | undefined,
  JsonValue
>;

export interface AuthUserTable {
  created_at: GeneratedTimestamp;
  email: string;
  email_verified: Generated<boolean>;
  id: Generated<string>;
  image: string | null;
  name: string;
  updated_at: GeneratedTimestamp;
}

export interface AuthSessionTable {
  created_at: GeneratedTimestamp;
  expires_at: ColumnType<Date, Date | string, Date | string>;
  id: Generated<string>;
  ip_address: string | null;
  token: string;
  updated_at: GeneratedTimestamp;
  user_agent: string | null;
  user_id: string;
}

export interface AuthAccountTable {
  access_token: string | null;
  access_token_expires_at: NullableTimestamp;
  account_id: string;
  created_at: GeneratedTimestamp;
  id: Generated<string>;
  id_token: string | null;
  issuer: string;
  password: string | null;
  provider_id: string;
  refresh_token: string | null;
  refresh_token_expires_at: NullableTimestamp;
  scope: string | null;
  updated_at: GeneratedTimestamp;
  user_id: string;
}

export interface AuthVerificationTable {
  created_at: GeneratedTimestamp;
  expires_at: ColumnType<Date, Date | string, Date | string>;
  id: Generated<string>;
  identifier: string;
  updated_at: GeneratedTimestamp;
  value: string;
}

export interface AuthRateLimitTable {
  count: number;
  id: Generated<string>;
  key: string;
  last_request: ColumnType<string, number | string, number | string>;
}

export interface ProfileTable {
  created_at: GeneratedTimestamp;
  degree_program: string | null;
  display_name: string | null;
  email: string;
  full_name: string;
  id: string;
  university: string | null;
  updated_at: GeneratedTimestamp;
}

export interface UserRoleTable {
  assigned_at: GeneratedTimestamp;
  assigned_by: string | null;
  role: PlatformRole;
  user_id: string;
}

export interface CourseTable {
  created_at: GeneratedTimestamp;
  created_by: string;
  estimated_duration_minutes: number | null;
  id: Generated<string>;
  published_at: NullableTimestamp;
  published_by: string | null;
  short_description: string | null;
  slug: string;
  status: ContentStatus;
  title: string;
  updated_at: GeneratedTimestamp;
}

export interface CourseModuleTable {
  course_id: string;
  created_at: GeneratedTimestamp;
  id: Generated<string>;
  position: number;
  title: string;
  updated_at: GeneratedTimestamp;
}

export interface LessonTable {
  created_at: GeneratedTimestamp;
  description: string | null;
  duration_seconds: number | null;
  external_video_id: string | null;
  id: Generated<string>;
  is_preview: Generated<boolean>;
  kind: "document" | "interactive" | "video";
  module_id: string;
  position: number;
  title: string;
  updated_at: GeneratedTimestamp;
}

export interface CourseResourceTable {
  course_id: string;
  created_at: GeneratedTimestamp;
  external_url: string | null;
  id: Generated<string>;
  lesson_id: string | null;
  requires_enrollment: Generated<boolean>;
  storage_path: string | null;
  title: string;
  type: "atlas" | "guide" | "link" | "worksheet";
  updated_at: GeneratedTimestamp;
}

export interface EnrollmentTable {
  access_ends_at: NullableTimestamp;
  access_starts_at: GeneratedTimestamp;
  course_id: string;
  created_at: GeneratedTimestamp;
  grant_reason: string | null;
  granted_by: string | null;
  id: Generated<string>;
  status: "active" | "completed" | "expired" | "paused" | "revoked";
  updated_at: GeneratedTimestamp;
  user_id: string;
}

export interface LessonProgressTable {
  completed_at: NullableTimestamp;
  created_at: GeneratedTimestamp;
  lesson_id: string;
  status: Generated<LearningProgressStatus>;
  updated_at: GeneratedTimestamp;
  user_id: string;
  watched_seconds: Generated<number>;
}

export interface AuditLogTable {
  action: string;
  actor_user_id: string | null;
  id: Generated<string>;
  metadata: GeneratedJsonDocument;
  occurred_at: GeneratedTimestamp;
  target_id: string | null;
  target_type: string;
}

export interface ContentItemTable {
  author_user_id: string;
  content: GeneratedJsonDocument;
  created_at: GeneratedTimestamp;
  estimated_minutes: number | null;
  id: Generated<string>;
  is_featured: Generated<boolean>;
  kind: ContentKind;
  published_at: NullableTimestamp;
  published_by: string | null;
  reviewed_at: NullableTimestamp;
  reviewed_by: string | null;
  slug: string;
  status: Generated<ContentStatus>;
  summary: string;
  title: string;
  topic: string;
  updated_at: GeneratedTimestamp;
  version: Generated<number>;
}

export interface ContentAssetTable {
  content_item_id: string;
  created_at: GeneratedTimestamp;
  finalized_at: NullableTimestamp;
  id: Generated<string>;
  kind: ContentAssetKind;
  mime_type: string;
  original_file_name: string;
  owner_user_id: string;
  size_bytes: ColumnType<string, number | string, number | string>;
  status: Generated<"pending" | "ready">;
  storage_bucket: Generated<string>;
  storage_path: string;
}

export interface SubjectTable {
  created_at: GeneratedTimestamp;
  id: Generated<string>;
  name: string;
  slug: string;
}

export interface ContentSubjectTable {
  content_item_id: string;
  created_at: GeneratedTimestamp;
  subject_id: string;
}

export interface CediahDatabase {
  content_reaction_counts: {
    content_item_id: string;
    like_count: ColumnType<string, number | string, number | string>;
    dislike_count: ColumnType<string, number | string, number | string>;
  };
  content_reactions: {
    content_item_id: string;
    viewer_key: string;
    reaction: "liked" | "disliked";
    updated_at: GeneratedTimestamp;
  };
  content_view_counts: {
    content_item_id: string;
    view_count: ColumnType<string, number | string, number | string>;
  };
  content_view_receipts: {
    content_item_id: string;
    viewer_key: string;
    last_viewed_at: GeneratedTimestamp;
  };
  audit_log: AuditLogTable;
  auth_accounts: AuthAccountTable;
  auth_rate_limits: AuthRateLimitTable;
  auth_sessions: AuthSessionTable;
  auth_users: AuthUserTable;
  auth_verifications: AuthVerificationTable;
  content_assets: ContentAssetTable;
  content_items: ContentItemTable;
  content_subjects: ContentSubjectTable;
  course_modules: CourseModuleTable;
  course_resources: CourseResourceTable;
  courses: CourseTable;
  enrollments: EnrollmentTable;
  lesson_progress: LessonProgressTable;
  lessons: LessonTable;
  profiles: ProfileTable;
  subjects: SubjectTable;
  user_roles: UserRoleTable;
}

export type DatabaseClient = Kysely<CediahDatabase>;

export function createPostgresPool(configuration: PoolConfig) {
  return new Pool(configuration);
}

export function createPostgresDatabase(pool: Pool): DatabaseClient {
  return new Kysely<CediahDatabase>({
    dialect: new PostgresDialect({ pool }),
  });
}
