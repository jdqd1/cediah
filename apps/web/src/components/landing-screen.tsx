"use client";

import Image from "next/image";
import Link from "next/link";
import { useState, type MouseEvent } from "react";
import {
  ArrowRight,
  Check,
  ClipboardText,
  ClockCountdown,
  BookOpen,
  Crown,
  FacebookLogo,
  ImagesSquare,
  InstagramLogo,
  Lightning,
  MonitorPlay,
  Sparkle,
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
    slug: "basico",
    level: "NIVEL 1",
    icon: Sparkle,
    monthlyPrice: 4.99,
    annualPrice: 47.9,
    includedFeatures: 4,
    popular: false,
  },
  {
    name: "Pro",
    slug: "pro",
    level: "NIVEL 2",
    icon: Lightning,
    monthlyPrice: 8.99,
    annualPrice: 86.3,
    includedFeatures: 6,
    popular: true,
  },
  {
    name: "Premium",
    slug: "premium",
    level: "NIVEL 3",
    icon: Crown,
    monthlyPrice: 12.99,
    annualPrice: 124.7,
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
  const [billingCycle, setBillingCycle] = useState<"monthly" | "yearly">("yearly");

  const scrollToPlans = (event: MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault();
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    document.getElementById("planes")?.scrollIntoView({
      behavior: reduceMotion ? "auto" : "smooth",
      block: "start",
    });
  };

  return (
    <main className="marketing-page marketing-page-paper">
      <section className="marketing-hero" aria-labelledby="marketing-title">
        <div className="marketing-hero-art" aria-hidden="true">
          <Image
            className="marketing-hero-reference marketing-hero-reference-desktop"
            src="/landing/landing-reference-desktop.png"
            alt=""
            fill
            priority
            sizes="(max-width: 700px) 1px, 100vw"
          />
          <Image
            className="marketing-hero-reference marketing-hero-reference-mobile"
            src="/landing/landing-reference-mobile.png"
            alt=""
            fill
            priority
            sizes="(max-width: 700px) 100vw, 1px"
          />
        </div>

        <header className="marketing-header">
          <Link className="marketing-brand" href="/" aria-label="Koraz, inicio">
            <CediahLogo variant="dark" priority />
          </Link>

          <nav className="marketing-navigation" id="marketing-navigation" aria-label="Navegación principal">
            <div className="marketing-nav-links">
              <a className="marketing-plans-link" href="#planes" onClick={scrollToPlans}>Planes</a>
            </div>
            <div className="marketing-nav-actions">
              <Link className="marketing-login" href={accessHref}>Iniciar sesión</Link>
              <Link className="marketing-register" href={registerHref}>Regístrate</Link>
            </div>
          </nav>
        </header>

        <div className="marketing-hero-inner">
          <div className="marketing-hero-copy">
            <h1 id="marketing-title">
              <span>Estudia a tu <br className="marketing-mobile-break" />manera.</span>
              <span>Llega más lejos.</span>
            </h1>
            <span className="marketing-hero-rule" aria-hidden="true" />
            <p>Combina tus apuntes de siempre con<br className="marketing-desktop-break" /> herramientas digitales que te hacen avanzar.</p>
            <div className="marketing-hero-actions">
              <Link className="marketing-primary-button" href={registerHref}>
                Comienza gratis <ArrowRight aria-hidden="true" size={18} weight="bold" />
              </Link>
            </div>
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
          <span className="marketing-pricing-eyebrow">TU PRÓXIMO NIVEL</span>
          <h2 id="plans-title">Elige el plan que te hace avanzar</h2>
          <p>Compara beneficios y cambia la forma de pago cuando quieras.</p>
          <div className="marketing-billing-switch" role="group" aria-label="Frecuencia de facturación">
            <button
              className={billingCycle === "monthly" ? "is-active" : ""}
              type="button"
              aria-pressed={billingCycle === "monthly"}
              onClick={() => setBillingCycle("monthly")}
            >
              Mensual
            </button>
            <button
              className={billingCycle === "yearly" ? "is-active" : ""}
              type="button"
              aria-pressed={billingCycle === "yearly"}
              onClick={() => setBillingCycle("yearly")}
            >
              Anual <span>-20%</span>
            </button>
          </div>
        </div>
        <div className="marketing-plan-grid">
          {plans.map((plan, planIndex) => {
            const PlanIcon = plan.icon;
            const annualMonthlyPrice = plan.annualPrice / 12;
            const annualSavings = plan.monthlyPrice * 12 - plan.annualPrice;
            const displayedPrice = billingCycle === "yearly" ? annualMonthlyPrice : plan.monthlyPrice;

            return (
              <article
                className={`marketing-plan-card marketing-plan-tier-${planIndex + 1} ${plan.popular ? "is-popular" : ""}`}
                key={plan.name}
              >
                {plan.popular ? (
                  <span className="marketing-popular-badge"><Lightning aria-hidden="true" size={11} weight="fill" /> MÁS ELEGIDO</span>
                ) : null}
                <div className="marketing-plan-heading">
                  <span className="marketing-plan-icon"><PlanIcon aria-hidden="true" size={21} weight="fill" /></span>
                  <div><small>{plan.level}</small><h3>{plan.name}</h3></div>
                </div>
                <div className="marketing-price" aria-live="polite">
                  <strong>${displayedPrice.toFixed(2)}</strong><span>/mes</span>
                </div>
                <div className="marketing-billing-detail">
                  {billingCycle === "yearly" ? (
                    <>
                      <span>Pago único de <strong>${plan.annualPrice.toFixed(2)}</strong> al año</span>
                      <b><Sparkle aria-hidden="true" size={12} weight="fill" /> Ahorras ${annualSavings.toFixed(2)}</b>
                    </>
                  ) : (
                    <>
                      <span>Facturación flexible cada mes</span>
                      <b>Con anual: ${annualMonthlyPrice.toFixed(2)}/mes</b>
                    </>
                  )}
                </div>
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
                <Link href={`${registerHref}&plan=${plan.slug}&facturacion=${billingCycle === "yearly" ? "anual" : "mensual"}`}>
                  Elegir {plan.name} <ArrowRight aria-hidden="true" size={13} weight="bold" />
                </Link>
              </article>
            );
          })}
        </div>
      </section>

      <footer className="marketing-footer" id="instituciones">
        <div className="marketing-footer-inner">
          <div className="marketing-footer-brand">
            <Link href="/" aria-label="Koraz, inicio"><CediahLogo variant="dark" /></Link>
            <p>Aprendizaje que se ve,<br />conocimiento que se queda.</p>
            <div className="marketing-socials" aria-label="Redes sociales" role="group">
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
          <p className="marketing-copyright">© 2026 Koraz. Todos los derechos reservados.</p>
        </div>
      </footer>
    </main>
  );
}
