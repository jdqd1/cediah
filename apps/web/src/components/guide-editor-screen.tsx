"use client";

import { ensureQuestionIdentity } from "@cediah/contracts";
import { useEffect, useState, type ComponentProps } from "react";
import { createPortal } from "react-dom";
import {
  appendDiscoveredGuideKeyPoints,
  normalizeGuideKeyPoint,
} from "@/lib/guide-key-points";
import type { ImportedQuizQuestion } from "@/lib/quiz-import";
import { GuideEditorScreen as GuideEditorScreenBase } from "./guide-editor-screen-base";
import { KeyPointsImportDropzone } from "./key-points-import-dropzone";
import { QuizImportDropzone } from "./quiz-import-dropzone";

type GuideEditorScreenProps = ComponentProps<typeof GuideEditorScreenBase>;
type GuideQuestion = GuideEditorScreenProps["draft"]["content"]["quiz"]["questions"][number];

type KeyPointImportResult =
  | { added: number }
  | { error: string };

function createQuestionId() {
  return typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `question-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function sameNodes(current: HTMLElement[], next: HTMLElement[]) {
  return current.length === next.length && current.every((node, index) => node === next[index]);
}

function ensureSlot(builder: HTMLElement, attribute: "guideKeyPointsImportSlot" | "guideQuizImportSlot") {
  const selector = attribute === "guideKeyPointsImportSlot"
    ? ":scope > [data-guide-key-points-import-slot]"
    : ":scope > [data-guide-quiz-import-slot]";
  let slot = builder.querySelector<HTMLElement>(selector);
  if (!slot) {
    slot = document.createElement("div");
    slot.dataset[attribute] = "true";
    builder.prepend(slot);
  }
  return slot;
}

function findKeyPointBuilders() {
  const builders = new Set<HTMLElement>();

  document.querySelectorAll<HTMLElement>(".guide-companion-panel").forEach((panel) => {
    const label = panel.querySelector<HTMLElement>("header button")?.textContent?.toLocaleLowerCase("es") ?? "";
    if (!label.includes("puntos clave")) return;
    const body = panel.querySelector<HTMLElement>(".guide-companion-body");
    if (body) builders.add(body);
  });

  document.querySelectorAll<HTMLButtonElement>("button.guide-panel-add").forEach((button) => {
    const label = button.textContent?.toLocaleLowerCase("es") ?? "";
    if (!label.includes("punto clave") && !label.includes("añadir selección")) return;
    const body = button.closest<HTMLElement>(".guide-companion-body");
    if (body) builders.add(body);
  });

  return Array.from(builders);
}

function GuideImportPortals({
  busy,
  draft,
  editable,
  onChange,
  status = "draft",
}: Pick<GuideEditorScreenProps, "busy" | "draft" | "editable" | "onChange" | "status">) {
  const [quizMountNodes, setQuizMountNodes] = useState<HTMLElement[]>([]);
  const [keyPointMountNodes, setKeyPointMountNodes] = useState<HTMLElement[]>([]);
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    const connect = () => {
      const quizSlots = Array.from(
        document.querySelectorAll<HTMLElement>(".guide-quiz-builder"),
      ).map((builder) => ensureSlot(builder, "guideQuizImportSlot"));

      const keyPointSlots = findKeyPointBuilders().map((builder) =>
        ensureSlot(builder, "guideKeyPointsImportSlot"),
      );

      setQuizMountNodes((current) => sameNodes(current, quizSlots) ? current : quizSlots);
      setKeyPointMountNodes((current) => sameNodes(current, keyPointSlots) ? current : keyPointSlots);
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

  const questions = draft.content.quiz.questions;
  const keyPoints = draft.content.keyPoints;
  const maxQuestions = Math.max(0, 100 - questions.length);
  const maxKeyPoints = Math.max(0, 30 - keyPoints.length);
  const canEdit = editable && status !== "published";
  const requiresEdit = !isEditing && canEdit && !busy;

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

  function importKeyPoints(imported: string[]): KeyPointImportResult {
    const existing = new Set(keyPoints.map(normalizeGuideKeyPoint).filter(Boolean));
    const newPoints = imported.filter((point) => !existing.has(normalizeGuideKeyPoint(point)));

    if (newPoints.length > maxKeyPoints) {
      return {
        error: `El archivo contiene ${newPoints.length} puntos nuevos y solo quedan ${maxKeyPoints} espacios.`,
      };
    }

    const nextKeyPoints = appendDiscoveredGuideKeyPoints(keyPoints, imported, 30);
    const added = nextKeyPoints.length - keyPoints.length;
    if (added > 0) {
      onChange({
        ...draft,
        content: {
          ...draft.content,
          keyPoints: nextKeyPoints,
        },
      } as GuideEditorScreenProps["draft"]);
    }

    return { added };
  }

  return (
    <>
      {keyPointMountNodes.map((mountNode, index) =>
        createPortal(
          <KeyPointsImportDropzone
            disabled={busy || !canEdit}
            maxPoints={maxKeyPoints}
            onImport={importKeyPoints}
            onRequestEdit={requestEdit}
            requiresEdit={requiresEdit}
          />,
          mountNode,
          `guide-key-points-import-${index}`,
        ),
      )}
      {quizMountNodes.map((mountNode, index) =>
        createPortal(
          <QuizImportDropzone
            disabled={busy || !canEdit}
            maxQuestions={maxQuestions}
            onImport={importQuestions}
            onRequestEdit={requestEdit}
            requiresEdit={requiresEdit}
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
      <GuideImportPortals
        busy={props.busy}
        draft={props.draft}
        editable={props.editable}
        onChange={props.onChange}
        status={props.status}
      />
    </>
  );
}
