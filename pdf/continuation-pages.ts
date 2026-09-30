import { rgb, type PDFPage } from "pdf-lib";
import { DOCUMENT_TITLES } from "../domain/document-types";
import type { Document, DocumentTotals } from "../domain/document";
import { formatCurrency } from "../domain/formatting";
import { drawTextField, type PdfFonts } from "./field-renderer";
import { renderContinuationRows } from "./table-renderer";
import type { ContinuationFieldDefinition, OverlayMap } from "./types";

function topRect(page: PDFPage, [x0, top, x1, bottom]: [number, number, number, number]) {
  return {
    x: x0,
    y: page.getHeight() - bottom,
    width: x1 - x0,
    height: bottom - top,
  };
}

function drawContinuationTable(page: PDFPage, overlayMap: OverlayMap): void {
  const continuation = overlayMap.continuation;
  const header = continuation.tableHeaderBand;
  const bodyTop = continuation.tableBodyTop;
  const bodyBottom = continuation.tableBodyBottom;
  const black = rgb(0, 0, 0);

  page.drawRectangle({ ...topRect(page, header), color: rgb(...continuation.headerFill) });
  const horizontalPositions = [header[1], header[3], ...Array.from(
    { length: continuation.itemCapacity },
    (_, index) => bodyTop + (index + 1) * continuation.rowHeight,
  )];
  for (const top of horizontalPositions) {
    if (top > bodyBottom + 0.01) {
      continue;
    }
    const bottomY = page.getHeight() - top;
    page.drawLine({
      start: { x: header[0], y: bottomY },
      end: { x: header[2], y: bottomY },
      thickness: continuation.horizontalRuleThickness,
      color: black,
    });
  }

  for (const x of continuation.verticalRules) {
    page.drawLine({
      start: { x, y: page.getHeight() - header[1] },
      end: { x, y: page.getHeight() - bodyBottom },
      thickness: continuation.horizontalRuleThickness,
      color: black,
    });
  }
}

function renderContinuationTotals(
  page: PDFPage,
  totals: DocumentTotals,
  rowCount: number,
  fonts: PdfFonts,
  overlayMap: OverlayMap,
): void {
  const totalMap = overlayMap.continuation.totals;
  const firstTop = Math.max(
    totalMap.firstRowTop,
    overlayMap.continuation.tableBodyTop + rowCount * overlayMap.continuation.rowHeight + 4.0,
  );
  const labels = ["Sub-total", "VAT", "TOTAL"] as const;
  const values = [totals.subtotal, totals.vat, totals.total];

  labels.forEach((label, index) => {
    const top = firstTop + totalMap.rowStep * index;
    const labelDefinition: ContinuationFieldDefinition = {
      bbox: [367.8, top, totalMap.labelRight, top + 7.37],
      font: "bold",
      fontSize: 6.6,
      align: "right",
    };
    const valueDefinition: ContinuationFieldDefinition = {
      bbox: [totalMap.amountLeft, top, totalMap.amountRight, top + 7.37],
      font: "body",
      fontSize: 6.6,
      align: "right",
    };
    drawTextField({ page, definition: labelDefinition, value: label, fonts, field: `totals.${index}.label` });
    drawTextField({
      page,
      definition: valueDefinition,
      value: formatCurrency(values[index]),
      fonts,
      field: `totals.${index}.value`,
    });
  });
}

export function renderContinuationPage(
  page: PDFPage,
  document: Document,
  items: Document["items"],
  itemOffset: number,
  totals: DocumentTotals,
  fonts: PdfFonts,
  overlayMap: OverlayMap,
): void {
  const continuation = overlayMap.continuation;
  const titleBand = continuation.titleBand;
  page.drawRectangle({ ...topRect(page, titleBand), color: rgb(...continuation.titleFill) });
  drawContinuationTable(page, overlayMap);

  drawTextField({
    page,
    definition: continuation.title,
    value: `${DOCUMENT_TITLES[document.documentType]} (CONTINUED)`,
    fonts,
    field: "documentType.continuation",
  });
  const documentNumberDefinition: ContinuationFieldDefinition = {
    ...continuation.documentNumber,
    bbox: continuation.documentNumber.bbox,
  };
  drawTextField({
    page,
    definition: documentNumberDefinition,
    value: `Document number: ${document.documentNumber}`,
    fonts,
    field: "documentNumber.continuation",
  });

  const headerLabels = {
    quantity: "Quantity",
    description: "Description",
    unitPrice: "Unit price",
    amount: "Amount",
  };
  for (const [key, definition] of Object.entries(continuation.headers)) {
    drawTextField({
      page,
      definition,
      value: headerLabels[key as keyof typeof headerLabels],
      fonts,
      field: `headers.${key}`,
    });
  }

  renderContinuationRows(page, items, itemOffset, overlayMap, fonts);
  renderContinuationTotals(page, totals, items.length, fonts, overlayMap);
}