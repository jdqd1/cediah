import { writeFile } from "node:fs/promises";
import { expect, test } from "@playwright/test";

test("renders a bounded canvas, pans without changing levels and measures warm navigation", async ({
  page,
  isMobile,
}, testInfo) => {
  test.skip(
    isMobile,
    "Desktop performance sample; mobile behavior is covered by the journey tests.",
  );
  test.setTimeout(90_000);
  await page.goto("/visual-fixtures/mapa?estado=large");
  await expect(page.locator(".react-flow__node").first()).toBeVisible();
  expect(await page.locator(".react-flow__node").count()).toBeLessThan(200);
  const viewport = page.locator(".react-flow__viewport");
  const before = await viewport.getAttribute("style");
  const pane = await page.locator(".react-flow__pane").boundingBox();
  await page.mouse.move(pane!.x + 8, pane!.y + 8);
  await page.mouse.down();
  await page.mouse.move(pane!.x + 88, pane!.y + 48, { steps: 10 });
  await page.mouse.up();
  await expect(viewport).not.toHaveAttribute("style", before!);
  expect(new URL(page.url()).searchParams.has("node")).toBe(false);
  await page
    .getByRole("button", { name: "Vista de lista", exact: true })
    .click();
  await expect(page.getByRole("article")).toHaveCount(200);
  await page.goto("/visual-fixtures/mapa");
  // Both synthetic datasets reuse a map ID; discard the 200-item encuadre explicitly.
  await page
    .getByRole("button", { name: "Ajustar vista", exact: true })
    .click();
  const durations: number[] = [];
  for (let i = 0; i < 35; i++) {
    const started = await page.evaluate(() => performance.now());
    if (i % 2 === 0) {
      await page
        .getByRole("button", { name: "Abrir Anatomía", exact: true })
        .click();
      await expect(
        page.getByRole("heading", { name: "Anatomía", exact: true }),
      ).toBeVisible();
    } else {
      await page.getByRole("button", { name: "Mi mapa", exact: true }).click();
      await expect(
        page.getByRole("heading", {
          name: "Mi mapa de aprendizaje",
          exact: true,
        }),
      ).toBeVisible();
    }
    await expect(page.locator("[data-phase]")).toHaveAttribute(
      "data-phase",
      "idle",
    );
    const elapsed = (await page.evaluate(() => performance.now())) - started;
    if (i >= 5) durations.push(elapsed);
  }
  durations.sort((a, b) => a - b);
  await writeFile(
    testInfo.outputPath("navigation-performance.json"),
    JSON.stringify(
      {
        environment: "Next development, browser automation included",
        warmups: 5,
        samples: durations.length,
        p95Ms: Math.round(durations[Math.ceil(durations.length * 0.95) - 1]!),
      },
      null,
      2,
    ),
  );
});
