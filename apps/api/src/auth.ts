import { betterAuth } from "better-auth";
import { captcha } from "better-auth/plugins";
import nodemailer from "nodemailer";
import { Pool } from "pg";
import type { IdentityProvider, IdentityRequest, ProviderUser } from "@cediah/contracts";

export type SmtpConfiguration = {
  from: string;
  host: string;
  password?: string;
  port: number;
  secure: boolean;
  user?: string;
};

export type BetterAuthConfiguration = {
  databaseUrl: string;
  publicUrl: string;
  requireEmailVerification: boolean;
  secret: string;
  smtp?: SmtpConfiguration;
  turnstileSecretKey?: string;
  trustedOrigins: string[];
};

export interface AuthService extends IdentityProvider {
  close(): Promise<void>;
  handle(request: Request): Promise<Response>;
}

function requestHeaders(input: IdentityRequest) {
  const headers = new Headers();
  if (input.authorization) headers.set("authorization", input.authorization);
  if (input.cookie) headers.set("cookie", input.cookie);
  if (input.forwardedFor) headers.set("x-forwarded-for", input.forwardedFor);
  if (input.userAgent) headers.set("user-agent", input.userAgent);
  return headers;
}

function createMailer(configuration: SmtpConfiguration | undefined) {
  if (!configuration) return undefined;

  return nodemailer.createTransport({
    auth:
      configuration.user && configuration.password
        ? { pass: configuration.password, user: configuration.user }
        : undefined,
    host: configuration.host,
    port: configuration.port,
    secure: configuration.secure,
  });
}

export function createBetterAuthService(
  configuration: BetterAuthConfiguration,
  dependencies: { pool?: Pool } = {},
): AuthService {
  const ownsPool = !dependencies.pool;
  const pool = dependencies.pool ?? new Pool({ connectionString: configuration.databaseUrl });
  const mailer = createMailer(configuration.smtp);
  const sendAuthEmail = mailer && configuration.smtp
    ? async (input: { subject: string; text: string; to: string }) => {
        await mailer.sendMail({
          from: configuration.smtp?.from,
          subject: input.subject,
          text: input.text,
          to: input.to,
        });
      }
    : undefined;

  const auth = betterAuth({
    account: {
      fields: {
        accessToken: "access_token",
        accessTokenExpiresAt: "access_token_expires_at",
        accountId: "account_id",
        createdAt: "created_at",
        idToken: "id_token",
        providerId: "provider_id",
        refreshToken: "refresh_token",
        refreshTokenExpiresAt: "refresh_token_expires_at",
        updatedAt: "updated_at",
        userId: "user_id",
      },
      modelName: "auth_accounts",
    },
    advanced: {
      cookiePrefix: "cediah",
      database: { generateId: "uuid" },
      defaultCookieAttributes: {
        httpOnly: true,
        sameSite: "lax",
        secure: new URL(configuration.publicUrl).protocol === "https:",
      },
    },
    baseURL: configuration.publicUrl,
    database: pool,
    emailAndPassword: {
      autoSignIn: true,
      enabled: true,
      maxPasswordLength: 128,
      minPasswordLength: 12,
      requireEmailVerification: configuration.requireEmailVerification,
      revokeSessionsOnPasswordReset: true,
      sendResetPassword: sendAuthEmail
        ? async ({ url, user }) => {
            await sendAuthEmail({
              subject: "Restablece tu contraseña de CEDIAH",
              text: `Abre este enlace para crear una contraseña nueva: ${url}`,
              to: user.email,
            });
          }
        : undefined,
    },
    emailVerification: sendAuthEmail
      ? {
          autoSignInAfterVerification: true,
          sendOnSignUp: configuration.requireEmailVerification,
          async sendVerificationEmail({ url, user }) {
            await sendAuthEmail({
              subject: "Verifica tu correo de CEDIAH",
              text: `Abre este enlace para verificar tu correo: ${url}`,
              to: user.email,
            });
          },
        }
      : undefined,
    plugins: configuration.turnstileSecretKey
      ? [
          captcha({
            provider: "cloudflare-turnstile",
            secretKey: configuration.turnstileSecretKey,
          }),
        ]
      : [],
    rateLimit: {
      enabled: true,
      modelName: "auth_rate_limits",
      storage: "database",
      fields: { lastRequest: "last_request" },
    },
    secret: configuration.secret,
    session: {
      fields: {
        createdAt: "created_at",
        expiresAt: "expires_at",
        ipAddress: "ip_address",
        updatedAt: "updated_at",
        userAgent: "user_agent",
        userId: "user_id",
      },
      modelName: "auth_sessions",
    },
    trustedOrigins: configuration.trustedOrigins,
    user: {
      fields: {
        createdAt: "created_at",
        emailVerified: "email_verified",
        updatedAt: "updated_at",
      },
      modelName: "auth_users",
    },
    verification: {
      fields: {
        createdAt: "created_at",
        expiresAt: "expires_at",
        updatedAt: "updated_at",
      },
      modelName: "auth_verifications",
      storeIdentifier: "hashed",
    },
  });

  return {
    async close() {
      if (ownsPool) await pool.end();
    },
    getUser: async (input): Promise<ProviderUser | null> => {
      const session = await auth.api.getSession({ headers: requestHeaders(input) });
      if (
        !session?.user.email ||
        (configuration.requireEmailVerification && !session.user.emailVerified)
      ) {
        return null;
      }
      return { email: session.user.email, id: session.user.id };
    },
    handle: (request) => auth.handler(request),
    async revokeSessions(userId) {
      await pool.query('delete from "auth_sessions" where "user_id" = $1', [userId]);
    },
  };
}
