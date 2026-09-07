export default function LearningLoading() {
  return (
    <main aria-busy="true" aria-label="Cargando Aprendizaje guiado" className="learning-main learning-loading">
      <div className="learning-skeleton learning-skeleton-hero" />
      <div className="learning-skeleton learning-skeleton-tabs" />
      <div className="learning-skeleton-heading"><span /><span /></div>
      <div className="learning-loading-layout">
        <div>
          <div className="learning-skeleton learning-skeleton-card" />
          <div className="learning-skeleton learning-skeleton-row" />
          <div className="learning-skeleton learning-skeleton-row" />
        </div>
        <div className="learning-skeleton learning-skeleton-aside" />
      </div>
      <span className="sr-only">Cargando tu progreso y próximas actividades…</span>
    </main>
  );
}
