import { describe, expect, it } from "vitest";
import { interactiveTermTesting } from "../src/interactive-terms/indexer.js";

function entry(normalized: string, termId: string, priority = 0) {
  return {
    normalized,
    occurrencePolicy: "all" as const,
    priority,
    termId,
  };
}

describe("interactive-term matcher", () => {
  it("prefers the longest specific term when terms overlap", () => {
    const automaton = interactiveTermTesting.buildAutomaton([
      entry("arteria", "arteria"),
      entry("arteria mesenterica", "arteria-mesenterica"),
      entry("arteria mesenterica superior", "ams"),
    ]);

    const matches = interactiveTermTesting.findTextMatches(
      "La arteria mesentérica superior irriga el intestino medio.",
      automaton,
    );

    expect(matches).toHaveLength(1);
    expect(matches[0]?.t).toBe("ams");
    expect(matches[0]?.s).toBe(3);
    expect(matches[0]?.e).toBe(31);
  });

  it("matches accent-insensitively while preserving source offsets", () => {
    const automaton = interactiveTermTesting.buildAutomaton([
      entry("glucolisis", "glycolysis"),
    ]);

    const text = "La glucólisis ocurre en el citosol.";
    const matches = interactiveTermTesting.findTextMatches(text, automaton);

    expect(matches).toHaveLength(1);
    expect(text.slice(matches[0]!.s, matches[0]!.e)).toBe("glucólisis");
  });

  it("does not match a term inside a longer word", () => {
    const automaton = interactiveTermTesting.buildAutomaton([
      entry("arteria", "arteria"),
    ]);

    expect(interactiveTermTesting.findTextMatches("La pared arterial es elástica.", automaton)).toEqual([]);
  });

  it("uses priority to resolve identical normalized aliases", () => {
    const automaton = interactiveTermTesting.buildAutomaton([
      entry("ams", "lower", 1),
      entry("ams", "higher", 10),
    ]);

    const matches = interactiveTermTesting.findTextMatches("La AMS nace de la aorta.", automaton);
    expect(matches[0]?.t).toBe("higher");
  });
});
