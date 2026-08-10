import Image from "next/image";

type CediahLogoProps = {
  className?: string;
  priority?: boolean;
  variant?: "dark" | "light";
};

export function CediahLogo({ className = "", priority = false, variant = "light" }: CediahLogoProps) {
  return (
    <span className={`cediah-logo cediah-logo-${variant} ${className}`.trim()}>
      <Image
        src={variant === "dark" ? "/brand/logo-dark-transparent.png" : "/brand/logo-light.png"}
        alt="CEDIAH"
        width={variant === "light" ? 155 : 220}
        height={variant === "light" ? 135 : 170}
        priority={priority}
      />
    </span>
  );
}
