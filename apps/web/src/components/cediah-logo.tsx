import Image from "next/image";

type CediahLogoProps = {
  className?: string;
  priority?: boolean;
  variant?: "dark" | "light";
};

export function CediahLogo({ className = "", priority = false, variant = "light" }: CediahLogoProps) {
  return (
    <span
      aria-label="KORAS"
      className={`cediah-logo cediah-logo-${variant} ${className}`.trim()}
      role="img"
    >
      <Image
        className="koras-logo-mark"
        src="/brand/koras-mark.png"
        alt=""
        width={1512}
        height={1512}
        priority={priority}
      />
      <span className="koras-logo-copy">
        <strong>KORAS</strong>
      </span>
    </span>
  );
}
