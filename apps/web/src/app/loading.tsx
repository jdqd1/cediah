export default function Loading() {
  return (
    <div
      className="route-loading"
      role="status"
      aria-busy="true"
      aria-live="polite"
    >
      <span className="route-loading-indicator" aria-hidden="true" />
      <p className="route-loading-label">Cargando sección…</p>
      <div className="route-loading-skeleton" aria-hidden="true">
        <span className="route-loading-skeleton-title" />
        <span className="route-loading-skeleton-line" />
        <span className="route-loading-skeleton-line route-loading-skeleton-line-short" />
      </div>
    </div>
  );
}
