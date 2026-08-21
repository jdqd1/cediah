"use client";

import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  ArrowsInSimple,
  ArrowsOutSimple,
  BookOpen,
  CaretDown,
  CaretLeft,
  CaretRight,
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
import { questionAnswer } from "@/lib/question-answer";
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
  const [supportWide, setSupportWide] = useState(false);
  const [favorite, setFavorite] = useState(false);
  const [fontMenuOpen, setFontMenuOpen] = useState(false);
  const [mobileDrawer, setMobileDrawer] = useState<"outline" | "support" | null>(null);
  const manualNavigationRef = useRef(false);
  const navigationFrameRef = useRef<number | null>(null);
  const headingHighlightTimerRef = useRef<number | null>(null);
  const highlightedHeadingRef = useRef<HTMLElement | null>(null);
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
      if (navigationFrameRef.current !== null) window.cancelAnimationFrame(navigationFrameRef.current);
      if (headingHighlightTimerRef.current !== null) window.clearTimeout(headingHighlightTimerRef.current);
      highlightedHeadingRef.current?.classList.remove("is-navigation-target");
    },
    [],
  );

  function goToHeading(id: string) {
    const target = document.getElementById(id);
    if (!target) return;
    manualNavigationRef.current = true;
    if (navigationFrameRef.current !== null) window.cancelAnimationFrame(navigationFrameRef.current);
    if (headingHighlightTimerRef.current !== null) window.clearTimeout(headingHighlightTimerRef.current);
    highlightedHeadingRef.current?.classList.remove("is-navigation-target");
    setActiveHeadingId(id);
    target.scrollIntoView({ behavior: "smooth", block: "start" });

    let previousScrollY = window.scrollY;
    let stableFrames = 0;
    let frameCount = 0;
    let observedMovement = false;

    const monitorArrival = () => {
      frameCount += 1;
      const currentScrollY = window.scrollY;
      if (Math.abs(currentScrollY - previousScrollY) > 0.5) {
        observedMovement = true;
        stableFrames = 0;
      } else {
        stableFrames += 1;
      }
      previousScrollY = currentScrollY;

      const scrollMarginTop = Number.parseFloat(window.getComputedStyle(target).scrollMarginTop) || 0;
      const targetTop = target.getBoundingClientRect().top;
      const reachedRequestedOffset = Math.abs(targetTop - scrollMarginTop) <= 24;
      const targetIsVisible = targetTop >= scrollMarginTop - 24 && targetTop <= window.innerHeight * 0.82;
      const scrollingFinished = observedMovement && stableFrames >= 4 && targetIsVisible;
      const alreadyAtSection = !observedMovement && frameCount > 6 && stableFrames >= 4 && targetIsVisible;

      if ((reachedRequestedOffset && stableFrames >= 2) || scrollingFinished || alreadyAtSection || frameCount > 160) {
        navigationFrameRef.current = null;
        manualNavigationRef.current = false;
        target.classList.remove("is-navigation-target");
        void target.offsetWidth;
        target.classList.add("is-navigation-target");
        highlightedHeadingRef.current = target;
        headingHighlightTimerRef.current = window.setTimeout(() => {
          target.classList.remove("is-navigation-target");
          if (highlightedHeadingRef.current === target) highlightedHeadingRef.current = null;
          headingHighlightTimerRef.current = null;
        }, 1_500);
        return;
      }

      navigationFrameRef.current = window.requestAnimationFrame(monitorArrival);
    };

    navigationFrameRef.current = window.requestAnimationFrame(monitorArrival);
  }

  function toggleFavorite() {
    setFavorite((current) => !current);
  }

  function toggleOutlinePanel() {
    if (window.matchMedia("(max-width: 760px)").matches) {
      setMobileDrawer((current) => (current === "outline" ? null : "outline"));
      return;
    }
    setOutlineExpanded((current) => !current);
  }

  function toggleSupportPanel() {
    if (window.matchMedia("(max-width: 760px)").matches) {
      setMobileDrawer((current) => (current === "support" ? null : "support"));
      return;
    }
    setSupportExpanded((current) => !current);
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
          <span aria-hidden="true" className="published-reader-tool-title" title="Tamaño de texto">
            <TextAa aria-hidden="true" size={17} />
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
        </div>
      </section>

      <section className="published-reader-mobile-toolbar" aria-label="Herramientas de lectura móvil">
        <div
          aria-hidden={!fontMenuOpen}
          className={"published-reader-mobile-font-menu" + (fontMenuOpen ? " is-open" : "")}
          id="published-reader-font-menu"
        >
          <button
            aria-label="Reducir tamaño de texto"
            disabled={!fontMenuOpen || fontScale <= 90}
            tabIndex={fontMenuOpen ? 0 : -1}
            type="button"
            onClick={() => setFontScale((current) => Math.max(90, current - 10))}
          >
            <Minus aria-hidden="true" size={15} />
          </button>
          <output aria-live="polite">{fontScale}%</output>
          <button
            aria-label="Aumentar tamaño de texto"
            disabled={!fontMenuOpen || fontScale >= 130}
            tabIndex={fontMenuOpen ? 0 : -1}
            type="button"
            onClick={() => setFontScale((current) => Math.min(130, current + 10))}
          >
            <Plus aria-hidden="true" size={15} />
          </button>
        </div>
        <div className="published-reader-mobile-toolbar-row">
          <button
            aria-controls="published-guide-outline-links"
            aria-expanded={mobileDrawer === "outline"}
            aria-label="Abrir índice"
            className="published-reader-mobile-side-button"
            type="button"
            onClick={() => setMobileDrawer((current) => (current === "outline" ? null : "outline"))}
          >
            <ListBullets aria-hidden="true" size={19} />
            <span className="sr-only">Índice</span>
          </button>
          <div className="published-reader-mobile-main-tools">
            <button
              aria-label="Resaltar"
              aria-pressed={highlightImportant}
              className={"published-reader-mobile-tool" + (highlightImportant ? " is-active" : "")}
              type="button"
              onClick={() => setHighlightImportant((current) => !current)}
            >
              <Highlighter aria-hidden="true" size={17} />
              <span>Resaltar</span>
            </button>
            <button
              aria-controls="published-reader-font-menu"
              aria-expanded={fontMenuOpen}
              aria-label="Fuente"
              className={"published-reader-mobile-tool" + (fontMenuOpen ? " is-active" : "")}
              type="button"
              onClick={() => setFontMenuOpen((current) => !current)}
            >
              <TextAa aria-hidden="true" size={17} />
              <span>Fuente</span>
            </button>
            <button
              aria-label="Favorito"
              aria-pressed={favorite}
              className={"published-reader-mobile-tool" + (favorite ? " is-active" : "")}
              type="button"
              onClick={toggleFavorite}
            >
              <Star aria-hidden="true" size={17} weight={favorite ? "fill" : "regular"} />
              <span>Favorito</span>
            </button>
          </div>
          <button
            aria-controls="published-guide-support-content"
            aria-expanded={mobileDrawer === "support"}
            aria-label="Abrir recursos de estudio"
            className="published-reader-mobile-side-button"
            type="button"
            onClick={() => setMobileDrawer((current) => (current === "support" ? null : "support"))}
          >
            <BookOpen aria-hidden="true" size={19} />
            <span className="sr-only">Recursos de estudio</span>
          </button>
        </div>
      </section>

      {mobileDrawer && (
        <button
          aria-label="Cerrar panel lateral"
          className="published-reader-drawer-backdrop"
          type="button"
          onClick={() => setMobileDrawer(null)}
        />
      )}

      <div
        className={`published-rich-guide-layout${outlineExpanded ? "" : " is-outline-collapsed"}${supportExpanded ? "" : " is-support-collapsed"}${supportWide ? " is-support-wide" : ""}`}
      >
        <nav
          className={"published-rich-guide-outline" + (outlineExpanded ? "" : " is-collapsed") + (mobileDrawer === "outline" ? " is-mobile-open" : "")}
          aria-label="Índice de la guía"
        >
          <div className="published-rich-guide-outline-heading">
            <span>
              <ListBullets aria-hidden="true" size={19} />
              <strong>Índice de la guía</strong>
            </span>
            <button
              aria-controls="published-guide-outline-links"
              aria-expanded={outlineExpanded}
              aria-label={outlineExpanded ? "Contraer índice de la guía" : "Expandir índice de la guía"}
              className="published-rich-guide-outline-toggle"
              title={outlineExpanded ? "Contraer índice" : "Expandir índice"}
              type="button"
              onClick={toggleOutlinePanel}
            >
            {outlineExpanded ? (
              <CaretLeft aria-hidden="true" className="published-rich-guide-outline-caret" size={17} />
            ) : (
              <CaretRight aria-hidden="true" className="published-rich-guide-outline-caret" size={17} />
            )}
            </button>
          </div>
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

        <aside
          className={"published-rich-guide-support" + (supportExpanded ? "" : " is-collapsed") + (mobileDrawer === "support" ? " is-mobile-open" : "")}
          aria-label="Recursos de estudio"
        >
          <div className="published-rich-guide-support-heading">
            <span>
              <BookOpen aria-hidden="true" size={18} />
              <strong>Recursos de estudio</strong>
            </span>
            <button
              aria-label={supportWide ? "Restaurar tamaño de recursos" : "Ampliar recursos de estudio"}
              aria-pressed={supportWide}
              className="published-rich-guide-support-expand"
              title={supportWide ? "Restaurar tamaño" : "Ampliar recursos"}
              type="button"
              onClick={() => setSupportWide((current) => !current)}
            >
              {supportWide ? <ArrowsInSimple aria-hidden="true" size={16} /> : <ArrowsOutSimple aria-hidden="true" size={16} />}
            </button>
            <button
              aria-controls="published-guide-support-content"
              aria-expanded={supportExpanded}
              aria-label={supportExpanded ? "Contraer recursos de estudio" : "Expandir recursos de estudio"}
              className="published-rich-guide-support-toggle"
              title={supportExpanded ? "Contraer recursos" : "Expandir recursos"}
              type="button"
              onClick={toggleSupportPanel}
            >
            {supportExpanded ? (
              <CaretRight aria-hidden="true" className="published-rich-guide-support-caret" size={17} />
            ) : (
              <CaretLeft aria-hidden="true" className="published-rich-guide-support-caret" size={17} />
            )}
            </button>
          </div>
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
                title="Cuestinoario"
                tone="quiz"
              >
                {item.content.quiz.questions.length > 0 ? (
                  <QuestionAnswerCards questions={item.content.quiz.questions} />
                ) : (
                  <p className="published-rich-guide-resource-empty">Esta guía no incluye preguntas y respuestas.</p>
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
      <div
        aria-hidden={!expanded}
        className={"published-rich-guide-resource-content" + (expanded ? " is-expanded" : "")}
        id={id}
      >
        <div className="published-rich-guide-resource-content-inner">
          {children}
        </div>
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
    { id: "quiz", label: "Preguntas y respuestas" },
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
            <QuestionAnswerCards questions={displayedQuiz} />
          ) : (
            <p className="published-rich-guide-resource-empty">Esta guía no incluye preguntas y respuestas.</p>
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
  return <QuestionAnswerCards questions={item.content.questions} />;
}

type QuizQuestion = Extract<ContentItem, { kind: "quiz" }>["content"]["questions"][number];

function QuestionAnswerCards({ questions }: { questions: QuizQuestion[] }) {
  return (
    <section className="published-question-answer">
      <div className="published-tool-heading">
        <ClipboardText size={34} />
        <div>
          <h3>Preguntas y respuestas</h3>
          <p>{questions.length} {questions.length === 1 ? "tarjeta" : "tarjetas"} de repaso</p>
        </div>
      </div>
      <div className="published-question-answer-list">
        {questions.map((question, questionIndex) => (
          <article className="published-question-answer-card" key={`${question.prompt}-${questionIndex}`}>
            <header>
              <span>{String(questionIndex + 1).padStart(2, "0")}</span>
              <div>
                <small>Pregunta</small>
                <h4>{question.prompt}</h4>
              </div>
            </header>
            <div className="published-question-answer-response">
              <span><CheckCircle aria-hidden="true" size={16} weight="fill" /> Respuesta</span>
              <p>{questionAnswer(question)}</p>
            </div>
            {question.explanation && (
              <p className="published-question-answer-context">{question.explanation}</p>
            )}
          </article>
        ))}
      </div>
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
