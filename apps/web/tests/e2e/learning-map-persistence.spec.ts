import { test, expect } from "@playwright/test";
test.describe("disposable API/SQL persistence", () => {
  test.skip(
    process.env.MAP_E2E_REAL !== "true",
    "Requires the isolated learning-map-server and API_BASE_URL=http://127.0.0.1:4100",
  );
  test("account change clears private encuadres and rejects another account's deep link", async ({
    page,
    context,
  }) => {
    await context.addCookies([
      { name: "map_e2e", value: "student", url: "http://localhost:3000" },
    ]);
    await page.goto("/aprendizaje/mapa");
    await page
      .getByRole("button", { name: "Vista de lista", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Abrir Mi nodo E2E", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: "Mi nodo E2E", exact: true }),
    ).toBeVisible();
    const privateUrl = page.url();
    await page.evaluate(() =>
      sessionStorage.setItem(
        "learning-map:v1:c1000000-0000-4000-8000-000000000001:corrupt",
        "{broken",
      ),
    );
    await context.addCookies([
      { name: "map_e2e", value: "other", url: "http://localhost:3000" },
    ]);
    await page.goto(privateUrl);
    await expect(
      page.getByText("Este contenido ya no está disponible en tu mapa."),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Abrir Bloque E2E", exact: true }),
    ).toHaveCount(0);
    expect(
      await page.evaluate(() =>
        Object.keys(sessionStorage).some((key) =>
          key.includes("c1000000-0000-4000-8000-000000000001"),
        ),
      ),
    ).toBe(false);
    await page
      .getByRole("button", { name: "Ir a mi mapa", exact: true })
      .click();
    await expect(
      page.getByRole("heading", {
        name: "Un espacio para tu aprendizaje",
        exact: true,
      }),
    ).toBeVisible();
  });
  test("creates, adds contextual content, completes a block and undoes removal", async ({
    page,
    context,
    isMobile,
  }, testInfo) => {
    await context.addCookies([
      { name: "map_e2e", value: "student", url: "http://localhost:3000" },
    ]);
    await page.goto("/aprendizaje/mapa");
    await page
      .getByRole("button", { name: "Vista de lista", exact: true })
      .click();
    const title = `Repaso ${testInfo.project.name}`;
    await page.getByRole("button", { name: "Nuevo nodo", exact: true }).click();
    await page.getByRole("textbox", { name: "Nombre del nodo" }).fill(title);
    await page.getByRole("button", { name: "Guardar", exact: true }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await page
      .getByRole("button", { name: `Abrir ${title}`, exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: title, exact: true }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Agregar contenido", exact: true })
      .first()
      .click();
    await page
      .getByRole("textbox", { name: "Buscar bloques o lecciones" })
      .fill("Lección E2E 1");
    await page
      .getByRole("button", { name: "Añadir Lección E2E 1", exact: true })
      .click();
    await expect(
      page.getByRole("button", { name: "Añadir Lección E2E 1", exact: true }),
    ).toBeDisabled();
    await page
      .getByRole("button", { name: "Cerrar diálogo", exact: true })
      .click();
    await expect(
      page.getByRole("button", { name: "Abrir Lección E2E 1", exact: true }),
    ).toBeVisible();
    if (isMobile)
      await page
        .getByRole("button", { name: "Sugerencias", exact: true })
        .click();
    await page
      .getByRole("button", { name: "Completar bloque", exact: true })
      .click();
    if (isMobile)
      await page
        .getByRole("button", { name: "Cerrar sugerencias", exact: true })
        .click();
    await expect(
      page.getByRole("button", { name: "Abrir Bloque E2E", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Abrir Lección E2E 1", exact: true }),
    ).toHaveCount(0);
    await page.getByLabel("Opciones de Bloque E2E", { exact: true }).click();
    await page
      .getByRole("button", { name: "Quitar del mapa", exact: true })
      .click();
    await page.getByRole("button", { name: "Quitar", exact: true }).click();
    await expect(
      page.getByRole("button", { name: "Abrir Bloque E2E", exact: true }),
    ).toHaveCount(0);
    await page.getByRole("button", { name: "Deshacer", exact: true }).click();
    await expect(
      page.getByRole("button", { name: "Abrir Bloque E2E", exact: true }),
    ).toBeVisible();
    await page.reload();
    await page
      .getByRole("button", { name: "Vista de lista", exact: true })
      .click();
    await expect(
      page.getByRole("button", { name: "Abrir Bloque E2E", exact: true }),
    ).toBeVisible();
  });
  test("organizes, reloads, launches a guide and returns to the same lesson", async ({
    page,
    context,
  }, testInfo) => {
    await context.addCookies([
      { name: "map_e2e", value: "student", url: "http://localhost:3000" },
    ]);
    await page.goto("/aprendizaje/mapa");
    await page
      .getByRole("button", { name: "Abrir Mi nodo E2E", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Abrir Bloque E2E", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Vista de lista", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Abrir Lección E2E 1", exact: true })
      .click();
    const returnUrl = page.url();
    await page
      .getByRole("button", {
        name: /^(Comenzar lección|Comenzar actividad|Continuar actividad)$/,
      })
      .click();
    await expect(page).toHaveURL(/\/aprendizaje\/sesiones\//, {
      timeout: 30_000,
    });
    await expect(
      page.getByText("Contenido sintético sin uso médico."),
    ).toBeVisible();
    await page.getByRole("link", { name: "Mi mapa", exact: true }).click();
    await expect(page).toHaveURL(returnUrl);
    await expect(
      page.getByRole("heading", { name: "Lección E2E 1", exact: true }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Cerrar lección", exact: true })
      .click();
    await expect(page).not.toHaveURL(/unit=/);
    await page
      .getByRole("button", { name: "Atrás en el mapa", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: "Mi nodo E2E", exact: true }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Atrás en el mapa", exact: true })
      .click();
    await expect(
      page.getByRole("heading", {
        name: "Mi mapa de aprendizaje",
        exact: true,
      }),
    ).toBeVisible();
    const listView = page.getByRole("button", {
      name: "Vista de lista",
      exact: true,
    });
    // A saved encuadre can leave a menu outside the compact viewport.
    // The equivalent list exposes every menu; moving switches back to the canvas.
    if (await listView.isVisible()) await listView.click();
    await page.getByLabel("Opciones de Mi nodo E2E", { exact: true }).click();
    await page
      .getByRole("button", { name: "Mover con teclado", exact: true })
      .click();
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("Enter");
    await expect(
      page.getByRole("status").filter({ hasText: "Posiciones guardadas" }),
    ).toBeVisible();
    const card = page.locator(".react-flow__node").filter({
      has: page.getByRole("button", {
        name: "Abrir Mi nodo E2E",
        exact: true,
      }),
    });
    const transform = await card.evaluate(
      (el) => (el as HTMLElement).style.transform,
    );
    await page.reload();
    await expect(
      page.getByRole("button", { name: "Abrir Mi nodo E2E", exact: true }),
    ).toBeVisible();
    await expect
      .poll(() => card.evaluate((el) => (el as HTMLElement).style.transform))
      .toBe(transform);
    await page.screenshot({
      path: testInfo.outputPath("persistent-map.png"),
      fullPage: true,
    });
  });
});
