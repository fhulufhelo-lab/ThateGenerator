import { existsSync } from "node:fs";
import { beforeAll, describe, expect, it } from "vitest";
import { PDFDocument } from "pdf-lib";
import { renderDocument } from "../../pdf/render-document";
import type { DocumentRequest } from "../../domain/document";

const windowsFonts = {
  body: "C:\\Windows\\Fonts\\arial.ttf",
  bold: "C:\\Windows\\Fonts\\arialbd.ttf",
  contact: "C:\\Windows\\Fonts\\calibri.ttf",
};
const canRender = Object.values(windowsFonts).every(existsSync);

const request: DocumentRequest = {
  documentType: "invoice",
  documentNumber: "INV-1001",
  purchaseOrderNumber: "PO-44",
  date: "2026-09-18",
  salesRep: "Taylor",
  customer: {
    name: "Cable Trading House",
    attention: "Accounts",
    phone: "0123456789",
    addressLine1: "26 Borax Street",
    addressLine2: "Alrode",
    addressLine3: "Alberton",
    postalCode: "1451",
  },
  contact: {
    mobile: "0820000000",
    email: "accounts@example.com",
    secondaryContact: "",
  },
  taxRate: 15,
  items: [{ quantity: 2, description: "Power cable", unitPrice: 10.25 }],
};

describe.skipIf(!canRender)("PDF document renderer", () => {
  beforeAll(() => {
    process.env.PDF_FONT_ARIAL_PATH = windowsFonts.body;
    process.env.PDF_FONT_ARIAL_BOLD_PATH = windowsFonts.bold;
    process.env.PDF_FONT_CALIBRI_PATH = windowsFonts.contact;
  });

  it("preserves the two-page A4 template for documents within the original row capacity", async () => {
    const bytes = await renderDocument(request);
    const pdf = await PDFDocument.load(bytes);

    expect(pdf.getPageCount()).toBe(2);
    expect(pdf.getPage(0).getSize().width).toBeCloseTo(595.2756, 1);
    expect(pdf.getPage(0).getSize().height).toBeCloseTo(841.8898, 1);
  });

  it("populates the blank page and creates more continuation pages for overflow", async () => {
    const bytes = await renderDocument({
      ...request,
      items: Array.from({ length: 45 }, (_, index) => ({
        quantity: index + 1,
        description: `Item ${index + 1}`,
        unitPrice: 1.25,
      })),
    });
    const pdf = await PDFDocument.load(bytes);

    expect(pdf.getPageCount()).toBe(3);
  });

  it("rejects line items that cannot fit the configured continuation page", async () => {
    await expect(renderDocument({
      ...request,
      items: Array.from({ length: 45 }, (_, index) => ({
        quantity: 1,
        description: index === 44 ? "X".repeat(1000) : `Item ${index + 1}`,
        unitPrice: 1,
      })),
    })).rejects.toThrow(/does not fit/);
  });

  it("rejects a document that exceeds the 12-page resource limit", async () => {
    await expect(renderDocument({
      ...request,
      items: Array.from({ length: 465 }, (_, index) => ({
        quantity: 1,
        description: `Item ${index + 1}`,
        unitPrice: 1,
      })),
    })).rejects.toThrow(/maximum of 12 PDF pages/);
  });
});