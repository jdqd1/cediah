export type Position = { x: number; y: number };
export type Positions = Record<string, Position>;
export function initialLayout(
  ids: string[],
  width: number,
  root = false,
  cardHeight = root ? 184 : 172,
): Positions {
  const w = root ? 168 : 156,
    h = cardHeight;
  const cols =
    root && ids.length === 6 && width >= 768
      ? 3
      : Math.max(2, Math.min(4, Math.floor((width + 56) / (w + 56))));
  return Object.fromEntries(
    ids.map((id, i) => {
      const count = Math.min(cols, ids.length - Math.floor(i / cols) * cols);
      return [
        id,
        {
          x: (i % cols) * (w + 56) + ((cols - count) * (w + 56)) / 2,
          y: Math.floor(i / cols) * (h + 64),
        },
      ];
    }),
  );
}
function overlaps(a: Position, b: Position, root: boolean, cardHeight: number) {
  return (
    Math.abs(a.x - b.x) < (root ? 168 : 156) + 24 &&
    Math.abs(a.y - b.y) < cardHeight + 24
  );
}
export function findFreePosition(
  anchor: Position,
  positions: Positions,
  root = false,
  cardHeight = root ? 184 : 172,
): Position {
  const occupied = Object.values(positions),
    w = (root ? 168 : 156) + 56,
    h = cardHeight + 64;
  if (!occupied.some((p) => overlaps(anchor, p, root, cardHeight)))
    return anchor;
  let tries = 0;
  for (let radius = 1; tries < 200; radius++) {
    const cells: Position[] = [];
    for (let k = -radius + 1; k <= radius; k++) cells.push({ x: radius, y: k });
    for (let k = radius - 1; k >= -radius; k--) cells.push({ x: k, y: radius });
    for (let k = radius - 1; k >= -radius; k--)
      cells.push({ x: -radius, y: k });
    for (let k = -radius + 1; k <= radius; k++)
      cells.push({ x: k, y: -radius });
    for (const cell of cells) {
      if (++tries > 200) break;
      const p = { x: anchor.x + cell.x * w, y: anchor.y + cell.y * h };
      if (!occupied.some((o) => overlaps(p, o, root, cardHeight))) return p;
    }
  }
  return { x: 0, y: Math.max(0, ...occupied.map((p) => p.y)) + h };
}
export function reconcileLayout(
  ids: string[],
  saved: Positions,
  width: number,
  root = false,
  cardHeight = root ? 184 : 172,
) {
  const positions = Object.fromEntries(
    Object.entries(saved).filter(([id]) => ids.includes(id)),
  );
  const initial = initialLayout(ids, width, root, cardHeight);
  for (const id of ids)
    if (!positions[id])
      positions[id] = findFreePosition(
        initial[id]!,
        positions,
        root,
        cardHeight,
      );
  return positions;
}
export function resolveDropOverlap(
  id: string,
  point: Position,
  positions: Positions,
  root = false,
  cardHeight = root ? 184 : 172,
) {
  return findFreePosition(
    point,
    Object.fromEntries(Object.entries(positions).filter(([key]) => key !== id)),
    root,
    cardHeight,
  );
}
