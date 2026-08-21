"use client";

import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  CaretDown,
  CardsThree,
  CheckCircle,
  ClipboardText,
  Compass,
  DownloadSimple,
  Highlighter,
  Lightbulb,
  ListBullets,
  Minus,
  PlayCircle,
  Plus,
  Printer,
  SealCheck,
  ShareNetwork,
  Star,
  TextAa,
} from "@phosphor-icons/react";
import type { ContentItem } from "@cediah/contracts";
import {
  type CSSProperties,
  type KeyboardEvent,
  type ReactNode,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { extractGuideOutline, numberGuideOutline, sectionsToRichTextDocument } from "@/lib/guide-document";
import { AppShell } from "./app-shell";
import { RichTextRenderer } from "./rich-text-renderer";

export function ContentDetailScreen({
  item,
  isAdministrator = false,
  linkedGuide,
}: {
  item: ContentItem;
  isAdministrator?: boolean;
  linkedGuide?: Extract<ContentItem, { kind: "guide" }>;
}) {
  const libraryLabel = item.kind === "guide" ? "Guías" : "Biblioteca";
  return (
    <AppShell
      activeKey={item.kind === "guide" ? "guides" : item.kind}
      headerTitle={libraryLabel}
      isAdministrator={isAdministrator}
      mainClassName="content-detail-main"
    >
      <article className="published-content">
        <header className={`published-content-header${item.kind === "guide" ? " published-rich-guide-header" : ""}`}>
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
          <div className="published-guide-title-row">
            <h2>{item.title}</h2>
          </div>
          {item.kind !== "guide" && <p>{item.summary}</p>}
        </header>
        <ContentBody item={item} linkedGuide={linkedGuide} />
      </article>
    </AppShell>
  );
}

function ContentBody({ item, linkedGuide }: { item: ContentItem; linkedGuide?: GuideItem }) {
  if (item.kind === "guide") {
    return <GuideBody item={item} />;
  }

  if (item.kind === "video") {
    return <VideoBody item={item} linkedGuide={linkedGuide} />;
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

type GuideItem = Extract<ContentItem, { kind: "guide" }>;

function GuideBody({ item }: { item: GuideItem }) {
  const guideDocument = useMemo(
    () => item.content.document ?? sectionsToRichTextDocument(item.content.sections),
    [item.content.document, item.content.sections],
  );
  const outline = useMemo(() => extractGuideOutline(guideDocument), [guideDocument]);
  const numberedOutline = useMemo(() => numberGuideOutline(outline), [outline]);
  const [activeHeadingId, setActiveHeadingId] = useState("");
  const [fontScale, setFontScale] = useState(100);
  const [highlightImportant, setHighlightImportant] = useState(false);
  const [outlineExpanded, setOutlineExpanded] = useState(true);
  const [supportExpanded, setSupportExpanded] = useState(true);
  const [favorite, setFavorite] = useState(false);
  const [shareFeedback, setShareFeedback] = useState("");
  const manualNavigationRef = useRef(false);
  const manualNavigationTimerRef = useRef<number | null>(null);
  const visibleActiveHeadingId = outline.some(({ id }) => id === activeHeadingId)
    ? activeHeadingId
    : outline[0]?.id;
  const hasGuideContent = item.content.document !== null || item.content.sections.length > 0;
  const readerStyle = {
    "--reader-font-size": `${(0.91 * fontScale / 100).toFixed(3)}rem`,
  } as CSSProperties;

  useEffect(() => {
    if (typeof IntersectionObserver === "undefined" || outline.length === 0) return;

    const headings = outline
      .map(({ id }) => document.getElementById(id))
      .filter((heading): heading is HTMLElement => heading !== null);
    const observer = new IntersectionObserver(
      (entries) => {
        if (manualNavigationRef.current) return;
        const nearestVisibleHeading = entries
          .filter((entry) => entry.isIntersecting)
          .sort((first, second) => first.boundingClientRect.top - second.boundingClientRect.top)[0];

        if (nearestVisibleHeading?.target.id) {
          setActiveHeadingId(nearestVisibleHeading.target.id);
        }
      },
      { rootMargin: "-18% 0px -70% 0px", threshold: 0 },
    );

    headings.forEach((heading) => observer.observe(heading));
    return () => observer.disconnect();
  }, [outline]);

  useEffect(
    () => () => {
      if (manualNavigationTimerRef.current !== null) {
        window.clearTimeout(manualNavigationTimerRef.current);
      }
    },
    [],
  );

  function goToHeading(id: string) {
    manualNavigationRef.current = true;
    if (manualNavigationTimerRef.current !== null) {
      window.clearTimeout(manualNavigationTimerRef.current);
    }
    manualNavigationTimerRef.current = window.setTimeout(() => {
      manualNavigationRef.current = false;
      manualNavigationTimerRef.current = null;
    }, 1_000);
    setActiveHeadingId(id);
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  async function shareGuide() {
    const url = window.location.href;
    const shareData = { text: item.summary, title: item.title, url };

    if (navigator.share) {
      try {
        await navigator.share(shareData);
        setShareFeedback("Guía compartida.");
        return;
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
      }
    }

    try {
      if (!navigator.clipboard?.writeText) throw new Error("clipboard_unavailable");
      await navigator.clipboard.writeText(url);
      setShareFeedback("Enlace copiado.");
    } catch {
      window.prompt("Copia este enlace para compartir la guía:", url);
    }
  }

  function toggleFavorite() {
    setFavorite((current) => !current);
  }

  return (
    <div
      className={`published-rich-guide-reader${highlightImportant ? " is-highlighting" : ""}`}
      style={readerStyle}
    >
      <section className="published-reader-actionbar" aria-label="Herramientas de lectura">
        <div className="published-reader-actionbar-group">
          <button
            aria-label="Resaltar lo importante"
            aria-pressed={highlightImportant}
            className="published-reader-toggle"
            type="button"
            onClick={() => setHighlightImportant((current) => !current)}
          >
            <Highlighter aria-hidden="true" size={18} />
            <span>Resaltar lo importante</span>
            <span aria-hidden="true" className="published-reader-switch" />
          </button>
        </div>

        <div className="published-reader-actionbar-group published-reader-tools-group" role="group" aria-label="Herramientas de lectura">
          <span className="published-reader-tool-title">
            <TextAa aria-hidden="true" size={17} />
            <strong>Tamaño de texto</strong>
          </span>
          <span className="published-reader-text-size">
            <button
              aria-label="Reducir tamaño de texto"
              disabled={fontScale <= 90}
              type="button"
              onClick={() => setFontScale((current) => Math.max(90, current - 10))}
            >
              <Minus aria-hidden="true" size={14} />
            </button>
            <output aria-live="polite">{fontScale}%</output>
            <button
              aria-label="Aumentar tamaño de texto"
              disabled={fontScale >= 130}
              type="button"
              onClick={() => setFontScale((current) => Math.min(130, current + 10))}
            >
              <Plus aria-hidden="true" size={14} />
            </button>
          </span>
        </div>

        <div className="published-reader-actionbar-group published-reader-actions">
          {item.asset?.downloadUrl && (
            <a aria-label="Descargar guía" href={item.asset.downloadUrl}>
              <DownloadSimple aria-hidden="true" size={18} />
              <span>Descargar</span>
            </a>
          )}
          <button aria-label="Imprimir guía" type="button" onClick={() => window.print()}>
            <Printer aria-hidden="true" size={18} />
            <span>Imprimir</span>
          </button>
          <button
            aria-pressed={favorite}
            aria-label="Favorito"
            title="Marcar durante esta lectura"
            type="button"
            onClick={toggleFavorite}
          >
            <Star aria-hidden="true" size={18} weight={favorite ? "fill" : "regular"} />
            <span>Favorito</span>
          </button>
          <button aria-label="Compartir guía" type="button" onClick={() => void shareGuide()}>
            <ShareNetwork aria-hidden="true" size={18} />
            <span>Compartir</span>
          </button>
        </div>
        {shareFeedback && (
          <span className="published-reader-share-feedback" role="status">
            {shareFeedback}
          </span>
        )}
      </section>

      <div className="published-rich-guide-layout">
        <nav className="published-rich-guide-outline" aria-label="Índice de la guía">
          <button
            aria-controls="published-guide-outline-links"
            aria-expanded={outlineExpanded}
            className="published-rich-guide-outline-heading"
            type="button"
            onClick={() => setOutlineExpanded((current) => !current)}
          >
            <span>
              <ListBullets aria-hidden="true" size={19} />
              <strong>Índice de la guía</strong>
            </span>
            <CaretDown aria-hidden="true" className="published-rich-guide-outline-caret" size={17} />
          </button>
          <div
            className="published-rich-guide-outline-content"
            hidden={!outlineExpanded}
            id="published-guide-outline-links"
          >
            <div className="published-rich-guide-outline-links">
              {numberedOutline.map((outlineItem) => (
                <a
                  aria-current={visibleActiveHeadingId === outlineItem.id ? "location" : undefined}
                  className={`${outlineItem.displayLevel === 2 ? "is-subsection" : "is-section"}${visibleActiveHeadingId === outlineItem.id ? " is-active" : ""}`}
                  href={`#${outlineItem.id}`}
                  key={outlineItem.id}
                  onClick={(event) => {
                    event.preventDefault();
                    goToHeading(outlineItem.id);
                  }}
                >
                  <span aria-hidden="true">
                    {outlineItem.number}
                  </span>
                  {outlineItem.label}
                </a>
              ))}
              {outline.length === 0 && (
                <p className="published-rich-guide-outline-empty">La guía no contiene apartados.</p>
              )}
            </div>
            {item.asset?.downloadUrl && (
              <a className="published-rich-guide-download" href={item.asset.downloadUrl}>
                <DownloadSimple aria-hidden="true" size={18} />
                <span>Descargar guía</span>
              </a>
            )}
          </div>
        </nav>

        <section className="published-rich-guide-article" aria-label="Contenido de la guía">
        {hasGuideContent ? (
          <RichTextRenderer document={guideDocument} />
        ) : item.asset?.downloadUrl ? (
          <div className="published-asset-callout">
            <BookOpen size={38} />
            <h3>Esta guía está disponible como documento.</h3>
            <a href={item.asset.downloadUrl}>
              <DownloadSimple size={19} /> Abrir {item.asset.fileName}
            </a>
          </div>
        ) : (
          <div className="published-rich-guide-empty">
            <BookOpen aria-hidden="true" size={34} />
            <h3>El contenido de esta guía aún no está disponible.</h3>
          </div>
        )}
        </section>

        <aside className="published-rich-guide-support" aria-label="Recursos de estudio">
          <button
            aria-controls="published-guide-support-content"
            aria-expanded={supportExpanded}
            className="published-rich-guide-support-heading"
            type="button"
            onClick={() => setSupportExpanded((current) => !current)}
          >
            <span>
              <BookOpen aria-hidden="true" size={18} />
              <strong>Recursos de estudio</strong>
            </span>
            <CaretDown aria-hidden="true" className="published-rich-guide-support-caret" size={17} />
          </button>
          <div
            className="published-rich-guide-support-content"
            hidden={!supportExpanded}
            id="published-guide-support-content"
          >
            <div className="published-rich-guide-support-grid">
              <ReaderSupportPanel
                count={item.content.keyPoints.length}
                defaultExpanded
                icon={<Lightbulb aria-hidden="true" size={20} />}
                id="published-guide-key-points"
                title="Puntos clave"
                tone="key-points"
              >
                {item.content.keyPoints.length > 0 ? (
                  <ul className="published-rich-guide-key-points">
                    {item.content.keyPoints.map((point) => (
                      <li key={point}>
                        <Lightbulb aria-hidden="true" size={17} />
                        <span>{point}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="published-rich-guide-resource-empty">Esta guía no incluye puntos clave.</p>
                )}
              </ReaderSupportPanel>

              <ReaderSupportPanel
                count={item.content.quiz.questions.length}
                defaultExpanded
                icon={<ClipboardText aria-hidden="true" size={20} />}
                id="published-guide-quiz"
                title="Cuestionario"
                tone="quiz"
              >
                {item.content.quiz.questions.length > 0 ? (
                  <QuizPractice questions={item.content.quiz.questions} />
                ) : (
                  <p className="published-rich-guide-resource-empty">Esta guía no incluye cuestionario.</p>
                )}
              </ReaderSupportPanel>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

function ReaderSupportPanel({
  children,
  count,
  defaultExpanded = false,
  icon,
  id,
  title,
  tone,
}: {
  children: ReactNode;
  count: number;
  defaultExpanded?: boolean;
  icon: ReactNode;
  id: string;
  title: string;
  tone?: "key-points" | "quiz";
}) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  return (
    <section className={`published-rich-guide-resource${tone ? ` published-rich-guide-resource-${tone}` : ""}`}>
      <button
        aria-controls={id}
        aria-expanded={expanded}
        className="published-rich-guide-resource-trigger"
        onClick={() => setExpanded((current) => !current)}
        type="button"
      >
        <span className="published-rich-guide-resource-icon">{icon}</span>
        <span>
          <strong>{title}</strong>
          <small>{count === 1 ? "1 elemento" : `${count} elementos`}</small>
        </span>
        <CaretDown aria-hidden="true" className="published-rich-guide-resource-caret" size={17} />
      </button>
      <div className="published-rich-guide-resource-content" hidden={!expanded} id={id}>
        {children}
      </div>
    </section>
  );
}

type VideoItem = ContentItem & { kind: "video" };
type VideoResource = "guide" | "key-points" | "quiz";

function VideoBody({ item, linkedGuide }: { item: VideoItem; linkedGuide?: GuideItem }) {
  const [resource, setResource] = useState<VideoResource>("guide");
  const displayedGuide = linkedGuide?.content ?? item.content.guide;
  const displayedKeyPoints = linkedGuide?.content.keyPoints ?? item.content.keyPoints;
  const displayedQuiz = linkedGuide?.content.quiz.questions ?? item.content.quiz.questions;
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
          <div className="video-guide-resource">
            {linkedGuide && (
              <header className="video-linked-guide-heading">
                <span>Guía vinculada</span>
                <h3>{linkedGuide.title}</h3>
                <p>{linkedGuide.summary}</p>
                <Link href={`/guias/${linkedGuide.slug}`}>
                  Abrir guía completa <ArrowRight aria-hidden="true" size={16} />
                </Link>
              </header>
            )}
            {displayedGuide.document ? (
              <RichTextRenderer
                className="video-rich-guide-document"
                document={displayedGuide.document}
              />
            ) : (
              <div className="video-guide-sections">
                {displayedGuide.sections.map((section, index) => (
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
          </div>
        )}
        {resource === "key-points" && (
          displayedKeyPoints.length > 0 ? (
            <ul className="video-key-points">
              {displayedKeyPoints.map((point) => (
                <li key={point}><CheckCircle size={19} />{point}</li>
              ))}
            </ul>
          ) : (
            <p className="published-rich-guide-resource-empty">Esta guía no incluye puntos clave.</p>
          )
        )}
        {resource === "quiz" && (
          displayedQuiz.length > 0 ? (
            <QuizPractice questions={displayedQuiz} />
          ) : (
            <p className="published-rich-guide-resource-empty">Esta guía no incluye cuestionario.</p>
          )
        )}
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
