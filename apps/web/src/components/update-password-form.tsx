"use client";

import { type FormEvent, useState } from "react";
import { getBrowserSupabaseClient } from "@/lib/supabase/browser";

export function UpdatePasswordForm() {
  const [message, setMessage] = useState<string>();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const supabase = getBrowserSupabaseClient();

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase) return;

    setIsSubmitting(true);
    setMessage(undefined);
    const password = String(new FormData(event.currentTarget).get("password") ?? "");

    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      window.location.assign("/dashboard");
    } catch {
      setMessage("El enlace no es válido o expiró. Solicita uno nuevo.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form className="auth-form" onSubmit={onSubmit}>
      <div>
        <p className="eyebrow">Acceso protegido</p>
        <h1>Elige una nueva contraseña</h1>
        <p>Usa al menos 12 caracteres y no reutilices una contraseña anterior.</p>
      </div>
      {!supabase && <p className="auth-message" role="alert">El acceso todavía no está configurado para este ambiente.</p>}
      {message && <p className="auth-message" role="status">{message}</p>}
      <label htmlFor="password">Nueva contraseña</label>
      <input autoComplete="new-password" disabled={!supabase || isSubmitting} id="password" minLength={12} name="password" required type="password" />
      <button className="button button-primary" disabled={!supabase || isSubmitting} type="submit">
        {isSubmitting ? "Actualizando..." : "Guardar contraseña"}
      </button>
    </form>
  );
}
