export type KnowledgeMatchFrequency = "all" | "first_guide" | "first_section";

export type KnowledgeMatcherAlias = {
  aliasId: string;
  caseSensitive: boolean;
  frequency: KnowledgeMatchFrequency;
  normalizedAlias: string;
  priority: number;
  sourceAlias: string;
  termId: string;
};

export type KnowledgeTextMatch = {
  aliasId: string;
  endOffset: number;
  frequency: KnowledgeMatchFrequency;
  priority: number;
  startOffset: number;
  termId: string;
};

type AutomatonNode = {
  failure: number;
  next: Map<string, number>;
  outputs: number[];
};

type NormalizedText = {
  endOffsets: number[];
  startOffsets: number[];
  value: string;
};

const wordCharacter = /[\p{L}\p{N}]/u;

function normalizeCharacter(character: string) {
  return character
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLocaleLowerCase("es");
}

/**
 * Mirrors public.cediah_term_normalize while retaining a map back to UTF-16
 * source offsets. That lets the renderer slice the original text without
 * changing accents, capitalization or authored formatting.
 */
export function normalizeKnowledgeTextWithOffsets(input: string): NormalizedText {
  const normalized: string[] = [];
  const startOffsets: number[] = [];
  const endOffsets: number[] = [];
  let previousWasWhitespace = false;

  for (let offset = 0; offset < input.length;) {
    const codePoint = input.codePointAt(offset);
    if (codePoint === undefined) break;
    const sourceCharacter = String.fromCodePoint(codePoint);
    const width = sourceCharacter.length;
    const sourceEnd = offset + width;

    if (/\s/u.test(sourceCharacter)) {
      if (normalized.length > 0 && !previousWasWhitespace) {
        normalized.push(" ");
        startOffsets.push(offset);
        endOffsets.push(sourceEnd);
      }
      previousWasWhitespace = true;
      offset = sourceEnd;
      continue;
    }

    previousWasWhitespace = false;
    for (const character of normalizeCharacter(sourceCharacter)) {
      normalized.push(character);
      startOffsets.push(offset);
      endOffsets.push(sourceEnd);
    }
    offset = sourceEnd;
  }

  while (normalized[normalized.length - 1] === " ") {
    normalized.pop();
    startOffsets.pop();
    endOffsets.pop();
  }

  return { endOffsets, startOffsets, value: normalized.join("") };
}

function boundaryIsValid(value: string, start: number, endExclusive: number) {
  const first = value[start] ?? "";
  const last = value[endExclusive - 1] ?? "";
  const before = start > 0 ? value[start - 1] ?? "" : "";
  const after = endExclusive < value.length ? value[endExclusive] ?? "" : "";

  if (wordCharacter.test(first) && before && wordCharacter.test(before)) return false;
  if (wordCharacter.test(last) && after && wordCharacter.test(after)) return false;
  return true;
}

function normalizeAlias(alias: KnowledgeMatcherAlias) {
  return {
    ...alias,
    normalizedAlias: normalizeKnowledgeTextWithOffsets(alias.normalizedAlias).value,
  };
}

/**
 * Multi-pattern matcher built once for a reindex batch. Runtime is O(text +
 * matches), rather than O(aliases × text), and conflicts are resolved by
 * earliest position, longest phrase and then explicit priority.
 */
export class KnowledgeTermMatcher {
  private readonly aliases: KnowledgeMatcherAlias[];
  private readonly nodes: AutomatonNode[];

  constructor(rawAliases: KnowledgeMatcherAlias[]) {
    this.aliases = rawAliases
      .map(normalizeAlias)
      .filter((alias) => alias.normalizedAlias.length >= 2);
    this.nodes = [{ failure: 0, next: new Map(), outputs: [] }];
    this.buildTrie();
    this.buildFailureLinks();
  }

  private buildTrie() {
    this.aliases.forEach((alias, aliasIndex) => {
      let state = 0;
      for (const character of alias.normalizedAlias) {
        const existing = this.nodes[state]?.next.get(character);
        if (existing !== undefined) {
          state = existing;
          continue;
        }
        const nextState = this.nodes.length;
        this.nodes.push({ failure: 0, next: new Map(), outputs: [] });
        this.nodes[state]?.next.set(character, nextState);
        state = nextState;
      }
      this.nodes[state]?.outputs.push(aliasIndex);
    });
  }

  private buildFailureLinks() {
    const queue: number[] = [];
    for (const state of this.nodes[0]?.next.values() ?? []) {
      this.nodes[state]!.failure = 0;
      queue.push(state);
    }

    for (let cursor = 0; cursor < queue.length; cursor += 1) {
      const state = queue[cursor]!;
      for (const [character, nextState] of this.nodes[state]!.next) {
        queue.push(nextState);
        let failure = this.nodes[state]!.failure;
        while (failure !== 0 && !this.nodes[failure]!.next.has(character)) {
          failure = this.nodes[failure]!.failure;
        }
        const fallback = this.nodes[failure]!.next.get(character);
        this.nodes[nextState]!.failure = fallback ?? 0;
        this.nodes[nextState]!.outputs.push(
          ...this.nodes[this.nodes[nextState]!.failure]!.outputs,
        );
      }
    }
  }

  find(input: string): KnowledgeTextMatch[] {
    if (this.aliases.length === 0 || input.length === 0) return [];
    const normalized = normalizeKnowledgeTextWithOffsets(input);
    if (!normalized.value) return [];

    let state = 0;
    const candidates: Array<KnowledgeTextMatch & { normalizedLength: number }> = [];
    for (let index = 0; index < normalized.value.length; index += 1) {
      const character = normalized.value[index]!;
      while (state !== 0 && !this.nodes[state]!.next.has(character)) {
        state = this.nodes[state]!.failure;
      }
      state = this.nodes[state]!.next.get(character) ?? 0;

      for (const aliasIndex of this.nodes[state]!.outputs) {
        const alias = this.aliases[aliasIndex]!;
        const normalizedLength = alias.normalizedAlias.length;
        const start = index - normalizedLength + 1;
        const endExclusive = index + 1;
        if (start < 0 || !boundaryIsValid(normalized.value, start, endExclusive)) continue;

        const startOffset = normalized.startOffsets[start];
        const endOffset = normalized.endOffsets[endExclusive - 1];
        if (startOffset === undefined || endOffset === undefined || endOffset <= startOffset) continue;
        if (alias.caseSensitive) {
          const source = input.slice(startOffset, endOffset).replace(/\s+/g, " ").trim();
          const expected = alias.sourceAlias.replace(/\s+/g, " ").trim();
          if (source !== expected) continue;
        }
        candidates.push({
          aliasId: alias.aliasId,
          endOffset,
          frequency: alias.frequency,
          normalizedLength,
          priority: alias.priority,
          startOffset,
          termId: alias.termId,
        });
      }
    }

    candidates.sort((left, right) =>
      left.startOffset - right.startOffset ||
      right.normalizedLength - left.normalizedLength ||
      right.priority - left.priority ||
      left.termId.localeCompare(right.termId),
    );

    const selected: KnowledgeTextMatch[] = [];
    let occupiedUntil = -1;
    for (const candidate of candidates) {
      if (candidate.startOffset < occupiedUntil) continue;
      selected.push({
        aliasId: candidate.aliasId,
        endOffset: candidate.endOffset,
        frequency: candidate.frequency,
        priority: candidate.priority,
        startOffset: candidate.startOffset,
        termId: candidate.termId,
      });
      occupiedUntil = candidate.endOffset;
    }
    return selected;
  }
}
