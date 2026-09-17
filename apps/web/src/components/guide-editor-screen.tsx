"use client";

import { ensureQuestionIdentity } from "@cediah/contracts";
import { useEffect, useState, type ComponentProps } from "react";
import { createPortal } from "react-dom";
import type { ImportedQuizQuestion } from "@/lib/quiz-import";
import { QuizImportDropzone } from "./quiz-import-dropzone";
import { GuideEditorScreen as GuideEditorScreenBase } from "./guide-editor-screen-base";

type GuideEditorScreenProps = ComponentProps<typeof GuideEditorScreenBase>;
type GuideQuestion = GuideEditorScreenProps["draft"]["content"]["quiz"]["questions"][number];

function createQuestionId() {
  return typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `question-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function QuizImportPortal({
  busy,
  draft,
  onChange,
}: Pick<GuideEditorScreenProps, "busy" | "draft" | "onChange">) {
  const [mountNodes, setMountNodes] = useState<HTMLElement[]>([]);

  useEffect(() => {
    const connect = () => {
      const builders = Array.from(
        document.querySelectorAll<HTMLElement>(".guide-quiz-builder"),
      );

      const slots = builders.map((builder) => {
        let slot = builder.querySelector<HTMLElement>(
          ":scope > [data-guide-quiz-import-slot]",
        );
        if (!slot) {
          slot = document.createElement("div");
          slot.dataset.guideQuizImportSlot = "true";
          builder.prepend(slot);
        }
        return slot;
      });

      setMountNodes((current) => {
        const unchanged =
          current.length === slots.length &&
          current.every((node, index) => node === slots[index]);
        return unchanged ? current : slots;
      });
    };

    connect();
    const documentObserver = new MutationObserver(connect);
    documentObserver.observe(document.body, { childList: true, subtree: true });

    return () => documentObserver.disconnect();
  }, []);

  if (mountNodes.length === 0) return null;

  const questions = draft.content.quiz.questions;
  const maxQuestions = Math.max(0, 100 - questions.length);

  function importQuestions(imported: ImportedQuizQuestion[]) {
    const nextQuestions = imported.map((question) =>
      ensureQuestionIdentity(question, createQuestionId).value as GuideQuestion,
    );
    onChange({
      ...draft,
      content: {
        ...draft.content,
        quiz: { questions: [...questions, ...nextQuestions] },
      },
    } as GuideEditorScreenProps["draft"]);
  }

  return (
    <>
      {mountNodes.map((mountNode, index) =>
        createPortal(
          <QuizImportDropzone
            disabled={busy}
            maxQuestions={maxQuestions}
            onImport={importQuestions}
          />,
          mountNode,
          `guide-quiz-import-${index}`,
        ),
      )}
    </>
  );
}

export function GuideEditorScreen(props: GuideEditorScreenProps) {
  return (
    <>
      <GuideEditorScreenBase {...props} />
      <QuizImportPortal busy={props.busy} draft={props.draft} onChange={props.onChange} />
    </>
  );
}
