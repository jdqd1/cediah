export type VideoObservedRange = {
  endSeconds: number;
  startSeconds: number;
};

const maximumBatchRanges = 8;
const maximumBatchSeconds = 45;
const maximumRangeSeconds = 30;

function splitRange(range: VideoObservedRange) {
  const pieces: VideoObservedRange[] = [];
  for (let start = range.startSeconds; start < range.endSeconds; start += maximumRangeSeconds) {
    pieces.push({
      endSeconds: Math.min(start + maximumRangeSeconds, range.endSeconds),
      startSeconds: start,
    });
  }
  return pieces;
}

export function compactVideoObservedRanges(ranges: VideoObservedRange[]) {
  const merged: VideoObservedRange[] = [];
  for (const range of [...ranges].sort((left, right) => left.startSeconds - right.startSeconds)) {
    if (!Number.isFinite(range.startSeconds) || !Number.isFinite(range.endSeconds) ||
      range.endSeconds <= range.startSeconds) continue;
    const previous = merged.at(-1);
    if (previous && range.startSeconds <= previous.endSeconds + 0.25) {
      previous.endSeconds = Math.max(previous.endSeconds, range.endSeconds);
    } else {
      merged.push({ ...range });
    }
  }
  return merged.flatMap(splitRange);
}

export function takeVideoObservedBatch(ranges: VideoObservedRange[]) {
  const compacted = compactVideoObservedRanges(ranges);
  const batch: VideoObservedRange[] = [];
  let seconds = 0;
  let index = 0;
  for (; index < compacted.length && batch.length < maximumBatchRanges; index += 1) {
    const range = compacted[index]!;
    const available = maximumBatchSeconds - seconds;
    if (available <= 0) break;
    const duration = range.endSeconds - range.startSeconds;
    if (duration <= available) {
      batch.push(range);
      seconds += duration;
      continue;
    }
    batch.push({ endSeconds: range.startSeconds + available, startSeconds: range.startSeconds });
    compacted[index] = { endSeconds: range.endSeconds, startSeconds: range.startSeconds + available };
    break;
  }
  return { batch, remaining: compacted.slice(index) };
}
