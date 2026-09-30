import { execFileSync } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { expect, test } from "@playwright/test";

const fixtureDirectory = path.join(process.cwd(), "tests", "fixtures");

async function readFixture(name: string): Promise<Record<string, unknown>> {
  return JSON.parse(await readFile(path.join(fixtureDirectory, name), "utf8")) as Record<string, unknown>;
}

test("user generates a PDF and can download or prepare a WhatsApp message", async ({ page }) => {
  const invoice = await readFixture("invoice.json");
  await page.goto("/");
  await page.getByLabel("INVOICE").check();
  await page.getByLabel("Document number").fill(String(invoice.documentNumber));
  await page.getByLabel("Sales representative").fill(String(invoice.salesRep));
  await page.getByLabel("Customer name").fill("Cable Trading House");
  await page.getByLabel("Item 1 description").fill("Power cable");
  await page.getByLabel("Item 1 quantity").fill("2");
  await page.getByLabel("Item 1 unit price").fill("10.25");
  await page.getByRole("button", { name: "Add item" }).click();
  await page.getByLabel("Item 2 description").fill("Connectors");
  await page.getByLabel("Item 2 quantity").fill("3");
  await page.getByLabel("Item 2 unit price").fill("4.1");

  await expect(page.getByText("R\u00a037,72").first()).toBeVisible();
  await page.getByRole("button", { name: /Generate PDF/ }).click();
  await expect(page.getByTitle("PDF preview for INV-1001")).toBeVisible();

  const downloadLink = page.getByRole("link", { name: "Download PDF" });
  await expect(downloadLink).toHaveAttribute("download", "invoice-INV-1001.pdf");
  const [download] = await Promise.all([page.waitForEvent("download"), downloadLink.click()]);
  expect(download.suggestedFilename()).toBe("invoice-INV-1001.pdf");

  const whatsappLink = page.getByRole("link", { name: "WhatsApp" });
  const whatsappUrl = new URL((await whatsappLink.getAttribute("href")) ?? "");
  expect(whatsappUrl.hostname).toBe("wa.me");
  expect(whatsappUrl.searchParams.get("text")).toContain("I will share the PDF separately");
  await expect(page.getByText("WhatsApp opens a message; attach the downloaded PDF yourself.")).toBeVisible();
});

test("form remains usable without horizontal overflow on a phone viewport", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Create document" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Add item" })).toBeVisible();

  const dimensions = await page.evaluate(() => ({
    documentWidth: document.documentElement.scrollWidth,
    viewportWidth: window.innerWidth,
  }));
  expect(dimensions.documentWidth).toBeLessThanOrEqual(dimensions.viewportWidth);
});

test("static PDF artwork matches clean baselines for every document type @pdf-visual", async ({ request }, testInfo) => {
  test.skip(testInfo.project.name !== "chromium", "PDF raster comparison runs once in Chromium.");
  const baselineDirectory = path.join(process.cwd(), "tests", "visual", "baselines");
  const checker = path.join(process.cwd(), "tests", "visual", "check_pdf_visuals.py");

  for (const fixtureName of ["delivery-note.json", "quotation.json", "invoice.json"]) {
    const fixture = await readFixture(fixtureName);
    const response = await request.post("/api/generate-pdf", { data: fixture });
    expect(response.status(), `${fixtureName} should generate a PDF`).toBe(200);

    const pdfPath = testInfo.outputPath(fixtureName.replace(".json", ".pdf"));
    await writeFile(pdfPath, await response.body());
    const output = execFileSync(process.env.PYTHON ?? "python", [checker, pdfPath, baselineDirectory], {
      encoding: "utf8",
    });
    expect(output).toContain("static pixels match");
  }
});