"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Decimal from "decimal.js";
import { useEffect, useState, type InputHTMLAttributes, type ReactNode } from "react";
import { useFieldArray, useForm, useWatch, type FieldError, type FieldPath } from "react-hook-form";
import { calculateTotals } from "../../domain/calculations";
import { companyConfig } from "../../domain/company-config";
import { DOCUMENT_TITLES, DOCUMENT_TYPES } from "../../domain/document-types";
import { formatCurrency } from "../../domain/formatting";
import { documentRequestSchema, type DocumentRequestInput, type ParsedDocumentRequest } from "../../validation/document-schema";
import { SharePdfActions } from "../sharing/SharePdfActions";

const typeDescriptions = {
  delivery_note: "DELIVERY NOTE",
  quotation: "QUOTATION",
  invoice: "INVOICE",
} satisfies Record<(typeof DOCUMENT_TYPES)[number], string>;

function localDateValue(): string {
  const date = new Date();
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 10);
}

function makeDefaultValues(): DocumentRequestInput {
  return {
    documentType: "delivery_note",
    documentNumber: "",
    purchaseOrderNumber: "",
    date: localDateValue(),
    salesRep: "",
    customer: {
      name: "",
      attention: "",
      phone: "",
      addressLine1: "",
      addressLine2: "",
      addressLine3: "",
      postalCode: "",
    },
    contact: {
      mobile: "",
      email: "",
      secondaryContact: "",
    },
    taxRate: 15,
    items: [{ quantity: 1, description: "", unitPrice: 0 }],
  };
}

function FormField({
  id,
  label,
  error,
  children,
  className = "",
}: {
  id: string;
  label: string;
  error?: FieldError;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`form-field ${className}`}>
      <label htmlFor={id}>{label}</label>
      {children}
      {error?.message && <span className="field-error" id={`${id}-error`}>{error.message}</span>}
    </div>
  );
}

function TextInput(props: InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }) {
  const { invalid, className = "", ...inputProps } = props;
  return <input {...inputProps} className={`text-input ${className}`} aria-invalid={invalid || undefined} />;
}

export function DocumentForm() {
  const [pdfUrl, setPdfUrl] = useState("");
  const [pdfBlob, setPdfBlob] = useState<Blob | null>(null);
  const [pdfFilename, setPdfFilename] = useState("");
  const [generatedDocumentTitle, setGeneratedDocumentTitle] = useState("");
  const [generatedDocumentNumber, setGeneratedDocumentNumber] = useState("");
  const [serverMessage, setServerMessage] = useState("");
  const {
    register,
    control,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<DocumentRequestInput, unknown, ParsedDocumentRequest>({
    resolver: zodResolver(documentRequestSchema),
    defaultValues: makeDefaultValues(),
    mode: "onBlur",
  });
  const { fields, append, remove } = useFieldArray({ control, name: "items" });
  const values = useWatch({ control });
  const taxRate = Number.isFinite(values.taxRate) ? values.taxRate ?? 0 : 0;
  const items = (values.items ?? []).map((item) => ({
    quantity: typeof item?.quantity === "number" && Number.isFinite(item.quantity) ? item.quantity : 0,
    description: item?.description ?? "",
    unitPrice: typeof item?.unitPrice === "number" && Number.isFinite(item.unitPrice) ? item.unitPrice : 0,
  }));
  const totals = calculateTotals(items, new Decimal(taxRate));

  useEffect(() => () => {
    if (pdfUrl) {
      URL.revokeObjectURL(pdfUrl);
    }
  }, [pdfUrl]);

  async function generatePdf(requestData: ParsedDocumentRequest) {
    setServerMessage("");

    try {
      const response = await fetch("/api/generate-pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestData),
      });

      if (!response.ok) {
        const result = await response.json().catch(() => null) as {
          error?: { message?: string; fields?: Record<string, string> };
        } | null;
        const fieldErrors = result?.error?.fields;
        if (fieldErrors) {
          for (const [path, message] of Object.entries(fieldErrors)) {
            setError(path as FieldPath<DocumentRequestInput>, { type: "server", message });
          }
        }
        setServerMessage(result?.error?.message ?? "The PDF could not be generated. Please try again.");
        return;
      }

      const pdf = await response.blob();
      if (pdf.type !== "application/pdf") {
        setServerMessage("The server returned an unexpected response instead of a PDF.");
        return;
      }
      setPdfUrl(URL.createObjectURL(pdf));
      setPdfBlob(pdf);
      setPdfFilename(response.headers.get("Content-Disposition")?.match(/filename="([^"]+)"/)?.[1] ?? "document.pdf");
      setGeneratedDocumentTitle(DOCUMENT_TITLES[requestData.documentType]);
      setGeneratedDocumentNumber(requestData.documentNumber);
    } catch {
      setServerMessage("The PDF service could not be reached. Please try again.");
    }
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <a className="brand" href="/" aria-label="Thate Electrical Supplies home">
          <span className="brand-mark" aria-hidden="true">T</span>
          <span className="brand-name">THATE <b>ELECTRICAL SUPPLIES</b></span>
        </a>
        <div className="topbar-context">
          <span className="context-dot" aria-hidden="true" />
          <span>Document desk</span>
        </div>
      </header>

      <main className="workspace">
        <div className="page-heading">
          <div>
            <p className="eyebrow">DOCUMENTS <span>/</span> NEW</p>
            <h1>Create document</h1>
          </div>
          <div className="template-status"><span aria-hidden="true">●</span> Approved template</div>
        </div>

        <form className="document-layout" noValidate onSubmit={handleSubmit(generatePdf)}>
          <div className="form-column">
            <section className="form-section document-type-section" aria-labelledby="document-type-heading">
              <div className="section-heading">
                <div className="section-number">01</div>
                <div>
                  <h2 id="document-type-heading">Document type</h2>
                  <p>Choose the title for this document.</p>
                </div>
              </div>
              <div className="type-options" role="radiogroup" aria-labelledby="document-type-heading">
                {DOCUMENT_TYPES.map((type) => (
                  <label className="type-option" key={type}>
                    <input type="radio" value={type} {...register("documentType")} />
                    <span>{typeDescriptions[type]}</span>
                  </label>
                ))}
              </div>
            </section>

            <section className="form-section" aria-labelledby="details-heading">
              <div className="section-heading">
                <div className="section-number">02</div>
                <div>
                  <h2 id="details-heading">Document details</h2>
                  <p>Reference numbers and issue date.</p>
                </div>
              </div>
              <div className="field-grid field-grid-three">
                <FormField id="documentNumber" label="Document number" error={errors.documentNumber}>
                  <TextInput id="documentNumber" autoComplete="off" placeholder="e.g. INV-1001" {...register("documentNumber")} invalid={Boolean(errors.documentNumber)} />
                </FormField>
                <FormField id="purchaseOrderNumber" label="Purchase order number" error={errors.purchaseOrderNumber}>
                  <TextInput id="purchaseOrderNumber" autoComplete="off" placeholder="Optional" {...register("purchaseOrderNumber")} invalid={Boolean(errors.purchaseOrderNumber)} />
                </FormField>
                <FormField id="date" label="Date" error={errors.date}>
                  <TextInput id="date" type="date" {...register("date")} invalid={Boolean(errors.date)} />
                </FormField>
                <FormField id="salesRep" label="Sales representative" error={errors.salesRep}>
                  <TextInput id="salesRep" autoComplete="name" {...register("salesRep")} invalid={Boolean(errors.salesRep)} />
                </FormField>
              </div>
            </section>

            <section className="form-section" aria-labelledby="supplier-heading">
              <div className="section-heading">
                <div className="section-number">03</div>
                <div>
                  <h2 id="supplier-heading">Supplier</h2>
                  <p>Company information is fixed.</p>
                </div>
                <span className="fixed-tag">FIXED</span>
              </div>
              <div className="supplier-details">
                <strong>{companyConfig.name}</strong>
                <span>{companyConfig.address.join(", ")}</span>
                <span>{companyConfig.telephone}</span>
              </div>
            </section>

            <section className="form-section" aria-labelledby="customer-heading">
              <div className="section-heading">
                <div className="section-number">04</div>
                <div>
                  <h2 id="customer-heading">Customer</h2>
                  <p>Customer and delivery details.</p>
                </div>
              </div>
              <div className="field-grid field-grid-two">
                <FormField id="customer-name" label="Customer name" error={errors.customer?.name} className="field-span-two">
                  <TextInput id="customer-name" autoComplete="organization" {...register("customer.name")} invalid={Boolean(errors.customer?.name)} />
                </FormField>
                <FormField id="customer-attention" label="Attention" error={errors.customer?.attention}>
                  <TextInput id="customer-attention" {...register("customer.attention")} invalid={Boolean(errors.customer?.attention)} />
                </FormField>
                <FormField id="customer-phone" label="Phone" error={errors.customer?.phone}>
                  <TextInput id="customer-phone" type="tel" autoComplete="tel" {...register("customer.phone")} invalid={Boolean(errors.customer?.phone)} />
                </FormField>
                <FormField id="customer-address-1" label="Address line 1" error={errors.customer?.addressLine1}>
                  <TextInput id="customer-address-1" autoComplete="address-line1" {...register("customer.addressLine1")} invalid={Boolean(errors.customer?.addressLine1)} />
                </FormField>
                <FormField id="customer-address-2" label="Address line 2" error={errors.customer?.addressLine2}>
                  <TextInput id="customer-address-2" autoComplete="address-line2" {...register("customer.addressLine2")} invalid={Boolean(errors.customer?.addressLine2)} />
                </FormField>
                <FormField id="customer-address-3" label="Address line 3" error={errors.customer?.addressLine3}>
                  <TextInput id="customer-address-3" autoComplete="address-level2" {...register("customer.addressLine3")} invalid={Boolean(errors.customer?.addressLine3)} />
                </FormField>
                <FormField id="customer-postal-code" label="Postal code" error={errors.customer?.postalCode}>
                  <TextInput id="customer-postal-code" autoComplete="postal-code" {...register("customer.postalCode")} invalid={Boolean(errors.customer?.postalCode)} />
                </FormField>
              </div>
            </section>

            <section className="form-section" aria-labelledby="contact-heading">
              <div className="section-heading">
                <div className="section-number">05</div>
                <div>
                  <h2 id="contact-heading">Contact</h2>
                  <p>Customer contact information.</p>
                </div>
              </div>
              <div className="field-grid field-grid-two">
                <FormField id="contact-mobile" label="Mobile" error={errors.contact?.mobile}>
                  <TextInput id="contact-mobile" type="tel" autoComplete="tel" {...register("contact.mobile")} invalid={Boolean(errors.contact?.mobile)} />
                </FormField>
                <FormField id="contact-email" label="Email" error={errors.contact?.email}>
                  <TextInput id="contact-email" type="email" autoComplete="email" {...register("contact.email")} invalid={Boolean(errors.contact?.email)} />
                </FormField>
                <FormField id="contact-secondary" label="Secondary contact" error={errors.contact?.secondaryContact} className="field-span-two">
                  <TextInput id="contact-secondary" {...register("contact.secondaryContact")} invalid={Boolean(errors.contact?.secondaryContact)} />
                </FormField>
              </div>
            </section>

            <section className="form-section items-section" aria-labelledby="items-heading">
              <div className="section-heading">
                <div className="section-number">06</div>
                <div>
                  <h2 id="items-heading">Line items</h2>
                  <p>{fields.length} {fields.length === 1 ? "item" : "items"}</p>
                </div>
                <button
                  className="text-action add-item-action"
                  type="button"
                  onClick={() => append({ quantity: 1, description: "", unitPrice: 0 })}
                  disabled={fields.length >= 464}
                >
                  <span aria-hidden="true">+</span> Add item
                </button>
              </div>
              <div className="items-table" role="group" aria-label="Document line items">
                <div className="item-header" aria-hidden="true">
                  <span>Quantity</span><span>Description</span><span>Unit price</span><span>Amount</span><span />
                </div>
                {fields.map((field, index) => {
                  const itemErrors = errors.items?.[index];
                  const quantity = items[index]?.quantity ?? 0;
                  const unitPrice = items[index]?.unitPrice ?? 0;
                  const amount = new Decimal(quantity).times(unitPrice);
                  return (
                    <div className="item-row" key={field.id}>
                      <FormField id={`item-${index}-quantity`} label={`Item ${index + 1} quantity`} error={itemErrors?.quantity}>
                        <TextInput id={`item-${index}-quantity`} type="number" inputMode="decimal" min="0" step="any" {...register(`items.${index}.quantity`, { valueAsNumber: true })} invalid={Boolean(itemErrors?.quantity)} />
                      </FormField>
                      <FormField id={`item-${index}-description`} label={`Item ${index + 1} description`} error={itemErrors?.description}>
                        <TextInput id={`item-${index}-description`} {...register(`items.${index}.description`)} invalid={Boolean(itemErrors?.description)} />
                      </FormField>
                      <FormField id={`item-${index}-unit-price`} label={`Item ${index + 1} unit price`} error={itemErrors?.unitPrice}>
                        <TextInput id={`item-${index}-unit-price`} type="number" inputMode="decimal" min="0" step="0.01" {...register(`items.${index}.unitPrice`, { valueAsNumber: true })} invalid={Boolean(itemErrors?.unitPrice)} />
                      </FormField>
                      <div className="item-amount">
                        <span className="mobile-field-label">Amount</span>
                        <strong>{formatCurrency(amount)}</strong>
                      </div>
                      <button
                        className="remove-item-action"
                        type="button"
                        onClick={() => remove(index)}
                        disabled={fields.length === 1}
                        aria-label={`Remove item ${index + 1}`}
                      >
                        Remove
                      </button>
                    </div>
                  );
                })}
                {typeof errors.items?.message === "string" && <p className="field-error table-error">{errors.items.message}</p>}
                {fields.length >= 464 && <p className="item-limit-note">Maximum of 464 items for one generated document.</p>}
              </div>
            </section>

            <section className="form-section tax-section" aria-labelledby="tax-heading">
              <div className="section-heading">
                <div className="section-number">07</div>
                <div>
                  <h2 id="tax-heading">Tax</h2>
                  <p>Set the tax rate for this document.</p>
                </div>
              </div>
              <FormField id="taxRate" label="Tax rate (%)" error={errors.taxRate}>
                <TextInput id="taxRate" className="tax-input" type="number" inputMode="decimal" min="0" max="100" step="0.01" {...register("taxRate", { valueAsNumber: true })} invalid={Boolean(errors.taxRate)} />
              </FormField>
            </section>

            {serverMessage && <div className="server-message" role="alert">{serverMessage}</div>}

            <div className="form-actions">
              <button className="generate-button" type="submit" disabled={isSubmitting}>
                {isSubmitting ? <><span className="button-spinner" aria-hidden="true" /> Generating PDF</> : <>Generate PDF <span aria-hidden="true">→</span></>}
              </button>
              <span className="action-note">PDF output uses the approved fixed template.</span>
            </div>
          </div>

          <aside className="summary-panel" aria-label="Document totals preview">
            <div className="summary-header">
              <span className="summary-kicker">LIVE SUMMARY</span>
              <span className="summary-count">{fields.length} {fields.length === 1 ? "item" : "items"}</span>
            </div>
            <div className="summary-type">{DOCUMENT_TITLES[values.documentType ?? "delivery_note"]}</div>
            <div className="summary-lines">
              <div><span>Subtotal</span><strong>{formatCurrency(totals.subtotal)}</strong></div>
              <div><span>Tax <small>({taxRate}%)</small></span><strong>{formatCurrency(totals.vat)}</strong></div>
            </div>
            <div className="summary-total">
              <span>Total</span>
              <strong>{formatCurrency(totals.total)}</strong>
            </div>
            <div className="summary-footnote">Calculated from current line items.</div>
          </aside>
        </form>

        {pdfUrl && (
          <section className="pdf-preview" aria-labelledby="pdf-preview-heading">
            <div className="preview-heading">
              <div className="preview-identification">
                <div>
                  <p className="eyebrow">GENERATED PDF</p>
                  <h2 id="pdf-preview-heading">{generatedDocumentNumber}</h2>
                </div>
                <span className="preview-status"><span aria-hidden="true">●</span> Ready</span>
              </div>
              {pdfBlob && (
                <SharePdfActions
                  pdf={pdfBlob}
                  pdfUrl={pdfUrl}
                  fileName={pdfFilename}
                  title={generatedDocumentTitle}
                  documentNumber={generatedDocumentNumber}
                />
              )}
            </div>
            <iframe className="pdf-frame" src={pdfUrl} title={`PDF preview for ${generatedDocumentNumber}`} />
          </section>
        )}
      </main>
      <footer className="site-footer">
        <span>THATE ELECTRICAL SUPPLIES</span>
        <span>Document desk</span>
      </footer>
    </div>
  );
}