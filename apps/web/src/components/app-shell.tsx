"use client";

import {
  BookOpen,
  CardsThree,
  CheckSquareOffset,
  CircleNotch,
  ClipboardText,
  House,
  GraduationCap,
  List,
  Notebook,
  PlayCircle,
  PencilSimpleLine,
  X,
  UserCircle,
  ShieldCheck,
} from "@phosphor-icons/react";
import { CaretDown } from "@phosphor-icons/react/dist/ssr";
import Link, { useLinkStatus } from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { signOut } from "@/app/panel/actions";
import { getBrowserSupabaseClient } from "@/lib/supabase/browser";
import { CediahLogo } from "./cediah-logo";
import {
  setSidebarCollapsedPreference,
  useSidebarCollapsedPreference,
} from "./sidebar-preference";

type AppShellProps = {
  activeKey: string;
  canManageContent?: boolean;
  canManageRoles?: boolean;
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
};

type NavIcon = typeof House;

type NavItem = {
  key: string;
  label: string;
  href: string;
  icon: NavIcon;
};

const mainNavigation: NavItem[] = [
  { key: "dashboard", label: "Inicio", href: "/dashboard", icon: House },
  { key: "subjects", label: "Asignaturas", href: "/asignaturas", icon: GraduationCap },
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

function NavigationItemStatus({ label }: { label: string }) {
  const { pending } = useLinkStatus();

  if (!pending) return null;

  return (
    <span
      className="sidebar-link-pending"
      role="status"
      aria-label={`Abriendo ${label}`}
    >
      <span className="sidebar-link-spinner" aria-hidden="true">
        <CircleNotch size={16} />
      </span>
    </span>
  );
}

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
      title={item.label}
    >
      <Icon size={21} weight={active ? "fill" : "regular"} />
      <span className="sidebar-link-label">{item.label}</span>
      <NavigationItemStatus label={item.label} />
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
          title={label}
          type="button"
          onClick={onToggle}
        >
          <Icon size={21} weight={active ? "fill" : "regular"} />
          <span className="sidebar-link-label">{label}</span>
          <CaretDown aria-hidden="true" className="sidebar-group-caret" size={16} />
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

export function AppShell({
  activeKey,
  breadcrumbs,
  canManageContent = false,
  canManageRoles = false,
  isAdministrator = false,
  viewer: initialViewer,
  children,
  headerSubtitle,
  headerTitle,
  includeCourses = false,
  mainClassName = "",
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
  const sidebarCollapsed = useSidebarCollapsedPreference();
  const [viewer, setViewer] = useState<{ email: string } | null>(initialViewer ?? null);
  const menuTriggerRef = useRef<HTMLButtonElement>(null);
  const sidebarRef = useRef<HTMLElement>(null);
  const pathname = usePathname();
  const shouldFetchViewer = !initialViewer;

  const closeSidebar = () => setSidebarOpen(false);
  const showBreadcrumbs = Boolean(breadcrumbs && breadcrumbs.length > 0);
  const showContentManagement = canManageContent || isAdministrator;
  const showRoleManagement = canManageRoles || isAdministrator;
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
    : "Abrir menú principal";

  function togglePrimaryMenu() {
    if (window.matchMedia("(min-width: 961px)").matches) {
      setSidebarCollapsedPreference(!sidebarCollapsed);
    } else {
      setSidebarOpen(true);
    }
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
    let active = true;
    const supabase = getBrowserSupabaseClient();

    if (!supabase) return;

    const synchronizeViewer = async () => {
      const { data, error } = await supabase.auth.getUser();
      if (!active) return;
      setViewer(error || !data.user?.email ? null : { email: data.user.email });
    };

    if (shouldFetchViewer) void synchronizeViewer();
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!active) return;
      setViewer(session?.user.email ? { email: session.user.email } : null);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [shouldFetchViewer]);

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
  const showHeaderHeading = showBreadcrumbs || Boolean(headerTitle || headerSubtitle);

  return (
    <div
      className={`app-shell ${activeKey === "dashboard" ? "dashboard-shell" : ""} ${sidebarOpen ? "sidebar-open" : ""} ${sidebarCollapsed ? "sidebar-collapsed" : ""}`.trim()}
    >
      <aside className="app-sidebar" id="app-sidebar" aria-label="Navegación principal" ref={sidebarRef}>
        <div className="sidebar-topline">
          <button
            aria-controls="app-sidebar"
            aria-expanded={!sidebarCollapsed}
            aria-label={menuButtonLabel}
            className="sidebar-menu-trigger"
            title={menuButtonLabel}
            type="button"
            onClick={togglePrimaryMenu}
          >
            <List aria-hidden="true" size={25} />
          </button>
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
            className="sidebar-close"
            type="button"
            aria-label="Cerrar menú"
            onClick={() => {
              closeSidebar();
              menuTriggerRef.current?.focus();
            }}
          >
            <X size={22} />
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
              onToggle={() => setStudyMenuOpen((open) => !open)}
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
                onToggle={() => setAdminMenuOpen((open) => !open)}
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
        <header className={`app-topbar app-topbar-simplified ${welcome ? "app-topbar-welcome" : ""} ${isAdministrator ? "app-topbar-admin" : ""}`.trim()} data-active-key={activeKey}>
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
          {showHeaderHeading && (
            <div className="topbar-heading">
              {showBreadcrumbs ? (
                <div className="topbar-breadcrumbs" aria-label="Ruta actual">
                  {breadcrumbs?.map((breadcrumb, index) => (
                    <span key={`${breadcrumb}-${index}`} className={index === breadcrumbs.length - 1 ? "current" : ""}>
                      {breadcrumb}
                      {index < breadcrumbs.length - 1 && <span className="breadcrumb-chevron">›</span>}
                    </span>
                  ))}
                </div>
              ) : (
                <>
                  <h1>{headerTitle}</h1>
                  {headerSubtitle && <p>{headerSubtitle}</p>}
                </>
              )}
            </div>
          )}
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
                      {isAdministrator && (
                        <span className="dashboard-admin-badge profile-role-badge">
                          <ShieldCheck size={14} weight="fill" />
                          Administrador
                        </span>
                      )}
                      <form action={signOut}>
                        <button className="profile-sign-out" type="submit">Cerrar sesión</button>
                      </form>
                    </div>
                  )}
                </>
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
        <main className={`app-main ${mainClassName}`.trim()} data-pathname={pathname}>
          {children}
        </main>
      </div>
    </div>
  );
}
