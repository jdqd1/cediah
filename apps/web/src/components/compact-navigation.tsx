import { ArrowLeft } from "@phosphor-icons/react";
import Link from "next/link";
import type { ComponentProps } from "react";

type IconBackLinkProps = Omit<ComponentProps<typeof Link>, "aria-label" | "children"> & {
  label: string;
};

export function IconBackLink({ className = "", label, title, ...props }: IconBackLinkProps) {
  return (
    <Link
      {...props}
      aria-label={label}
      data-navigation-direction="back"
      className={`icon-back-link ${className}`.trim()}
      title={title ?? label}
    >
      <ArrowLeft aria-hidden="true" size={19} weight="bold" />
    </Link>
  );
}
