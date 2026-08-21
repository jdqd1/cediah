type QuestionWithAnswerOptions = {
  correctOptionIndex: number;
  options: string[];
};

export function questionAnswer(question: QuestionWithAnswerOptions) {
  return question.options[question.correctOptionIndex] ?? question.options.find(Boolean) ?? "";
}

export function withQuestionAnswer<T extends QuestionWithAnswerOptions>(
  question: T,
  answer: string,
): T {
  return {
    ...question,
    correctOptionIndex: 0,
    // The persisted contract still expects two options. Mirroring the answer
    // keeps existing content compatible while the product presents Q&A cards.
    options: [answer, answer],
  };
}
