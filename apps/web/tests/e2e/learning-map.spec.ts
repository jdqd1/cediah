import { test, expect } from "@playwright/test";
const root = "/visual-fixtures/mapa";
const node = "b1000000-0000-4000-8000-000000000001",
  block = "b1000000-0000-4000-8000-000000000022";
test("six visual states and responsive widths remain readable", async ({
  page,
}, testInfo) => {
  test.setTimeout(90_000);
  for (const [name, query] of Object.entries({
    root: "",
    node: `node=${node}`,
    block: `node=${node}&item=${block}`,
    lesson: `node=${node}&item=${block}&unit=leccion-2`,
    direct: "node=b1000000-0000-4000-8000-000000000003",
    mixed: `estado=mixed&node=${node}`,
  })) {
    await page.goto(`${root}?${query}`);
    await expect(
      page.getByRole("button", {
        name: "Vista de lista",
        exact: true,
        includeHidden: true,
      }),
    ).toBeVisible();
    await expect(
      page
        .locator('[role="status"]')
        .filter({ hasText: "Posiciones guardadas" }),
    ).toBeAttached();
    await expect(page.locator(".react-flow__node").first()).toBeAttached();
    await page.screenshot({
      path: testInfo.outputPath(`${name}.png`),
      fullPage: true,
    });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
  for (const width of [320, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(`${root}?estado=long`);
    await expect(page.locator(".react-flow__node").first()).toBeVisible();
    const cards = await page
      .locator(".react-flow__node article")
      .evaluateAll((elements) =>
        elements.map((el) => {
          const rect = el.getBoundingClientRect();
          return {
            x: rect.x,
            y: rect.y,
            right: rect.right,
            bottom: rect.bottom,
            height: rect.height,
          };
        }),
      );
    expect(new Set(cards.map((card) => Math.round(card.height))).size).toBe(1);
    for (let i = 0; i < cards.length; i++)
      for (let j = i + 1; j < cards.length; j++) {
        const a = cards[i]!,
          b = cards[j]!;
        expect(
          a.x < b.right && b.x < a.right && a.y < b.bottom && b.y < a.bottom,
        ).toBe(false);
      }
    await page.screenshot({
      path: testInfo.outputPath(`long-canvas-${width}.png`),
      fullPage: true,
    });
    await page
      .getByRole("button", { name: "Vista de lista", exact: true })
      .click();
    const contentFits = await page.locator("article").evaluateAll((elements) =>
      elements.every((el) => {
        const card = el.getBoundingClientRect();
        const button = el
          .querySelector("button[data-map-open]")!
          .getBoundingClientRect();
        return button.bottom <= card.bottom + 1;
      }),
    );
    expect(contentFits).toBe(true);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: testInfo.outputPath(`long-${width}.png`),
      fullPage: true,
    });
  }
});
test("hierarchy, deep links, back/forward and lesson panel", async ({
  page,
  isMobile,
}, testInfo) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(root);
  if (isMobile)
    await page
      .getByRole("button", { name: "Vista de lista", exact: true })
      .click();
  await expect(
    page.getByRole("button", { name: "Abrir Anatomía", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Abrir Anatomía", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Anatomía", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Abrir Tórax", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Tórax", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Abrir Corazón", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Corazón", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("13 % · 1/8 esenciales", { exact: false }),
  ).toBeVisible();
  await page.screenshot({
    path: testInfo.outputPath("lesson.png"),
    fullPage: true,
  });
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Corazón", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Cerrar lección", exact: true })
    .click();
  await expect(page).not.toHaveURL(/unit=/);
  await page
    .getByRole("button", { name: "Atrás en el mapa", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Anatomía", exact: true }),
  ).toBeVisible();
  await page.goBack();
  await expect(
    page.getByRole("heading", { name: "Tórax", exact: true }),
  ).toBeVisible();
  await page.goForward();
  await expect(
    page.getByRole("heading", { name: "Anatomía", exact: true }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});
test("list, keyboard dialog and document reflow", async ({
  page,
}, testInfo) => {
  await page.goto(`${root}?node=${node}&item=${block}`);
  await page
    .getByRole("button", { name: "Vista de lista", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Abrir Corazón", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Nuevo nodo", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "Crear nodo" })).toBeVisible();
  await expect(
    page.getByRole("textbox", { name: "Nombre del nodo" }),
  ).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Nuevo nodo", exact: true }),
  ).toBeFocused();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: testInfo.outputPath("list.png"),
    fullPage: true,
  });
});
test("manual zoom keeps hierarchy and reduced motion stays usable", async ({
  page,
  isMobile,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto(root);
  await page.getByRole("button", { name: "Restablecer zoom al 100 %" }).click();
  await expect(
    page.getByRole("button", { name: "Restablecer zoom al 100 %" }),
  ).toContainText("100");
  await page.getByRole("button", { name: "Acercar", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Restablecer zoom al 100 %" }),
  ).toContainText("110");
  expect(new URL(page.url()).searchParams.has("node")).toBe(false);
  if (isMobile)
    await page
      .getByRole("button", { name: "Vista de lista", exact: true })
      .click();
  await page
    .getByRole("button", { name: "Abrir Anatomía", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Anatomía", exact: true }),
  ).toBeVisible();
});
