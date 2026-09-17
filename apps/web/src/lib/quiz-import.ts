export const QUIZ_IMPORT_VERSION = 1 as const;
export const MAX_QUIZ_IMPORT_FILE_BYTES = 1_000_000;
export const MAX_QUIZ_IMPORT_QUESTIONS = 100;

export type ImportedQuizQuestion = {
  correctOptionIndex: number;
  explanation: string;
  options: string[];
  prompt: string;
};

type QuizImportQuestionFile = {
  correcta: number;
  explicacion?: string;
  opciones: string[];
  pregunta: string;
};

type QuizImportFile = {
  preguntas: QuizImportQuestionFile[];
  version: typeof QUIZ_IMPORT_VERSION;
};

export class QuizImportError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "QuizImportError";
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function questionLabel(index: number) {
  return `Pregunta ${index + 1}`;
}

function parseQuestion(value: unknown, index: number): ImportedQuizQuestion {
  if (!isRecord(value)) {
    throw new QuizImportError(`${questionLabel(index)} debe ser un objeto.`);
  }

  const prompt = typeof value.pregunta === "string" ? value.pregunta.trim() : "";
  if (!prompt) {
    throw new QuizImportError(`${questionLabel(index)} no tiene un enunciado válido en \"pregunta\".`);
  }
  if (prompt.length > 2_000) {
    throw new QuizImportError(`${questionLabel(index)} supera los 2000 caracteres permitidos en el enunciado.`);
  }

  if (!Array.isArray(value.opciones)) {
    throw new QuizImportError(`${questionLabel(index)} debe incluir un arreglo \"opciones\".`);
  }
  if (value.opciones.length < 2 || value.opciones.length > 8) {
    throw new QuizImportError(`${questionLabel(index)} debe tener entre 2 y 8 opciones.`);
  }

  const options = value.opciones.map((option, optionIndex) => {
    if (typeof option !== "string" || !option.trim()) {
      throw new QuizImportError(
        `${questionLabel(index)}, opción ${optionIndex + 1}: la opción debe contener texto.`,
      );
    }
    const normalized = option.trim();
    if (normalized.length > 500) {
      throw new QuizImportError(
        `${questionLabel(index)}, opción ${optionIndex + 1}: supera los 500 caracteres permitidos.`,
      );
    }
    return normalized;
  });

  if (!Number.isInteger(value.correcta)) {
    throw new QuizImportError(`${questionLabel(index)} debe indicar \"correcta\" con un número entero.`);
  }
  const correctAnswer = value.correcta as number;
  if (correctAnswer < 1 || correctAnswer > options.length) {
    throw new QuizImportError(
      `${questionLabel(index)} tiene una respuesta correcta fuera de rango. Usa 1 para la primera opción, 2 para la segunda, etc.`,
    );
  }

  if (value.explicacion !== undefined && typeof value.explicacion !== "string") {
    throw new QuizImportError(`${questionLabel(index)} debe usar texto en \"explicacion\".`);
  }
  const explanation = typeof value.explicacion === "string" ? value.explicacion.trim() : "";
  if (explanation.length > 4_000) {
    throw new QuizImportError(`${questionLabel(index)} supera los 4000 caracteres permitidos en la explicación.`);
  }

  return {
    correctOptionIndex: correctAnswer - 1,
    explanation,
    options,
    prompt,
  };
}

export function parseQuizImportFile(raw: string): ImportedQuizQuestion[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw) as unknown;
  } catch {
    throw new QuizImportError("El archivo no contiene JSON válido.");
  }

  if (!isRecord(parsed)) {
    throw new QuizImportError("El archivo debe contener un objeto JSON.");
  }
  if (parsed.version !== QUIZ_IMPORT_VERSION) {
    throw new QuizImportError(`La versión del archivo debe ser ${QUIZ_IMPORT_VERSION}.`);
  }
  if (!Array.isArray(parsed.preguntas)) {
    throw new QuizImportError('El archivo debe incluir un arreglo llamado "preguntas".');
  }
  if (parsed.preguntas.length === 0) {
    throw new QuizImportError("El archivo no contiene preguntas.");
  }
  if (parsed.preguntas.length > MAX_QUIZ_IMPORT_QUESTIONS) {
    throw new QuizImportError(`Un archivo puede contener como máximo ${MAX_QUIZ_IMPORT_QUESTIONS} preguntas.`);
  }

  return parsed.preguntas.map(parseQuestion);
}

export function isQuizImportFile(file: Pick<File, "name" | "type">) {
  return file.name.toLowerCase().endsWith(".json") || file.type === "application/json";
}

export type { QuizImportFile, QuizImportQuestionFile };
