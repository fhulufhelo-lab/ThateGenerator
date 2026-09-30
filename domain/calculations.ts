import Decimal from "decimal.js";
import type { DocumentItem, DocumentTotals } from "./document";

export function calculateTotals(items: readonly DocumentItem[], taxRate: Decimal.Value): DocumentTotals {
  const subtotal = items.reduce(
    (total, item) => total.plus(new Decimal(item.quantity).times(item.unitPrice)),
    new Decimal(0),
  );
  const vat = subtotal.times(taxRate).dividedBy(100);

  return {
    subtotal,
    vat,
    total: subtotal.plus(vat),
  };
}