import type { MapProgress } from "@cediah/contracts";

export type EssentialStep = {
  key: string;
  completed: boolean;
  started: boolean;
  total?: number;
  completedCount?: number;
};
/** Identity is path/version/step, never resource or occurrence. */
export function aggregateMapProgress(
  steps: Iterable<EssentialStep>,
  unavailable = false,
): MapProgress {
  if (unavailable)
    return {
      status: "unavailable",
      percentage: null,
      completedEssentialSteps: null,
      totalEssentialSteps: null,
      started: false,
    };
  const unique = new Map<string, EssentialStep>();
  for (const step of steps) unique.set(step.key, step);
  const total = [...unique.values()].reduce((n, s) => n + (s.total ?? 1), 0);
  const completed = [...unique.values()].reduce(
    (n, s) => n + (s.completedCount ?? Number(s.completed)),
    0,
  );
  const started = [...unique.values()].some((s) => s.started || s.completed);
  return {
    status:
      total === 0
        ? "empty"
        : completed === total
          ? "completed"
          : started
            ? "in_progress"
            : "not_started",
    percentage:
      total === 0
        ? null
        : completed === total
          ? 100
          : Math.min(99, Math.round((100 * completed) / total)),
    completedEssentialSteps: completed,
    totalEssentialSteps: total,
    started,
  };
}
