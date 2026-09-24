import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page, type TestInfo } from "@playwright/test";

const axeTags = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

async function openFixture(
  page: Page,
  state = "ready",
  failure = "none",
) {
  await page.goto(`/visual-fixtures/editor-rutas?estado=${state}&fallo=${failure}`);
  await expect(page.getByRole("link", { name: "Volver a rutas" })).toBeVisible();
  await expect(page.getByRole("tablist", { name: "Secciones del editor de rutas" })).toBeVisible();
}

async function requestLog(page: Page) {
  return (await page.getByTestId("fixture-request-log").textContent()) ?? "";
}

async function selectSection(page: Page, name: "Actividades" | "Datos" | "Revisión") {
  await page.getByRole("tab", { name, exact: true }).click();
  await expect(page.getByRole("tab", { name, exact: true })).toHaveAttribute("aria-selected", "true");
}

async function openReadyUnit(page: Page) {
  await selectSection(page, "Actividades");
  const unit = page.getByRole("button", { name: /Unidad 1.*Pared torácica/ });
  if (!(await page.getByLabel("Nombre de la unidad").isVisible())) await unit.click();
  await expect(page.getByLabel("Nombre de la unidad")).toBeVisible();
}

async function openFirstActivity(page: Page) {
  const activity = page.getByRole("button", { name: /Actividad 1.*Comprender la pared torácica/ });
  if (!(await page.getByLabel("Nombre de la actividad").isVisible())) await activity.click();
  await expect(page.getByLabel("Nombre de la actividad")).toBeVisible();
}

async function openDeleteConfirmation(page: Page) {
  await openReadyUnit(page);
  await page.getByRole("button", { name: "Acciones de la unidad Pared torácica" }).click();
  await page.getByRole("menuitem", { name: "Eliminar unidad" }).click();
  await expect(page.getByRole("alertdialog")).toBeVisible();
  await expect(page.getByRole("heading", { name: "¿Eliminar esta unidad?" })).toBeVisible();
}

async function openMaterialPicker(page: Page) {
  await openReadyUnit(page);
  const addActivity = page.getByRole("button", { name: "Añadir actividad" });
  await addActivity.click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Añadir actividad a Pared torácica" })).toBeVisible();
  return addActivity;
}

async function auditEditor(page: Page, testInfo: TestInfo, state: string) {
  await page.evaluate(async () => {
    await Promise.all(document.getAnimations().map((animation) => animation.finished.catch(() => undefined)));
  });
  const report = await new AxeBuilder({ page })
    .include("[data-editor-surface]")
    .withTags(axeTags)
    .analyze();
  await testInfo.attach(`axe-${state}-${testInfo.project.name}`, {
    body: Buffer.from(JSON.stringify(report, null, 2)),
    contentType: "application/json",
  });
  expect(report.violations, report.violations.map((entry) => `${entry.id}: ${entry.help}`).join("\n")).toEqual([]);
}

test.describe("editor cotidiano con transporte fixture en memoria", () => {
  test("el índice distingue un borrador nuevo de una ruta con publicación previa", async ({ page }) => {
    await page.goto("/visual-fixtures/editor-rutas?estado=legacy&vista=indice");
    await expect(page.getByRole("heading", { name: "Rutas de aprendizaje" })).toBeVisible();
    await expect(page.getByText("Borrador de ruta publicada", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: /Archivar ruta/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /Eliminar ruta/ })).toBeVisible();
    await page.getByRole("button", { name: /Eliminar ruta/ }).click();
    await expect(page.getByRole("alertdialog")).toContainText("progreso de los usuarios");
    await page.getByRole("button", { name: "Cancelar" }).click();
    await page.getByRole("button", { name: /Eliminar ruta/ }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Eliminar ruta" }).click();
    await expect(page.getByText("Aún no hay rutas")).toBeVisible();
  });

  test("crea la ruta nominal y respeta guardar → validar → enviar", async ({ page }) => {
    await openFixture(page, "new");
    await expect(page.getByRole("tab")).toHaveCount(3);
    await page.getByLabel("Título de la ruta").fill("Ruta clínica del tórax");
    await page.getByLabel("Tema").selectOption({ label: "Anatomía" });
    await page.getByLabel("Descripción breve").fill("Reconocer estructuras y comprobar relaciones anatómicas.");

    await selectSection(page, "Actividades");
    await page.getByRole("button", { name: "Añadir unidad" }).click();
    await page.getByLabel("Nombre de la unidad").fill("Unidad torácica");
    await page.getByRole("textbox", { name: /^Objetivo/ }).first().fill("Identificar las estructuras principales del tórax");

    await page.getByRole("button", { name: "Añadir actividad" }).click();
    const guide = page.getByRole("listitem").filter({ hasText: "Pared torácica: guía visual" });
    await guide.getByRole("button", { name: "Elegir" }).click();
    await page.getByRole("radio", { name: "Guía", exact: true }).check();
    await expect(page.getByText(/Pared torácica: guía visual · Guía/)).toBeVisible();
    await page.getByRole("button", { name: "Añadir a Unidad torácica" }).click();

    await page.getByRole("button", { name: "Añadir actividad" }).click();
    const quiz = page.getByRole("listitem").filter({ hasText: "Comprobación de la pared torácica" });
    await quiz.getByRole("button", { name: "Elegir" }).click();
    await page.getByRole("radio", { name: "Cuestionario", exact: true }).check();
    await expect(page.getByText(/Comprobación de la pared torácica · Cuestionario/)).toBeVisible();
    await page.getByRole("button", { name: "Añadir a Unidad torácica" }).click();
    await expect(page.getByText("Texto del botón")).toBeHidden();

    await selectSection(page, "Revisión");
    await page.getByRole("button", { name: "Comprobar ruta" }).click();
    await expect(page.getByText("No encontramos puntos pendientes en esta versión guardada.")).toBeVisible();
    await page.getByRole("button", { name: "Enviar a revisión" }).click();
    await expect(page.getByText("En revisión", { exact: true }).first()).toBeVisible();

    const calls = (await requestLog(page)).split("|");
    const created = calls.indexOf("create");
    const validated = calls.indexOf("validate:1");
    const transitioned = calls.indexOf("transition:in_review:1");
    expect(created).toBeGreaterThanOrEqual(0);
    expect(validated).toBeGreaterThan(created);
    expect(transitioned).toBeGreaterThan(validated);
  });

  test("elimina una unidad con confirmación local, permite cancelar y guarda cero unidades", async ({ page }) => {
    await openFixture(page, "ready");
    await openDeleteConfirmation(page);
    const cancel = page.getByRole("button", { name: "Cancelar" });
    await expect(cancel).toBeFocused();
    await cancel.click();
    await expect(page.getByRole("button", { name: /Unidad 1.*Pared torácica/ })).toBeVisible();

    await page.getByRole("button", { name: "Acciones de la unidad Pared torácica" }).click();
    await page.getByRole("menuitem", { name: "Eliminar unidad" }).click();
    await page.getByRole("button", { name: "Eliminar unidad" }).click();
    await expect(page.getByText("Empieza por una unidad")).toBeVisible();
    await expect(page.getByRole("button", { name: "Añadir unidad" })).toBeFocused();
    await page.getByRole("button", { name: "Guardar borrador" }).click();
    await expect(page.getByText("Borrador al día")).toBeVisible();
    expect(await requestLog(page)).toContain("save:1");

    await selectSection(page, "Revisión");
    await page.getByRole("button", { name: "Comprobar ruta" }).click();
    await expect(page.getByText("La ruta todavía no tiene unidades")).toBeVisible();
    await expect(page.getByText("Añade una unidad para organizar las actividades.")).toBeVisible();
    await expect(page.getByText(/version\.units|DTO|fd000000/i)).toHaveCount(0);
  });

  test("mantiene material fijado fuera de la primera página y pagina sin perderlo", async ({ page }) => {
    await openFixture(page, "off-page");
    await openReadyUnit(page);
    await openFirstActivity(page);
    await expect(page.getByText("Pared torácica: guía visual", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Añadir actividad" }).click();
    await expect(page.getByRole("listitem")).toHaveCount(1);
    await page.getByRole("button", { name: "Cargar más" }).click();
    await expect(page.getByRole("listitem").filter({ hasText: "Comprobación de la pared torácica" })).toBeVisible();
    await page.getByLabel("Buscar por título").fill("Comprobación");
    await page.getByRole("button", { name: "Buscar", exact: true }).click();
    await expect(page.getByRole("listitem")).toHaveCount(1);
    await expect(page.getByRole("listitem")).toContainText("Comprobación de la pared torácica");
    await page.getByRole("button", { name: "Cancelar" }).click();
    await expect(page.getByText("Pared torácica: guía visual", { exact: true })).toBeVisible();
  });

  test("aborta respuestas de filtros obsoletos y no vuelve a consultar al recuperar foco", async ({ page }) => {
    await openFixture(page, "ready", "slow");
    await openMaterialPicker(page);
    const search = page.getByLabel("Buscar por título");
    await search.fill("Pared");
    await search.press("Enter");
    await search.fill("Comprobación");
    await search.press("Enter");
    await expect(page.getByRole("listitem")).toHaveCount(1);
    await expect(page.getByRole("listitem")).toContainText("Comprobación de la pared torácica");
    await expect(page.getByText("No pudimos consultar los materiales.")).toHaveCount(0);
    const beforeFocus = (await requestLog(page)).split("|").filter((entry) => entry === "search").length;
    await page.evaluate(() => window.dispatchEvent(new Event("focus")));
    const afterFocus = (await requestLog(page)).split("|").filter((entry) => entry === "search").length;
    expect(afterFocus).toBe(beforeFocus);
  });

  test("bloquea doble guardado y conserva el orden de la única operación", async ({ page }) => {
    await openFixture(page, "ready", "slow");
    await page.getByLabel("Título de la ruta").fill("Anatomía esencial actualizada");
    const save = page.getByRole("button", { name: "Guardar borrador" });
    await save.dblclick();
    await expect(page.getByRole("button", { name: "Guardando…" })).toBeDisabled();
    await expect(page.getByText("Borrador al día")).toBeVisible();
    const saves = (await requestLog(page)).split("|").filter((entry) => entry.startsWith("save:"));
    expect(saves).toEqual(["save:1"]);
  });

  test("un fallo de guardado impide validar y mantiene el borrador dirty", async ({ page }) => {
    await openFixture(page, "ready", "save-503");
    await page.getByLabel("Título de la ruta").fill("Cambio que debe conservarse");
    await selectSection(page, "Revisión");
    await page.getByRole("button", { name: "Comprobar ruta" }).click();
    await expect(page.getByText("No pudimos confirmar el guardado. Tus cambios siguen aquí. Vuelve a intentar.").first()).toBeVisible();
    expect(await requestLog(page)).toBe("save:1");
    await selectSection(page, "Datos");
    await expect(page.getByLabel("Título de la ruta")).toHaveValue("Cambio que debe conservarse");
    await expect(page.getByText("Cambios sin guardar").first()).toBeVisible();
  });

  test("rechaza una validación confirmada para otra versión", async ({ page }) => {
    await openFixture(page, "ready", "validate-stale");
    await selectSection(page, "Revisión");
    await page.getByRole("button", { name: "Comprobar ruta" }).click();
    await expect(page.getByText("Actualiza el editor para completar la comprobación.").first()).toBeVisible();
    await expect(page.getByText("La ruta está lista para revisión", { exact: false })).toHaveCount(0);
    expect(await requestLog(page)).toContain("validate:1");
  });

  test("presenta errores accionables y warning limited sin tecnicismos", async ({ page }) => {
    await openFixture(page, "errors");
    await selectSection(page, "Revisión");
    await page.getByRole("button", { name: "Comprobar ruta" }).click();
    await expect(page.getByText("Falta una actividad para comprender este objetivo")).toBeVisible();
    await expect(page.getByText("Faltan 2 preguntas o tarjetas para este objetivo")).toBeVisible();
    await expect(page.getByRole("button", { name: "Añadir explicación" })).toBeVisible();
    await expect(page.getByText(/objective\.|version\.units|fd000000|Mensaje técnico de fixture/)).toHaveCount(0);
    await page.getByRole("button", { name: "Añadir explicación" }).click();
    await expect(page.getByRole("heading", { name: "Añadir actividad a Pared torácica" })).toBeVisible();
    await page.getByRole("button", { name: "Cancelar" }).click();

    await openFixture(page, "limited");
    await selectSection(page, "Revisión");
    await page.getByRole("button", { name: "Comprobar ruta" }).click();
    await expect(page.getByText("Este objetivo tiene práctica introductoria")).toBeVisible();
    await expect(page.getByText(/La ruta está lista para revisión\. Hay 1 sugerencias opcionales/)).toBeVisible();
    await page.getByRole("button", { name: "Enviar a revisión" }).click();
    await expect(page.getByText("En revisión", { exact: true }).first()).toBeVisible();
  });

  test("conserva borrador ante conflicto y recupera cambios solo en la misma ruta y actor", async ({ page }) => {
    await openFixture(page, "ready", "save-409");
    await page.getByLabel("Título de la ruta").fill("Borrador en conflicto");
    await page.getByRole("button", { name: "Guardar borrador" }).click();
    await expect(page.getByText("La ruta cambió en otra sesión", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Descargar mis cambios" })).toBeVisible();
    await expect(page.getByLabel("Título de la ruta")).toHaveValue("Borrador en conflicto");
    await expect.poll(() => page.evaluate(() => sessionStorage.length)).toBeGreaterThan(0);
    const storedRecovery = await page.evaluate(() => Object.entries(sessionStorage));
    expect(storedRecovery.map(([, value]) => value).join("\n")).toContain("Borrador en conflicto");

    await page.reload();
    expect(await page.evaluate(() => Object.values(sessionStorage).join("\n"))).toContain("Borrador en conflicto");
    await expect(page.getByRole("button", { name: "Recuperar" })).toBeVisible();
    await page.getByRole("button", { name: "Recuperar" }).click();
    await expect(page.getByLabel("Título de la ruta")).toHaveValue("Borrador en conflicto");
    await expect(page.getByText("Cambios sin guardar").first()).toBeVisible();
  });

  test("selector, ayuda y eliminación funcionan con teclado y restauran foco", async ({ page }) => {
    await openFixture(page, "ready");
    const addActivity = await openMaterialPicker(page);
    await expect(page.getByLabel("Buscar por título")).toBeFocused();
    const pickerDialog = page.getByRole("dialog");
    for (let index = 0; index < 12; index += 1) {
      await page.keyboard.press("Tab");
      expect(await pickerDialog.evaluate((dialog) => dialog.contains(document.activeElement))).toBe(true);
    }
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(addActivity).toBeFocused();

    const help = page.getByRole("button", { name: "Ayuda: Cómo redactar objetivos" });
    await help.focus();
    await page.keyboard.press("Enter");
    await expect(page.getByText(/Describe una acción que el estudiante podrá realizar/)).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByText(/Describe una acción que el estudiante podrá realizar/)).toHaveCount(0);
    await expect(help).toBeFocused();

    await page.getByRole("button", { name: "Acciones de la unidad Pared torácica" }).focus();
    await page.keyboard.press("Enter");
    await page.getByRole("menuitem", { name: "Eliminar unidad" }).focus();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("button", { name: "Cancelar" })).toBeFocused();
    const deleteDialog = page.getByRole("alertdialog");
    for (let index = 0; index < 4; index += 1) {
      await page.keyboard.press("Tab");
      expect(await deleteDialog.evaluate((dialog) => dialog.contains(document.activeElement))).toBe(true);
    }
    await page.keyboard.press("Escape");
    await expect(page.getByRole("alertdialog")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Acciones de la unidad Pared torácica" })).toBeFocused();
  });

  test("vista previa usa el borrador actual y no solicita tracking de estudiante", async ({ page }) => {
    const studentRequests: string[] = [];
    page.on("request", (request) => {
      if (/\/(attempts|enrollments|rewards|complete)(?:\/|\?|$)/.test(new URL(request.url()).pathname)) {
        studentRequests.push(request.url());
      }
    });
    await openFixture(page, "ready");
    await page.getByLabel("Título de la ruta").fill("Vista previa del cambio local");
    const before = await requestLog(page);
    await page.getByRole("button", { name: "Vista previa" }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Vista previa del cambio local" })).toBeVisible();
    await expect(page.getByText("no registra actividad de estudio", { exact: false })).toBeVisible();
    await page.getByRole("button", { name: "Cerrar vista previa" }).click();
    expect(studentRequests).toEqual([]);
    expect(await requestLog(page)).toBe(before);
  });

  test("publicada y archivada permanecen de solo lectura y solo la publicada puede clonarse", async ({ page }) => {
    await openFixture(page, "published");
    await expect(page.getByLabel("Título de la ruta")).toBeDisabled();
    await expect(page.getByRole("button", { name: "Guardar borrador" })).toBeDisabled();
    await selectSection(page, "Revisión");
    await expect(page.getByRole("button", { name: "Archivar ruta" })).toBeVisible();
    await page.getByRole("button", { name: "Crear nueva versión para editar" }).click();
    await expect(page.getByText("Borrador", { exact: true }).first()).toBeVisible();
    await expect(page.getByRole("button", { name: "Archivar ruta" })).toBeVisible();
    await selectSection(page, "Datos");
    await expect(page.getByLabel("Título de la ruta")).toBeEnabled();

    await openFixture(page, "archived");
    await expect(page.getByLabel("Título de la ruta")).toBeDisabled();
    await selectSection(page, "Revisión");
    await expect(page.getByRole("button", { name: "Crear nueva versión para editar" })).toHaveCount(0);
    await expect(page.getByText("Esta ruta está archivada. No admite edición ni publicación.")).toBeVisible();
  });

  test("contenido heredado conserva dos objetivos, cuatro formatos y alternativas", async ({ page }) => {
    await openFixture(page, "legacy");
    await openReadyUnit(page);
    await expect(page.getByRole("textbox", { name: /^Objetivo/ }).nth(0)).toHaveValue("Identificar las estructuras principales de la pared torácica");
    await expect(page.getByRole("textbox", { name: /^Objetivo/ }).nth(1)).toHaveValue("Explicar las relaciones del mediastino");
    await openFirstActivity(page);
    await page.getByRole("button", { name: "Más opciones" }).click();
    await expect(page.getByText("Materiales y alternativas")).toBeVisible();
    await expect(page.getByText("Guía", { exact: true }).last()).toBeVisible();
    await expect(page.getByText("Video", { exact: true }).last()).toBeVisible();
    await expect(page.getByLabel("Uso de esta actividad")).toHaveValue("integrate");
  });

  test("reflow no crea overflow de página en los cinco anchos", async ({ page }) => {
    for (const viewport of [
      { height: 800, width: 320 },
      { height: 844, width: 390 },
      { height: 1024, width: 768 },
      { height: 768, width: 1024 },
      { height: 900, width: 1440 },
    ]) {
      await page.setViewportSize(viewport);
      await openFixture(page, "long");
      await expect.poll(() => page.evaluate(() => ({
        client: document.documentElement.clientWidth,
        scroll: document.documentElement.scrollWidth,
      }))).toEqual({ client: viewport.width, scroll: viewport.width });
      await expect(page.getByRole("button", { name: "Guardar borrador" })).toBeVisible();
    }
  });
});

test("accesibilidad automática en Datos, unidad, selector, errores y confirmación", async ({ page }, testInfo) => {
  await openFixture(page, "ready");
  await auditEditor(page, testInfo, "datos");

  await openReadyUnit(page);
  await auditEditor(page, testInfo, "unidad-expandida");

  await page.getByRole("button", { name: "Añadir actividad" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await auditEditor(page, testInfo, "selector-abierto");
  await page.keyboard.press("Escape");

  await openFixture(page, "errors");
  await selectSection(page, "Revisión");
  await page.getByRole("button", { name: "Comprobar ruta" }).click();
  await expect(page.getByText("Falta una actividad para comprender este objetivo")).toBeVisible();
  await auditEditor(page, testInfo, "revision-con-errores");

  await openFixture(page, "ready");
  await openDeleteConfirmation(page);
  await auditEditor(page, testInfo, "confirmacion-eliminacion");
});
