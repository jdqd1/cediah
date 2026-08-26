import Image from "next/image";

type CediahLogoProps = {
  className?: string;
  priority?: boolean;
  variant?: "dark" | "light";
};

export function CediahLogo({ className = "", priority = false, variant = "light" }: CediahLogoProps) {
  return (
    <span
      aria-label="Koraz"
      className={`cediah-logo cediah-logo-${variant} ${className}`.trim()}
      role="img"
    >
      <Image
        className="koraz-logo-mark"
        src="/brand/koraz-mark.png"
        alt=""
        width={72}
        height={72}
        priority={priority}
      />
      <span className="koraz-logo-copy" aria-hidden="true">
        <strong>KORAZ</strong>
        <small>Aprende. Explora. Crece.</small>
      </span>
    </span>
  );
}
