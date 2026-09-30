import Decimal from "decimal.js";
import type { Document, DocumentItem } from "../domain/document";
import { formatCurrency } from "../domain/formatting";
import { drawTextField, type PdfFonts } from "./field-renderer";
import type { ContinuationFieldDefinition, OverlayMap, PdfFieldDefinition } from "./types";

const MAIN_PAGE_ITEM_CAPACITY = 2;

function itemText(item: DocumentItem, index: number, field: string, overlayMap: OverlayMap): string {
  if (field === "quantity") {
    return new Decimal(item.quantity).toString();
  }
  if (field === "description") {
    return item.description;
  }
  if (field === "unitPrice") {
    return formatCurrency(item.unitPrice);
  }
  if (field === "amount") {
    return formatCurrency(new Decimal(item.quantity).times(item.unitPrice));
  }
  throw new Error(`Unknown item field at index ${index}: ${field}`);
}

export function renderMainPageItems(
  page: Parameters<typeof drawTextField>[0]["page"],
  document: Document,
  overlayMap: OverlayMap,
  fonts: PdfFonts,
): void {
  const itemFields = ["quantity", "description", "unitPrice", "amount"] as const;

  document.items.slice(0, MAIN_PAGE_ITEM_CAPACITY).forEach((item, index) => {
    for (const field of itemFields) {
      const key = `items[].${field}`;
      const definition = overlayMap.fields[key];
      const rowStep = definition.rowStep ?? 10.8;
      const [x0, y0, x1, y1] = definition.bbox;
      const rowDefinition: PdfFieldDefinition = {
        ...definition,
        bbox: [x0, y0 + rowStep * index, x1, y1 + rowStep * index],
      };
      drawTextField({
        page,
        definition: rowDefinition,
        value: itemText(item, index, field, overlayMap),
        fonts,
        field: `items.${index}.${field}`,
      });
    }
  });
}

export function renderContinuationRows(
  page: Parameters<typeof drawTextField>[0]["page"],
  items: readonly DocumentItem[],
  itemOffset: number,
  overlayMap: OverlayMap,
  fonts: PdfFonts,
): void {
  const continuation = overlayMap.continuation;
  const itemFields = ["quantity", "description", "unitPrice", "amount"] as const;
  const definitions: Record<(typeof itemFields)[number], ContinuationFieldDefinition> = {
    quantity: overlayMap.fields["items[].quantity"],
    description: overlayMap.fields["items[].description"],
    unitPrice: overlayMap.fields["items[].unitPrice"],
    amount: overlayMap.fields["items[].amount"],
  };

  items.forEach((item, index) => {
    const rowIndex = index;
    for (const field of itemFields) {
      const definition = definitions[field];
      const [x0, , x1, ] = definition.bbox;
      const rowTextTop = continuation.rowTextTop + continuation.rowTextStep * rowIndex;
      const rowDefinition: ContinuationFieldDefinition = {
        ...definition,
        bbox: [x0, rowTextTop, x1, rowTextTop + 7.37],
      };
      drawTextField({
        page,
        definition: rowDefinition,
        value: itemText(item, itemOffset + index, field, overlayMap),
        fonts,
        field: `items.${itemOffset + index}.${field}`,
      });
    }
  });
}

