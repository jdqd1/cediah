"use client";

import {
  type ChangeEvent,
  type FormEvent,
  useCallback,
  useEffect,
  useState,
} from "react";
import type {
  TestVideoAssetResponse,
  TestVideoUploadResponse,
} from "@cediah/contracts";

type UploadPhase = "error" | "idle" | "processing" | "provisioning" | "ready" | "uploading";

type VideoConstraints = TestVideoUploadResponse["constraints"];

const acceptedMimeTypes = new Set(["video/mp4", "video/quicktime", "video/webm"]);
const directUploadMaximumBytes = 200_000_000;

const errorMessages: Record<string, string> = {
  forbidden:
    "Esta cuenta no está autorizada para las pruebas de video. Debe agregarse su UUID en el servidor.",
  identity_unavailable:
    "La identidad no está disponible en este ambiente. Inicia sesión de nuevo después de completar la configuración.",
  invalid_video_test_upload:
    "El archivo no cumple los requisitos de la prueba. Selecciona un MP4, WebM o MOV con un nombre de archivo válido.",
  not_found:
    "La prueba ya no está disponible para esta cuenta.",
  unauthorized: "Tu sesión terminó. Vuelve a iniciar sesión para solicitar una carga.",
  video_test_file_too_large:
    "El archivo supera el límite configurado para esta prueba. Usa un video más pequeño.",
  video_test_duration_too_long:
    "El video supera la duración configurada para esta prueba. Usa un video más corto.",
  video_test_unavailable:
    "La prueba de video no está configurada o el proveedor no respondió. Inténtalo cuando el servidor esté listo.",
};

function formatBytes(value: number) {
  if (value >= 1_000_000) return (value / 1_000_000).toFixed(value >= 10_000_000 ? 0 : 1) + " MB";
  return Math.ceil(value / 1_000) + " KB";
}

function getErrorCode(value: unknown) {
  if (
    typeof value === "object" &&
    value !== null &&
    "error" in value &&
    typeof value.error === "string"
  ) {
    return value.error;
  }

  return "video_test_unavailable";
}

function getErrorMessage(error: unknown) {
  const code = error instanceof Error ? error.message : "video_test_unavailable";
  return errorMessages[code] ?? errorMessages.video_test_unavailable;
}

function readVideoDurationSeconds(file: File): Promise<number> {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    const objectUrl = URL.createObjectURL(file);
    const finish = () => {
      video.removeAttribute("src");
      video.load();
      URL.revokeObjectURL(objectUrl);
    };

    video.preload = "metadata";
    video.addEventListener(
      "loadedmetadata",
      () => {
        const duration = video.duration;
        finish();
        if (Number.isFinite(duration) && duration > 0) {
          resolve(duration);
          return;
        }
        reject(new Error("invalid_video_test_upload"));
      },
      { once: true },
    );
    video.addEventListener(
      "error",
      () => {
        finish();
        reject(new Error("invalid_video_test_upload"));
      },
      { once: true },
    );
    video.src = objectUrl;
  });
}

function isTestVideoUploadResponse(value: unknown): value is TestVideoUploadResponse {
  if (typeof value !== "object" || value === null || !("constraints" in value) || !("upload" in value)) {
    return false;
  }

  const { constraints, upload } = value;
  return (
    typeof constraints === "object" &&
    constraints !== null &&
    "maxDurationSeconds" in constraints &&
    typeof constraints.maxDurationSeconds === "number" &&
    "maxFileSizeBytes" in constraints &&
    typeof constraints.maxFileSizeBytes === "number" &&
    typeof upload === "object" &&
    upload !== null &&
    "externalVideoId" in upload &&
    typeof upload.externalVideoId === "string" &&
    "uploadUrl" in upload &&
    typeof upload.uploadUrl === "string"
  );
}

function isTestVideoAssetResponse(value: unknown): value is TestVideoAssetResponse {
  return (
    typeof value === "object" &&
    value !== null &&
    "videoId" in value &&
    typeof value.videoId === "string" &&
    "status" in value &&
    typeof value.status === "string"
  );
}

function uploadFile(
  upload: TestVideoUploadResponse["upload"],
  file: File,
  onProgress: (percent: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    if (upload.uploadType === "signed_put") {
      request.open("PUT", upload.uploadUrl);
      request.setRequestHeader("Content-Type", file.type);
    } else {
      const formData = new FormData();
      formData.append("file", file);
      request.open("POST", upload.uploadUrl);
      request.upload.addEventListener("progress", (event) => {
        if (event.lengthComputable) onProgress(Math.round((event.loaded / event.total) * 100));
      });
      request.addEventListener("error", () => reject(new Error("video_test_unavailable")));
      request.addEventListener("load", () => {
        if (request.status >= 200 && request.status < 300) {
          resolve();
          return;
        }
        reject(new Error("video_test_unavailable"));
      });
      request.send(formData);
      return;
    }
    request.upload.addEventListener("progress", (event) => {
      if (event.lengthComputable) onProgress(Math.round((event.loaded / event.total) * 100));
    });
    request.addEventListener("error", () => reject(new Error("video_test_unavailable")));
    request.addEventListener("load", () => {
      if (request.status >= 200 && request.status < 300) {
        resolve();
        return;
      }
      reject(new Error("video_test_unavailable"));
    });
    request.send(file);
  });
}

export function VideoTestUploader() {
  const [asset, setAsset] = useState<TestVideoAssetResponse | undefined>(undefined);
  const [constraints, setConstraints] = useState<VideoConstraints | undefined>(undefined);
  const [errorMessage, setErrorMessage] = useState<string | undefined>(undefined);
  const [file, setFile] = useState<File | undefined>(undefined);
  const [phase, setPhase] = useState<UploadPhase>("idle");
  const [progress, setProgress] = useState(0);
  const [videoId, setVideoId] = useState<string | undefined>(undefined);

  const checkStatus = useCallback(async (id: string) => {
    try {
      const response = await fetch("/api/video-tests/" + encodeURIComponent(id), {
        cache: "no-store",
      });
      const body: unknown = await response
        .json()
        .catch(() => ({ error: "video_test_unavailable" }));
      if (!response.ok) throw new Error(getErrorCode(body));
      if (!isTestVideoAssetResponse(body)) throw new Error("video_test_unavailable");

      setAsset(body);
      setVideoId(body.videoId);
      if (body.status === "ready" && (body.iframeUrl || body.playbackUrl)) {
        setErrorMessage(undefined);
        setPhase("ready");
        return;
      }
      if (body.status === "failed") {
        setErrorMessage(
          "El proveedor no pudo procesar este archivo. Prueba con un MP4, WebM o MOV compatible.",
        );
        setPhase("error");
        return;
      }

      setErrorMessage(undefined);
      setPhase("processing");
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
      setPhase("error");
    }
  }, []);

  useEffect(() => {
    if (phase !== "processing" || !videoId) return;

    const interval = window.setInterval(() => {
      void checkStatus(videoId);
    }, 5_000);
    return () => window.clearInterval(interval);
  }, [checkStatus, phase, videoId]);

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const selectedFile = event.target.files?.[0];
    setErrorMessage(undefined);
    setProgress(0);

    if (!selectedFile) {
      setFile(undefined);
      return;
    }
    if (!acceptedMimeTypes.has(selectedFile.type)) {
      setFile(undefined);
      setPhase("error");
      setErrorMessage("Selecciona un archivo MP4, WebM o MOV.");
      return;
    }
    if (selectedFile.size > directUploadMaximumBytes) {
      setFile(undefined);
      setPhase("error");
      setErrorMessage("Para esta carga directa de prueba, el archivo debe pesar menos de 200 MB.");
      return;
    }

    setFile(selectedFile);
    setPhase("idle");
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!file) {
      setPhase("error");
      setErrorMessage("Selecciona primero el video de prueba.");
      return;
    }

    setAsset(undefined);
    setErrorMessage(undefined);
    setPhase("provisioning");
    setProgress(0);

    try {
      const durationSeconds = await readVideoDurationSeconds(file);
      const provisionResponse = await fetch("/api/video-tests/uploads", {
        body: JSON.stringify({
          durationSeconds,
          fileName: file.name,
          fileSizeBytes: file.size,
          mimeType: file.type,
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const provisionBody: unknown = await provisionResponse
        .json()
        .catch(() => ({ error: "video_test_unavailable" }));
      if (!provisionResponse.ok) throw new Error(getErrorCode(provisionBody));
      if (!isTestVideoUploadResponse(provisionBody)) throw new Error("video_test_unavailable");

      setConstraints(provisionBody.constraints);
      setVideoId(provisionBody.upload.externalVideoId);
      setPhase("uploading");
      await uploadFile(provisionBody.upload, file, setProgress);
      setProgress(100);
      setPhase("processing");
      void checkStatus(provisionBody.upload.externalVideoId);
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
      setPhase("error");
    }
  }

  const isBusy = phase === "provisioning" || phase === "uploading" || phase === "processing";
  const isProcessing = phase === "processing";

  return (
    <section className="video-test-uploader" aria-labelledby="video-test-upload-title">
      <div className="video-test-uploader-heading">
        <p className="eyebrow dark">Carga privada de prueba</p>
        <h2 id="video-test-upload-title">Sube un video para probar el reproductor.</h2>
        <p>
          El enlace de carga vence en pocos minutos y queda limitado a la ruta privada de esta
          prueba. El archivo no se publica en cursos, no habilita matrículas y requiere una sesión
          firmada para reproducirse.
        </p>
      </div>

      <form className="video-test-form" onSubmit={handleSubmit}>
        <label htmlFor="test-video-file">Archivo de prueba</label>
        <input
          accept="video/mp4,video/quicktime,video/webm"
          disabled={isBusy}
          id="test-video-file"
          onChange={handleFileChange}
          type="file"
        />
        <p className="video-test-file-note">
          MP4, WebM o MOV. Máximo técnico para carga directa: 200 MB. El servidor confirma el
          límite específico antes de emitir el enlace.
        </p>

        {file ? (
          <p className="video-test-selection" aria-live="polite">
            <strong>{file.name}</strong>
            <span>{formatBytes(file.size)}</span>
          </p>
        ) : null}

        {phase === "uploading" ? (
          <div className="video-test-progress" aria-label={"Carga " + progress + "%"}>
            <progress max="100" value={progress} />
            <span>{progress}% cargado</span>
          </div>
        ) : null}

        {isProcessing ? (
          <p className="video-test-status" aria-live="polite">
            El proveedor está procesando el video. Esta página comprobará el estado automáticamente.
          </p>
        ) : null}

        {errorMessage ? (
          <p className="video-test-error" role="alert">
            {errorMessage}
          </p>
        ) : null}

        <button className="button button-primary" disabled={isBusy || !file} type="submit">
          {phase === "provisioning"
            ? "Preparando enlace privado"
            : phase === "uploading"
              ? "Subiendo video"
              : phase === "processing"
                ? "Procesando video"
                : phase === "ready"
                  ? "Subir otra prueba"
                  : "Subir video de prueba"}
        </button>
      </form>

      <dl className="video-test-constraints" aria-label="Límites vigentes de la prueba">
        <div>
          <dt>Duración reservada</dt>
          <dd>
            {constraints
              ? Math.round(constraints.maxDurationSeconds / 60) + " min"
              : "Se confirma al solicitar la carga"}
          </dd>
        </div>
        <div>
          <dt>Tamaño permitido</dt>
          <dd>
            {constraints
              ? formatBytes(constraints.maxFileSizeBytes)
              : "Se confirma al solicitar la carga"}
          </dd>
        </div>
        <div>
          <dt>Publicación</dt>
          <dd>Desactivada</dd>
        </div>
      </dl>

      {(asset?.iframeUrl || asset?.playbackUrl) && phase === "ready" ? (
        <section className="video-test-player" aria-labelledby="video-test-player-title">
          <div>
            <p className="eyebrow dark">Reproductor privado</p>
            <h3 id="video-test-player-title">El video está listo para la prueba.</h3>
          </div>
          <div className="video-test-iframe-shell">
            {asset.playbackUrl ? (
              <video
                controls
                playsInline
                preload="metadata"
                src={asset.playbackUrl}
                title="Reproductor privado de video de prueba"
              />
            ) : (
              <iframe
                allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture;"
                allowFullScreen
                referrerPolicy="strict-origin-when-cross-origin"
                src={asset.iframeUrl ?? ""}
                title="Reproductor privado de video de prueba"
              />
            )}
          </div>
          <div className="video-test-player-meta">
            <p>
              El enlace de reproducción vence a las{" "}
              {asset.expiresAt
                ? new Intl.DateTimeFormat("es-VE", {
                    hour: "2-digit",
                    minute: "2-digit",
                  }).format(new Date(asset.expiresAt))
                : "breve plazo"}
              .
            </p>
            <button
              className="video-test-refresh"
              onClick={() => {
                if (videoId) void checkStatus(videoId);
              }}
              type="button"
            >
              Renovar sesión de reproducción
            </button>
          </div>
        </section>
      ) : null}
    </section>
  );
}
