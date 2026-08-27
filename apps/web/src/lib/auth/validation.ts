import { z } from "zod";

export const AUTH_EMAIL_MAX_LENGTH = 254;
export const AUTH_PASSWORD_MIN_LENGTH = 12;
export const AUTH_PASSWORD_MAX_LENGTH = 128;

export type AuthFormMode =
  | "recover"
  | "sign-in"
  | "sign-up"
  | "update-password";

export type AuthFieldName = "confirmPassword" | "email" | "password";
export type AuthFieldErrors = Partial<Record<AuthFieldName, string>>;

const EmailSchema = z
  .string()
  .trim()
  .min(1, "Escribe tu correo electrónico.")
  .max(AUTH_EMAIL_MAX_LENGTH, "El correo es demasiado largo.")
  .email("Escribe un correo electrónico válido.")
  .transform((value) => value.toLowerCase());

const ExistingPasswordSchema = z
  .string()
  .min(1, "Escribe tu contraseña.")
  .max(AUTH_PASSWORD_MAX_LENGTH, "La contraseña es demasiado larga.");

export const NewPasswordSchema = z
  .string()
  .min(
    AUTH_PASSWORD_MIN_LENGTH,
    `Usa al menos ${AUTH_PASSWORD_MIN_LENGTH} caracteres.`,
  )
  .max(AUTH_PASSWORD_MAX_LENGTH, "Usa como máximo 128 caracteres.")
  .refine((value) => /[a-z]/.test(value), {
    message: "Incluye al menos una letra minúscula.",
  })
  .refine((value) => /[A-Z]/.test(value), {
    message: "Incluye al menos una letra mayúscula.",
  })
  .refine((value) => /[0-9]/.test(value), {
    message: "Incluye al menos un número.",
  })
  .refine((value) => /[^A-Za-z0-9\s]/.test(value), {
    message: "Incluye al menos un símbolo.",
  });

const RecoverSchema = z.object({ email: EmailSchema });
const SignInSchema = z.object({
  email: EmailSchema,
  password: ExistingPasswordSchema,
});
const NewPasswordFields = {
  confirmPassword: z.string().min(1, "Confirma la contraseña."),
  password: NewPasswordSchema,
} as const;

const matchingPasswords = (value: {
  confirmPassword: string;
  password: string;
}) => value.password === value.confirmPassword;

const NewPasswordFormSchema = z
  .object(NewPasswordFields)
  .refine(matchingPasswords, {
    message: "Las contraseñas no coinciden.",
    path: ["confirmPassword"],
  });
const SignUpSchema = z
  .object({ email: EmailSchema, ...NewPasswordFields })
  .refine(matchingPasswords, {
    message: "Las contraseñas no coinciden.",
    path: ["confirmPassword"],
  });

type AuthInput = {
  confirmPassword?: string;
  email?: string;
  password?: string;
};

type ValidatedAuthInputByMode = {
  recover: { email: string; mode: "recover" };
  "sign-in": { email: string; mode: "sign-in"; password: string };
  "sign-up": {
      confirmPassword: string;
      email: string;
      mode: "sign-up";
      password: string;
  };
  "update-password": {
    confirmPassword: string;
    mode: "update-password";
    password: string;
  };
};

type ValidatedAuthInput<M extends AuthFormMode> = ValidatedAuthInputByMode[M];

export type AuthValidationResult<M extends AuthFormMode = AuthFormMode> =
  | { errors: AuthFieldErrors; success: false }
  | { success: true; value: ValidatedAuthInput<M> };

function getFieldErrors(error: z.ZodError): AuthFieldErrors {
  const errors: AuthFieldErrors = {};

  for (const issue of error.issues) {
    const field = issue.path[0];
    if (
      (field === "confirmPassword" || field === "email" || field === "password") &&
      !errors[field]
    ) {
      errors[field] = issue.message;
    }
  }

  return errors;
}

export function validateAuthInput<M extends AuthFormMode>(
  mode: M,
  input: AuthInput,
): AuthValidationResult<M> {
  const schema =
    mode === "recover"
      ? RecoverSchema
      : mode === "sign-in"
        ? SignInSchema
        : mode === "sign-up"
          ? SignUpSchema
          : NewPasswordFormSchema;
  const result = schema.safeParse(input);

  if (!result.success) {
    return { errors: getFieldErrors(result.error), success: false };
  }

  return {
    success: true,
    value: { ...result.data, mode } as ValidatedAuthInput<M>,
  };
}

export const passwordRequirementChecks = [
  {
    label: `Al menos ${AUTH_PASSWORD_MIN_LENGTH} caracteres`,
    test: (value: string) => value.length >= AUTH_PASSWORD_MIN_LENGTH,
  },
  {
    label: "Una mayúscula y una minúscula",
    test: (value: string) => /[A-Z]/.test(value) && /[a-z]/.test(value),
  },
  { label: "Un número", test: (value: string) => /[0-9]/.test(value) },
  {
    label: "Un símbolo",
    test: (value: string) => /[^A-Za-z0-9\s]/.test(value),
  },
] as const;

const INVALID_REDIRECT_CHARACTERS = /[\\\u0000-\u001f\u007f]/;
const REDIRECT_BASE = new URL("https://internal.invalid");

export function getSafeNextPath(
  value: string | null | undefined,
  fallback = "/dashboard",
) {
  if (
    !value ||
    value.length > 2_048 ||
    !value.startsWith("/") ||
    value.startsWith("//") ||
    INVALID_REDIRECT_CHARACTERS.test(value)
  ) {
    return fallback;
  }

  try {
    const decoded = decodeURIComponent(value);
    if (decoded.startsWith("//") || INVALID_REDIRECT_CHARACTERS.test(decoded)) {
      return fallback;
    }

    const parsed = new URL(value, REDIRECT_BASE);
    if (parsed.origin !== REDIRECT_BASE.origin) return fallback;

    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return fallback;
  }
}

type AuthErrorLike = {
  code?: string;
  status?: number;
};

export function getPublicAuthErrorMessage(
  error: unknown,
  mode: AuthFormMode,
) {
  const authError = error as AuthErrorLike | null;
  const code = authError?.code?.toUpperCase();

  if (
    authError?.status === 429 ||
    code === "OVER_EMAIL_SEND_RATE_LIMIT" ||
    code === "OVER_REQUEST_RATE_LIMIT" ||
    code === "TOO_MANY_REQUESTS"
  ) {
    return "Has realizado demasiados intentos. Espera unos minutos antes de volver a probar.";
  }

  if (code === "CAPTCHA_FAILED" || code === "MISSING_RESPONSE" || code === "VERIFICATION_FAILED") {
    return "No pudimos verificar que eres una persona. Completa la verificación e inténtalo de nuevo.";
  }

  if ((code === "EMAIL_NOT_CONFIRMED" || code === "EMAIL_NOT_VERIFIED") && mode === "sign-in") {
    return "Confirma tu correo con el enlace que te enviamos antes de iniciar sesión.";
  }

  if (
    (code === "WEAK_PASSWORD" ||
      code === "PASSWORD_TOO_SHORT" ||
      code === "PASSWORD_TOO_LONG") &&
    (mode === "sign-up" || mode === "update-password")
  ) {
    return "La contraseña no cumple la política de seguridad. Revisa todos los requisitos.";
  }

  if (mode === "recover") {
    return "No fue posible solicitar el enlace. Inténtalo de nuevo más tarde.";
  }

  if (mode === "update-password") {
    return "No fue posible actualizar la contraseña. Solicita un enlace nuevo e inténtalo otra vez.";
  }

  return "No fue posible completar el acceso. Verifica los datos e inténtalo de nuevo.";
}
