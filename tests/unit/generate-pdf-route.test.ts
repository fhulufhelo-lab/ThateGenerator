import { existsSync } from "node:fs";
import { beforeAll, describe, expect, it } from "vitest";
import { PDFDocument } from "pdf-lib";
import { POST } from "../../app/api/generate-pdf/route";

const windowsFonts = {
  body: "C:\\Windows\\Fonts\\arial.ttf",
  bold: "C:\\Windows\\Fonts\\arialbd.ttf",
  contact: "C:\\Windows\\Fonts\\calibri.ttf",
};
const canRender = Object.values(windowsFonts).every(existsSync);
const requestBody = {
  documentType: "invoice",
  documentNumber: "INV-1001",
  date: "2026-09-18",
  salesRep: "Taylor",
  customer: { name: "Cable Trading House" },
  contact: { email: "" },
  taxRate: 15,
  items: [{ quantity: 2, description: "Power cable", unitPrice: 10.25 }],
};

describe("POST /api/generate-pdf", () => {
  beforeAll(() => {
    process.env.PDF_FONT_ARIAL_PATH = windowsFonts.body;
    process.env.PDF_FONT_ARIAL_BOLD_PATH = windowsFonts.bold;
    process.env.PDF_FONT_CALIBRI_PATH = windowsFonts.contact;
  });

  it("returns a generated PDF with the documented download headers", async () => {
    if (!canRender) {
      return;
    }

    const response = await POST(new Request("http://localhost/api/generate-pdf", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(requestBody),
    }));

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("application/pdf");
    expect(response.headers.get("content-disposition")).toBe('attachment; filename="invoice-INV-1001.pdf"');
    expect((await response.arrayBuffer()).byteLength).toBeGreaterThan(1000);
  });

  it("returns field-level JSON validation errors and rejects non-JSON bodies", async () => {
    const invalidResponse = await POST(new Request("http://localhost/api/generate-pdf", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...requestBody, taxRate: 101 }),
    }));
    const invalidBody = await invalidResponse.json();

    expect(invalidResponse.status).toBe(400);
    expect(invalidBody.error.code).toBe("VALIDATION_ERROR");
    expect(invalidBody.error.fields.taxRate).toContain("100");

    const contentTypeResponse = await POST(new Request("http://localhost/api/generate-pdf", {
      method: "POST",
      headers: { "content-type": "text/plain" },
      body: "{}",
    }));
    expect(contentTypeResponse.status).toBe(415);
  });

  it("returns the preserved base pages and populated continuation page for overflow", async () => {
    if (!canRender) {
      return;
    }

    const response = await POST(new Request("http://localhost/api/generate-pdf", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        ...requestBody,
        items: Array.from({ length: 3 }, (_, index) => ({
          quantity: index + 1,
          description: `API continuation item ${index + 1}`,
          unitPrice: 10,
        })),
      }),
    }));
    const pdf = await PDFDocument.load(await response.arrayBuffer());

    expect(response.status).toBe(200);
    expect(pdf.getPageCount()).toBe(2);
    expect(pdf.getPage(1).getSize().width).toBeCloseTo(595.2756, 1);
    expect(pdf.getPage(1).getSize().height).toBeCloseTo(841.8898, 1);
  });
});