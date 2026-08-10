import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import type {
  DirectVideoUpload,
  VideoAsset,
  VideoPlaybackSession,
  VideoProvider,
} from "@cediah/contracts";
import type { SupabaseStorageConfiguration } from "../config.js";

const uploadPrefix = "test-videos";
const maxPlaybackLifetimeSeconds = 60 * 60;

function videoPath(creatorId: string, videoId: string) {
  return `${uploadPrefix}/${creatorId}/${videoId}`;
}

export function createSupabaseStorageVideoProvider(
  configuration: SupabaseStorageConfiguration,
): VideoProvider {
  const client = createClient(configuration.url, configuration.secretKey, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
    },
  });
  const bucket = client.storage.from(configuration.bucket);

  return {
    async createDirectUpload(input): Promise<DirectVideoUpload> {
      const externalVideoId = randomUUID();
      const path = videoPath(input.creatorId, externalVideoId);
      const { data, error } = await bucket.createSignedUploadUrl(path, { upsert: false });

      if (error || !data?.signedUrl || !data.path || !data.token) {
        throw new Error("Supabase Storage omitted the signed-upload details");
      }

      return {
        expiresAt: input.expiresAt,
        externalVideoId,
        storageBucket: configuration.bucket,
        uploadPath: data.path,
        uploadToken: data.token,
        uploadType: "supabase_signed",
        uploadUrl: data.signedUrl,
      };
    },

    async createPlaybackSession(
      videoId,
      expiresInSeconds,
      creatorId,
    ): Promise<VideoPlaybackSession> {
      if (!creatorId) throw new Error("Supabase playback requires the video owner");

      const lifetime = Math.min(Math.max(expiresInSeconds, 60), maxPlaybackLifetimeSeconds);
      const { data, error } = await bucket.createSignedUrl(videoPath(creatorId, videoId), lifetime);
      if (error || !data?.signedUrl) {
        throw new Error("Supabase Storage omitted the signed-playback details");
      }

      return {
        expiresAt: new Date(Date.now() + lifetime * 1_000).toISOString(),
        playbackUrl: data.signedUrl,
      };
    },

    async getVideoAsset(videoId, creatorId): Promise<VideoAsset | null> {
      if (!creatorId) return null;

      const { data, error } = await bucket.exists(videoPath(creatorId, videoId));
      if (error && data !== false) throw error;
      if (!data) return null;

      return { creatorId, status: "ready" };
    },
  };
}
