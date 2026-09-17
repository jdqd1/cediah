import { describe, expect, it } from "vitest";
import { parseQuizImportFile, QuizImportError } from "./quiz-import";

describe("parseQuizImportFile", () => {
  it("normalizes a valid Spanish quiz import file", () => {
    expect(parseQuizImportFile(JSON.stringify({
      version: 1,
      preguntas: [
        {
          pregunta: "  ¿Cuál es la respuesta?  ",
          opciones: [" Primera ", " Segunda "],
          correcta: 2,
          explicacion: "  Porque es la segunda.  ",
        },
      ],
    }))).toEqual([
      {
        prompt: "¿Cuál es la respuesta?",
        options: ["Primera", "Segunda"],
        correctOptionIndex: 1,
        explanation: "Porque es la segunda.",
      },
    ]);
  });

  it("allows an omitted explanation", () => {
    expect(parseQuizImportFile(JSON.stringify({
      version: 1,
      preguntas: [
        {
          pregunta: "¿Pregunta?",
          opciones: ["A", "B"],
          correcta: 1,
        },
      ],
    }))[0]?.explanation).toBe("");
  });

  it("rejects a correct answer outside the available options", () => {
    expect(() => parseQuizImportFile(JSON.stringify({
      version: 1,
      preguntas: [
        {
          pregunta: "¿Pregunta?",
          opciones: ["A", "B"],
          correcta: 3,
        },
      ],
    }))).toThrow(QuizImportError);
  });

  it("rejects malformed JSON", () => {
    expect(() => parseQuizImportFile("{no-es-json")).toThrow("El archivo no contiene JSON válido.");
  });
});
