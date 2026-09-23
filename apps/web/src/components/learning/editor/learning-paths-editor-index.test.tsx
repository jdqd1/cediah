import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { editorFixture } from "./editor-fixtures";
import { LearningPathsEditorIndex } from "./learning-paths-editor-index";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

describe("learning paths editor index", () => {
  it("offers a clearly labelled delete action for an existing route", () => {
    const path = editorFixture("ready").initialPath!;
    const html = renderToStaticMarkup(<LearningPathsEditorIndex paths={[path]} />);

    expect(html).toContain(`href="/panel/rutas/${path.id}"`);
    expect(html).toContain(`aria-label="Eliminar ruta ${path.title}"`);
    expect(html).toContain("Eliminar");
  });

  it("offers archiving instead of deletion when the route has publication history", () => {
    const path = {
      ...editorFixture("ready").initialPath!,
      version: { ...editorFixture("ready").initialPath!.version, number: 4 },
    };
    const html = renderToStaticMarkup(<LearningPathsEditorIndex canArchive paths={[path]} />);

    expect(html).toContain("Borrador de ruta publicada");
    expect(html).toContain(`aria-label="Archivar ruta ${path.title}"`);
    expect(html).not.toContain(`aria-label="Eliminar ruta ${path.title}"`);
  });

  it("labels archived routes from archivedAt even when their version remains published", () => {
    const path = editorFixture("archived").initialPath!;
    const html = renderToStaticMarkup(<LearningPathsEditorIndex canArchive paths={[path]} />);

    expect(html).toContain("Archivada");
    expect(html).not.toContain(`aria-label="Eliminar ruta ${path.title}"`);
    expect(html).not.toContain(`aria-label="Archivar ruta ${path.title}"`);
  });
});
