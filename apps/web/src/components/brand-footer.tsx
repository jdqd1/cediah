import { InstagramLogo, YoutubeLogo, EnvelopeSimple } from "@phosphor-icons/react/dist/ssr";
import { CediahLogo } from "./cediah-logo";

export function BrandFooter() {
  return (
    <footer className="brand-footer">
      <div className="brand-footer-lockup">
        <CediahLogo variant="dark" />
        <div>
          <p>Koraz — Conocimiento que conecta y transforma</p>
          <span>Aprende. Explora. Crece.</span>
        </div>
      </div>
      <div className="brand-footer-socials" aria-label="Redes sociales">
        <a href="#instagram" aria-label="Instagram"><InstagramLogo size={25} weight="regular" /></a>
        <a href="#youtube" aria-label="YouTube"><YoutubeLogo size={27} weight="regular" /></a>
        <a href="#correo" aria-label="Correo electrónico"><EnvelopeSimple size={27} weight="regular" /></a>
      </div>
    </footer>
  );
}
