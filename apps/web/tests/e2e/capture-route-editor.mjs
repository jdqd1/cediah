import AxeBuilder from "@axe-core/playwright";
import { chromium } from "@playwright/test";
import { writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

const baseUrl = process.env.EDITOR_FIXTURE_URL ?? "http://127.0.0.1:3100";
const evidenceDir = resolve(fileURLToPath(new URL("../../../../docs/aprendizaje-guiado/evidencias-editor/", import.meta.url)));
const axeTags = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];
const browser = await chromium.launch();
const context = await browser.newContext({
  colorScheme: "light",
  reducedMotion: "reduce",
  viewport: { height: 900, width: 1440 },
});
const page = await context.newPage();
const measurements = [];

async function openFixture(state = "ready", extras = "") {
  await page.goto(`${baseUrl}/visual-fixtures/editor-rutas?estado=${state}${extras}`);
  await page.getByRole("link", { name: "Volver a rutas" }).waitFor();
  await page.getByRole("tablist", { name: "Secciones del editor de rutas" }).waitFor();
  await page.evaluate(async () => {
    await Promise.all(document.getAnimations().map((animation) => animation.finished.catch(() => undefined)));
  });
}

async function selectSection(name) {
  await page.getByRole("tab", { name, exact: true }).click();
  await page.getByRole("tab", { name, exact: true }).getAttribute("aria-selected");
}

async function openUnit() {
  await selectSection("Actividades");
  const name = page.getByLabel("Nombre de la unidad");
  if (!(await name.isVisible())) await page.getByRole("button", { name: /Unidad 1.*Pared torácica/ }).click();
  await name.waitFor();
}

async function capture(name, { fullPage = true } = {}) {
  await page.evaluate(async () => {
    await Promise.all(document.getAnimations().map((animation) => animation.finished.catch(() => undefined)));
  });
  await page.screenshot({ caret: "initial", fullPage, path: resolve(evidenceDir, name) });
}

async function audit(label) {
  const report = await new AxeBuilder({ page }).include("[data-editor-surface]").withTags(axeTags).analyze();
  measurements.push({
    axe: {
      incomplete: report.incomplete.map(({ help, id, nodes }) => ({
        help,
        id,
        nodeCount: nodes.length,
        nodes: nodes.map(({ failureSummary, html, target }) => ({ failureSummary, html, target })),
      })),
      violations: report.violations.map(({ help, id, nodes }) => ({
        help,
        id,
        nodeCount: nodes.length,
        nodes: nodes.map(({ failureSummary, html, target }) => ({ failureSummary, html, target })),
      })),
    },
    label,
    viewport: page.viewportSize(),
  });
}

async function contrast(label, locator) {
  const result = await locator.evaluate((element) => {
    function channels(value) {
      const match = value.match(/[\d.]+/g)?.slice(0, 3).map(Number);
      return match?.length === 3 ? match : [0, 0, 0];
    }
    function luminance(rgb) {
      const converted = rgb.map((value) => {
        const channel = value / 255;
        return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
      });
      return 0.2126 * converted[0] + 0.7152 * converted[1] + 0.0722 * converted[2];
    }
    const foreground = getComputedStyle(element).color;
    let backgroundNode = element;
    let background = getComputedStyle(backgroundNode).backgroundColor;
    while (backgroundNode.parentElement && (background === "transparent" || /rgba\([^)]*,\s*0\)/.test(background))) {
      backgroundNode = backgroundNode.parentElement;
      background = getComputedStyle(backgroundNode).backgroundColor;
    }
    const foregroundLuminance = luminance(channels(foreground));
    const backgroundLuminance = luminance(channels(background));
    return {
      background,
      foreground,
      ratio: Number(((Math.max(foregroundLuminance, backgroundLuminance) + 0.05) / (Math.min(foregroundLuminance, backgroundLuminance) + 0.05)).toFixed(2)),
    };
  });
  measurements.push({ contrast: result, label, viewport: page.viewportSize() });
}

async function overlap(label, target, blocker) {
  await target.evaluate((element) => element.scrollIntoView({ block: "center" }));
  const [targetBox, blockerBox] = await Promise.all([target.boundingBox(), blocker.boundingBox()]);
  const intersects = Boolean(targetBox && blockerBox
    && targetBox.x < blockerBox.x + blockerBox.width
    && targetBox.x + targetBox.width > blockerBox.x
    && targetBox.y < blockerBox.y + blockerBox.height
    && targetBox.y + targetBox.height > blockerBox.y);
  measurements.push({ blockerBox, intersects, label, targetBox, viewport: page.viewportSize() });
}

await page.setViewportSize({ height: 900, width: 1440 });
await page.goto(`${baseUrl}/visual-fixtures/editor-rutas?estado=ready&vista=indice`);
await page.getByRole("heading", { name: "Rutas de aprendizaje" }).waitFor();
await capture("01-indice-desktop-1440.png");

await openFixture("ready");
await capture("02-datos-desktop-1440.png");
await contrast("texto principal", page.getByRole("heading", { name: "Anatomía esencial del tórax" }));
await contrast("texto secundario", page.getByText("Organiza qué aprender, elige materiales publicados y comprueba la ruta antes de enviarla."));
await contrast("pestaña activa", page.getByRole("tab", { name: "Datos", exact: true }));
await audit("datos-desktop");

await page.setViewportSize({ height: 844, width: 390 });
await openFixture("ready");
await capture("03-datos-mobile-390.png");

await page.setViewportSize({ height: 900, width: 1440 });
await openFixture("ready");
await openUnit();
await capture("04-unidad-actividades-desktop-1440.png");
await audit("unidad-desktop");

await page.setViewportSize({ height: 844, width: 390 });
await openFixture("ready");
await openUnit();
await capture("05-unidad-actividades-mobile-390.png");

await page.setViewportSize({ height: 900, width: 1440 });
await openFixture("ready");
await openUnit();
await page.getByRole("button", { name: "Añadir actividad" }).click();
await page.getByRole("dialog").waitFor();
await capture("06-selector-resultados-desktop-1440.png", { fullPage: false });
await audit("selector-desktop");

await page.setViewportSize({ height: 844, width: 390 });
await openFixture("ready");
await openUnit();
await page.getByRole("button", { name: "Añadir actividad" }).click();
await page.getByRole("dialog").waitFor();
await capture("07-selector-resultados-mobile-390.png", { fullPage: false });

await page.setViewportSize({ height: 900, width: 1440 });
await openFixture("empty-catalog");
await openUnit();
await page.getByRole("button", { name: "Añadir actividad" }).click();
await page.getByRole("dialog").waitFor();
await capture("08-selector-vacio-desktop-1440.png", { fullPage: false });

await openFixture("errors");
await selectSection("Revisión");
await page.getByRole("button", { name: "Comprobar ruta" }).click();
await page.getByText("Falta una actividad para comprender este objetivo").waitFor();
await page.getByText("Falta una actividad para comprender este objetivo").evaluate((element) => {
  element.closest("li")?.scrollIntoView({ block: "start" });
  window.scrollBy(0, -120);
});
await capture("09-revision-errores-desktop-1440.png", { fullPage: false });
await overlap(
  "acción de error frente a barra de guardado",
  page.getByRole("button", { name: "Añadir práctica" }),
  page.getByText("Borrador al día").locator("..").locator(".."),
);
await contrast("error accionable", page.getByText("Falta una actividad para comprender este objetivo"));
await audit("revision-errores-desktop");

await page.setViewportSize({ height: 844, width: 390 });
await openFixture("ready");
await openUnit();
await page.getByRole("button", { name: "Acciones de la unidad Pared torácica" }).click();
await page.getByRole("menuitem", { name: "Eliminar unidad" }).click();
await page.getByRole("alertdialog").waitFor();
await capture("10-confirmacion-eliminacion-mobile-390.png", { fullPage: false });
await contrast("texto de confirmación", page.getByText(/Se quitará «Pared torácica»/));
await audit("confirmacion-mobile");

await page.setViewportSize({ height: 900, width: 1440 });
await openFixture("published");
await capture("11-version-publicada-desktop-1440.png");

await page.setViewportSize({ height: 800, width: 320 });
await openFixture("new");
await capture("12-formulario-mobile-320.png");
await overlap(
  "último campo frente a barra de guardado a 320 px",
  page.getByLabel("Descripción breve"),
  page.getByText("Borrador al día").locator("..").locator(".."),
);

await page.setViewportSize({ height: 900, width: 1440 });
await openFixture("ready");
await page.getByRole("button", { name: "Vista previa" }).click();
await page.getByRole("dialog").waitFor();
await capture("13-vista-previa-desktop-1440.png", { fullPage: false });

await page.setViewportSize({ height: 1024, width: 768 });
await openFixture("long");
await capture("14-datos-tablet-768.png");

await page.setViewportSize({ height: 768, width: 1024 });
await openFixture("ready");
await openUnit();
await capture("15-unidad-tablet-1024.png");

await page.setViewportSize({ height: 900, width: 720 });
await openFixture("ready");
await capture("16-zoom-200-equivalente-1440.png");
measurements.push({
  label: "zoom-200-equivalente",
  note: "Viewport CSS de 720 px para una ventana física de 1440 px: reflow equivalente a zoom de página 200 %.",
  overflow: await page.evaluate(() => ({ clientWidth: document.documentElement.clientWidth, scrollWidth: document.documentElement.scrollWidth })),
  viewport: page.viewportSize(),
});

await writeFile(resolve(evidenceDir, "t021-mediciones.json"), `${JSON.stringify(measurements, null, 2)}\n`, "utf8");
await browser.close();
