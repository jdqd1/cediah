import { normalizeGuideKeyPoint } from "@/lib/guide-key-points";

export const KEY_POINTS_IMPORT_VERSION = 1 as const;
export const MAX_KEY_POINTS_IMPORT_FILE_BYTES = 1_000_000;
export const MAX_IMPORTED_KEY_POINTS = 30;
export const MAX_KEY_POINT_LENGTH = 500;

type KeyPointsImportFile = {
  puntos_clave: string[];
  version: typeof KEY_POINTS_IMPORT_VERSION;
};

export class KeyPointsImportError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "KeyPointsImportError";
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function parseKeyPointsImportFile(raw: string): string[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw) as unknown;
  } catch {
    throw new KeyPointsImportError("El archivo no contiene JSON válido.");
  }

  if (!isRecord(parsed)) {
    throw new KeyPointsImportError("El archivo debe contener un objeto JSON.");
  }
  if (parsed.version !== KEY_POINTS_IMPORT_VERSION) {
    throw new KeyPointsImportError(`La versión del archivo debe ser ${KEY_POINTS_IMPORT_VERSION}.`);
  }
  if (!Array.isArray(parsed.puntos_clave)) {
    throw new KeyPointsImportError('El archivo debe incluir un arreglo llamado "puntos_clave".');
  }
  if (parsed.puntos_clave.length === 0) {
    throw new KeyPointsImportError("El archivo no contiene puntos clave.");
  }
  if (parsed.puntos_clave.length > MAX_IMPORTED_KEY_POINTS) {
    throw new KeyPointsImportError(`Un archivo puede contener como máximo ${MAX_IMPORTED_KEY_POINTS} puntos clave.`);
  }

  const points: string[] = [];
  const seen = new Set<string>();

  parsed.puntos_clave.forEach((value, index) => {
    if (typeof value !== "string" || !value.trim()) {
      throw new KeyPointsImportError(`Punto clave ${index + 1} debe contener texto.`);
    }

    const point = value.replace(/\s+/g, " ").trim();
    if (point.length > MAX_KEY_POINT_LENGTH) {
      throw new KeyPointsImportError(`Punto clave ${index + 1} supera los ${MAX_KEY_POINT_LENGTH} caracteres permitidos.`);
    }

    const normalized = normalizeGuideKeyPoint(point);
    if (!normalized || seen.has(normalized)) return;
    seen.add(normalized);
    points.push(point);
  });

  if (points.length === 0) {
    throw new KeyPointsImportError("El archivo no contiene puntos clave únicos para importar.");
  }

  return points;
}

export function isKeyPointsImportFile(file: Pick<File, "name" | "type">) {
  return file.name.toLowerCase().endsWith(".json") || file.type === "application/json";
}

export type { KeyPointsImportFile };
