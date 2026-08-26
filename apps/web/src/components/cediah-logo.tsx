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
        width={1512}
        height={1512}
        priority={priority}
      />
      <Image
        className="koraz-logo-wordmark"
        src="/brand/koraz-wordmark.png"
        alt=""
        width={2000}
        height={496}
        priority={priority}
      />
    </span>
  );
}
