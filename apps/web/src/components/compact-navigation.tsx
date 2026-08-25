import { ArrowLeft } from "@phosphor-icons/react";
import Link from "next/link";
import type { ComponentProps } from "react";

type IconBackLinkProps = Omit<ComponentProps<typeof Link>, "aria-label" | "children"> & {
  label: string;
};

function navigationSegment(value: string) {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLocaleLowerCase("es")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function IconBackLink({ className = "", label, title, ...props }: IconBackLinkProps) {
  return (
    <Link
      {...props}
      aria-label={label}
      className={`icon-back-link ${className}`.trim()}
      title={title ?? label}
    >
      <ArrowLeft aria-hidden="true" size={19} weight="bold" />
    </Link>
  );
}

export function NavigationTrail({
  className = "",
  segments,
}: {
  className?: string;
  segments: string[];
}) {
  const visibleSegments = segments.map(navigationSegment).filter(Boolean);
  const path = `../${visibleSegments.join("/")}`;

  return (
    <span
      className={`navigation-trail ${className}`.trim()}
      title={`Ruta actual: ${segments.filter(Boolean).join(" / ")}`}
    >
      {path}
    </span>
  );
}
