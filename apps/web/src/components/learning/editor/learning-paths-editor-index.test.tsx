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
});
