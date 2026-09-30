export const DOCUMENT_TYPES = ["delivery_note", "quotation", "invoice"] as const;

export type DocumentType = (typeof DOCUMENT_TYPES)[number];

export const DOCUMENT_TITLES: Record<DocumentType, string> = {
  delivery_note: "DELIVERY NOTE",
  quotation: "QUOTATION",
  invoice: "INVOICE",
};

export function isDocumentType(value: unknown): value is DocumentType {
  return typeof value === "string" && DOCUMENT_TYPES.some((type) => type === value);
}