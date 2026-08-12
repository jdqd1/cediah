"use client";

import Image from "next/image";
import Link from "next/link";
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  BookmarkSimple,
  DownloadSimple,
  HighlighterCircle,
  MagnifyingGlassMinus,
  MagnifyingGlassPlus,
  NotePencil,
  Printer,
  ShareNetwork,
  Star,
  SunDim,
} from "@phosphor-icons/react";
import { useState } from "react";
import { AppShell } from "./app-shell";

type GuideIndexItem = {
  active?: boolean;
  label: string;
  level: number;
  open?: boolean;
};

const indexItems: readonly GuideIndexItem[] = [
  { label: "1. Introducción", level: 0, active: true },
  { label: "2. Anatomía de superficie", level: 0 },
  { label: "3. Músculos del compartimento anterior", level: 0, open: true },
  { label: "3.1. M. sartorio", level: 1 },
  { label: "3.2. M. cuádriceps femoral", level: 1, open: true },
  { label: "3.2.1. M. recto femoral", level: 2 },
  { label: "3.2.2. M. vasto lateral", level: 2 },
  { label: "3.2.3. M. vasto medial", level: 2 },
  { label: "3.2.4. M. vasto intermedio", level: 2 },
  { label: "4. Inervación", level: 0 },
  { label: "5. Irrigación", level: 0 },
  { label: "6. Relaciones clínicas", level: 0 },
  { label: "7. Resumen", level: 0 },
  { label: "8. Referencias", level: 0 },
] as const;

const bookmarks = [
  { color: "amber", text: "El cuádriceps femoral es el principal extensor de la rodilla.", page: "p. 3" },
  { color: "green", text: "Origen del músculo recto femoral en la EIAI.", page: "p. 5" },
  { color: "purple", text: "Inervación: nervio femoral (L2–L4).", page: "p. 5" },
] as const;

export function GuideReaderScreen({ isAdministrator = false }: { isAdministrator?: boolean }) {
  const [highlightImportant, setHighlightImportant] = useState(true);
  const [summaryMode, setSummaryMode] = useState(false);
  const [fontScale, setFontScale] = useState(100);
  const [saved, setSaved] = useState(false);

  return (
    <AppShell
      activeKey="guides"
      isAdministrator={isAdministrator}
      breadcrumbs={["Guías de estudio", "Miembro inferior", "Músculos", "Guía: Músculos del compartimento anterior"]}
      headerTitle="Guía: Músculos del compartimento anterior del muslo"
      mainClassName="guide-reader-main"
    >
      <section className="guide-reader-toolbar">
        <div className="guide-reader-title-row">
          <div>
            <h2>Guía: Músculos del compartimento anterior del muslo</h2>
            <span className="guide-version-pill">Versión extensa</span>
          </div>
          <Link className="back-to-guide" href="/guias"><ArrowLeft size={17} /> Volver a guías</Link>
        </div>
        <div className="guide-reader-actions">
          <button className={`toggle-action ${highlightImportant ? "is-on" : ""}`} type="button" onClick={() => setHighlightImportant((value) => !value)}>
            <HighlighterCircle size={20} /> Resaltar lo importante <span className="switch-control"><i /></span>
          </button>
          <button className={`toggle-action ${summaryMode ? "is-on" : ""}`} type="button" onClick={() => setSummaryMode((value) => !value)}>
            Versión resumida <span className="switch-control"><i /></span>
          </button>
          <span className="toolbar-separator" />
          <button className="reader-action-button" type="button"><DownloadSimple size={20} /> Descargar</button>
          <button className="reader-action-button" type="button"><Printer size={20} /> Imprimir</button>
          <span className="toolbar-separator" />
          <button className={`reader-action-button ${saved ? "is-saved" : ""}`} type="button" onClick={() => setSaved((value) => !value)}><Star size={20} weight={saved ? "fill" : "regular"} /> Favorito</button>
          <button className="reader-action-button" type="button"><ShareNetwork size={20} /> Compartir</button>
        </div>
      </section>

      <div className="guide-reader-grid">
        <aside className="guide-index panel-surface" aria-labelledby="index-title">
          <h3 id="index-title">Índice de la guía</h3>
          <ol>
            {indexItems.map((item) => (
              <li className={`${item.active ? "is-active" : ""} level-${item.level}`} key={item.label}>
                <button type="button">{item.label}{item.open && <ArrowDown size={14} />}</button>
              </li>
            ))}
          </ol>
          <button className="download-index" type="button">Descargar índice <DownloadSimple size={17} /></button>
        </aside>

        <article className={`guide-article panel-surface ${summaryMode ? "is-summary" : ""}`}>
          <h3>1. INTRODUCCIÓN</h3>
          <p>
            El compartimento anterior del muslo está formado por el <mark className={highlightImportant ? "is-highlighted" : ""}>músculo sartorio</mark> y el <mark className={highlightImportant ? "is-highlighted" : ""}>músculo cuádriceps femoral</mark> (recto femoral, vasto lateral, vasto medial y vasto intermedio). Estos músculos son principalmente <mark className={highlightImportant ? "is-highlighted" : ""}>extensores de la rodilla</mark> y algunos también participan en la flexión de la cadera.
          </p>
          <div className="key-point-callout"><HighlighterCircle size={26} /><div><strong>PUNTO CLAVE</strong><p>El cuádriceps femoral es el principal extensor de la rodilla y juega un papel fundamental en actividades como caminar, subir escaleras y levantarse.</p></div></div>
          <hr />
          <h4>3.2. MÚSCULO CUÁDRICEPS FEMORAL</h4>
          <div className="article-image-wrap"><div><p>Formado por cuatro vientres musculares que rodean el fémur y convergen en un tendón común que se inserta en la tuberosidad tibial a través del tendón rotuliano.</p><h4>3.2.1. Músculo recto femoral</h4><ul><li><strong>Origen:</strong> espina ilíaca anteroinferior y borde superior del acetábulo.</li><li><strong>Inserción:</strong> tuberosidad tibial a través del tendón rotuliano.</li><li><strong>Inervación:</strong> nervio femoral (L2–L4).</li><li><strong>Acción:</strong> flexiona la cadera y extiende la rodilla.</li><li><strong>Irrigación:</strong> arteria femoral y ramas musculares.</li></ul></div><figure><Image src="/anatomy/thigh-light.png" alt="Vista anterior del músculo del muslo" fill sizes="320px" /><figcaption>Vista anterior del muslo derecho.</figcaption></figure></div>
          <div className="clinical-callout"><NotePencil size={25} /><div><strong>RELACIÓN CLÍNICA</strong><p>Lesiones del tendón del cuádriceps o del tendón rotuliano pueden comprometer la extensión de la rodilla.</p></div></div>
        </article>

        <aside className="guide-reader-side">
          <section className="reader-tools panel-surface">
            <h3>Herramientas de lectura</h3>
            <div className="reader-tool-row"><span>Aa</span><span>Tamaño de texto</span><span className="font-size-control"><button type="button" onClick={() => setFontScale((value) => Math.max(85, value - 5))}><MagnifyingGlassMinus size={17} /></button><strong>{fontScale}%</strong><button type="button" onClick={() => setFontScale((value) => Math.min(120, value + 5))}><MagnifyingGlassPlus size={17} /></button></span></div>
            <div className="reader-tool-row"><SunDim size={20} /><span>Modo de enfoque</span><button className="muted-switch" type="button"><i /></button></div>
            <button className="reader-tool-row reader-tool-link" type="button"><NotePencil size={20} /><span>Notas personales</span><ArrowRight size={16} /></button>
            <button className="reader-tool-row reader-tool-link" type="button"><BookmarkSimple size={20} /><span>Añadir marcador</span><ArrowRight size={16} /></button>
          </section>
          <section className="reader-bookmarks panel-surface"><div className="reader-side-title"><h3>Marcadores guardados <small>{bookmarks.length}</small></h3><ArrowUpRight size={17} /></div>{bookmarks.map((bookmark) => <div className="bookmark-row" key={bookmark.text}><i className={`bookmark-dot ${bookmark.color}`} /><span>{bookmark.text}</span><small>{bookmark.page}</small></div>)}<button className="full-width-outline" type="button">Ver todos los marcadores</button></section>
          <section className="reader-notes panel-surface"><div className="reader-side-title"><h3>Notas rápidas</h3><button type="button" aria-label="Añadir nota"><span>+</span></button></div><div className="note-card"><p>Revisar irrigación detallada en atlas anatómico.</p><small>Hoy, 10:42 a. m.</small><button type="button" aria-label="Eliminar nota">×</button></div></section>
        </aside>
      </div>

      <section className="guide-reader-pagination">
        <div className="reader-progress-label"><strong>8% completado</strong><span><i /></span></div>
        <div className="reader-page-controls"><button type="button"><ArrowLeft size={18} /><span><small>Sección anterior</small>2. Anatomía de superficie</span></button><button type="button" className="next-section"><span><small>Siguiente sección</small>3.2.2. M. vasto lateral</span><ArrowRight size={18} /></button></div>
      </section>
    </AppShell>
  );
}
