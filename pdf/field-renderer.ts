import type { PDFFont, PDFPage } from "pdf-lib";
import type { ContinuationFieldDefinition, FontKey, PdfFieldDefinition } from "./types";

export class PdfFieldOverflowError extends Error {
  constructor(readonly field: string) {
    super(`The value for ${field} does not fit the approved PDF field.`);
    this.name = "PdfFieldOverflowError";
  }
}

export type PdfFonts = Record<FontKey, PDFFont>;

type FieldOptions = {
  page: PDFPage;
  definition: PdfFieldDefinition | ContinuationFieldDefinition;
  value: string;
  fonts: PdfFonts;
  field: string;
};

export function drawTextField({ page, definition, value, fonts, field }: FieldOptions): void {
  if (!value) {
    return;
  }
  if (/[\r\n]/.test(value)) {
    throw new PdfFieldOverflowError(field);
  }

  const [x0, top, x1, bottom] = definition.bbox;
  const availableWidth = x1 - x0;
  const font = fonts[definition.font];
  let fontSize = definition.fontSize;
  const minimumFontSize = Math.min(fontSize, 4.5);
  while (font.widthOfTextAtSize(value, fontSize) > availableWidth && fontSize > minimumFontSize) {
    fontSize = Math.max(minimumFontSize, fontSize - 0.25);
  }
  if (font.widthOfTextAtSize(value, fontSize) > availableWidth) {
    throw new PdfFieldOverflowError(field);
  }

  const textWidth = font.widthOfTextAtSize(value, fontSize);
  const x = definition.align === "right"
    ? x1 - textWidth
    : definition.align === "center"
      ? x0 + (availableWidth - textWidth) / 2
      : x0;
  const baselineOffset = fontSize * 0.212;
  const y = page.getHeight() - bottom + baselineOffset;

  if (y < 0 || y > page.getHeight()) {
    throw new PdfFieldOverflowError(field);
  }

  page.drawText(value, { x, y, font, size: fontSize });
}

export class PdfPageLimitError extends Error {
  constructor(readonly maximumPages: number) {
    super(`The document exceeds the maximum of ${maximumPages} PDF pages.`);
    this.name = "PdfPageLimitError";
  }
}