import { sql, type Transaction } from "kysely";
import type { ZodType } from "zod";
import type {
  GuidedLearningFailure,
  GuidedLearningResult,
} from "@cediah/contracts";
import type { CediahDatabase, JsonValue } from "../db/database.js";
import { hashLearningSnapshot } from "./snapshot-hash.js";

const failureStatuses = new Set<GuidedLearningFailure>([
  "active_attempt",
  "conflict",
  "forbidden",
  "idempotency_conflict",
  "invalid_state",
  "not_found",
  "resource_changed",
  "version_conflict",
]);

function httpStatus(result: GuidedLearningResult<unknown>) {
  if (result.status === "success") return 200;
  if (result.status === "not_found") return 404;
  if (result.status === "forbidden") return 403;
  if (result.status === "not_ready") return 422;
  return 409;
}

function parseStoredResult<T>(value: JsonValue | null, schema: ZodType<T>): GuidedLearningResult<T> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return { status: "conflict" };
  const record = value as Record<string, unknown>;
  if (record.status === "success") {
    const parsed = schema.safeParse(record.value);
    return parsed.success ? { status: "success", value: parsed.data } : { status: "conflict" };
  }
  if (record.status === "not_ready" && Array.isArray(record.issues)) return { status:"not_ready", issues:record.issues };
  return typeof record.status === "string" && failureStatuses.has(record.status as GuidedLearningFailure)
    ? { status: record.status as GuidedLearningFailure }
    : { status: "conflict" };
}

export async function withLearningReceipt<T>(
  transaction: Transaction<CediahDatabase>,
  input: {
    idempotencyKey: string;
    request: unknown;
    responseSchema: ZodType<T>;
    userId: string;
  },
  mutate: () => Promise<GuidedLearningResult<T>>,
): Promise<GuidedLearningResult<T>> {
  const requestHash = hashLearningSnapshot(input.request);
  const inserted = await transaction.insertInto("learning_mutation_receipts").values({
    http_status: null,
    idempotency_key: input.idempotencyKey,
    request_hash: requestHash,
    response_json: null,
    user_id: input.userId,
  }).onConflict((conflict) => conflict.columns(["user_id", "idempotency_key"]).doNothing())
    .returning("idempotency_key")
    .executeTakeFirst();
  if (!inserted) {
    const receipt = await transaction.updateTable("learning_mutation_receipts")
      .set({
        last_replayed_at: sql<Date>`now()`,
        replay_count: sql<number>`replay_count + 1`,
      })
      .where("user_id", "=", input.userId)
      .where("idempotency_key", "=", input.idempotencyKey)
      .where("request_hash", "=", requestHash)
      .returning(["request_hash", "response_json"])
      .executeTakeFirst();
    if (!receipt) return { status: "idempotency_conflict" };
    return parseStoredResult(receipt.response_json, input.responseSchema);
  }

  const result = await mutate();
  await transaction.updateTable("learning_mutation_receipts").set({
    http_status: httpStatus(result),
    response_json: result as unknown as JsonValue,
  }).where("user_id", "=", input.userId)
    .where("idempotency_key", "=", input.idempotencyKey)
    .executeTakeFirstOrThrow();
  return result;
}
