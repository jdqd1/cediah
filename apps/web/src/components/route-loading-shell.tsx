"use client";

import {
  BookOpen,
  CardsThree,
  ClipboardText,
  House,
  List,
  Notebook,
  PencilSimpleLine,
  PlayCircle,
} from "@phosphor-icons/react";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { CediahLogo } from "./cediah-logo";
import { useSidebarCollapsedPreference } from "./sidebar-preference";

const APPLICATION_PATH_PREFIXES = [
  "/biblioteca",
  "/clases",
  "/cursos",
  "/dashboard",
  "/guias",
  "/panel",
  "/pruebas",
];

const LOADING_NAVIGATION = [
  { label: "Inicio", icon: House, path: "/dashboard" },
  { label: "Videos", icon: PlayCircle, path: "/clases" },
  { label: "Material de estudio", icon: BookOpen, path: "/biblioteca" },
  { label: "Guías", icon: Notebook, path: "/guias" },
  { label: "Flashcards", icon: CardsThree, path: "/flashcards" },
  { label: "Cuestionarios", icon: ClipboardText, path: "/cuestionarios" },
  { label: "Gestión de contenido", icon: PencilSimpleLine, path: "/panel" },
];

function LoadingIndicator() {
  return (
    <div
      className="route-loading"
      role="status"
      aria-busy="true"
      aria-live="polite"
    >
      <span className="route-loading-indicator" aria-hidden="true" />
      <p className="route-loading-label">Cargando sección…</p>
      <div className="route-loading-skeleton" aria-hidden="true">
        <span className="route-loading-skeleton-title" />
        <span className="route-loading-skeleton-line" />
        <span className="route-loading-skeleton-line route-loading-skeleton-line-short" />
      </div>
    </div>
  );
}

export function RouteLoadingShell() {
  const pathname = usePathname();
  const sidebarCollapsed = useSidebarCollapsedPreference();
  const isApplicationRoute = APPLICATION_PATH_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );

  if (!isApplicationRoute) return <LoadingIndicator />;

  return (
    <div className={`app-shell route-loading-app-shell ${sidebarCollapsed ? "sidebar-collapsed" : ""}`.trim()}>
      <aside className="app-sidebar" aria-hidden="true">
        <div className="sidebar-topline">
          <div className="sidebar-brand">
            <CediahLogo variant="light" />
          </div>
        </div>
        <nav className="sidebar-nav">
          <div className="sidebar-nav-group">
            {LOADING_NAVIGATION.map((item) => {
              const Icon = item.icon;
              const active = pathname === item.path || pathname.startsWith(`${item.path}/`);
              return (
                <div
                  className={`sidebar-link route-loading-sidebar-link ${active ? "is-active" : ""}`.trim()}
                  key={item.label}
                >
                  <Icon size={21} weight={active ? "fill" : "regular"} />
                  <span className="sidebar-link-label">{item.label}</span>
                </div>
              );
            })}
          </div>
        </nav>
        <div className="sidebar-watermark">
          <Image src="/anatomy/skull.png" alt="" width={220} height={220} />
        </div>
      </aside>

      <div className="app-body">
        <header className="app-topbar app-topbar-simplified" aria-hidden="true">
          <span className="menu-trigger">
            <List size={28} />
          </span>
          <div className="route-loading-topbar-copy">
            <span />
            <span />
          </div>
          <span className="route-loading-profile-placeholder" />
        </header>
        <main className="app-main route-loading-main">
          <LoadingIndicator />
        </main>
      </div>
    </div>
  );
}
