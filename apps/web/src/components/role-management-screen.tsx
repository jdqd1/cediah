"use client";

import { MagnifyingGlass, ShieldCheck, UserMinus, UserPlus } from "@phosphor-icons/react";
import {
  AdminRoleResponseSchema,
  type AdminRoleAction,
  type AdminRoleMutationRequest,
  type AdminRoleUser,
  type PlatformRole,
} from "@cediah/contracts";
import { type FormEvent, useState } from "react";
import { AppShell } from "./app-shell";

type Props = { initialUser: AdminRoleUser };

type Notice = { tone: "error" | "success"; text: string } | null;
type BusyState =
  | { kind: "lookup" }
  | { action: AdminRoleAction; kind: "mutation"; role: PlatformRole }
  | null;

const roleOptions: { label: string; value: PlatformRole }[] = [
  { label: "Estudiante", value: "student" },
  { label: "Colaborador de comunidad", value: "community_contributor" },
  { label: "Presentador", value: "presenter" },
  { label: "Editor académico", value: "academic_editor" },
  { label: "Coordinación", value: "coordination" },
  { label: "Finanzas (lectura)", value: "finance_readonly" },
  { label: "Administrador", value: "administrator" },
];

const roleNames = new Map(roleOptions.map((option) => [option.value, option.label]));
const errorMessages: Record<string, string> = {
  conflict: "Los roles cambiaron. Busca la cuenta de nuevo.",
  forbidden: "Sólo una cuenta con rol administrador puede gestionar roles.",
  identity_unavailable: "No fue posible validar tu sesión.",
  invalid_role_assignment: "No se pudo actualizar el rol.",
  invalid_role_lookup: "Escribe un correo válido.",
  last_administrator: "No se puede quitar el único administrador del sistema.",
  role_conflict: "Los roles cambiaron. Busca la cuenta de nuevo.",
  role_management_unavailable: "El servicio de roles no está disponible.",
  unauthorized: "Tu sesión terminó. Vuelve a iniciar sesión.",
  user_not_found: "No encontramos una cuenta con ese correo.",
};

function roleName(role: PlatformRole) {
  return roleNames.get(role) ?? role;
}

async function readRoleResponse(response: Response) {
  const body: unknown = await response.json().catch(() => ({ error: "role_management_unavailable" }));
  if (!response.ok) {
    const code =
      body && typeof body === "object" && "error" in body && typeof body.error === "string"
        ? body.error
        : "role_management_unavailable";
    throw new Error(errorMessages[code] ?? `No fue posible completar la operación (${response.status}).`);
  }
  const result = AdminRoleResponseSchema.safeParse(body);
  if (!result.success) throw new Error(errorMessages.role_management_unavailable ?? "El servicio de roles no está disponible.");
  return result.data.user;
}

export function RoleManagementScreen({ initialUser }: Props) {
  const [email, setEmail] = useState("");
  const [target, setTarget] = useState<AdminRoleUser | null>(null);
  const [notice, setNotice] = useState<Notice>(null);
  const [busy, setBusy] = useState<BusyState>(null);

  function updateEmail(value: string) {
    setEmail(value);
    setTarget(null);
    setNotice(null);
  }

  async function lookup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setNotice(null);
    setTarget(null);
    setBusy({ kind: "lookup" });
    try {
      const response = await fetch(`/api/admin/roles?email=${encodeURIComponent(email.trim())}`, {
        cache: "no-store",
      });
      const user = await readRoleResponse(response);
      setEmail(user.email);
      setTarget(user);
      setNotice({ tone: "success", text: "Cuenta encontrada." });
    } catch (error) {
      setTarget(null);
      setNotice({ tone: "error", text: error instanceof Error ? error.message : errorMessages.role_management_unavailable ?? "El servicio de roles no está disponible." });
    } finally {
      setBusy(null);
    }
  }

  async function mutate(role: PlatformRole, action: AdminRoleAction) {
    if (!target || busy) return;

    const targetEmail = target.email;
    if (
      action === "revoke"
      && role === "administrator"
      && !window.confirm(`¿Quitar el rol Administrador de ${targetEmail}? Esta cuenta perderá acceso a la administración.`)
    ) {
      return;
    }

    setNotice(null);
    setBusy({ action, kind: "mutation", role });
    const input: AdminRoleMutationRequest = {
      action,
      email: targetEmail,
      role,
    };

    try {
      const response = await fetch("/api/admin/roles", {
        body: JSON.stringify(input),
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      setTarget(await readRoleResponse(response));
      setNotice({
        tone: "success",
        text: action === "assign" ? `${roleName(role)} asignado.` : `${roleName(role)} retirado.`,
      });
    } catch (error) {
      setNotice({ tone: "error", text: error instanceof Error ? error.message : errorMessages.role_management_unavailable ?? "El servicio de roles no está disponible." });
    } finally {
      setBusy(null);
    }
  }

  const targetRoles = target?.roles ?? [];
  const lookupBusy = busy?.kind === "lookup";
  const mutationBusy = busy?.kind === "mutation";

  return (
    <AppShell
      activeKey="roles"
      canManageContent
      canManageRoles
      isAdministrator={initialUser.roles.includes("administrator")}
      viewer={{ email: initialUser.email }}
      headerTitle="Roles y permisos"
      mainClassName="role-management-main"
    >
      <section className="role-management-page" aria-label="Roles y permisos">
        <div className="role-management-workflow">
          <section className="role-account-panel" aria-labelledby="role-account-search-title">
            <header className="role-account-panel-header">
              <span className="role-account-panel-icon" aria-hidden="true">
                <MagnifyingGlass size={22} />
              </span>
              <h2 id="role-account-search-title">Buscar cuenta</h2>
            </header>

            <form className="role-search-form" aria-busy={lookupBusy} onSubmit={lookup}>
              <label className="role-search-field" htmlFor="role-account-email">
                Correo de la cuenta
              </label>
              <div className="role-search-row">
                <div className="role-search-control">
                  <MagnifyingGlass aria-hidden="true" size={18} />
                  <input
                    id="role-account-email"
                    autoCapitalize="none"
                    autoComplete="email"
                    disabled={busy !== null}
                    onChange={(event) => updateEmail(event.target.value)}
                    placeholder="persona@universidad.edu"
                    required
                    spellCheck={false}
                    type="email"
                    value={email}
                  />
                </div>
                <button
                  aria-busy={lookupBusy}
                  aria-controls="role-permissions"
                  className="role-search-submit studio-button studio-button-primary"
                  disabled={busy !== null || !email.trim()}
                  type="submit"
                >
                  <MagnifyingGlass aria-hidden="true" size={17} />
                  {lookupBusy ? "Buscando…" : "Buscar"}
                </button>
              </div>
            </form>
          </section>

          {notice && (
            <p
              className={`role-management-feedback studio-notice studio-notice-${notice.tone}`}
              id="role-management-feedback"
              role={notice.tone === "error" ? "alert" : "status"}
            >
              {notice.text}
            </p>
          )}

          {target ? (
            <section
              aria-busy={mutationBusy}
              aria-label={`Roles de ${target.email}`}
              className="role-permissions-panel"
              id="role-permissions"
            >
              <header className="role-selected-account">
                <span className="role-selected-account-avatar" aria-hidden="true">
                  {target.email.slice(0, 1).toUpperCase()}
                </span>
                <div className="role-selected-account-copy">
                  <span>Cuenta seleccionada</span>
                  <h2>{target.email}</h2>
                </div>
                <span className="role-selected-account-count">
                  <ShieldCheck aria-hidden="true" size={18} />
                  {targetRoles.length === 1 ? "1 rol asignado" : `${targetRoles.length} roles asignados`}
                </span>
              </header>

              <div className="role-permission-list" role="list">
                {roleOptions.map((option) => {
                  const assigned = targetRoles.includes(option.value);
                  const action: AdminRoleAction = assigned ? "revoke" : "assign";
                  const rowBusy = mutationBusy && busy.role === option.value;

                  return (
                    <div
                      className={`role-permission-row ${assigned ? "is-assigned" : "is-unassigned"} ${option.value === "administrator" ? "is-sensitive" : ""}`.trim()}
                      key={option.value}
                      role="listitem"
                    >
                      <div className="role-permission-copy">
                        <h3>{option.label}</h3>
                      </div>
                      <span className="role-permission-status">
                        {assigned ? "Asignado" : "Sin asignar"}
                      </span>
                      <button
                        aria-busy={rowBusy}
                        aria-label={
                          rowBusy
                            ? `Actualizando rol ${option.label}`
                            : `${assigned ? "Quitar" : "Asignar"} rol ${option.label} ${assigned ? "de" : "a"} ${target.email}`
                        }
                        className={`role-permission-action studio-button ${assigned ? "studio-button-danger" : "studio-button-secondary"}`}
                        disabled={busy !== null}
                        onClick={() => void mutate(option.value, action)}
                        type="button"
                      >
                        {assigned ? <UserMinus aria-hidden="true" size={17} /> : <UserPlus aria-hidden="true" size={17} />}
                        {rowBusy ? "Actualizando…" : assigned ? "Quitar" : "Asignar"}
                      </button>
                    </div>
                  );
                })}
              </div>
            </section>
          ) : (
            <div className="role-management-empty" id="role-permissions" role="status">
              <ShieldCheck aria-hidden="true" size={28} />
              <p>Busca una cuenta para gestionar sus roles.</p>
            </div>
          )}
        </div>
      </section>
    </AppShell>
  );
}
