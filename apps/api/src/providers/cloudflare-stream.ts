import type {
  DirectVideoUpload,
  VideoAsset,
  VideoAssetStatus,
  VideoPlaybackSession,
  VideoProvider,
} from "@cediah/contracts";
import type { CloudflareStreamConfiguration } from "../config.js";

type CloudflareResponse<T> = {
  result?: T;
  success?: boolean;
};

type CloudflareDirectUpload = {
  uid?: string;
  uploadURL?: string;
};

type CloudflareVideo = {
  creator?: string;
  readyToStream?: boolean;
  status?: {
    state?: string;
  };
};

type CloudflareToken = {
  token?: string;
};

const cloudflareApiOrigin = "https://api.cloudflare.com/client/v4";
const maxPlaybackLifetimeSeconds = 24 * 60 * 60;

function toVideoAssetStatus(video: CloudflareVideo): VideoAssetStatus {
  if (video.readyToStream) return "ready";

  switch (video.status?.state) {
    case "pendingupload":
      return "waiting_for_upload";
    case "downloading":
      return "uploading";
    case "error":
      return "failed";
    case "ready":
      return "ready";
    case "inprogress":
    case "live-inprogress":
    case "queued":
    default:
      return "processing";
  }
}

async function readCloudflareResult<T>(response: Response): Promise<T> {
  let payload: CloudflareResponse<T> | undefined;

  try {
    payload = (await response.json()) as CloudflareResponse<T>;
  } catch {
    throw new Error("Cloudflare Stream returned an unreadable response");
  }

  if (!response.ok || !payload.success || !payload.result) {
    throw new Error("Cloudflare Stream rejected the request");
  }

  return payload.result;
}

export function createCloudflareStreamVideoProvider(
  configuration: CloudflareStreamConfiguration,
  allowedOrigins: readonly string[],
): VideoProvider {
  const streamPath = "/accounts/" + configuration.accountId + "/stream";

  async function request(path: string, init: RequestInit) {
    return fetch(cloudflareApiOrigin + streamPath + path, {
      ...init,
      headers: {
        Authorization: "Bearer " + configuration.apiToken,
        "Content-Type": "application/json",
        ...init.headers,
      },
    });
  }

  return {
    async createDirectUpload(input): Promise<DirectVideoUpload> {
      const response = await request("/direct_upload", {
        body: JSON.stringify({
          allowedOrigins,
          creator: input.creatorId,
          expiry: input.expiresAt,
          maxDurationSeconds: input.maxDurationSeconds,
          requireSignedURLs: true,
        }),
        method: "POST",
      });
      const result = await readCloudflareResult<CloudflareDirectUpload>(response);

      if (!result.uid || !result.uploadURL) {
        throw new Error("Cloudflare Stream omitted the direct-upload details");
      }

      return {
        expiresAt: input.expiresAt,
        externalVideoId: result.uid,
        uploadUrl: result.uploadURL,
      };
    },

    async createPlaybackSession(videoId, expiresInSeconds): Promise<VideoPlaybackSession> {
      const lifetime = Math.min(Math.max(expiresInSeconds, 60), maxPlaybackLifetimeSeconds);
      const expiresAt = new Date(Date.now() + lifetime * 1_000).toISOString();
      const response = await request("/" + encodeURIComponent(videoId) + "/token", {
        body: JSON.stringify({
          exp: Math.floor(Date.now() / 1_000) + lifetime,
        }),
        method: "POST",
      });
      const result = await readCloudflareResult<CloudflareToken>(response);

      if (!result.token) {
        throw new Error("Cloudflare Stream omitted the playback token");
      }

      return {
        expiresAt,
        iframeUrl:
          "https://customer-" +
          configuration.customerCode +
          ".cloudflarestream.com/" +
          result.token +
          "/iframe",
      };
    },

    async getVideoAsset(videoId): Promise<VideoAsset | null> {
      const response = await request("/" + encodeURIComponent(videoId), {
        method: "GET",
      });

      if (response.status === 404) return null;

      const result = await readCloudflareResult<CloudflareVideo>(response);
      return {
        creatorId: result.creator ?? null,
        status: toVideoAssetStatus(result),
      };
    },
  };
}
