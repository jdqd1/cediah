"use client";
import { CaretRight, X } from "@phosphor-icons/react";
import type { LearningMapSummaryResponse, MapItem } from "@cediah/contracts";
import styles from "./learning-map.module.css";

type QuickTab = "hoy" | "rutas" | "progreso";
const tabs: { key: QuickTab; label: string }[] = [
  { key: "hoy", label: "Hoy" },
  { key: "rutas", label: "Rutas" },
  { key: "progreso", label: "Progreso" },
];

export function MapQuickPanel({ tab, summary, loading, error, onTab, onClose, onOpen, onRetry }: {
  tab: QuickTab;
  summary: LearningMapSummaryResponse | null;
  loading: boolean;
  error: boolean;
  onTab: (tab: QuickTab) => void;
  onClose: () => void;
  onOpen: (item: MapItem) => void;
  onRetry: () => void;
}) {
  const nodes = summary?.nodes ?? [];
  const next = nodes.find((item) => item.availability === "available" && item.progress.status === "in_progress")
    ?? nodes.find((item) => item.availability === "available" && item.progress.status !== "completed");
  const completed = nodes.filter((item) => item.progress.status === "completed").length;
  return (
    <aside className={`${styles.panel} ${styles.quickPanel}`} aria-label="Resumen de aprendizaje">
      <div className={styles.quickPanelTop}>
        <div className={styles.quickTabs} role="tablist" aria-label="Resumen del mapa">
          {tabs.map(({ key, label }) => (
            <button key={key} type="button" role="tab" aria-selected={tab === key} onClick={() => onTab(key)}>{label}</button>
          ))}
        </div>
        <button className={styles.iconButton} aria-label="Cerrar resumen" onClick={onClose}><X size={18} /></button>
      </div>
      <div className={styles.panelScroll} role="tabpanel">
        {loading && !summary ? <p className={styles.quickMuted}>Cargando resumen…</p> : null}
        {error && !summary ? <><p className={styles.quickMuted}>No pudimos cargar el resumen.</p><button className={styles.button} onClick={onRetry}>Reintentar</button></> : null}
        {summary && tab === "hoy" ? (
          <>
            <h2>Tu próximo paso</h2>
            {next ? (
              <button className={styles.quickRoute} onClick={() => onOpen(next)}>
                <span><strong>{next.title}</strong><small>{next.progress.status === "in_progress" ? "Continúa donde quedaste" : "Lista para empezar"}</small></span>
                <CaretRight size={18} />
              </button>
            ) : <p className={styles.quickMuted}>{nodes.length ? "Todas tus rutas están al día." : "Añade contenido para comenzar."}</p>}
            {summary.progress.percentage !== null ? <p className={styles.quickFootnote}>{summary.progress.percentage} % del mapa completado</p> : null}
          </>
        ) : null}
        {summary && tab === "rutas" ? (
          <>
            <h2>Mis rutas <span className={styles.quickCount}>{nodes.length}</span></h2>
            {nodes.length ? nodes.map((item) => (
              <button className={styles.quickRoute} key={item.occurrenceId} onClick={() => onOpen(item)}>
                <span><strong>{item.title}</strong><small>{item.childCountLabel}{item.progress.percentage !== null ? ` · ${item.progress.percentage} %` : ""}</small></span>
                <CaretRight size={18} />
              </button>
            )) : <p className={styles.quickMuted}>Aún no hay rutas en tu mapa.</p>}
          </>
        ) : null}
        {summary && tab === "progreso" ? (
          <>
            <h2>Tu progreso</h2>
            <div className={styles.quickMetric}><strong>{summary.progress.percentage === null ? "—" : `${summary.progress.percentage} %`}</strong><span>del mapa completado</span></div>
            <div className={styles.quickProgressTrack} role="progressbar" aria-label="Progreso del mapa" aria-valuenow={summary.progress.percentage ?? 0} aria-valuemin={0} aria-valuemax={100}><span style={{ width: `${summary.progress.percentage ?? 0}%` }} /></div>
            <p className={styles.quickFootnote}>{completed} de {nodes.length} rutas completadas</p>
            {nodes.filter((item) => item.progress.percentage !== null).slice(0, 5).map((item) => (
              <button className={styles.quickRoute} key={item.occurrenceId} onClick={() => onOpen(item)}>
                <span><strong>{item.title}</strong><small>{item.progress.percentage} % completado</small></span>
                <CaretRight size={18} />
              </button>
            ))}
          </>
        ) : null}
      </div>
    </aside>
  );
}
