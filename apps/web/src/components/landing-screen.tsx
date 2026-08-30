"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import {
  ArrowRight,
  Check,
  ClipboardText,
  ClockCountdown,
  BookOpen,
  FacebookLogo,
  ImagesSquare,
  InstagramLogo,
  List,
  MonitorPlay,
  TiktokLogo,
  X,
  YoutubeLogo,
} from "@phosphor-icons/react";
import { CediahLogo } from "./cediah-logo";

const featureItems = [
  { title: "Materias médicas", icon: BookOpen },
  { title: "Videos HD", icon: MonitorPlay },
  { title: "Flashcards", icon: ImagesSquare },
  { title: "Cuestionarios", icon: ClipboardText },
  { title: "Seguimiento", icon: ClockCountdown },
] as const;

const planFeatures = [
  "Materias esenciales",
  "Videos y guías",
  "Cuestionarios",
  "Seguimiento de progreso",
  "Acceso a todas las materias",
  "Flashcards ilimitadas",
  "Casos clínicos exclusivos",
  "Soporte prioritario",
] as const;

const plans = [
  {
    name: "Básico",
    price: "$4.99",
    includedFeatures: 4,
    popular: false,
  },
  {
    name: "Pro",
    price: "$8.99",
    includedFeatures: 6,
    popular: true,
  },
  {
    name: "Premium",
    price: "$12.99",
    includedFeatures: planFeatures.length,
    popular: false,
  },
] as const;

const footerGroups = [
  { title: "Plataforma", links: ["Materias", "Videos", "Flashcards", "Cuestionarios"] },
  { title: "Recursos", links: ["Blog", "Guías gratuitas", "Casos clínicos", "Novedades"] },
  { title: "Empresa", links: ["Sobre nosotros", "Términos", "Privacidad", "Contacto"] },
  { title: "¿Necesitas ayuda?", links: ["Soporte", "Centro de ayuda", "Preguntas frecuentes"] },
] as const;

const accessHref = "/acceder";
const registerHref = "/acceder?modo=registro";

export function LandingScreen() {
  const [menuOpen, setMenuOpen] = useState(false);
  const closeMenu = () => setMenuOpen(false);

  return (
    <main className="marketing-page">
      <section className="marketing-hero" aria-labelledby="marketing-title">
        <header className="marketing-header">
          <Link className="marketing-brand" href="/" aria-label="Koraz, inicio">
            <CediahLogo variant="light" priority />
          </Link>

          <button
            className="marketing-menu-button"
            type="button"
            aria-label={menuOpen ? "Cerrar menú" : "Abrir menú"}
            aria-expanded={menuOpen}
            aria-controls="marketing-navigation"
            onClick={() => setMenuOpen((open) => !open)}
          >
            {menuOpen ? <X size={24} weight="bold" /> : <List size={25} weight="bold" />}
          </button>

          <nav
            className={'marketing-navigation ' + (menuOpen ? "is-open" : "")}
            id="marketing-navigation"
            aria-label="Navegación principal"
          >
            <div className="marketing-nav-links">
              <a href="#planes" onClick={closeMenu}>Planes</a>
            </div>
            <div className="marketing-nav-actions">
              <Link className="marketing-login" href={accessHref} onClick={closeMenu}>Iniciar sesión</Link>
              <Link className="marketing-register" href={registerHref} onClick={closeMenu}>Regístrate</Link>
            </div>
          </nav>
        </header>

        <div className="marketing-hero-inner">
          <div className="marketing-hero-copy">
            <h1 id="marketing-title">
              <span>Medicina real.</span>
              <span>Aprendizaje</span>
              <strong>sin límites.</strong>
            </h1>
            <p>Explora, practica y domina<br />las materias de tu carrera.</p>
            <div className="marketing-hero-actions">
              <Link className="marketing-primary-button" href={registerHref}>
                Comienza gratis <ArrowRight aria-hidden="true" size={18} weight="bold" />
              </Link>
            </div>
          </div>

          <div className="marketing-anatomy-stage" aria-hidden="true">
            <Image
              className="marketing-anatomy-hero"
              src="/landing/anatomy-hero.png"
              alt=""
              width={1024}
              height={1024}
              priority
              sizes="(max-width: 700px) 96vw, 56vw"
            />
          </div>
        </div>
      </section>

      <section className="marketing-features" id="recursos" aria-label="Recursos de la plataforma">
        {featureItems.map(({ title, icon: Icon }) => (
          <div className="marketing-feature" key={title}>
            <Icon aria-hidden="true" size={35} weight="thin" />
            <strong>{title}</strong>
          </div>
        ))}
      </section>

      <section className="marketing-platform" id="plataforma" aria-labelledby="platform-title">
        <div className="marketing-platform-inner">
          <div className="marketing-platform-copy">
            <span>TODO EN UN SOLO LUGAR</span>
            <h2 id="platform-title">Aprende.<br />Practica.<br />Retén.</h2>
            <p>La forma más visual e<br className="marketing-desktop-break" /> inteligente de estudiar medicina.</p>
            <Link className="marketing-primary-button" href={registerHref}>
              Explorar plataforma <ArrowRight aria-hidden="true" size={18} weight="bold" />
            </Link>
          </div>
          <div className="marketing-devices">
            <Image
              src="/landing/platform-devices.png"
              alt="Vista de Koraz en tablet y teléfono con distintas materias médicas"
              width={1536}
              height={1024}
              sizes="(max-width: 700px) 100vw, 64vw"
            />
          </div>
        </div>
      </section>

      <section className="marketing-pricing" id="planes" aria-labelledby="plans-title">
        <div className="marketing-pricing-heading">
          <h2 id="plans-title">Elige tu plan</h2>
          <span>Ahorra 20% anual ✦</span>
        </div>
        <div className="marketing-plan-grid">
          {plans.map((plan) => (
            <article className={'marketing-plan-card ' + (plan.popular ? "is-popular" : "")} key={plan.name}>
              {plan.popular ? <span className="marketing-popular-badge">MÁS POPULAR</span> : null}
              <h3>{plan.name}</h3>
              <div className="marketing-price"><strong>{plan.price}</strong><span>/mes</span></div>
              <ul>
                {planFeatures.map((feature, featureIndex) => {
                  const included = featureIndex < plan.includedFeatures;

                  return (
                    <li
                      className={included ? "is-included" : "is-excluded"}
                      key={feature}
                      aria-label={`${feature}: ${included ? "incluido" : "no incluido"}`}
                    >
                      {included ? (
                        <Check aria-hidden="true" size={12} weight="bold" />
                      ) : (
                        <X aria-hidden="true" size={12} weight="bold" />
                      )}
                      {feature}
                    </li>
                  );
                })}
              </ul>
              <Link href={registerHref + '&plan=' + plan.name.toLowerCase()}>Elegir plan</Link>
            </article>
          ))}
        </div>
      </section>

      <section className="marketing-cta" aria-labelledby="cta-title">
        <Image className="marketing-cta-anatomy" src="/landing/cta-anatomy.png" alt="" width={1024} height={1024} />
        <h2 id="cta-title">Domina tus materias.<br />Transforma tu futuro.</h2>
        <Link className="marketing-primary-button" href={registerHref}>
          Comienza gratis <ArrowRight aria-hidden="true" size={18} weight="bold" />
        </Link>
      </section>

      <footer className="marketing-footer" id="instituciones">
        <div className="marketing-footer-inner">
          <div className="marketing-footer-brand">
            <Link href="/" aria-label="Koraz, inicio"><CediahLogo variant="light" /></Link>
            <p>Aprendizaje que se ve,<br />conocimiento que se queda.</p>
            <div className="marketing-socials" aria-label="Redes sociales">
              <a href="#instagram" aria-label="Instagram"><InstagramLogo size={16} /></a>
              <a href="#youtube" aria-label="YouTube"><YoutubeLogo size={16} /></a>
              <a href="#tiktok" aria-label="TikTok"><TiktokLogo size={16} /></a>
              <a href="#facebook" aria-label="Facebook"><FacebookLogo size={16} /></a>
            </div>
          </div>
          <div className="marketing-footer-groups">
            {footerGroups.map((group) => (
              <div className="marketing-footer-group" key={group.title}>
                <strong>{group.title}</strong>
                {group.links.map((label) => <a href="#plataforma" key={label}>{label}</a>)}
              </div>
            ))}
          </div>
          <p className="marketing-copyright">© 2025 Koraz. Todos los derechos reservados.</p>
        </div>
      </footer>
    </main>
  );
}
