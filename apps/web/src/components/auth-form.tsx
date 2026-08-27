"use client";

import {
  Check,
  EnvelopeSimple,
  Eye,
  EyeSlash,
  LockKey,
} from "@phosphor-icons/react";
import Link from "next/link";
import { type FormEvent, useCallback, useState } from "react";
import {
  type AuthFieldErrors,
  type AuthFormMode,
  AUTH_EMAIL_MAX_LENGTH,
  AUTH_PASSWORD_MAX_LENGTH,
  AUTH_PASSWORD_MIN_LENGTH,
  getPublicAuthErrorMessage,
  getSafeNextPath,
  passwordRequirementChecks,
  validateAuthInput,
} from "@/lib/auth/validation";
import { authClient } from "@/lib/auth/client";
import { getPublicTurnstileSiteKey } from "@/lib/auth/environment";
import { TurnstileWidget } from "./turnstile-widget";

type AuthMode = Exclude<AuthFormMode, "update-password">;
type AuthFormVariant = "card" | "landing";

type AuthFormProps = {
  initialMessage?: string;
  initialMessageTone?: Feedback["tone"];
  mode: AuthMode;
  nextPath?: string;
  variant?: AuthFormVariant;
};

type Feedback = {
  message: string;
  tone: "error" | "success";
};

function getHeading(mode: AuthMode) {
  if (mode === "recover") return "Recupera tu acceso";
  if (mode === "sign-up") return "Crea tu cuenta";
  return "Accede a Koraz";
}

function getSubmitLabel(mode: AuthMode) {
  if (mode === "recover") return "Enviar enlace";
  if (mode === "sign-up") return "Crear cuenta";
  return "Iniciar sesión";
}

export function AuthForm({
  initialMessage,
  initialMessageTone = "error",
  mode,
  nextPath,
  variant = "card",
}: AuthFormProps) {
  const [captchaResetKey, setCaptchaResetKey] = useState(0);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [confirmPassword, setConfirmPassword] = useState("");
  const [email, setEmail] = useState("");
  const [errors, setErrors] = useState<AuthFieldErrors>({});
  const [feedback, setFeedback] = useState<Feedback | undefined>(
    initialMessage
      ? { message: initialMessage, tone: initialMessageTone }
      : undefined,
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [password, setPassword] = useState("");
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const captchaSiteKey = getPublicTurnstileSiteKey();
  const isRecovery = mode === "recover";
  const isSignUp = mode === "sign-up";
  const targetPath = getSafeNextPath(nextPath);
  const formClassName = variant === "landing" ? "landing-auth-form" : "auth-form";

  const clearError = useCallback((field: keyof AuthFieldErrors) => {
    setErrors((current) => {
      if (!current[field]) return current;
      const next = { ...current };
      delete next[field];
      return next;
    });
  }, []);

  const handleCaptchaError = useCallback(() => {
    setCaptchaToken(null);
    setFeedback({
      message:
        "No pudimos cargar la verificación de seguridad. Revisa tu conexión e inténtalo de nuevo.",
      tone: "error",
    });
  }, []);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSubmitting) return;

    const validation = validateAuthInput(mode, {
      confirmPassword,
      email,
      password,
    });
    if (!validation.success) {
      setErrors(validation.errors);
      setFeedback({
        message: "Revisa los campos marcados antes de continuar.",
        tone: "error",
      });
      const firstInvalidField = ["email", "password", "confirmPassword"].find(
        (field) => validation.errors[field as keyof AuthFieldErrors],
      );
      if (firstInvalidField) {
        document.getElementById(`auth-${firstInvalidField}`)?.focus();
      }
      return;
    }

    if (captchaSiteKey && !captchaToken) {
      setFeedback({
        message: "Completa la verificación de seguridad antes de continuar.",
        tone: "error",
      });
      return;
    }

    setErrors({});
    setFeedback(undefined);
    setIsSubmitting(true);
    const captchaFetchOptions = captchaToken
      ? { headers: { "x-captcha-response": captchaToken } }
      : undefined;

    try {
      if (validation.value.mode === "recover") {
        const resetUrl = new URL(
          "/auth/actualizar-contrasena",
          window.location.origin,
        );
        const { error } = await authClient.requestPasswordReset(
          {
            email: validation.value.email,
            redirectTo: resetUrl.toString(),
          },
          captchaFetchOptions,
        );
        if (error) throw error;
        setEmail("");
        setFeedback({
          message:
            "Si el correo está registrado, recibirás un enlace para restablecer el acceso.",
          tone: "success",
        });
        return;
      }

      if (validation.value.mode === "sign-up") {
        const callbackUrl = new URL("/auth/callback", window.location.origin);
        callbackUrl.searchParams.set("next", targetPath);
        const { data, error } = await authClient.signUp.email(
          {
            callbackURL: callbackUrl.toString(),
            email: validation.value.email,
            name: validation.value.email,
            password: validation.value.password,
          },
          captchaFetchOptions,
        );
        if (error) throw error;
        setPassword("");
        setConfirmPassword("");

        if (data?.token) {
          window.location.replace(targetPath);
          return;
        }

        setFeedback({
          message:
            "Si el correo puede registrarse, recibirás un enlace de confirmación. Revísalo antes de iniciar sesión.",
          tone: "success",
        });
        return;
      }

      const { error } = await authClient.signIn.email(
        {
          email: validation.value.email,
          password: validation.value.password,
        },
        captchaFetchOptions,
      );
      if (error) throw error;
      window.location.replace(targetPath);
    } catch (error) {
      setFeedback({
        message: getPublicAuthErrorMessage(error, mode),
        tone: "error",
      });
    } finally {
      setIsSubmitting(false);
      if (captchaSiteKey) setCaptchaResetKey((value) => value + 1);
    }
  }

  const feedbackElement = feedback && (
    <p
      className={`${variant === "landing" ? "landing-auth-message" : "auth-message"} is-${feedback.tone}`}
      role={feedback.tone === "error" ? "alert" : "status"}
    >
      {feedback.message}
    </p>
  );

  const emailInput = (
    <input
      aria-describedby={errors.email ? "auth-email-error" : undefined}
      aria-invalid={Boolean(errors.email)}
      autoCapitalize="none"
      autoComplete="email"
      disabled={isSubmitting}
      id="auth-email"
      inputMode="email"
      maxLength={AUTH_EMAIL_MAX_LENGTH}
      name="email"
      onChange={(event) => {
        setEmail(event.target.value);
        clearError("email");
      }}
      placeholder={variant === "landing" ? "Correo electrónico" : undefined}
      required
      spellCheck={false}
      type="email"
      value={email}
    />
  );

  const passwordInput = (
    <input
      aria-describedby={errors.password ? "auth-password-error" : undefined}
      aria-invalid={Boolean(errors.password)}
      autoComplete={isSignUp ? "new-password" : "current-password"}
      disabled={isSubmitting}
      id="auth-password"
      maxLength={AUTH_PASSWORD_MAX_LENGTH}
      minLength={isSignUp ? AUTH_PASSWORD_MIN_LENGTH : undefined}
      name="password"
      onChange={(event) => {
        setPassword(event.target.value);
        clearError("password");
      }}
      placeholder={variant === "landing" ? "Contraseña" : undefined}
      required
      type={showPassword ? "text" : "password"}
      value={password}
    />
  );

  return (
    <form className={formClassName} method="post" noValidate onSubmit={onSubmit}>
      {variant === "card" && (
        <div>
          <h1>{getHeading(mode)}</h1>
          {isRecovery && <p>Te enviaremos un enlace de recuperación de un solo uso.</p>}
        </div>
      )}

      {feedbackElement}

      {variant === "landing" ? (
        <label className={`landing-field ${errors.email ? "is-invalid" : ""}`}>
          <span className="sr-only">Correo electrónico</span>
          <EnvelopeSimple aria-hidden="true" size={21} />
          {emailInput}
        </label>
      ) : (
        <>
          <label htmlFor="auth-email">Correo</label>
          {emailInput}
        </>
      )}
      {errors.email && (
        <p className="auth-field-error" id="auth-email-error">
          {errors.email}
        </p>
      )}

      {!isRecovery && (
        <>
          {variant === "landing" ? (
            <label className={`landing-field ${errors.password ? "is-invalid" : ""}`}>
              <span className="sr-only">Contraseña</span>
              <LockKey aria-hidden="true" size={21} />
              {passwordInput}
              <button
                aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                onClick={() => setShowPassword((value) => !value)}
                type="button"
              >
                {showPassword ? <EyeSlash size={21} /> : <Eye size={21} />}
              </button>
            </label>
          ) : (
            <>
              <label htmlFor="auth-password">Contraseña</label>
              <div className={`auth-input-shell ${errors.password ? "is-invalid" : ""}`}>
                {passwordInput}
                <button
                  aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                  onClick={() => setShowPassword((value) => !value)}
                  type="button"
                >
                  {showPassword ? <EyeSlash size={20} /> : <Eye size={20} />}
                </button>
              </div>
            </>
          )}
          {errors.password && (
            <p className="auth-field-error" id="auth-password-error">
              {errors.password}
            </p>
          )}
        </>
      )}

      {isSignUp && (
        <>
          <ul className="password-requirements" aria-label="Requisitos de contraseña">
            {passwordRequirementChecks.map((requirement) => {
              const passed = requirement.test(password);
              return (
                <li className={passed ? "is-valid" : ""} key={requirement.label}>
                  <span aria-hidden="true">{passed ? <Check size={13} weight="bold" /> : "•"}</span>
                  {requirement.label}
                </li>
              );
            })}
          </ul>
          <label htmlFor="auth-confirmPassword">Confirma la contraseña</label>
          <div className={`auth-input-shell ${errors.confirmPassword ? "is-invalid" : ""}`}>
            <input
              aria-describedby={errors.confirmPassword ? "auth-confirm-password-error" : undefined}
              aria-invalid={Boolean(errors.confirmPassword)}
              autoComplete="new-password"
              disabled={isSubmitting}
              id="auth-confirmPassword"
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
            <p className="auth-field-error" id="auth-confirm-password-error">
              {errors.confirmPassword}
            </p>
          )}
        </>
      )}

      {captchaSiteKey && (
        <TurnstileWidget
          onError={handleCaptchaError}
          onTokenChange={setCaptchaToken}
          resetKey={captchaResetKey}
          siteKey={captchaSiteKey}
        />
      )}

      {variant === "landing" && mode === "sign-in" && (
        <div className="landing-form-options is-link-only">
          <Link href="/recuperar-acceso">¿Olvidaste tu contraseña?</Link>
        </div>
      )}

      <button
        className={variant === "landing" ? "landing-submit" : "button button-primary"}
        disabled={isSubmitting || Boolean(captchaSiteKey && !captchaToken)}
        type="submit"
      >
        {isSubmitting ? "Procesando..." : getSubmitLabel(mode)}
      </button>

      {/* Temporary button to explore interface */}
      <div style={{ textAlign: "center", marginTop: "1rem" }}>
        <Link href="/dashboard" className="button button-secondary" style={{ width: "100%", textDecoration: "none", display: "inline-block" }}>
          Explorar la interfaz sin cuenta
        </Link>
      </div>

      {variant === "landing" && mode === "sign-in" && (
        <p className="landing-register">
          ¿No tienes una cuenta? <Link href="/acceder?modo=registro">Regístrate</Link>
        </p>
      )}
      {variant === "card" && mode === "sign-in" && (
        <Link className="auth-helper" href="/recuperar-acceso">
          ¿Olvidaste tu contraseña?
        </Link>
      )}
    </form>
  );
}
