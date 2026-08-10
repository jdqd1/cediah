"use client";

import Image from "next/image";
import Link from "next/link";
import {
  ArrowUpRight,
  BookOpen,
  ChartLineUp,
  Check,
  ClipboardText,
  Eye,
  EyeSlash,
  EnvelopeSimple,
  GithubLogo,
  GoogleLogo,
  GraduationCap,
  LockKey,
  PlayCircle,
  Skull,
  CardsThree,
  UsersThree,
} from "@phosphor-icons/react";
import { type FormEvent, useState } from "react";
import { getBrowserSupabaseClient } from "@/lib/supabase/browser";
import { CediahLogo } from "./cediah-logo";

const featureItems = [
  { label: "Clases\nteóricas", icon: PlayCircle },
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
        <LandingAuthForm />
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
          <div><PlayCircle size={36} weight="thin" /><strong>+300</strong><span>Clases</span></div>
          <div><BookOpen size={36} weight="thin" /><strong>+800</strong><span>Recursos</span></div>
          <div><GraduationCap size={36} weight="thin" /><strong>100%</strong><span>Hecho para<br />estudiantes</span></div>
        </div>
      </section>
    </main>
  );
}

function LandingAuthForm() {
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(true);
  const [message, setMessage] = useState<string>();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const supabase = getBrowserSupabaseClient();

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(undefined);
    setIsSubmitting(true);
    const formData = new FormData(event.currentTarget);
    const email = String(formData.get("email") ?? "");
    const password = String(formData.get("password") ?? "");

    if (!supabase) {
      setMessage("El acceso todavía no está configurado para este ambiente.");
      setIsSubmitting(false);
      return;
    }

    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      window.location.assign("/panel");
    } catch {
      setMessage("No fue posible completar el acceso. Verifica los datos e inténtalo de nuevo.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form className="landing-auth-form" onSubmit={onSubmit} noValidate>
      <div className="social-buttons">
        <button type="button" onClick={() => setMessage("El acceso con Google estará disponible próximamente.")}><GoogleLogo size={24} weight="regular" /> Continuar con Google</button>
        <button type="button" onClick={() => setMessage("El acceso con GitHub estará disponible próximamente.")}><GithubLogo size={24} weight="fill" /> Continuar con GitHub</button>
      </div>
      <div className="auth-divider"><span />o continúa con tu correo<span /></div>
      {message && <p className="landing-auth-message" role="status">{message}</p>}
      <label className="landing-field"><EnvelopeSimple size={21} /><input autoComplete="email" name="email" placeholder="Correo electrónico" required type="email" /></label>
      <label className="landing-field"><LockKey size={21} /><input autoComplete="current-password" minLength={12} name="password" placeholder="Contraseña" required type={showPassword ? "text" : "password"} /><button type="button" aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"} onClick={() => setShowPassword((value) => !value)}>{showPassword ? <EyeSlash size={21} /> : <Eye size={21} />}</button></label>
      <div className="landing-form-options"><label><button className={`check-control ${remember ? "is-checked" : ""}`} type="button" aria-pressed={remember} onClick={() => setRemember((value) => !value)}>{remember && <Check size={15} weight="bold" />}</button>Recordarme</label><Link href="/recuperar-acceso">¿Olvidaste tu contraseña?</Link></div>
      <button className="landing-submit" disabled={isSubmitting} type="submit">{isSubmitting ? "Iniciando sesión..." : "Iniciar sesión"}</button>
      <p className="landing-register">¿No tienes una cuenta? <Link href="/acceder?modo=registro">Regístrate</Link></p>
      <Link className="landing-demo-link" href="/dashboard">Explorar la interfaz <ArrowUpRight size={16} /></Link>
    </form>
  );
}
