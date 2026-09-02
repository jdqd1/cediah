import { describe, expect, it } from "vitest";
import { quizPerformance, studyProgress } from "./study-progress";

describe("study sessions", () => {
  it("uses completed items instead of the visible question number", () => {
    expect(studyProgress(0, 3)).toEqual({ value: 0, tone: "start" });
    expect(studyProgress(1, 3)).toEqual({ value: 1, tone: "progress" });
    expect(studyProgress(3, 3)).toEqual({ value: 3, tone: "complete" });
    expect(studyProgress(4, 3).value).toBe(3);
  });
  it("gives appropriate feedback for low, partial and high scores", () => {
    expect(quizPerformance(0, 3).tone).toBe("review");
    expect(quizPerformance(2, 3).tone).toBe("developing");
    expect(quizPerformance(3, 3).tone).toBe("excellent");
    expect(quizPerformance(0, 0).percentage).toBe(0);
  });
});
