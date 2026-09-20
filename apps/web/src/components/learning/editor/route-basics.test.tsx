import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { createEmptyDraft } from "./editor-model";
import { RouteBasics } from "./route-basics";
import { FieldHelp } from "./field-help";
import { EditorFocusProvider } from "./editor-focus";

const topics = [
  { id: "c1000000-0000-4000-8000-000000000001", title: "Tórax" },
  { id: "c1000000-0000-4000-8000-000000000002", title: "Abdomen" },
];

describe("route basics", () => {
  it("renders only understandable route fields with contract limits", () => {
    const html = renderToStaticMarkup(
      <EditorFocusProvider><RouteBasics disabled={false} draft={createEmptyDraft(topics)} onChange={() => {}} topics={topics} /></EditorFocusProvider>,
    );
    expect(html).toContain("Título de la ruta");
    expect(html).toContain("Descripción breve");
    expect(html).toContain("Selecciona un tema");
    expect(html).toContain('maxLength="200"');
    expect(html).toContain('maxLength="2000"');
    expect(html.match(/type="radio"/g)).toHaveLength(8);
    expect(html).not.toContain("Slug");
    expect(html).not.toContain("Clave estable");
    expect(html).not.toContain("Nivel de evidencia");
  });

  it("selects a topic only when it is the sole published choice", () => {
    expect(createEmptyDraft(topics).topicContentId).toBe("");
    expect(createEmptyDraft([topics[0]!]).topicContentId).toBe(topics[0]!.id);
  });

  it("associates safe field errors and keeps the empty-topic action viable", () => {
    const html = renderToStaticMarkup(
      <EditorFocusProvider><RouteBasics
        disabled={false}
        draft={createEmptyDraft([])}
        errors={{ summary: "Escribe una descripción breve.", title: "Escribe un título.", topicContentId: "Selecciona un tema." }}
        onChange={() => {}}
        topics={[]}
      /></EditorFocusProvider>,
    );
    expect(html.match(/aria-invalid="true"/g)).toHaveLength(3);
    expect(html).toContain('href="/panel/contenido"');
    expect(html).toContain('target="_blank"');
  });

  it("uses a click and keyboard button for an authorized help family", () => {
    const html = renderToStaticMarkup(
      <FieldHelp family="objectives" label="Objetivos" onOpenFamilyChange={() => {}} openFamily={null}>
        Describe un resultado observable.
      </FieldHelp>,
    );
    expect(html).toContain('aria-label="Ayuda: Objetivos"');
    expect(html).toContain('type="button"');
    expect(html).not.toContain('title="');
  });
});
