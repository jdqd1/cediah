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
  const [mountNode, setMountNode] = useState<HTMLElement | null>(null);
  const [panelDisabled, setPanelDisabled] = useState(true);

  useEffect(() => {
    let panelObserver: MutationObserver | null = null;

    const connect = () => {
      const builder = document.querySelector<HTMLElement>(".guide-quiz-builder");
      if (!builder) {
        setMountNode(null);
        setPanelDisabled(true);
        panelObserver?.disconnect();
        panelObserver = null;
        return;
      }

      let slot = builder.querySelector<HTMLElement>(":scope > [data-guide-quiz-import-slot]");
      if (!slot) {
        slot = document.createElement("div");
        slot.dataset.guideQuizImportSlot = "true";
        builder.prepend(slot);
      }
      setMountNode(slot);

      const syncDisabled = () => {
        const addButton = builder.querySelector<HTMLButtonElement>("button.guide-panel-add");
        setPanelDisabled(addButton?.disabled ?? true);
      };
      syncDisabled();

      panelObserver?.disconnect();
      panelObserver = new MutationObserver(syncDisabled);
      panelObserver.observe(builder, {
        attributes: true,
        attributeFilter: ["disabled"],
        subtree: true,
      });
    };

    connect();
    const documentObserver = new MutationObserver(connect);
    documentObserver.observe(document.body, { childList: true, subtree: true });

    return () => {
      documentObserver.disconnect();
      panelObserver?.disconnect();
    };
  }, []);

  if (!mountNode) return null;

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

  return createPortal(
    <QuizImportDropzone
      disabled={busy || panelDisabled}
      maxQuestions={maxQuestions}
      onImport={importQuestions}
    />,
    mountNode,
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
