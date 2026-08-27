import {
  AdminRoleUserSchema,
  PlatformRoleSchema,
  type AdminRoleUser,
  type PlatformRole,
  type RoleManagementProvider,
  type RoleManagementResult,
} from "@cediah/contracts";
import type { DatabaseClient } from "../db/database.js";

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function errorRecord(error: unknown) {
  return error && typeof error === "object" ? (error as Record<string, unknown>) : null;
}

function isLastAdministratorError(error: unknown) {
  const record = errorRecord(error);
  return typeof record?.message === "string" && record.message.includes("last_administrator");
}

async function getRolesFrom(
  database: DatabaseClient,
  userId: string,
): Promise<PlatformRole[]> {
  const rows = await database
    .selectFrom("user_roles")
    .select("role")
    .where("user_id", "=", userId)
    .orderBy("role", "asc")
    .execute();
  const roles: PlatformRole[] = [];

  for (const row of rows) {
    const parsed = PlatformRoleSchema.safeParse(row.role);
    if (parsed.success && !roles.includes(parsed.data)) roles.push(parsed.data);
  }

  return roles;
}

async function withRoles(
  database: DatabaseClient,
  input: { email: string; id: string },
): Promise<AdminRoleUser> {
  return AdminRoleUserSchema.parse({
    email: input.email,
    id: input.id,
    roles: await getRolesFrom(database, input.id),
  });
}

async function lookupUser(
  database: DatabaseClient,
  email: string,
): Promise<AdminRoleUser | null> {
  const user = await database
    .selectFrom("auth_users")
    .select(["email", "id"])
    .where((expression) =>
      expression.fn("lower", ["email"]),
      "=",
      normalizeEmail(email),
    )
    .executeTakeFirst();
  return user ? withRoles(database, user) : null;
}

export function createPostgresRoleManagementProvider(
  database: DatabaseClient,
): RoleManagementProvider {
  return {
    getRoles(userId) {
      return getRolesFrom(database, userId);
    },

    lookupUserByEmail(email) {
      return lookupUser(database, email);
    },

    async mutateRole(input) {
      try {
        return await database.transaction().execute(async (transaction) => {
          const actorRoles = await getRolesFrom(transaction, input.actorUserId);
          if (!actorRoles.includes("administrator")) {
            return { status: "forbidden" } satisfies RoleManagementResult<AdminRoleUser>;
          }

          const target = await lookupUser(transaction, input.email);
          if (!target) {
            return { status: "not_found" } satisfies RoleManagementResult<AdminRoleUser>;
          }

          if (input.action === "assign") {
            const inserted = await transaction
              .insertInto("user_roles")
              .values({
                assigned_by: input.actorUserId,
                role: input.role,
                user_id: target.id,
              })
              .onConflict((conflict) =>
                conflict.columns(["user_id", "role"]).doNothing(),
              )
              .returning("user_id")
              .executeTakeFirst();

            if (inserted) {
              await transaction
                .insertInto("audit_log")
                .values({
                  action: "role_assigned",
                  actor_user_id: input.actorUserId,
                  metadata: { email: target.email, role: input.role },
                  target_id: target.id,
                  target_type: "user_role",
                })
                .execute();
            }

            return {
              status: "success",
              value: await withRoles(transaction, target),
            } satisfies RoleManagementResult<AdminRoleUser>;
          }

          if (!target.roles.includes(input.role)) {
            return {
              status: "success",
              value: target,
            } satisfies RoleManagementResult<AdminRoleUser>;
          }

          if (input.role === "administrator") {
            const administrators = await transaction
              .selectFrom("user_roles")
              .select("user_id")
              .where("role", "=", "administrator")
              .forUpdate()
              .execute();
            if (administrators.length <= 1) {
              return {
                status: "last_administrator",
              } satisfies RoleManagementResult<AdminRoleUser>;
            }
          }

          const deleted = await transaction
            .deleteFrom("user_roles")
            .where("user_id", "=", target.id)
            .where("role", "=", input.role)
            .returning("user_id")
            .executeTakeFirst();

          if (deleted) {
            await transaction
              .insertInto("audit_log")
              .values({
                action: "role_revoked",
                actor_user_id: input.actorUserId,
                metadata: { email: target.email, role: input.role },
                target_id: target.id,
                target_type: "user_role",
              })
              .execute();
          }

          return {
            status: "success",
            value: await withRoles(transaction, target),
          } satisfies RoleManagementResult<AdminRoleUser>;
        });
      } catch (error) {
        if (isLastAdministratorError(error)) return { status: "last_administrator" };
        throw error;
      }
    },
  };
}
