import { createClient } from "@supabase/supabase-js";
import {
  AdminRoleUserSchema,
  PlatformRoleSchema,
  type AdminRoleUser,
  type PlatformRole,
  type RoleManagementProvider,
} from "@cediah/contracts";

type SupabaseRoleManagementConfiguration = {
  secretKey: string;
  url: string;
};

const usersPerPage = 1_000;
const maximumUserPages = 100;

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function errorCode(error: unknown) {
  const record = asRecord(error);
  return typeof record?.code === "string" ? record.code : null;
}

function errorMessage(error: unknown) {
  const record = asRecord(error);
  return typeof record?.message === "string" ? record.message : "";
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function isUniqueConflict(error: unknown) {
  return errorCode(error) === "23505";
}

function isLastAdministratorError(error: unknown) {
  return errorMessage(error).toLowerCase().includes("last_administrator");
}

export function createSupabaseRoleManagementProvider(
  configuration: SupabaseRoleManagementConfiguration,
): RoleManagementProvider {
  const client = createClient(configuration.url, configuration.secretKey, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
    },
  });

  async function getRoles(userId: string): Promise<PlatformRole[]> {
    const { data, error } = await client
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);
    if (error) throw error;

    const roles: PlatformRole[] = [];
    for (const row of data ?? []) {
      const parsed = PlatformRoleSchema.safeParse(asRecord(row)?.role);
      if (parsed.success && !roles.includes(parsed.data)) roles.push(parsed.data);
    }
    return roles;
  }

  async function withRoles(input: { email: string; id: string }): Promise<AdminRoleUser> {
    return AdminRoleUserSchema.parse({
      email: input.email,
      id: input.id,
      roles: await getRoles(input.id),
    });
  }

  async function lookupUserByEmail(email: string): Promise<AdminRoleUser | null> {
    const normalizedEmail = normalizeEmail(email);
    for (let page = 1; page <= maximumUserPages; page += 1) {
      const { data, error } = await client.auth.admin.listUsers({
        page,
        perPage: usersPerPage,
      });
      if (error) throw error;

      const users = data?.users ?? [];
      const match = users.find(
        (user) => typeof user.email === "string" && user.email.toLowerCase() === normalizedEmail,
      );
      if (match?.email) return withRoles({ email: match.email, id: match.id });
      if (users.length < usersPerPage) break;
    }
    return null;
  }

  async function writeAudit(input: {
    action: "role_assigned" | "role_revoked";
    actorUserId: string;
    email: string;
    role: PlatformRole;
    targetUserId: string;
  }) {
    const { error } = await client.from("audit_log").insert({
      action: input.action,
      actor_user_id: input.actorUserId,
      metadata: { email: input.email, role: input.role },
      target_id: input.targetUserId,
      target_type: "user_role",
    });
    if (error) throw error;
  }

  return {
    getRoles,
    lookupUserByEmail,
    async mutateRole(input) {
      const actorRoles = await getRoles(input.actorUserId);
      if (!actorRoles.includes("administrator")) return { status: "forbidden" };

      const target = await lookupUserByEmail(input.email);
      if (!target) return { status: "not_found" };

      if (input.action === "assign") {
        const { error } = await client.from("user_roles").insert({
          assigned_by: input.actorUserId,
          role: input.role,
          user_id: target.id,
        });
        if (error && !isUniqueConflict(error)) throw error;
        if (!error) {
          await writeAudit({
            action: "role_assigned",
            actorUserId: input.actorUserId,
            email: target.email,
            role: input.role,
            targetUserId: target.id,
          });
        }
        return { status: "success", value: await withRoles({ email: target.email, id: target.id }) };
      }

      if (!target.roles.includes(input.role)) {
        return { status: "success", value: target };
      }

      if (input.role === "administrator") {
        const { count, error } = await client
          .from("user_roles")
          .select("user_id", { count: "exact", head: true })
          .eq("role", "administrator");
        if (error) throw error;
        if ((count ?? 0) <= 1) return { status: "last_administrator" };
      }

      const { error } = await client
        .from("user_roles")
        .delete()
        .eq("user_id", target.id)
        .eq("role", input.role);
      if (error) {
        if (isLastAdministratorError(error)) return { status: "last_administrator" };
        throw error;
      }

      await writeAudit({
        action: "role_revoked",
        actorUserId: input.actorUserId,
        email: target.email,
        role: input.role,
        targetUserId: target.id,
      });
      return { status: "success", value: await withRoles({ email: target.email, id: target.id }) };
    },
  };
}