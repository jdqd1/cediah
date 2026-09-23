import type { LearningPathDetail, LearningPathStatus } from "@cediah/contracts";
import { describe, expect, it } from "vitest";
import { editorWorkflowActions } from "./editor-workflow";

function detail(status: LearningPathStatus, archivedAt: string | null = null, versionNumber = 1): LearningPathDetail {
  return {
    archivedAt,
    coverKey: "lungs",
    createdBy: "fb000000-0000-4000-8000-000000000001",
    enrollment: null,
    id: "fb000000-0000-4000-8000-000000000002",
    slug: "ruta-flujo",
    summary: "Resumen",
    title: "Ruta",
    topic: { id: "fb000000-0000-4000-8000-000000000003", title: "Tema" },
    version: {
      editVersion: 2,
      evidenceLevel: "standard",
      id: "fb000000-0000-4000-8000-000000000004",
      number: versionNumber,
      policyVersion: "guided-v1",
      publishedAt: status === "published" ? "2026-09-19T12:00:00.000Z" : null,
      releaseNotes: "",
      status,
      units: [],
    },
  };
}

describe("editor workflow capabilities", () => {
  it("sends new and editable drafts through the guarded review command", () => {
    expect(editorWorkflowActions(null, { canPublish: false, canReview: false })).toEqual(["send-review"]);
    expect(editorWorkflowActions(detail("changes_requested"), { canPublish: false, canReview: false })).toEqual(["send-review"]);
  });

  it("shows review and publication actions only to existing capabilities", () => {
    expect(editorWorkflowActions(detail("in_review"), { canPublish: false, canReview: false })).toEqual([]);
    expect(editorWorkflowActions(detail("in_review"), { canPublish: false, canReview: true })).toEqual(["changes-requested", "approve"]);
    expect(editorWorkflowActions(detail("approved"), { canPublish: false, canReview: true })).toEqual([]);
    expect(editorWorkflowActions(detail("approved"), { canPublish: true, canReview: true })).toEqual(["publish"]);
  });

  it("allows a new version only from a non-archived published route", () => {
    expect(editorWorkflowActions(detail("published"), { canPublish: false, canReview: false })).toEqual(["create-version"]);
    expect(editorWorkflowActions(detail("published"), { canPublish: true, canReview: true })).toEqual(["create-version", "archive"]);
    expect(editorWorkflowActions(detail("published", "2026-09-19T12:00:00.000Z"), { canPublish: true, canReview: true })).toEqual([]);
    expect(editorWorkflowActions(detail("archived"), { canPublish: true, canReview: true })).toEqual([]);
  });

  it("offers archiving for a later draft that retains a published version", () => {
    expect(editorWorkflowActions(detail("draft", null, 4), { canPublish: true, canReview: true }))
      .toEqual(["send-review", "archive"]);
    expect(editorWorkflowActions(detail("draft", null, 4), { canPublish: false, canReview: false }))
      .toEqual(["send-review"]);
    expect(editorWorkflowActions(detail("draft"), { canPublish: true, canReview: true }))
      .toEqual(["send-review"]);
  });
});
