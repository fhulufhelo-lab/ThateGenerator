import type Decimal from "decimal.js";
import type { DocumentType } from "./document-types";

export type DocumentItem = {
  quantity: number;
  description: string;
  unitPrice: number;
};

export type Supplier = {
  addressLine1: string;
  addressLine2: string;
  addressLine3: string;
};

export type Customer = {
  name: string;
  attention: string;
  phone: string;
  addressLine1: string;
  addressLine2: string;
  addressLine3: string;
  postalCode: string;
};

export type DocumentContact = {
  telephone: string;
  mobile: string;
  email: string;
  secondaryContact: string;
};

export type SignatureDetails = {
  name?: string;
  date?: string;
};

export type Document = {
  documentType: DocumentType;
  registrationNumber: string;
  vatNumber: string;
  documentNumber: string;
  purchaseOrderNumber?: string;
  date: string;
  salesRep: string;
  supplier: Supplier;
  customer: Customer;
  contact: DocumentContact;
  taxRate: number;
  items: DocumentItem[];
  signature?: SignatureDetails;
};

export type DocumentRequest = Omit<
  Document,
  "registrationNumber" | "vatNumber" | "supplier" | "signature" | "contact"
> & {
  contact: Omit<DocumentContact, "telephone">;
};

export type DocumentTotals = {
  subtotal: Decimal;
  vat: Decimal;
  total: Decimal;
};