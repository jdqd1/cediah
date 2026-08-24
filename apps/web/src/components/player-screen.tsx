"use client";

import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  CaretDown,
  CheckCircle,
  ClipboardText,
  ImageSquare,
  ListChecks,
  Pause,
  Play,
  Printer,
  Question,
  SpeakerHigh,
  SquaresFour,
} from "@phosphor-icons/react";
import { useState } from "react";
import { AppShell } from "./app-shell";
import { BrandFooter } from "./brand-footer";

const questions = [
  ["¿Qué músculos conforman el compartimento anterior del muslo?", "Está formado principalmente por el cuádriceps femoral (recto femoral, vasto lateral, vasto medial y vasto intermedio) y el músculo sartorio."],
  ["¿Cuál es la función principal del cuádriceps femoral?", "Extender la rodilla y participar en la flexión de la cadera (solo el recto femoral)."],
  ["¿Qué músculo es el principal extensor de la rodilla?", "El cuádriceps femoral, siendo el vasto medial el que aporta mayor fuerza en los últimos grados de extensión."],
  ["¿Qué inervación tiene el recto femoral?", "Nervio femoral (L2–L4)."],
  ["¿Qué acción realiza el músculo sartorio?", "Flexiona, abduce y rota lateralmente la cadera; flexiona la rodilla y rota medialmente la pierna."],
] as const;

const resources = [
  { title: "Guía: Músculos del muslo (compartimento anterior)", meta: "PDF  •  12 páginas", icon: ClipboardText, color: "wine" },
  { title: "Flashcards: Músculos del muslo (anterior)", meta: "32 tarjetas", icon: SquaresFour, color: "blue" },
  { title: "Banco de preguntas (Compartimento anterior)", meta: "20 preguntas", icon: ListChecks, color: "green" },
  { title: "Imágenes y esquemas relacionados", meta: "15 archivos", icon: ImageSquare, color: "amber" },
] as const;

const relatedClasses = [
  { title: "Introducción al miembro inferior", meta: "Vista previa", time: "12:10", image: "/anatomy/pelvis.png" },
  { title: "Huesos del fémur", meta: "Cabeza, cuello y diáfisis", time: "34:15", image: "/anatomy/skull.png" },
  { title: "Compartimento medial del muslo", meta: "Músculos y relaciones", time: "29:33", image: "/anatomy/thigh.png" },
  { title: "Compartimento posterior del muslo", meta: "Músculos isquiotibiales", time: "31:08", image: "/anatomy/back-muscles.png" },
] as const;

export function PlayerScreen({ isAdministrator = false }: { isAdministrator?: boolean }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(28);
  const [activeTab, setActiveTab] = useState<"questions" | "points">("questions");
  const [completed, setCompleted] = useState(false);

  return (
    <AppShell
      activeKey="video"
      breadcrumbs={["Videos", "Miembro inferior", "Músculos", "Músculos del muslo: compartimento anterior"]}
      headerTitle="Músculos del muslo: compartimento anterior"
      isAdministrator={isAdministrator}
      mainClassName="player-main"
    >
      <div className="player-layout">
        <section className="player-primary">
          <div className="player-title-row">
            <div>
              <h2>Músculos del muslo: compartimento anterior</h2>
              <p className="player-summary">Video · Nivel intermedio</p>
            </div>
            <button className={`complete-class ${completed ? "is-complete" : ""}`} type="button" onClick={() => setCompleted((value) => !value)}>{completed ? <CheckCircle size={19} weight="fill" /> : <CheckCircle size={19} />} {completed ? "Completada" : "Marcar como completada"}</button>
          </div>

          <div className="video-player-shell">
            <Image src="/anatomy/thigh.png" alt="Ilustración del compartimento anterior del muslo" fill sizes="(max-width: 1100px) 100vw, 780px" priority />
            <div className="video-player-overlay" />
            <div className="video-controls">
              <input aria-label="Progreso del video" type="range" min={0} max={100} value={progress} onChange={(event) => setProgress(Number(event.target.value))} />
              <div className="video-control-row"><button className="player-icon-control" type="button" aria-label={isPlaying ? "Pausar" : "Reproducir"} onClick={() => setIsPlaying((value) => !value)}>{isPlaying ? <Pause size={24} weight="fill" /> : <Play size={24} weight="fill" />}</button><button className="player-icon-control" type="button" aria-label="Volumen"><SpeakerHigh size={23} /></button><span className="video-time">08:12 / 28:45</span><span className="video-control-spacer" /><button className="player-icon-control" type="button" aria-label="Pantalla completa"><SquaresFour size={23} weight="fill" /></button></div>
            </div>
          </div>

          <div className="player-tabs" role="tablist" aria-label="Contenido del video">
            <button className={activeTab === "questions" ? "is-active" : ""} type="button" role="tab" aria-selected={activeTab === "questions"} onClick={() => setActiveTab("questions")}><ClipboardText size={21} /> Preguntas de repaso</button>
            <button className={activeTab === "points" ? "is-active" : ""} type="button" role="tab" aria-selected={activeTab === "points"} onClick={() => setActiveTab("points")}><Question size={21} /> Puntos clave</button>
          </div>

          {activeTab === "questions" ? (
            <section className="question-section" aria-labelledby="question-title">
              <div className="question-heading"><div><h3 id="question-title"><Question size={20} /> Cuestionario</h3><p>Repasa los conceptos clave del video.</p></div><button className="outline-action small" type="button"><Printer size={17} /> Imprimir</button></div>
              <div className="question-list">{questions.map(([question, answer]) => <details className="question-row" key={question}><summary><span className="question-mark">?</span><span><strong>{question}</strong><small>{answer}</small></span><CaretDown size={17} /></summary></details>)}</div>
              <button className="show-more-questions" type="button">Ver más preguntas <CaretDown size={17} /></button>
            </section>
          ) : (
            <section className="key-points-section"><h3><Question size={20} /> Puntos clave</h3><ul><li>El cuádriceps femoral extiende la rodilla y es esencial para la marcha.</li><li>El recto femoral es el único vientre del cuádriceps que cruza la cadera.</li><li>La inervación principal depende del nervio femoral, raíces L2–L4.</li></ul></section>
          )}
        </section>

        <aside className="player-sidebar">
          <section className="resource-panel" aria-labelledby="resource-title"><h2 id="resource-title"><SquaresFour size={23} /> Material complementario</h2><div className="resource-filters"><button className="is-selected" type="button">Todos</button><button type="button">Guías</button><button type="button">Flashcards</button><button type="button">Cuestionarios</button></div><div className="resource-list">{resources.map(({ title, meta, icon: Icon, color }) => <Link className="resource-row" href="/guias/musculos-compartimento-anterior" key={title}><span className={`resource-icon resource-icon-${color}`}><Icon size={27} /></span><span><strong>{title}</strong><small>{meta}</small></span><ArrowRight size={18} /></Link>)}</div></section>
          <section className="related-classes" aria-labelledby="related-title"><div className="section-heading-row"><h2 id="related-title">Videos relacionados</h2><Link href="/asignaturas?tipo=video">Ver todos</Link></div><div>{relatedClasses.map((item) => <Link className="related-class-row" href="/clases/reproductor" key={item.title}><span className="related-class-image"><Image src={item.image} alt="" fill sizes="100px" /><small>{item.time}</small></span><span><strong>{item.title}</strong><small>{item.meta}</small></span></Link>)}</div></section>
        </aside>
      </div>
      <BrandFooter />
    </AppShell>
  );
}
