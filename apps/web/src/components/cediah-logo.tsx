import Image from "next/image";

type CediahLogoProps = {
  className?: string;
  priority?: boolean;
  variant?: "dark" | "light";
};

export function CediahLogo({ className = "", priority = false, variant = "dark" }: CediahLogoProps) {
  const markSource = variant === "light"
    ? "/brand/koras-mark-light.png"
    : "/brand/koras-mark-dark.png";

  return (
    <span
      aria-label="KORAS"
      className={`cediah-logo cediah-logo-${variant} ${className}`.trim()}
      role="img"
    >
      <Image
        className="koras-logo-mark koraz-logo-mark"
        src={markSource}
        alt=""
        width={1254}
        height={1254}
        priority={priority}
      />
      <span className="koras-logo-copy koraz-logo-copy">
        <strong>KORAS</strong>
      </span>
    </span>
  );
}
