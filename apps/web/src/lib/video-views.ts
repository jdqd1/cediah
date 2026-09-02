const viewNumber = new Intl.NumberFormat("es");

export function formatVideoViews(count = 0) {
  const views = Number.isFinite(count) ? Math.max(0, Math.floor(count)) : 0;
  return `${viewNumber.format(views)} ${views === 1 ? "reproducción" : "reproducciones"}`;
}
