"use client";

import Link from "next/link";
import Image from "next/image";
import {
  BookOpen,
  ChartLineUp,
  ClipboardText,
  GraduationCap,
  PlayCircle,
  Skull,
  CardsThree,
  UsersThree,
} from "@phosphor-icons/react";
import { AuthForm } from "./auth-form";
import { CediahLogo } from "./cediah-logo";

const featureItems = [
  { label: "Videos", icon: PlayCircle },
  { label: "Material\nde estudio", icon: BookOpen },
  { label: "Flashcards\ninteractivas", icon: CardsThree },
  { label: "Cuestionarios\npor tema", icon: ClipboardText },
  { label: "Atlas\nanatómicos", icon: Skull },
  { label: "Tu\nprogreso", icon: ChartLineUp },
] as const;

export function LandingScreen() {
  return (
    <main className="landing-page">
      <section className="landing-auth-column" aria-labelledby="landing-title">
        <CediahLogo variant="dark" priority className="landing-logo" />
        <div className="landing-auth-heading">
          <h1 id="landing-title">Bienvenido</h1>
          <p>Inicia sesión para continuar</p>
        </div>
        <AuthForm mode="sign-in" variant="landing" />
        
        <div style={{ marginTop: '24px', textAlign: 'center', width: '100%', maxWidth: '360px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
            <span style={{ flex: 1, height: '1px', background: 'var(--line)' }} />
            <span style={{ fontSize: '0.85rem', color: 'var(--muted)' }}>o si solo quieres mirar</span>
            <span style={{ flex: 1, height: '1px', background: 'var(--line)' }} />
          </div>
          <Link 
            href="/dashboard"
            style={{ 
              display: 'inline-block', 
              width: '100%',
              padding: '12px 16px',
              borderRadius: '8px',
              border: '1px solid var(--modern-primary)',
              color: 'var(--modern-primary)',
              textDecoration: 'none',
              fontWeight: 500,
              transition: 'all 0.2s'
            }}
          >
            Explorar interfaz (provisional)
          </Link>
        </div>
      </section>

      <section className="landing-visual-column" aria-labelledby="landing-visual-title">
        <div className="landing-visual-backdrop" />
        <div className="landing-copy">
          <h2 id="landing-visual-title"><span>ANATOMÍA.</span><strong>CONOCE. COMPRENDE.<br />TRANSFORMA.</strong></h2>
          <span className="landing-rule" />
          <div className="landing-feature-row">
            {featureItems.map(({ label, icon: Icon }) => (
              <div className="landing-feature" key={label}>
                <Icon size={41} weight="thin" />
                <span>{label.split("\n").map((line) => <span key={line}>{line}</span>)}</span>
              </div>
            ))}
          </div>
        </div>
        <Image className="landing-hero-image" src="/anatomy/hero-head.png" alt="Ilustración anatómica del rostro y cuello" fill priority sizes="70vw" />
        <div className="landing-brand-seal" aria-hidden="true"><CediahLogo variant="light" /></div>
        <div className="landing-stat-bar">
          <div><UsersThree size={36} weight="thin" /><strong>+15.000</strong><span>Estudiantes</span></div>
          <div><PlayCircle size={36} weight="thin" /><strong>+300</strong><span>Videos</span></div>
          <div><BookOpen size={36} weight="thin" /><strong>+800</strong><span>Recursos</span></div>
          <div><GraduationCap size={36} weight="thin" /><strong>100%</strong><span>Hecho para<br />estudiantes</span></div>
        </div>
      </section>
    </main>
  );
}
