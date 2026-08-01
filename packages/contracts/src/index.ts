import { z } from "zod";

export const HealthResponseSchema = z.object({
  checkedAt: z.string().datetime(),
  environment: z.enum(["development", "test", "production"]),
  service: z.literal("cediah-api"),
  status: z.literal("ok"),
  version: z.string().regex(/^\d+\.\d+\.\d+$/),
});

export type HealthResponse = z.infer<typeof HealthResponseSchema>;

export type ProviderUser = {
  email: string;
  id: string;
};

export interface IdentityProvider {
  getUser(accessToken: string): Promise<ProviderUser | null>;
  revokeSessions(userId: string): Promise<void>;
}

export interface StorageProvider {
  createDownloadUrl(path: string, expiresInSeconds: number): Promise<string>;
  delete(path: string): Promise<void>;
  upload(path: string, body: Uint8Array, contentType: string): Promise<void>;
}

export interface VideoProvider {
  createPlaybackToken(videoId: string, expiresInSeconds: number): Promise<string>;
  getPlaybackStatus(videoId: string): Promise<"processing" | "ready" | "failed">;
}

export interface PaymentProvider {
  createPaymentIntent(input: {
    amountMinor: number;
    currency: string;
    userId: string;
  }): Promise<{ externalId: string; status: "pending" | "approved" | "rejected" }>;
}

export interface MailProvider {
  send(input: { subject: string; text: string; to: string }): Promise<{ messageId: string }>;
}
