"use client";

import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  CardsThree,
  CheckCircle,
  ClipboardText,
  Compass,
  DownloadSimple,
  PlayCircle,
  SealCheck,
} from "@phosphor-icons/react";
import type { ContentItem } from "@cediah/contracts";
import { type KeyboardEvent, useMemo, useState } from "react";
import { AppShell } from "./app-shell";

export function ContentDetailScreen({ item, isAdministrator = false }: { item: ContentItem; isAdministrator?: boolean }) {
  const libraryLabel = item.kind === "guide" ? "Guías" : "Biblioteca";
  return (
    <AppShell
      activeKey={item.kind === "guide" ? "guides" : item.kind}
      headerTitle={libraryLabel}
      isAdministrator={isAdministrator}
      mainClassName="content-detail-main"
    >
      <article className="published-content">
        <header className="published-content-header">
          <div className="published-content-context">
            <Link href={item.kind === "guide" ? "/guias" : "/biblioteca"}>
              <ArrowLeft size={17} /> Volver
            </Link>
            <nav className="published-content-breadcrumbs" aria-label="Ruta actual">
              <span>{libraryLabel}</span>
              <span aria-hidden="true">›</span>
              <span>{item.topic}</span>
              <span aria-hidden="true">›</span>
              <span className="current">{item.title}</span>
            </nav>
          </div>
          <h2>{item.title}</h2>
          <p>{item.summary}</p>
        </header>
        <ContentBody item={item} />
      </article>
    </AppShell>
  );
}

function ContentBody({ item }: { item: ContentItem }) {
  if (item.kind === "guide") {
    return (
      <div className="published-guide-layout">
        <nav aria-label="Contenido de la guía">
          <strong>En esta guía</strong>
          {item.content.sections.map((section, index) => (
            <a href={"#section-" + index} key={section.heading}>{section.heading}</a>
          ))}
          {item.asset?.downloadUrl && (
            <a className="published-download" href={item.asset.downloadUrl}>
              <DownloadSimple size={18} /> Descargar {item.asset.fileName}
            </a>
          )}
        </nav>
        <div className="published-guide-body">
          {item.content.sections.map((section, index) => (
            <section id={"section-" + index} key={section.heading}>
              <span>{String(index + 1).padStart(2, "0")}</span>
              <h3>{section.heading}</h3>
              {section.body.split(/\n{2,}/).map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
            </section>
          ))}
          {item.content.sections.length === 0 && item.asset?.downloadUrl && (
            <div className="published-asset-callout">
              <BookOpen size={38} />
              <h3>Esta guía está disponible como documento.</h3>
              <a href={item.asset.downloadUrl}>
                <DownloadSimple size={19} /> Abrir {item.asset.fileName}
              </a>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (item.kind === "video") {
    return <VideoBody item={item} />;
  }

  if (item.kind === "quiz") return <QuizBody item={item} />;
  if (item.kind === "flashcards") return <FlashcardsBody item={item} />;

  return (
    <section className="published-topic">
      <Compass size={36} />
      {item.content.introduction.split(/\n{2,}/).map((paragraph) => (
        <p key={paragraph}>{paragraph}</p>
      ))}
      {item.content.objectives.length > 0 && (
        <div>
          <h3>Objetivos de aprendizaje</h3>
          <ul>
            {item.content.objectives.map((objective) => (
              <li key={objective}><CheckCircle size={19} />{objective}</li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

type VideoItem = ContentItem & { kind: "video" };
type VideoResource = "guide" | "key-points" | "quiz";

function VideoBody({ item }: { item: VideoItem }) {
  const [resource, setResource] = useState<VideoResource>("guide");
  const tabs: { id: VideoResource; label: string }[] = [
    { id: "guide", label: "Guía" },
    { id: "key-points", label: "Puntos clave" },
    { id: "quiz", label: "Cuestionario" },
  ];

  function handleTabKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const lastIndex = tabs.length - 1;
    const nextIndex =
      event.key === "ArrowRight" ? (index === lastIndex ? 0 : index + 1)
      : event.key === "ArrowLeft" ? (index === 0 ? lastIndex : index - 1)
      : event.key === "Home" ? 0
      : event.key === "End" ? lastIndex
      : null;

    if (nextIndex === null) return;
    event.preventDefault();
    const next = tabs[nextIndex]!;
    setResource(next.id);
    document.getElementById(`video-resource-tab-${next.id}`)?.focus();
  }

  return (
    <section className="published-video published-video-package">
      {item.asset?.downloadUrl ? (
        <video aria-label={`Reproducir ${item.title}`} controls controlsList="nodownload noplaybackrate" disablePictureInPicture playsInline preload="metadata" src={item.asset.downloadUrl}>
          Tu navegador no puede reproducir este video.
        </video>
      ) : item.content.externalUrl ? (
        <div className="published-external-video">
          <PlayCircle size={58} />
          <h3>Video</h3>
          <a href={item.content.externalUrl} target="_blank" rel="noreferrer">
            Abrir video <ArrowRight size={18} />
          </a>
        </div>
      ) : null}

      <div className="published-video-copy">
        <p>{item.content.description}</p>
      </div>

      <div className="video-resource-tabs" role="tablist" aria-label="Recursos del video">
        {tabs.map((tab, index) => (
          <button
            aria-controls={`video-resource-${tab.id}`}
            aria-selected={resource === tab.id}
            className={resource === tab.id ? "is-active" : ""}
            id={`video-resource-tab-${tab.id}`}
            key={tab.id}
            onClick={() => setResource(tab.id)}
            onKeyDown={(event) => handleTabKeyDown(event, index)}
            role="tab"
            tabIndex={resource === tab.id ? 0 : -1}
            type="button"
          >
            {tab.label}
          </button>
        ))}
      </div>

      <section
        aria-labelledby={`video-resource-tab-${resource}`}
        className="video-resource-panel"
        id={`video-resource-${resource}`}
        role="tabpanel"
      >
        {resource === "guide" && (
          <div className="video-guide-sections">
            {item.content.guide.sections.map((section, index) => (
              <article key={`${section.heading}-${index}`}>
                <span>{String(index + 1).padStart(2, "0")}</span>
                <div>
                  <h3>{section.heading}</h3>
                  {section.body.split(/\n{2,}/).map((paragraph) => (
                    <p key={paragraph}>{paragraph}</p>
                  ))}
                </div>
              </article>
            ))}
          </div>
        )}
        {resource === "key-points" && (
          <ul className="video-key-points">
            {item.content.keyPoints.map((point) => (
              <li key={point}><CheckCircle size={19} />{point}</li>
            ))}
          </ul>
        )}
        {resource === "quiz" && <QuizPractice questions={item.content.quiz.questions} />}
      </section>
    </section>
  );
}

function QuizBody({
  item,
}: {
  item: ContentItem & { kind: "quiz" };
}) {
  return <QuizPractice questions={item.content.questions} />;
}

type QuizQuestion = Extract<ContentItem, { kind: "quiz" }>["content"]["questions"][number];

function QuizPractice({ questions }: { questions: QuizQuestion[] }) {
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [submitted, setSubmitted] = useState(false);
  const score = useMemo(
    () =>
      questions.reduce(
        (total, question, index) =>
          total + (answers[index] === question.correctOptionIndex ? 1 : 0),
        0,
      ),
    [answers, questions],
  );

  return (
    <section className="published-quiz">
      <div className="published-tool-heading">
          <ClipboardText size={34} />
        <div>
          <h3>Comprueba lo aprendido</h3>
          <p>{questions.length} preguntas</p>
        </div>
      </div>
      {questions.map((question, questionIndex) => (
        <fieldset key={question.prompt}>
          <legend><span>{questionIndex + 1}</span>{question.prompt}</legend>
          {question.options.map((option, optionIndex) => {
            const selected = answers[questionIndex] === optionIndex;
            const correct = submitted && optionIndex === question.correctOptionIndex;
            const incorrect = submitted && selected && !correct;
            return (
              <label
                className={correct ? "is-correct" : incorrect ? "is-incorrect" : ""}
                key={option}
              >
                <input
                  checked={selected}
                  disabled={submitted}
                  name={"question-" + questionIndex}
                  onChange={() =>
                    setAnswers((current) => ({ ...current, [questionIndex]: optionIndex }))
                  }
                  type="radio"
                />
                <span>{option}</span>
              </label>
            );
          })}
          {submitted && question.explanation && <p>{question.explanation}</p>}
        </fieldset>
      ))}
      {submitted ? (
        <div className="quiz-result" role="status">
          <SealCheck size={28} />
          <strong>{score} de {questions.length} respuestas correctas</strong>
          <button
            type="button"
            onClick={() => {
              setAnswers({});
              setSubmitted(false);
            }}
          >
            Intentar de nuevo
          </button>
        </div>
      ) : (
        <button
          className="published-primary-action"
          disabled={Object.keys(answers).length !== questions.length}
          onClick={() => setSubmitted(true)}
          type="button"
        >
          Calificar cuestionario
        </button>
      )}
    </section>
  );
}

function FlashcardsBody({
  item,
}: {
  item: ContentItem & { kind: "flashcards" };
}) {
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const card = item.content.cards[index] ?? item.content.cards[0];
  if (!card) return null;

  return (
    <section className="published-flashcards">
      <div className="published-tool-heading">
        <CardsThree size={34} />
        <div>
          <h3>Repaso activo</h3>
          <p>Tarjeta {index + 1} de {item.content.cards.length}</p>
        </div>
      </div>
      <button
        className={"flashcard-stage " + (flipped ? "is-flipped" : "")}
        onClick={() => setFlipped((value) => !value)}
        type="button"
      >
        <small>{flipped ? "Respuesta" : "Pregunta"}</small>
        <strong>{flipped ? card.back : card.front}</strong>
        <span>Haz clic para {flipped ? "ver la pregunta" : "revelar la respuesta"}</span>
      </button>
      <div className="flashcard-controls">
        <button
          disabled={index === 0}
          onClick={() => {
            setIndex((value) => value - 1);
            setFlipped(false);
          }}
          type="button"
        >
          <ArrowLeft size={18} /> Anterior
        </button>
        <progress max={item.content.cards.length} value={index + 1} />
        <button
          disabled={index === item.content.cards.length - 1}
          onClick={() => {
            setIndex((value) => value + 1);
            setFlipped(false);
          }}
          type="button"
        >
          Siguiente <ArrowRight size={18} />
        </button>
      </div>
    </section>
  );
}
