import { describe, expect, it } from "vitest";
import { calculateTotals } from "../../domain/calculations";
import { companyConfig } from "../../domain/company-config";
import { createDocument } from "../../domain/create-document";
import type { DocumentRequest } from "../../domain/document";
import { DOCUMENT_TITLES, isDocumentType } from "../../domain/document-types";
import { formatCurrency, formatDocumentDate } from "../../domain/formatting";
import { documentRequestSchema } from "../../validation/document-schema";

const validRequest: DocumentRequest = {
  documentType: "invoice",
  documentNumber: "INV-1001",
  purchaseOrderNumber: "",
  date: "2026-09-18",
  salesRep: "Taylor",
  customer: {
    name: "Cable Trading House",
    attention: "",
    phone: "",
    addressLine1: "26 Borax Street",
    addressLine2: "Alrode",
    addressLine3: "Alberton",
    postalCode: "1451",
  },
  contact: {
    mobile: "",
    email: "",
    secondaryContact: "",
  },
  taxRate: 15,
  items: [
    { quantity: 2.5, description: "Cable", unitPrice: 10.1 },
    { quantity: 3, description: "Connectors", unitPrice: 0.1 },
  ],
};

describe("document domain", () => {
  it("maps the supported document types to the approved titles", () => {
    expect(DOCUMENT_TITLES).toEqual({
      delivery_note: "DELIVERY NOTE",
      quotation: "QUOTATION",
      invoice: "INVOICE",
    });
    expect(isDocumentType("invoice")).toBe(true);
    expect(isDocumentType("credit_note")).toBe(false);
  });

  it("calculates multi-item totals with decimal-safe arithmetic", () => {
    const totals = calculateTotals(validRequest.items, validRequest.taxRate);

    expect(totals.subtotal.toString()).toBe("25.55");
    expect(totals.vat.toString()).toBe("3.8325");
    expect(totals.total.toString()).toBe("29.3825");
  });

  it("composes company values from fixed configuration, not request input", () => {
    const document = createDocument(validRequest);

    expect(document.registrationNumber).toBe(companyConfig.registrationNumber);
    expect(document.vatNumber).toBe(companyConfig.vatNumber);
    expect(document.supplier.addressLine1).toBe(companyConfig.address[0]);
    expect(document.contact.telephone).toBe(companyConfig.telephone);
    expect(document.customer.name).toBe(validRequest.customer.name);
  });

  it("formats ZAR amounts to two decimals and matches the source date style", () => {
    expect(formatCurrency("1234.5")).toBe("R\u00a01\u00a0234,50");
    expect(formatCurrency("-0.005")).toBe("-R\u00a00,01");
    expect(formatDocumentDate("2026-09-18")).toBe("Friday, September 18, 2026");
    expect(() => formatDocumentDate("2026-02-30")).toThrow(RangeError);
  });

  it("validates source fields and defaults omitted optional values", () => {
    const { purchaseOrderNumber, customer, contact, ...requestWithoutOptionals } = validRequest;
    const parsed = documentRequestSchema.parse({
      ...requestWithoutOptionals,
      customer: { name: customer.name },
      contact: {},
    });

    expect(parsed.purchaseOrderNumber).toBe("");
    expect(parsed.customer.addressLine1).toBe("");
    expect(parsed.contact.email).toBe("");
  });

  it("rejects invalid dates, email, financial values, empty items, and client totals", () => {
    const invalidRequests = [
      { ...validRequest, date: "2026-02-30" },
      { ...validRequest, contact: { ...validRequest.contact, email: "not-an-email" } },
      { ...validRequest, taxRate: 101 },
      { ...validRequest, items: [{ ...validRequest.items[0], quantity: -1 }] },
      { ...validRequest, items: [] },
      { ...validRequest, subtotal: 25.55 },
    ];

    for (const request of invalidRequests) {
      expect(documentRequestSchema.safeParse(request).success).toBe(false);
    }
  });
});