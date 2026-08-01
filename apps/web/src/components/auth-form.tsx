"use client";

import { type FormEvent, useState } from "react";
import { getBrowserSupabaseClient } from "@/lib/supabase/browser";

type AuthMode = "recover" | "sign-in" | "sign-up";

type AuthFormProps = {
  mode: AuthMode;
  nextPath?: string;
};

function safeNextPath(value: string | undefined) {
  return value?.startsWith("/") && !value.startsWith("//") ? value : "/panel";
}

export function AuthForm({ mode, nextPath }: AuthFormProps) {
  const [message, setMessage] = useState<string>();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const supabase = getBrowserSupabaseClient();
  const isRecovery = mode === "recover";
  const isSignUp = mode === "sign-up";
  const targetPath = safeNextPath(nextPath);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase) return;

    setIsSubmitting(true);
    setMessage(undefined);
    const formData = new FormData(event.currentTarget);
    const email = String(formData.get("email") ?? "");
    const password = String(formData.get("password") ?? "");
    const callbackUrl = new URL("/auth/callback", window.location.origin);
    callbackUrl.searchParams.set("next", isRecovery ? "/auth/actualizar-contrasena" : targetPath);

    try {
      if (isRecovery) {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: callbackUrl.toString(),
        });
        if (error) throw error;
        setMessage("Si el correo está registrado, recibirás un enlace para restablecer el acceso.");
        return;
      }

      if (isSignUp) {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: callbackUrl.toString() },
        });
        if (error) throw error;
        setMessage("Revisa tu correo para confirmar la cuenta antes de continuar.");
        return;
      }

      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      window.location.assign(targetPath);
    } catch {
      setMessage(
        isRecovery
          ? "No fue posible solicitar el enlace. Inténtalo de nuevo más tarde."
          : "No fue posible completar el acceso. Verifica los datos e inténtalo de nuevo.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  const heading = isRecovery ? "Recupera tu acceso" : isSignUp ? "Crea tu cuenta" : "Accede a CEDIAH";
  const submitLabel = isRecovery ? "Enviar enlace" : isSignUp ? "Crear cuenta" : "Iniciar sesión";

  return (
    <form className="auth-form" onSubmit={onSubmit} noValidate>
      <div>
        <p className="eyebrow">Acceso protegido</p>
        <h1>{heading}</h1>
        <p>
          {isRecovery
            ? "Te enviaremos un enlace de un solo uso."
            : "La cuenta te permitirá continuar tu recorrido cuando el curso piloto esté disponible."}
        </p>
      </div>

      {!supabase && (
        <p className="auth-message" role="alert">
          El acceso todavía no está configurado para este ambiente.
        </p>
      )}
      {message && <p className="auth-message" role="status">{message}</p>}

      <label htmlFor="email">Correo institucional o personal</label>
      <input autoComplete="email" disabled={!supabase || isSubmitting} id="email" name="email" required type="email" />

      {!isRecovery && (
        <>
          <label htmlFor="password">Contraseña</label>
          <input
            autoComplete={isSignUp ? "new-password" : "current-password"}
            disabled={!supabase || isSubmitting}
            id="password"
            minLength={12}
            name="password"
            required
            type="password"
          />
        </>
      )}

      <button className="button button-primary" disabled={!supabase || isSubmitting} type="submit">
        {isSubmitting ? "Procesando..." : submitLabel}
      </button>
    </form>
  );
}
