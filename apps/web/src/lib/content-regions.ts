export function normalizeRegion(value: string) {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .trim()
    .replace(/\s+/g, " ")
    .toLocaleLowerCase("es");
}

export function cleanRegion(value: string) {
  return value.trim().replace(/\s+/g, " ").slice(0, 120);
}

export function uniqueRegions(values: readonly string[]) {
  const seen = new Set<string>();
  return values.flatMap((value) => {
    const clean = cleanRegion(value);
    const key = normalizeRegion(clean);
    if (!key || seen.has(key)) return [];
    seen.add(key);
    return [clean];
  });
}
