import type { LearningAttemptMutationResponse } from "@cediah/contracts";

export type ActivityMutation = (
  path: string,
  method: "PATCH" | "POST",
  body: unknown,
) => Promise<LearningAttemptMutationResponse | null>;
