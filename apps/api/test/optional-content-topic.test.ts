import { describe, expect, it } from "vitest";
import { PublishableContentDraftSchema } from "@cediah/contracts";

const publishableGuide = {
  content: {
    document: null,
    keyPoints: [],
    linkedVideoId: null,
    quiz: { questions: [] },
    regions: [],
    sections: [{ body: "Contenido verificable.", heading: "Introducción" }],
  },
  estimatedMinutes: 10,
  featured: false,
  kind: "guide" as const,
  slug: "carbohidratos",
  subjectIds: ["19d4f11b-9ff1-45c2-b2b5-50686038fe42"],
  summary: "Guía de carbohidratos publicada directamente en Biología Celular.",
  title: "Carbohidratos",
};

describe("optional editorial topics", () => {
  it("allows publishable content to belong directly to a subject", () => {
    const parsed = PublishableContentDraftSchema.safeParse({
      ...publishableGuide,
      topic: "",
    });

    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.topic).toBe("");
  });

  it("keeps normal topic validation and normalization", () => {
    const parsed = PublishableContentDraftSchema.safeParse({
      ...publishableGuide,
      topic: "  Membrana celular  ",
    });

    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.topic).toBe("Membrana celular");
  });
});
