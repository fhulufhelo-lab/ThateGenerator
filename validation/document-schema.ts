import { z } from "zod";
import { DOCUMENT_TYPES } from "../domain/document-types";

const requiredText = z.string().trim().min(1, "This field is required.");
const optionalText = z.string().trim().optional().default("");
const optionalEmail = z.string().trim().email("Enter a valid email address.").or(z.literal("")).optional().default("");

const isoDate = requiredText.refine((value) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}, "Enter a valid date in YYYY-MM-DD format.");

export const documentRequestSchema = z.object({
  documentType: z.enum(DOCUMENT_TYPES),
  documentNumber: requiredText,
  purchaseOrderNumber: optionalText,
  date: isoDate,
  salesRep: requiredText,
  customer: z.object({
    name: requiredText,
    attention: optionalText,
    phone: optionalText,
    addressLine1: optionalText,
    addressLine2: optionalText,
    addressLine3: optionalText,
    postalCode: optionalText,
  }).strict(),
  contact: z.object({
    mobile: optionalText,
    email: optionalEmail,
    secondaryContact: optionalText,
  }).strict(),
  taxRate: z.number().finite().min(0, "Tax rate cannot be less than 0.").max(100, "Tax rate cannot exceed 100."),
  items: z.array(z.object({
    quantity: z.number().finite().min(0, "Quantity cannot be less than 0."),
    description: requiredText,
    unitPrice: z.number().finite().min(0, "Unit price cannot be less than 0."),
  }).strict()).min(1, "At least one line item is required."),
}).strict();

export type DocumentRequestInput = z.input<typeof documentRequestSchema>;
export type ParsedDocumentRequest = z.output<typeof documentRequestSchema>;