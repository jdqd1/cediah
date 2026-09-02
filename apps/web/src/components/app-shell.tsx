"use client";

import {
  BookOpen,
  CardsThree,
  CheckSquareOffset,
  ClipboardText,
  House,
  GraduationCap,
  List,
  Notebook,
  PlayCircle,
  PencilSimpleLine,
  UserCircle,
  ShieldCheck,
} from "@phosphor-icons/react";
import { CaretDown } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useSearchParams } from "next/navigation";
import { createContext, useContext, type ReactNode, useEffect, useRef, useState } from "react";
import { authClient } from "@/lib/auth/client";
import { useAccessRoles } from "./access-context";
import { CediahLogo } from "./cediah-logo";
import { GlobalContentSearch } from "./global-content-search";
import { RouteMain, useNavigationIntent } from "./route-navigation";
import {
  setSidebarCollapsedPreference,
  useSidebarCollapsedPreference,
} from "./sidebar-preference";

type AppShellProps = {
  activeKey: string;
  isAdministrator?: boolean;
  viewer?: {
    email: string;
  };
  children: ReactNode;
  headerSubtitle?: string;
  headerTitle: string;
  includeCourses?: boolean;
  mainClassName?: string;
  breadcrumbs?: string[];
  welcome?: boolean;
  profilePending?: boolean;
};

type NavIcon = typeof House;
const PersistentShellContext = createContext(false);

export function PersistentAppShell({ children, viewer, profilePending }: { children: ReactNode; viewer?: { email: string }; profilePending?: boolean }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const kind = searchParams.get("tipo");
  const activeKey = pathname.startsWith("/panel/administracion") ? "roles"
    : pathname.startsWith("/panel") ? "editor"
      : pathname.startsWith("/guias") ? "guides"
        : pathname.startsWith("/contenido") ? kind === "guide" ? "guides" : kind ?? "video"
          : pathname.startsWith("/asignaturas") ? kind === "guide" ? "guides" : kind ?? "subjects"
            : pathname.startsWith("/clases") ? "video"
              : pathname.startsWith("/cursos") ? "courses"
              : "dashboard";
  const title = [...mainNavigation, ...studyNavigation].find((item) => item.key === activeKey)?.label ?? "Koraz";
  return (
    <PersistentShellContext.Provider value={true}>
      <ShellChrome activeKey={activeKey} headerTitle={title} includeCourses={activeKey === "courses"} viewer={viewer} profilePending={profilePending}>
        {children}
      </ShellChrome>
    </PersistentShellContext.Provider>
  );
}

export function AppShell(props: AppShellProps) {
  const persistent = useContext(PersistentShellContext);
  const content = <RouteMain className={props.mainClassName ?? ""}>{props.children}</RouteMain>;
  return persistent ? content : <ShellChrome {...props}>{content}</ShellChrome>;
}

type NavItem = {
  key: string;
  label: string;
  href: string;
  icon: NavIcon;
};

const mainNavigation: NavItem[] = [
  { key: "dashboard", label: "Inicio", href: "/dashboard", icon: House },
  { key: "subjects", label: "Materias", href: "/asignaturas", icon: GraduationCap },
];

const studyNavigation: NavItem[] = [
  { key: "video", label: "Videos", href: "/asignaturas?tipo=video", icon: PlayCircle },
  { key: "guides", label: "Guías", href: "/guias", icon: Notebook },
  { key: "flashcards", label: "Flashcards", href: "/asignaturas?tipo=flashcards", icon: CardsThree },
  { key: "quiz", label: "Cuestionarios", href: "/asignaturas?tipo=quiz", icon: ClipboardText },
];




function getProfileInitials(email: string) {
  const localPart = email.split("@", 1)[0]?.replace(/[^a-z0-9]/gi, "") ?? "";
  return (localPart.slice(0, 2) || "US").toUpperCase();
}

const profileRoleLabels = {
  administrator: "Administrador",
  coordinator: "Coordinador",
  content_creator: "Creador de contenido",
  student: "Estudiante",
} as const;

function NavigationItem({
  item,
  activeKey,
  onNavigate,
}: {
  item: NavItem;
  activeKey: string;
  onNavigate: () => void;
}) {
  const Icon = item.icon;
  const active = item.key === activeKey;
  return (
    <Link
      className={`sidebar-link ${active ? "is-active" : ""}`.trim()}
      href={item.href}
      aria-current={active ? "page" : undefined}
      onClick={onNavigate}
    >
      <Icon size={21} weight={active ? "fill" : "regular"} />
      <span className="sidebar-link-label">{item.label}</span>
      <span aria-hidden="true" className="sidebar-item-tooltip">{item.label}</span>
    </Link>
  );
}

function NavigationGroup({
  activeKey,
  childItems,
  icon: Icon,
  label,
  onNavigate,
  onToggle,
  open,
  groupKey,
}: {
  activeKey: string;
  childItems: NavItem[];
  icon: NavIcon;
  label: string;
  onNavigate: () => void;
  onToggle: () => void;
  open: boolean;
  groupKey: string;
}) {
  const active = activeKey === groupKey || childItems.some((item) => item.key === activeKey);
  const groupClassName = "sidebar-nav-group-item" + (active ? " is-active" : "");
  const labelClassName = "sidebar-group-link" + (active ? " is-active" : "");

  return (
    <section className={groupClassName}>
      <div className="sidebar-group-heading">
        <button
          aria-controls={"sidebar-submenu-" + groupKey}
          aria-expanded={open}
          className={labelClassName}
          type="button"
          onClick={onToggle}
        >
          <Icon size={21} weight={active ? "fill" : "regular"} />
          <span className="sidebar-link-label">{label}</span>
          <CaretDown aria-hidden="true" className="sidebar-group-caret" size={16} />
          <span aria-hidden="true" className="sidebar-item-tooltip">{label}</span>
        </button>
      </div>
      <div
        aria-hidden={!open}
        className={"sidebar-submenu" + (open ? " is-open" : "")}
        id={"sidebar-submenu-" + groupKey}
        inert={!open}
      >
        {childItems.map((item) => (
          <NavigationItem key={item.key} item={item} activeKey={activeKey} onNavigate={onNavigate} />
        ))}
      </div>
    </section>
  );
}

function ShellChrome({
  activeKey,
  breadcrumbs,
  isAdministrator = false,
  viewer: initialViewer,
  children,
  headerSubtitle,
  headerTitle,
  includeCourses = false,
  profilePending = false,
  welcome = false,
}: AppShellProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [studyMenuOpen, setStudyMenuOpen] = useState(
    activeKey === "study" || studyNavigation.some((item) => item.key === activeKey),
  );
  const [adminMenuOpen, setAdminMenuOpen] = useState(
    activeKey === "editor" || activeKey === "roles",
  );
  const [isDesktopSidebar, setIsDesktopSidebar] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const accessRoles = useAccessRoles();
  const sidebarCollapsed = useSidebarCollapsedPreference();
  const session = authClient.useSession();
  const viewer = session.isPending
    ? initialViewer ?? null
    : session.data?.user.email
      ? { email: session.data.user.email }
      : null;
  const menuTriggerRef = useRef<HTMLButtonElement>(null);
  const sidebarRef = useRef<HTMLElement>(null);
  useNavigationIntent();

  const closeSidebar = () => setSidebarOpen(false);
  const showBreadcrumbs = Boolean(breadcrumbs && breadcrumbs.length > 0);
  const accessIsAdministrator = accessRoles.includes("administrator");
  const effectiveIsAdministrator = isAdministrator || accessIsAdministrator;
  const showContentManagement =
    effectiveIsAdministrator ||
    accessRoles.includes("coordinator") ||
    accessRoles.includes("content_creator");
  const showRoleManagement = effectiveIsAdministrator;
  const profileRole = (["administrator", "coordinator", "content_creator", "student"] as const)
    .find((role) => accessRoles.includes(role));
  const administrationItems: NavItem[] = [
    ...(showContentManagement
      ? [{ key: "editor", label: "Publicar contenido", href: "/panel/contenido", icon: PencilSimpleLine }]
      : []),
    ...(showRoleManagement
      ? [{ key: "roles", label: "Roles", href: "/panel/administracion/roles", icon: ShieldCheck }]
      : []),
  ];

  const menuButtonLabel = isDesktopSidebar
    ? sidebarCollapsed
      ? "Expandir menú principal"
      : "Contraer menú principal"
    : sidebarOpen
      ? "Cerrar menú principal"
      : "Abrir menú principal";

  function toggleNavigationGroup(
    setOpen: (updater: (current: boolean) => boolean) => void,
  ) {
    if (window.matchMedia("(min-width: 961px)").matches && sidebarCollapsed) {
      setSidebarCollapsedPreference(false);
      setOpen(() => true);
      return;
    }
    setOpen((current) => !current);
  }

  function togglePrimaryMenu() {
    if (window.matchMedia("(min-width: 961px)").matches) {
      setSidebarCollapsedPreference(!sidebarCollapsed);
    } else {
      if (sidebarOpen) {
        setSidebarOpen(false);
        window.requestAnimationFrame(() => menuTriggerRef.current?.focus());
      } else {
        setSidebarOpen(true);
      }
    }
  }

  async function handleSignOut() {
    if (isSigningOut) return;
    setIsSigningOut(true);
    const { error } = await authClient.signOut();
    if (error) {
      setIsSigningOut(false);
      return;
    }

    window.location.replace("/");
  }

  useEffect(() => {
    const desktopMedia = window.matchMedia("(min-width: 961px)");
    const synchronizeViewport = () => {
      setIsDesktopSidebar(desktopMedia.matches);
      if (desktopMedia.matches) setSidebarOpen(false);
    };

    synchronizeViewport();
    desktopMedia.addEventListener("change", synchronizeViewport);
    return () => desktopMedia.removeEventListener("change", synchronizeViewport);
  }, []);

  useEffect(() => {
    if (!sidebarOpen || !window.matchMedia("(max-width: 960px)").matches) return;

    const focusable = Array.from(
      sidebarRef.current?.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])',
      ) ?? [],
    ).filter((element) => !element.closest("[inert]") && element.getClientRects().length > 0);
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    first?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setSidebarOpen(false);
        menuTriggerRef.current?.focus();
        return;
      }

      if (event.key !== "Tab" || !first || !last) return;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [sidebarOpen]);
  return (
    <div
      className={`app-shell ${activeKey === "dashboard" ? "dashboard-shell" : ""} ${sidebarOpen ? "sidebar-open" : ""} ${sidebarCollapsed ? "sidebar-collapsed" : ""}`.trim()}
    >
      <aside className="app-sidebar" id="app-sidebar" aria-label="Navegación principal" ref={sidebarRef}>
        <div className="sidebar-topline">
          <Link
            className="sidebar-brand"
            href="/dashboard"
            aria-label="Koraz, inicio"
            onClick={closeSidebar}
            title="Ir al inicio"
          >
            <CediahLogo variant="light" priority={activeKey === "dashboard"} />
          </Link>
          <button
            aria-controls="app-sidebar"
            aria-expanded={isDesktopSidebar ? !sidebarCollapsed : sidebarOpen}
            aria-label={menuButtonLabel}
            className="sidebar-menu-trigger"
            title={menuButtonLabel}
            type="button"
            onClick={togglePrimaryMenu}
          >
            <List aria-hidden="true" size={25} />
          </button>
        </div>
        <nav className="sidebar-nav">
          <div className="sidebar-nav-group">
            {mainNavigation.map((item) => (
              <NavigationItem key={item.key} item={item} activeKey={activeKey} onNavigate={closeSidebar} />
            ))}
            <NavigationGroup
              activeKey={activeKey}
              childItems={studyNavigation}
              groupKey="study"
              icon={BookOpen}
              label="Material de estudio"
              onNavigate={closeSidebar}
              onToggle={() => toggleNavigationGroup(setStudyMenuOpen)}
              open={studyMenuOpen}
            />


            {includeCourses && (
              <NavigationItem
                item={{ key: "courses", label: "Mis cursos", href: "/cursos", icon: CheckSquareOffset }}
                activeKey={activeKey}
                onNavigate={closeSidebar}
              />
            )}
            {administrationItems.length > 0 && (
              <NavigationGroup
                activeKey={activeKey}
                childItems={administrationItems}
                groupKey="admin"
                icon={ShieldCheck}
                label="Administrar"
                onNavigate={closeSidebar}
                onToggle={() => toggleNavigationGroup(setAdminMenuOpen)}
                open={adminMenuOpen}
              />
            )}
          </div>
        </nav>

        <div className="sidebar-watermark" aria-hidden="true">
          <Image src="/anatomy/skull.png" alt="" width={220} height={220} />
        </div>
      </aside>

      {sidebarOpen && (
        <button
          aria-label="Cerrar menú"
          className="sidebar-backdrop"
          onClick={() => {
            closeSidebar();
            menuTriggerRef.current?.focus();
          }}
          tabIndex={-1}
          type="button"
        />
      )}

      <div className="app-body">
        <header className={`app-topbar app-topbar-simplified ${welcome ? "app-topbar-welcome" : ""} ${effectiveIsAdministrator ? "app-topbar-admin" : ""}`.trim()} data-active-key={activeKey}>
          <div className="topbar-leading">
            <button
              className="menu-trigger"
              ref={menuTriggerRef}
              type="button"
              aria-label={menuButtonLabel}
              aria-controls="app-sidebar"
              aria-expanded={isDesktopSidebar ? !sidebarCollapsed : sidebarOpen}
              title={menuButtonLabel}
              onClick={togglePrimaryMenu}
            >
              <List size={28} />
            </button>
            <Link className="topbar-brand" href="/dashboard" aria-label="Koraz, ir al inicio">
              <CediahLogo variant="light" priority={activeKey === "dashboard"} />
            </Link>
          </div>
          <GlobalContentSearch />
          <div className="topbar-page-context sr-only">
            <h1>{headerTitle || "Koraz"}</h1>
            {headerSubtitle && <p>{headerSubtitle}</p>}
            {showBreadcrumbs && <p>Ruta actual: {breadcrumbs?.join(" / ")}</p>}
          </div>
          <div className="topbar-actions">
            <div className="topbar-popover-wrap">
              {viewer ? (
                <>
                  <button
                    className="profile-trigger"
                    type="button"
                    aria-label={"Abrir menú de perfil de " + viewer.email}
                    aria-expanded={profileOpen}
                    onClick={() => setProfileOpen((open) => !open)}
                  >
                    <span className="profile-avatar">{getProfileInitials(viewer.email)}</span>
                    <CaretDown size={17} weight="bold" />
                  </button>
                  {profileOpen && (
                    <div className="topbar-popover profile-popover">
                      <strong>{viewer.email}</strong>
                      {profileRole && (
                        <span className="dashboard-admin-badge profile-role-badge">
                          <ShieldCheck size={14} weight="fill" />
                          {profileRoleLabels[profileRole]}
                        </span>
                      )}
                      <button
                        className="profile-sign-out"
                        disabled={isSigningOut}
                        onClick={handleSignOut}
                        type="button"
                      >
                        {isSigningOut ? "Cerrando sesión..." : "Cerrar sesión"}
                      </button>
                    </div>
                  )}
                </>
              ) : profilePending ? (
                <span className="profile-avatar" aria-label="Cargando perfil"><UserCircle size={20} /></span>
              ) : (
                <Link className="profile-trigger profile-sign-in" href="/acceder">
                  <span className="profile-avatar" aria-hidden="true">
                    <UserCircle size={20} weight="fill" />
                  </span>
                  <span>Acceder</span>
                </Link>
              )}
            </div>
          </div>
        </header>
        {children}
      </div>
    </div>
  );
}
