"use client";

import {
  BookOpen,
  CardsThree,
  CheckSquareOffset,
  CircleNotch,
  ClipboardText,
  House,
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
  { key: "video", label: "Videos", href: "/biblioteca?tipo=video", icon: PlayCircle },
  { key: "study", label: "Material de estudio", href: "/biblioteca", icon: BookOpen },
  { key: "guides", label: "Guías", href: "/guias", icon: Notebook },
  { key: "flashcards", label: "Flashcards", href: "/biblioteca?tipo=flashcards", icon: CardsThree },
  { key: "quiz", label: "Cuestionarios", href: "/biblioteca?tipo=quiz", icon: ClipboardText },
  { key: "topic", label: "Temas anatómicos", href: "/biblioteca?tipo=topic", icon: UserCircle },
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

    const focusable = sidebarRef.current?.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])',
    );
    const first = focusable?.[0];
    const last = focusable?.[focusable.length - 1];
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
            aria-label="CEDIAH, inicio"
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
            {includeCourses && (
              <NavigationItem
                item={{ key: "courses", label: "Mis cursos", href: "/cursos", icon: CheckSquareOffset }}
                activeKey={activeKey}
                onNavigate={closeSidebar}
              />
            )}
            {showContentManagement && (
              <NavigationItem
                item={{
                  key: "editor",
                  label: "Gestión de contenido",
                  href: "/panel/contenido",
                  icon: PencilSimpleLine,
                }}
                activeKey={activeKey}
                onNavigate={closeSidebar}
              />
            )}
            {showRoleManagement && (
              <NavigationItem
                item={{
                  key: "roles",
                  label: "Administrar roles",
                  href: "/panel/administracion/roles",
                  icon: ShieldCheck,
                }}
                activeKey={activeKey}
                onNavigate={closeSidebar}
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
