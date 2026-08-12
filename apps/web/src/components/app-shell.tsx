"use client";

import {
  Bell,
  BookOpen,
  BookmarkSimple,
  CalendarBlank,
  CardsThree,
  ChartLineUp,
  CheckSquareOffset,
  ClipboardText,
  GearSix,
  House,
  List,
  MagnifyingGlass,
  Notebook,
  PlayCircle,
  PencilSimpleLine,
  Question,
  X,
  UserCircle,
  UsersThree,
  ShieldCheck,
} from "@phosphor-icons/react";
import { CaretDown } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { type ReactNode, useEffect, useState } from "react";
import { signOut } from "@/app/panel/actions";
import { getBrowserSupabaseClient } from "@/lib/supabase/browser";
import { CediahLogo } from "./cediah-logo";

type AppShellProps = {
  activeKey: string;
  canManageContent?: boolean;
  canManageRoles?: boolean;
  isAdministrator?: boolean;
  viewer?: {
    email: string;
  };
  centeredSearch?: boolean;
  children: ReactNode;
  headerSubtitle?: string;
  headerTitle: string;
  includeCourses?: boolean;
  mainClassName?: string;
  searchPlaceholder?: string;
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
  { key: "video", label: "Clases teóricas", href: "/biblioteca?tipo=video", icon: PlayCircle },
  { key: "study", label: "Material de estudio", href: "/biblioteca", icon: BookOpen },
  { key: "guides", label: "Guías", href: "/guias", icon: Notebook },
  { key: "flashcards", label: "Flashcards", href: "/biblioteca?tipo=flashcards", icon: CardsThree },
  { key: "quiz", label: "Cuestionarios", href: "/biblioteca?tipo=quiz", icon: ClipboardText },
  { key: "topic", label: "Temas anatómicos", href: "/biblioteca?tipo=topic", icon: UserCircle },
];
const utilityNavigation: NavItem[] = [
  { key: "favorites", label: "Favoritos", href: "/dashboard", icon: BookmarkSimple },
  { key: "progress", label: "Mi progreso", href: "/dashboard", icon: ChartLineUp },
  { key: "calendar", label: "Calendario", href: "/dashboard", icon: CalendarBlank },
  { key: "community", label: "Comunidad", href: "/dashboard", icon: UsersThree },
];

const supportNavigation: NavItem[] = [
  { key: "settings", label: "Ajustes", href: "/dashboard", icon: GearSix },
  { key: "help", label: "Ayuda", href: "/dashboard", icon: Question },
];

function getProfileInitials(email: string) {
  const localPart = email.split("@", 1)[0]?.replace(/[^a-z0-9]/gi, "") ?? "";
  return (localPart.slice(0, 2) || "US").toUpperCase();
}

function NavigationItem({ item, activeKey, onNavigate }: { item: NavItem; activeKey: string; onNavigate: () => void }) {
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
      <span>{item.label}</span>
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
  centeredSearch = false,
  children,
  headerSubtitle,
  headerTitle,
  includeCourses = false,
  mainClassName = "",
  searchPlaceholder = "Buscar contenido...",
  welcome = false,
}: AppShellProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [viewer, setViewer] = useState<{ email: string } | null>(initialViewer ?? null);
  const pathname = usePathname();

  const closeSidebar = () => setSidebarOpen(false);
  const showBreadcrumbs = Boolean(breadcrumbs && breadcrumbs.length > 0);

  useEffect(() => {
    let active = true;
    const supabase = getBrowserSupabaseClient();

    if (!supabase) return;

    const synchronizeViewer = async () => {
      const { data, error } = await supabase.auth.getUser();
      if (!active) return;
      setViewer(error || !data.user?.email ? null : { email: data.user.email });
    };

    void synchronizeViewer();
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
  }, []);
  const showHeaderHeading = showBreadcrumbs || Boolean(headerTitle || headerSubtitle);

  return (
    <div className={`app-shell ${activeKey === "dashboard" ? "dashboard-shell" : ""} ${sidebarOpen ? "sidebar-open" : ""}`.trim()}>
      <aside className="app-sidebar" aria-label="Navegación principal">
        <div className="sidebar-topline">
          <Link className="sidebar-brand" href="/dashboard" aria-label="CEDIAH, inicio" onClick={closeSidebar}>
            <CediahLogo variant="light" priority={activeKey === "dashboard"} />
          </Link>
          <button className="sidebar-close" type="button" aria-label="Cerrar menú" onClick={closeSidebar}>
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
            {canManageContent && (
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
            {canManageRoles && (
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
          <div className="sidebar-divider" />
          <div className="sidebar-nav-group">
            {utilityNavigation.map((item) => (
              <NavigationItem key={item.key} item={item} activeKey={activeKey} onNavigate={closeSidebar} />
            ))}
          </div>
          <div className="sidebar-divider" />
          <div className="sidebar-nav-group">
            {supportNavigation.map((item) => (
              <NavigationItem key={item.key} item={item} activeKey={activeKey} onNavigate={closeSidebar} />
            ))}
          </div>
        </nav>

        <div className="sidebar-watermark" aria-hidden="true">
          <Image src="/anatomy/skull.png" alt="" width={220} height={220} />
        </div>
      </aside>

      <div className="app-body">
        <header className={`app-topbar ${welcome ? "app-topbar-welcome" : ""} ${centeredSearch ? "app-topbar-centered-search" : ""} ${isAdministrator ? "app-topbar-admin" : ""}`.trim()} data-active-key={activeKey}>
          <button className="menu-trigger" type="button" aria-label="Abrir menú" onClick={() => setSidebarOpen(true)}>
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
          <label className="topbar-search">
            <MagnifyingGlass size={21} />
            <input type="search" placeholder={searchPlaceholder} aria-label={searchPlaceholder} />
          </label>
          <div className="topbar-actions">
            <div className="topbar-popover-wrap topbar-notification-wrap">
              <button
                className={`icon-button ${notificationsOpen ? "is-active" : ""}`.trim()}
                type="button"
                aria-label="Notificaciones"
                aria-expanded={notificationsOpen}
                onClick={() => setNotificationsOpen((open) => !open)}
              >
                <Bell size={24} />
                <span className="notification-dot" />
              </button>
              {isAdministrator && (
                <span className="dashboard-admin-badge topbar-admin-badge" aria-label="Rol: administrador">
                  <ShieldCheck size={14} weight="fill" />
                  Administrador
                </span>
              )}
              {notificationsOpen && (
                <div className="topbar-popover notification-popover">
                  <strong>Notificaciones</strong>
                  <p>Tu siguiente guía está lista para continuar.</p>
                </div>
              )}
            </div>
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
