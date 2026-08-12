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

const roleOptions: { description: string; label: string; value: PlatformRole }[] = [
  { description: "Acceso de aprendizaje sin permisos editoriales.", label: "Estudiante", value: "student" },
  {
    description: "Puede crear contenido propio para la comunidad.",
    label: "Colaborador de comunidad",
    value: "community_contributor",
  },
  { description: "Puede presentar y administrar contenido propio.", label: "Presentador", value: "presenter" },
  { description: "Revisa contenido y solicita correcciones.", label: "Editor académico", value: "academic_editor" },
  { description: "Puede publicar y archivar contenido.", label: "Coordinación", value: "coordination" },
  { description: "Sólo lectura para información financiera.", label: "Finanzas (lectura)", value: "finance_readonly" },
  {
    description: "Rol máximo: administra contenido y asigna cualquier rol.",
    label: "Administrador",
    value: "administrator",
  },
];

const roleNames = new Map(roleOptions.map((option) => [option.value, option.label]));
const errorMessages: Record<string, string> = {
  conflict: "La asignación cambió mientras se procesaba. Consulta de nuevo la cuenta.",
  forbidden: "Sólo una cuenta con rol administrador puede gestionar roles.",
  identity_unavailable: "No fue posible validar tu sesión.",
  invalid_role_assignment: "Revisa el correo, la acción y el rol seleccionados.",
  invalid_role_lookup: "Escribe un correo válido.",
  last_administrator: "No se puede quitar el único administrador del sistema.",
  role_conflict: "La operación no pudo completarse porque el rol cambió.",
  role_management_unavailable: "El servicio de roles no está disponible.",
  unauthorized: "Tu sesión terminó. Vuelve a iniciar sesión.",
  user_not_found: "No existe una cuenta de Supabase Auth con ese correo.",
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
  const [email, setEmail] = useState(initialUser.email);
  const [role, setRole] = useState<PlatformRole>("community_contributor");
  const [action, setAction] = useState<AdminRoleAction>("assign");
  const [target, setTarget] = useState<AdminRoleUser | null>(initialUser);
  const [notice, setNotice] = useState<Notice>(null);
  const [busy, setBusy] = useState<"lookup" | "mutation" | null>(null);

  async function lookup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setNotice(null);
    setBusy("lookup");
    try {
      const response = await fetch(`/api/admin/roles?email=${encodeURIComponent(email.trim())}`, {
        cache: "no-store",
      });
      setTarget(await readRoleResponse(response));
      setNotice({ tone: "success", text: "Cuenta encontrada. Revisa sus roles actuales antes de guardar." });
    } catch (error) {
      setTarget(null);
      setNotice({ tone: "error", text: error instanceof Error ? error.message : errorMessages.role_management_unavailable ?? "El servicio de roles no está disponible." });
    } finally {
      setBusy(null);
    }
  }

  async function mutate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setNotice(null);
    setBusy("mutation");
    const input: AdminRoleMutationRequest = {
      action,
      email: email.trim().toLowerCase(),
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
        text: action === "assign" ? `Rol ${roleName(role)} asignado correctamente.` : `Rol ${roleName(role)} revocado correctamente.`,
      });
    } catch (error) {
      setNotice({ tone: "error", text: error instanceof Error ? error.message : errorMessages.role_management_unavailable ?? "El servicio de roles no está disponible." });
    } finally {
      setBusy(null);
    }
  }

  const targetRoles = target?.roles ?? [];

  return (
    <AppShell
      activeKey="roles"
      canManageContent
      canManageRoles
      isAdministrator={initialUser.roles.includes("administrator")}
      headerSubtitle="Asigna permisos por correo desde un único lugar."
      headerTitle="Administración de roles"
      mainClassName="role-management-main"
    >
      <section className="role-management-page" aria-labelledby="role-management-title">
        <header className="role-management-heading">
          <div>
            <p className="eyebrow">Control de acceso</p>
            <h2 id="role-management-title">Gestiona las cuentas autorizadas</h2>
            <p>
              El administrador es el rol máximo. Puede asignar o revocar cualquier rol, mientras que la API vuelve a validar el permiso en cada operación.
            </p>
          </div>
          <div className="role-management-max-badge"><ShieldCheck size={22} /> Administrador</div>
        </header>

        <div className="role-management-grid">
          <section className="role-management-card" aria-labelledby="role-lookup-title">
            <div className="role-card-heading">
              <div>
                <p className="eyebrow">1 · Cuenta</p>
                <h3 id="role-lookup-title">Busca por correo</h3>
              </div>
              <MagnifyingGlass size={22} />
            </div>
            <form className="role-lookup-form" onSubmit={lookup}>
              <label className="role-field">
                <span>Correo de Supabase Auth</span>
                <input
                  required
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="persona@universidad.edu"
                />
              </label>
              <button className="studio-button studio-button-secondary" disabled={busy !== null} type="submit">
                <MagnifyingGlass size={17} /> {busy === "lookup" ? "Buscando…" : "Consultar cuenta"}
              </button>
            </form>
            {target && (
              <div className="role-target" aria-live="polite">
                <div>
                  <span className="role-target-avatar">{target.email.slice(0, 1).toUpperCase()}</span>
                  <div>
                    <strong>{target.email}</strong>
                    <small>{target.id}</small>
                  </div>
                </div>
                <div className="role-chip-list">
                  {targetRoles.length > 0 ? targetRoles.map((currentRole) => (
                    <span className="role-chip" key={currentRole}>{roleName(currentRole)}</span>
                  )) : <span className="role-empty">Sin roles asignados</span>}
                </div>
              </div>
            )}
          </section>

          <section className="role-management-card" aria-labelledby="role-action-title">
            <div className="role-card-heading">
              <div>
                <p className="eyebrow">2 · Permiso</p>
                <h3 id="role-action-title">Asigna o revoca</h3>
              </div>
              {action === "assign" ? <UserPlus size={22} /> : <UserMinus size={22} />}
            </div>
            <form className="role-action-form" onSubmit={mutate}>
              <label className="role-field">
                <span>Acción</span>
                <select value={action} onChange={(event) => setAction(event.target.value as AdminRoleAction)}>
                  <option value="assign">Asignar rol</option>
                  <option value="revoke">Revocar rol</option>
                </select>
              </label>
              <label className="role-field">
                <span>Rol</span>
                <select value={role} onChange={(event) => setRole(event.target.value as PlatformRole)}>
                  {roleOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
              </label>
              <p className="role-selected-help">{roleOptions.find((option) => option.value === role)?.description}</p>
              <button className={`studio-button ${action === "assign" ? "studio-button-primary" : "studio-button-danger"}`} disabled={busy !== null || !email.trim()} type="submit">
                {action === "assign" ? <UserPlus size={17} /> : <UserMinus size={17} />}
                {busy === "mutation" ? "Guardando…" : action === "assign" ? "Asignar rol" : "Revocar rol"}
              </button>
            </form>
          </section>
        </div>

        {notice && <p className={`studio-notice studio-notice-${notice.tone}`} role="status">{notice.text}</p>}

        <section className="role-instructions" aria-labelledby="role-instructions-title">
          <p className="eyebrow">Reglas importantes</p>
          <h3 id="role-instructions-title">Cómo funciona el acceso</h3>
          <ul>
            <li>La cuenta debe existir primero en Supabase Auth y tener el correo confirmado.</li>
            <li>El API comprueba el rol administrador y registra cada asignación o revocación en <code>audit_log</code>.</li>
            <li>No se puede revocar el único rol administrador; esto evita bloquear el sistema.</li>
            <li>Revocar un rol no elimina la cuenta ni su contenido, sólo cambia sus permisos futuros.</li>
          </ul>
        </section>
      </section>
    </AppShell>
  );
}
