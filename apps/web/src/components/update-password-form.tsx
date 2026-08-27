"use client";

import { Check, Eye, EyeSlash } from "@phosphor-icons/react";
import { type FormEvent, useState } from "react";
import {
  type AuthFieldErrors,
  AUTH_PASSWORD_MAX_LENGTH,
  AUTH_PASSWORD_MIN_LENGTH,
  getPublicAuthErrorMessage,
  passwordRequirementChecks,
  validateAuthInput,
} from "@/lib/auth/validation";
import { authClient } from "@/lib/auth/client";

type UpdatePasswordFormProps = {
  token: string;
};

export function UpdatePasswordForm({ token }: UpdatePasswordFormProps) {
  const [confirmPassword, setConfirmPassword] = useState("");
  const [errors, setErrors] = useState<AuthFieldErrors>({});
  const [message, setMessage] = useState<string>();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [password, setPassword] = useState("");
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  function clearError(field: "confirmPassword" | "password") {
    setErrors((current) => {
      if (!current[field]) return current;
      const next = { ...current };
      delete next[field];
      return next;
    });
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSubmitting) return;

    const validation = validateAuthInput("update-password", {
      confirmPassword,
      password,
    });
    if (!validation.success) {
      setErrors(validation.errors);
      setMessage("Revisa los campos marcados antes de continuar.");
      const firstInvalid = validation.errors.password
        ? "new-password"
        : "confirm-new-password";
      document.getElementById(firstInvalid)?.focus();
      return;
    }

    setErrors({});
    setMessage(undefined);
    setIsSubmitting(true);

    try {
      const { error } = await authClient.resetPassword({
        newPassword: validation.value.password,
        token,
      });
      if (error) throw error;
      window.location.replace("/acceder?mensaje=contrasena-actualizada");
    } catch (error) {
      setMessage(getPublicAuthErrorMessage(error, "update-password"));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form className="auth-form" method="post" noValidate onSubmit={onSubmit}>
      <div>
        <p className="eyebrow">Acceso protegido</p>
        <h1>Elige una nueva contraseña</h1>
        <p>
          Usa una contraseña única. Al guardarla, cerraremos las sesiones activas de tu cuenta.
        </p>
      </div>
      {message && (
        <p className="auth-message is-error" role="alert">
          {message}
        </p>
      )}

      <label htmlFor="new-password">Nueva contraseña</label>
      <div className={`auth-input-shell ${errors.password ? "is-invalid" : ""}`}>
        <input
          aria-describedby={errors.password ? "new-password-error" : undefined}
          aria-invalid={Boolean(errors.password)}
          autoComplete="new-password"
          disabled={isSubmitting}
          id="new-password"
          maxLength={AUTH_PASSWORD_MAX_LENGTH}
          minLength={AUTH_PASSWORD_MIN_LENGTH}
          name="password"
          onChange={(event) => {
            setPassword(event.target.value);
            clearError("password");
          }}
          required
          type={showPassword ? "text" : "password"}
          value={password}
        />
        <button
          aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
          onClick={() => setShowPassword((value) => !value)}
          type="button"
        >
          {showPassword ? <EyeSlash size={20} /> : <Eye size={20} />}
        </button>
      </div>
      {errors.password && (
        <p className="auth-field-error" id="new-password-error">
          {errors.password}
        </p>
      )}

      <ul className="password-requirements" aria-label="Requisitos de contraseña">
        {passwordRequirementChecks.map((requirement) => {
          const passed = requirement.test(password);
          return (
            <li className={passed ? "is-valid" : ""} key={requirement.label}>
              <span aria-hidden="true">
                {passed ? <Check size={13} weight="bold" /> : "•"}
              </span>
              {requirement.label}
            </li>
          );
        })}
      </ul>

      <label htmlFor="confirm-new-password">Confirma la nueva contraseña</label>
      <div className={`auth-input-shell ${errors.confirmPassword ? "is-invalid" : ""}`}>
        <input
          aria-describedby={
            errors.confirmPassword ? "confirm-new-password-error" : undefined
          }
          aria-invalid={Boolean(errors.confirmPassword)}
          autoComplete="new-password"
          disabled={isSubmitting}
          id="confirm-new-password"
          maxLength={AUTH_PASSWORD_MAX_LENGTH}
          minLength={AUTH_PASSWORD_MIN_LENGTH}
          name="confirmPassword"
          onChange={(event) => {
            setConfirmPassword(event.target.value);
            clearError("confirmPassword");
          }}
          required
          type={showConfirmPassword ? "text" : "password"}
          value={confirmPassword}
        />
        <button
          aria-label={showConfirmPassword ? "Ocultar confirmación" : "Mostrar confirmación"}
          onClick={() => setShowConfirmPassword((value) => !value)}
          type="button"
        >
          {showConfirmPassword ? <EyeSlash size={20} /> : <Eye size={20} />}
        </button>
      </div>
      {errors.confirmPassword && (
        <p className="auth-field-error" id="confirm-new-password-error">
          {errors.confirmPassword}
        </p>
      )}

      <button
        className="button button-primary"
        disabled={isSubmitting}
        type="submit"
      >
        {isSubmitting ? "Actualizando..." : "Guardar contraseña"}
      </button>
    </form>
  );
}
