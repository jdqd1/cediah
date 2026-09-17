"use client";

import { ensureQuestionIdentity } from "@cediah/contracts";
import { useEffect, useState, type ComponentProps } from "react";
import { createPortal } from "react-dom";
import type { ImportedQuizQuestion } from "@/lib/quiz-import";
import { GuideEditorScreen as GuideEditorScreenBase } from "./guide-editor-screen-base";
import { QuizImportDropzone } from "./quiz-import-dropzone";

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
  editable,
  onChange,
  status = "draft",
}: Pick<GuideEditorScreenProps, "busy" | "draft" | "editable" | "onChange" | "status">) {
  const [mountNodes, setMountNodes] = useState<HTMLElement[]>([]);
  const [isEditing, setIsEditing] = useState(false);

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

    const syncEditing = () => {
      setIsEditing(Boolean(document.querySelector('button[aria-label="Editando la guía"]')));
    };

    connect();
    syncEditing();

    const documentObserver = new MutationObserver(() => {
      connect();
      syncEditing();
    });
    documentObserver.observe(document.body, {
      attributes: true,
      attributeFilter: ["aria-label"],
      childList: true,
      subtree: true,
    });

    return () => documentObserver.disconnect();
  }, []);

  if (mountNodes.length === 0) return null;

  const questions = draft.content.quiz.questions;
  const maxQuestions = Math.max(0, 100 - questions.length);
  const canEdit = editable && status !== "published";

  function requestEdit() {
    document.querySelector<HTMLButtonElement>('button[aria-label="Editar la guía"]')?.click();
  }

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
            disabled={busy || !canEdit}
            maxQuestions={maxQuestions}
            onImport={importQuestions}
            onRequestEdit={requestEdit}
            requiresEdit={!isEditing && canEdit && !busy}
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
      <QuizImportPortal
        busy={props.busy}
        draft={props.draft}
        editable={props.editable}
        onChange={props.onChange}
        status={props.status}
      />
    </>
  );
}
