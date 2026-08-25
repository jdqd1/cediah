import {
  BookOpen,
  CardsThree,
  ClipboardText,
  Compass,
  PlayCircle,
} from "@phosphor-icons/react";
import type { ContentKind } from "@cediah/contracts";

const coverIcons: Record<ContentKind, typeof BookOpen> = {
  flashcards: CardsThree,
  guide: BookOpen,
  quiz: ClipboardText,
  topic: Compass,
  video: PlayCircle,
};

export function ContentTypeCover({
  className = "",
  kind,
}: {
  className?: string;
  kind: ContentKind;
}) {
  const Icon = coverIcons[kind];

  return (
    <span
      aria-hidden="true"
      className={`content-type-cover content-type-cover-${kind} ${className}`.trim()}
    >
      <span className="content-type-cover-accent" />
      <span className="content-type-cover-glyph">
        <Icon size={25} weight={kind === "video" ? "fill" : "regular"} />
      </span>
    </span>
  );
}
