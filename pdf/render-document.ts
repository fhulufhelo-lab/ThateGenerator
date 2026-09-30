import { PDFDocument } from "pdf-lib";
import { calculateTotals } from "../domain/calculations";
import { createDocument } from "../domain/create-document";
import type { DocumentRequest } from "../domain/document";
import { DOCUMENT_TITLES } from "../domain/document-types";
import { formatCurrency, formatDocumentDate } from "../domain/formatting";
import { renderContinuationPage } from "./continuation-pages";
import { drawTextField, PdfPageLimitError, type PdfFonts } from "./field-renderer";
import { loadTemplate, loadTemplateSource } from "./template-loader";
import { renderMainPageItems } from "./table-renderer";
import type { OverlayMap, PdfFieldDefinition } from "./types";

export const MAX_DOCUMENT_PAGES = 12;

function drawMainFields(
  page: Parameters<typeof drawTextField>[0]["page"],
  document: ReturnType<typeof createDocument>,
  overlayMap: OverlayMap,
  fonts: PdfFonts,
): void {
  const values: Record<string, string> = {
    documentType: DOCUMENT_TITLES[document.documentType],
    registrationNumber: document.registrationNumber,
    vatNumber: document.vatNumber,
    documentNumber: document.documentNumber,
    purchaseOrderNumber: document.purchaseOrderNumber ?? "",
    date: formatDocumentDate(document.date),
    salesRep: document.salesRep,
    "supplier.addressLine1": document.supplier.addressLine1,
    "supplier.addressLine2": document.supplier.addressLine2,
    "supplier.addressLine3": document.supplier.addressLine3,
    "contact.telephone": document.contact.telephone,
    "customer.name": document.customer.name,
    "contact.mobile": document.contact.mobile,
    "customer.attention": document.customer.attention,
    "contact.email": document.contact.email,
    "customer.phone": document.customer.phone,
    "contact.secondaryContact": document.contact.secondaryContact,
    "customer.addressLine1": document.customer.addressLine1,
    "customer.addressLine2": document.customer.addressLine2,
    "customer.addressLine3": document.customer.addressLine3,
    "customer.postalCode": document.customer.postalCode,
    taxRate: `${document.taxRate}%`,
    "company.name": "THATE ELCTRICAL SUPPLIES",
    "company.bank": "First National Bank",
    "company.accountNumber": "62193132760",
    "company.accountType": "Cheque",
  };

  for (const [field, value] of Object.entries(values)) {
    const definition: PdfFieldDefinition | undefined = overlayMap.fields[field];
    if (!definition) {
      throw new Error(`Coordinate map is missing the ${field} field.`);
    }
    drawTextField({ page, definition, value, fonts, field });
  }
}

function renderMainTotals(
  page: Parameters<typeof drawTextField>[0]["page"],
  totals: ReturnType<typeof calculateTotals>,
  overlayMap: OverlayMap,
  fonts: PdfFonts,
): void {
  const values = {
    "totals.subtotal": totals.subtotal,
    "totals.vat": totals.vat,
    "totals.total": totals.total,
  };
  for (const [field, value] of Object.entries(values)) {
    drawTextField({
      page,
      definition: overlayMap.fields[field],
      value: formatCurrency(value),
      fonts,
      field,
    });
  }
}

export async function renderDocument(request: DocumentRequest): Promise<Uint8Array> {
  const [template, source] = await Promise.all([loadTemplate(), loadTemplateSource()]);
  const document = createDocument(request);
  const totals = calculateTotals(document.items, document.taxRate);
  const pages = template.pdf.getPages();
  const mainPage = pages[0];
  const continuationItems = document.items.slice(2);
  const capacity = template.overlayMap.continuation.itemCapacity;
  const continuationPageCount = Math.ceil(continuationItems.length / capacity);
  const outputPageCount = Math.max(2, 1 + continuationPageCount);
  if (outputPageCount > MAX_DOCUMENT_PAGES) {
    throw new PdfPageLimitError(MAX_DOCUMENT_PAGES);
  }

  drawMainFields(mainPage, document, template.overlayMap, template.fonts);
  renderMainPageItems(mainPage, document, template.overlayMap, template.fonts);

  if (continuationItems.length === 0) {
    renderMainTotals(mainPage, totals, template.overlayMap, template.fonts);
  } else {
    drawTextField({
      page: mainPage,
      definition: template.overlayMap.fields["totals.subtotal"],
      value: "Continued",
      fonts: template.fonts,
      field: "totals.continued",
    });

    const continuationPages = [pages[1]];
    if (continuationPageCount > 1) {
      const clonedPages = await template.pdf.copyPages(source, Array.from({ length: continuationPageCount - 1 }, () => 1));
      for (const clonedPage of clonedPages) {
        template.pdf.addPage(clonedPage);
      }
      continuationPages.push(...clonedPages);
    }

    for (let index = 0; index < continuationPageCount; index += 1) {
      const itemOffset = 2 + index * capacity;
      const pageItems = continuationItems.slice(index * capacity, (index + 1) * capacity);
      renderContinuationPage(
        continuationPages[index],
        document,
        pageItems,
        itemOffset,
        totals,
        template.fonts,
        template.overlayMap,
      );
    }
  }

  return template.pdf.save();
}