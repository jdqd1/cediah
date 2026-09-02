import { describe, expect, it } from "vitest";
import { isPlatformPath } from "./platform-routes";

describe("persistent platform frame", () => {
  it("keeps the frame on shared-shell screens", () => {
    for (const path of ["/dashboard", "/asignaturas", "/asignaturas/anatomia", "/contenido/abdomen", "/guias/abdomen", "/panel/contenido", "/cursos", "/clases/reproductor"]) {
      expect(isPlatformPath(path)).toBe(true);
    }
  });
  it("does not add duplicate chrome to public or standalone layouts", () => {
    for (const path of ["/", "/acceder", "/auth/callback", "/cursos/anatomia", "/cursos/anatomia/lecciones/introduccion", "/pruebas/video", "/dashboard-example"]) {
      expect(isPlatformPath(path)).toBe(false);
    }
  });
});
