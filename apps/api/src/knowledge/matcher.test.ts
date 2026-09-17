import { describe, expect, it } from "vitest";
import { KnowledgeTermMatcher, type KnowledgeMatcherAlias } from "./matcher.js";

function alias(
  sourceAlias: string,
  termId: string,
  overrides: Partial<KnowledgeMatcherAlias> = {},
): KnowledgeMatcherAlias {
  return {
    aliasId: `alias-${termId}-${sourceAlias}`,
    caseSensitive: false,
    frequency: "all",
    normalizedAlias: sourceAlias,
    priority: 0,
    sourceAlias,
    termId,
    ...overrides,
  };
}

describe("KnowledgeTermMatcher", () => {
  it("prefers the longest term when phrases overlap", () => {
    const matcher = new KnowledgeTermMatcher([
      alias("arteria", "artery"),
      alias("arteria mesentérica", "mesenteric"),
      alias("arteria mesentérica superior", "superior-mesenteric"),
    ]);

    const text = "La arteria mesentérica superior irriga gran parte del intestino.";
    const matches = matcher.find(text);

    expect(matches).toHaveLength(1);
    expect(matches[0]?.termId).toBe("superior-mesenteric");
    expect(text.slice(matches[0]?.startOffset, matches[0]?.endOffset)).toBe(
      "arteria mesentérica superior",
    );
  });

  it("matches accent-insensitively while preserving original source offsets", () => {
    const matcher = new KnowledgeTermMatcher([
      alias("glucolisis", "glycolysis"),
    ]);
    const text = "Durante la glucólisis se obtiene ATP.";
    const match = matcher.find(text)[0];

    expect(match?.termId).toBe("glycolysis");
    expect(text.slice(match?.startOffset, match?.endOffset)).toBe("glucólisis");
  });

  it("does not match aliases inside a longer word", () => {
    const matcher = new KnowledgeTermMatcher([alias("soma", "soma")]);

    expect(matcher.find("La célula somática se divide.")).toHaveLength(0);
    expect(matcher.find("El soma neuronal contiene el núcleo.")).toHaveLength(1);
  });

  it("respects explicitly case-sensitive aliases", () => {
    const matcher = new KnowledgeTermMatcher([
      alias("AMS", "superior-mesenteric", { caseSensitive: true }),
    ]);

    expect(matcher.find("La AMS nace de la aorta.")).toHaveLength(1);
    expect(matcher.find("La ams nace de la aorta.")).toHaveLength(0);
  });

  it("uses explicit priority when two aliases have the same span", () => {
    const matcher = new KnowledgeTermMatcher([
      alias("potencial de acción", "low", { priority: 1 }),
      alias("potencial de acción", "high", { priority: 10 }),
    ]);

    expect(matcher.find("Un potencial de acción despolariza la membrana.")[0]?.termId).toBe("high");
  });
});
