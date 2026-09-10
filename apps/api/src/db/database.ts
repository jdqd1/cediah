import {
  Kysely,
  PostgresDialect,
  type ColumnType,
  type Generated,
} from "kysely";
import { Pool, type PoolConfig } from "pg";
import type {
  ContentAssetKind,
  CatalogVisibility,
  ContentKind,
  ContentStatus,
  LearningCoverKey,
  LearningEvidenceState,
  LearningEnrollmentStatus,
  LearningAttemptStatus,
  LearningPathStatus,
  LearningProgressStatus,
  LearningProjection,
  LearningStepPurpose,
  LearningStepProgressState,
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
  catalog_visibility: Generated<CatalogVisibility>;
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

export interface LearningResourceTable {
  adapter_key: string;
  created_at: GeneratedTimestamp;
  id: Generated<string>;
  projection: "video" | "guide" | "quiz" | "flashcards";
  retired_at: NullableTimestamp;
  source_content_id: string;
}

export interface LearningItemTable {
  created_at: GeneratedTimestamp;
  id: string;
  item_kind: "question" | "flashcard";
  memory_version: Generated<number>;
  retired_at: NullableTimestamp;
  source_content_id: string;
  updated_at: GeneratedTimestamp;
}

export interface LearningResourceRevisionTable {
  adapter_version: number;
  created_at: GeneratedTimestamp;
  id: Generated<string>;
  payload_hash: string;
  payload_json: JsonValue;
  resource_id: string;
  revision_number: number;
  schema_version: number;
  source_version: number;
}

export interface LearningPathTable {
  archived_at: NullableTimestamp;
  cover_asset_id: string | null;
  cover_key: LearningCoverKey | null;
  created_at: GeneratedTimestamp;
  created_by: string;
  id: Generated<string>;
  published_version_id: string | null;
  slug: string;
  summary: string;
  title: string;
  topic_content_id: string;
  updated_at: GeneratedTimestamp;
}

export interface LearningPathVersionTable {
  created_at: GeneratedTimestamp;
  edit_version: Generated<number>;
  id: Generated<string>;
  path_id: string;
  policy_json: GeneratedJsonDocument;
  policy_version: string;
  published_at: NullableTimestamp;
  published_by: string | null;
  release_notes: string;
  status: Generated<LearningPathStatus>;
  updated_at: GeneratedTimestamp;
  version_number: number;
}

export interface LearningPathUnitTable {
  id: Generated<string>;
  objectives_json: JsonValue;
  path_version_id: string;
  pedagogy_version: Generated<number>;
  position: number;
  stable_key: string;
  title: string;
}

export interface LearningPathStepTable {
  id: Generated<string>;
  is_essential: Generated<boolean>;
  objective_ids_json: JsonValue;
  path_version_id: string;
  pedagogy_version: Generated<number>;
  position: number;
  purpose: LearningStepPurpose;
  recommended_after_json: JsonValue;
  stable_key: string;
  title: string;
  unit_id: string;
}

export interface LearningStepOptionTable {
  completion_rule_json: JsonValue;
  config_json: JsonValue;
  estimated_minutes: number | null;
  id: Generated<string>;
  is_default: Generated<boolean>;
  label: string;
  path_version_id: string;
  position: number;
  projection: LearningProjection;
  resource_revision_id: string;
  reward_identity: string;
  reward_version: Generated<number>;
  source_content_id: string;
  step_id: string;
}

export interface LearningEnrollmentTable {
  completed_at: NullableTimestamp;
  created_at: GeneratedTimestamp;
  id: Generated<string>;
  last_activity_at: GeneratedTimestamp;
  path_id: string;
  path_version_id: string;
  paused_at: NullableTimestamp;
  row_version: Generated<number>;
  started_at: GeneratedTimestamp;
  status: Generated<LearningEnrollmentStatus>;
  updated_at: GeneratedTimestamp;
  user_id: string;
}

export interface LearningEnrollmentVersionTable {
  adopted_at: GeneratedTimestamp;
  enrollment_id: string;
  mapping_json: GeneratedJsonDocument;
  path_id: string;
  path_version_id: string;
  previous_version_id: string | null;
}

export interface LearningAttemptTable {
  client_attempt_id: string;
  created_at: GeneratedTimestamp;
  enrollment_id: string | null;
  id: Generated<string>;
  manifest_json: JsonValue;
  path_version_id: string | null;
  projection: LearningProjection | "review";
  purpose: LearningStepPurpose;
  resume_json: GeneratedJsonDocument;
  row_version: Generated<number>;
  score_json: ColumnType<JsonValue | null, JsonValue | null | undefined, JsonValue | null>;
  started_at: GeneratedTimestamp;
  status: Generated<LearningAttemptStatus>;
  step_id: string | null;
  step_option_id: string | null;
  submitted_at: NullableTimestamp;
  updated_at: GeneratedTimestamp;
  user_id: string;
}

export interface LearningResponseTable {
  answer_json: JsonValue;
  answered_at: GeneratedTimestamp;
  attempt_id: string;
  grading_json: JsonValue;
  id: Generated<string>;
  item_id: string;
  memory_version: number;
  round: Generated<number>;
  schedule_applied: Generated<boolean>;
}

export interface LearningStepProgressTable {
  completed_at: NullableTimestamp;
  completion_method: "graded" | "observed" | "rated" | "self_reported" | null;
  enrollment_id: string;
  evidence_attempt_id: string | null;
  path_version_id: string;
  row_version: Generated<number>;
  state: Generated<LearningStepProgressState>;
  step_id: string;
  updated_at: GeneratedTimestamp;
}

export interface LearningMutationReceiptTable {
  created_at: GeneratedTimestamp;
  expires_at: GeneratedTimestamp;
  http_status: number | null;
  idempotency_key: string;
  last_replayed_at: NullableTimestamp;
  replay_count: Generated<number>;
  request_hash: string;
  response_json: ColumnType<JsonValue | null, JsonValue | null | undefined, JsonValue | null>;
  user_id: string;
}

export interface LearningEventTable {
  attempt_id: string | null;
  enrollment_id: string | null;
  event_type: string;
  id: Generated<string>;
  local_date: ColumnType<string, string | undefined, string>;
  occurred_at: GeneratedTimestamp;
  payload_json: GeneratedJsonDocument;
  policy_version: Generated<string>;
  semantic_key: string;
  timezone: Generated<string>;
  user_id: string;
}

export type LearningRewardKind =
  | "activity_understand"
  | "activity_recall"
  | "activity_check"
  | "review_applied"
  | "unit_completed"
  | "route_completed"
  | "milestone_first_activity"
  | "milestone_first_unit"
  | "milestone_first_review";

export interface LearningRewardTable {
  award_key: string;
  created_at: GeneratedTimestamp;
  event_id: string;
  id: Generated<string>;
  local_date: string;
  reward_kind: LearningRewardKind;
  user_id: string;
  xp: number;
}

export interface LearningReviewStateTable {
  created_at: GeneratedTimestamp;
  item_id: string;
  lapses: Generated<number>;
  last_reviewed_at: NullableTimestamp;
  memory_version: number;
  next_due_at: ColumnType<Date, Date | string, Date | string>;
  policy_version: Generated<string>;
  row_version: Generated<number>;
  stage: Generated<number>;
  updated_at: GeneratedTimestamp;
  user_id: string;
}

export interface LearningObjectiveProgressTable {
  enrollment_id: string;
  evidence_json: GeneratedJsonDocument;
  evidence_state: Generated<LearningEvidenceState>;
  last_assessed_at: NullableTimestamp;
  objective_id: string;
  path_version_id: string;
  policy_version: Generated<string>;
  updated_at: GeneratedTimestamp;
}

export interface LearningPreferenceTable {
  created_at: GeneratedTimestamp;
  exam_date: ColumnType<string | null, string | null | undefined, string | null>;
  pending_preferences_json: GeneratedJsonDocument;
  pinned_enrollment_id: string | null;
  row_version: Generated<number>;
  session_minutes: Generated<5 | 10 | 20>;
  timezone: Generated<string>;
  updated_at: GeneratedTimestamp;
  user_id: string;
  weekly_goal_days: 2 | 3 | 5 | null;
}

export interface LearningTaskOverrideTable {
  action: "snooze" | "dismiss" | "pin";
  created_at: GeneratedTimestamp;
  enrollment_id: string | null;
  snoozed_until: NullableTimestamp;
  task_key: string;
  updated_at: GeneratedTimestamp;
  user_id: string;
}

export interface LearningMapTable {
  id: Generated<string>; user_id: string; row_version: Generated<number>;
  created_at: GeneratedTimestamp; updated_at: GeneratedTimestamp;
}
export interface LearningMapNodeTable {
  id: Generated<string>; map_id: string; title: string; icon_key: import("@cediah/contracts").MapIconKey;
  origin_topic_id: string | null; sort_order: number; created_at: GeneratedTimestamp; updated_at: GeneratedTimestamp;
}
export interface LearningMapEntryTable {
  id: Generated<string>; map_id: string; node_id: string; kind: "block" | "lesson"; path_id: string;
  unit_stable_key: string | null; sort_order: number; created_at: GeneratedTimestamp; updated_at: GeneratedTimestamp;
}
export interface LearningMapLayoutTable {
  map_id: string; level_key: string; row_version: Generated<number>; schema_version: Generated<number>;
  positions_json: GeneratedJsonDocument; updated_at: GeneratedTimestamp;
}
export interface CediahDatabase {
  learning_maps: LearningMapTable;
  learning_map_nodes: LearningMapNodeTable;
  learning_map_entries: LearningMapEntryTable;
  learning_map_layouts: LearningMapLayoutTable;
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
  learning_items: LearningItemTable;
  learning_attempts: LearningAttemptTable;
  learning_enrollment_versions: LearningEnrollmentVersionTable;
  learning_enrollments: LearningEnrollmentTable;
  learning_events: LearningEventTable;
  learning_mutation_receipts: LearningMutationReceiptTable;
  learning_path_steps: LearningPathStepTable;
  learning_path_units: LearningPathUnitTable;
  learning_path_versions: LearningPathVersionTable;
  learning_paths: LearningPathTable;
  learning_preferences: LearningPreferenceTable;
  learning_rewards: LearningRewardTable;
  learning_objective_progress: LearningObjectiveProgressTable;
  learning_resource_revisions: LearningResourceRevisionTable;
  learning_resources: LearningResourceTable;
  learning_review_states: LearningReviewStateTable;
  learning_responses: LearningResponseTable;
  learning_step_progress: LearningStepProgressTable;
  learning_step_options: LearningStepOptionTable;
  learning_task_overrides: LearningTaskOverrideTable;
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
