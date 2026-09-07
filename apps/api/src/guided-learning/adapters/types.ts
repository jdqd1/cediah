import type { LearningProjection } from "@cediah/contracts";

export type LearningRevisionSnapshot = {
  content: unknown;
  projection: LearningProjection;
  sourceContentId: string;
  sourceVersion: number;
  title: string;
};

export type LearningSnapshotItem = {
  id: string;
  kind: "question" | "flashcard";
  memoryVersion: number;
};

export interface ActivityAdapter<
  TPayload = unknown,
  TStudentPayload = unknown,
  TKey extends string = LearningProjection,
> {
  key: TKey;
  version: number;
  items(payload: TPayload): LearningSnapshotItem[];
  parse(content: unknown): TPayload;
  toStudentPayload(payload: TPayload): TStudentPayload;
}
