"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const sections = [
  { href: "/panel/administracion/roles", label: "Roles y permisos" },
  { href: "/panel/administracion/terminos", label: "Términos interactivos" },
];

export function AdminSectionTabs() {
  const pathname = usePathname();
  return (
    <nav className="admin-section-tabs" aria-label="Secciones de administración">
      {sections.map((section) => {
        const active = pathname.startsWith(section.href);
        return (
          <Link
            aria-current={active ? "page" : undefined}
            className={`admin-section-tab ${active ? "is-active" : ""}`.trim()}
            href={section.href}
            key={section.href}
          >
            {section.label}
          </Link>
        );
      })}
    </nav>
  );
}
