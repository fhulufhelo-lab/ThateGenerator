# Architecture Specification --- Document PDF Generator

## 1. Purpose

This document defines the technical architecture for the
document-generation application described in `IMPLEMENTATION.md`.

The application is a browser-based form where a user enters document
information, selects **Delivery Note**, **Quotation**, or **Invoice**,
and generates a PDF that preserves the supplied document's existing
visual design.

The supplied PDF remains the visual source of truth. The architecture
therefore prioritizes deterministic PDF rendering and template fidelity
over generic HTML-to-PDF generation.

## 2. Confirmed Product Decisions

  Decision                   Selected approach
  -------------------------- -----------------------------------------------------
  Application                Browser-based web application
  Authentication             None
  Document persistence       None
  Document numbering         User enters the number manually
  Line items                 Multiple line items with automatic additional pages
  Company configuration      Hard-coded for the single company
  Signature                  Preserve the existing blank signature area
  Sharing                    Download + WhatsApp/share
  PDF generation             Server-side
  Hosting                    Netlify
  Database                   None
  Admin area                 Yes
  Document editing/history   No
  Template architecture      Single approved template
  Technology                 Architect-selected

### Important architectural consequence

The application is intentionally **stateless** for generated documents.
A PDF is generated on demand, returned to the browser, and is not stored
in a database or document store.

Because there is no authentication or persistence, the first release
should not expose document history or saved-document functionality.

## 3. Recommended Technology Stack

### Frontend

-   **Next.js**
-   **React**
-   **TypeScript**
-   **Tailwind CSS**
-   **React Hook Form**
-   **Zod**

### Backend

-   **Next.js server-side route / Netlify Function**
-   **TypeScript**
-   **pdf-lib** for PDF template manipulation
-   **decimal.js** for financial calculations

### Testing

-   **Vitest** for unit tests
-   **Playwright** for browser/end-to-end tests
-   **Poppler** or equivalent PDF rasterization for visual regression
-   Image/pixel comparison tooling for PDF visual tests

### Hosting

-   **Netlify**

Recommended deployment shape:

``` text
Browser
   |
   v
Netlify
   |
   +--> Next.js application
   |
   +--> Server-side PDF generation
              |
              +--> Fixed PDF template
              +--> Approved fonts
              +--> Coordinate renderer
```

## 4. Why This Stack

### Next.js + React + TypeScript

Next.js provides a unified React application and server-side endpoint
suitable for Netlify. TypeScript is important because the document
contains many structured fields and calculated values.

### React Hook Form + Zod

React Hook Form handles the large form efficiently. Zod provides a
strict document schema and validation model. Server-side validation
remains mandatory even when the browser validates the form.

### Tailwind CSS

Tailwind is appropriate for the **web UI only**. It must never be used
to reproduce the PDF.

### pdf-lib

The PDF requirement is fundamentally an overlay/template operation:

1.  Load the fixed master PDF.
2.  Preserve its static artwork.
3.  Replace/cover only approved dynamic regions.
4.  Draw submitted values at exact coordinates.
5.  Render line items and totals.
6.  Create controlled continuation pages when required.
7.  Return the PDF.

The renderer must remain coordinate-driven and deterministic.

### Netlify

Netlify is the selected hosting platform. The PDF generation endpoint
should run in the server-side execution model supported by the selected
Next.js/Netlify deployment.

## 5. High-Level Architecture

``` text
                         ┌───────────────────────┐
                         │       Browser         │
                         │  Document Form        │
                         │  Validation           │
                         │  Totals Preview       │
                         └───────────┬───────────┘
                                     │
                          POST document data
                                     │
                                     v
                    ┌────────────────────────────────┐
                    │       Netlify / Next.js        │
                    │                                │
                    │  Server-side PDF endpoint     │
                    │                                │
                    │  Validate → Calculate → Render │
                    └───────────────┬────────────────┘
                                    │
                                    v
                         ┌───────────────────────┐
                         │ Generated PDF         │
                         │ Download / Share      │
                         └───────────────────────┘
```

No database is required.

## 6. Core Architectural Principles

### 6.1 PDF is not generated from the UI

The browser form collects data. The PDF renderer independently consumes
the typed document data.

Never convert the rendered web form into a PDF screenshot.

### 6.2 One document model

The form submits one typed document object. The renderer consumes that
object and produces the PDF.

The renderer must not depend on DOM state, CSS, browser measurements, or
form layout.

### 6.3 One approved template

Delivery Note, Quotation, and Invoice use one shared approved visual
template.

``` ts
type DocumentType =
  | "delivery_note"
  | "quotation"
  | "invoice";

const documentTitles = {
  delivery_note: "DELIVERY NOTE",
  quotation: "QUOTATION",
  invoice: "INVOICE",
};
```

The document type changes the title only unless a future approved
reference explicitly requires another difference.

### 6.4 Coordinates are configuration

PDF coordinates must not be scattered throughout application code.

Use:

``` text
/templates/
  delivery-note-master.pdf
  delivery-note-overlay-map.json
```

The map defines position, size, font, alignment, and field-specific
rendering rules.

## 7. Application Layers

``` text
UI
 |
 v
Form / Validation
 |
 v
Document Domain
 |
 v
PDF Rendering
 |
 v
Template / Font Assets
```

### UI Layer

Responsible for:

-   form presentation
-   document type selection
-   input controls
-   validation messages
-   totals preview
-   Generate PDF
-   download/share actions

### Validation Layer

Responsible for:

-   required fields
-   date validation
-   numeric validation
-   email validation
-   line-item validation
-   document type validation
-   physical PDF field constraints

### Domain Layer

Responsible for:

-   document model
-   document types
-   calculations
-   currency formatting
-   business rules

This layer must not know about PDF coordinates.

### PDF Layer

Responsible for:

-   master PDF loading
-   font loading
-   dynamic field rendering
-   masking/replacing dynamic values
-   line-item rendering
-   totals
-   continuation pages

## 8. Recommended Project Structure

``` text
/
├── app/
│   ├── page.tsx
│   ├── layout.tsx
│   └── api/
│       └── generate-pdf/
│           └── route.ts
│
├── components/
│   ├── document-form/
│   │   ├── DocumentForm.tsx
│   │   ├── DocumentTypeField.tsx
│   │   ├── HeaderFields.tsx
│   │   ├── SupplierFields.tsx
│   │   ├── CustomerFields.tsx
│   │   ├── ContactFields.tsx
│   │   ├── TaxFields.tsx
│   │   ├── LineItems.tsx
│   │   ├── TotalsPreview.tsx
│   │   └── GeneratePdfButton.tsx
│   └── sharing/
│       └── SharePdfButton.tsx
│
├── domain/
│   ├── document.ts
│   ├── document-types.ts
│   ├── calculations.ts
│   └── formatting.ts
│
├── validation/
│   └── document-schema.ts
│
├── pdf/
│   ├── render-document.ts
│   ├── template-loader.ts
│   ├── field-renderer.ts
│   ├── table-renderer.ts
│   ├── continuation-pages.ts
│   ├── fonts.ts
│   └── coordinates.ts
│
├── templates/
│   ├── delivery-note-master.pdf
│   └── delivery-note-overlay-map.json
│
├── fonts/
│   ├── Arial.ttf
│   ├── Arial-Bold.ttf
│   ├── Calibri.ttf
│   └── Helvetica-BoldOblique.ttf
│
├── tests/
│   ├── unit/
│   ├── integration/
│   ├── e2e/
│   └── visual/
│
├── netlify.toml
├── package.json
├── tsconfig.json
└── ARCHITECTURE.md
```

## 9. Domain Model

The implementation specification's one-item model should become a
multiple-item model:

``` ts
type DocumentType =
  | "delivery_note"
  | "quotation"
  | "invoice";

type Document = {
  documentType: DocumentType;

  registrationNumber: string;
  vatNumber: string;
  documentNumber: string;
  purchaseOrderNumber?: string;
  date: string;
  salesRep: string;

  supplier: {
    addressLine1: string;
    addressLine2: string;
    addressLine3: string;
  };

  customer: {
    name: string;
    attention: string;
    phone: string;
    addressLine1: string;
    addressLine2: string;
    addressLine3: string;
    postalCode: string;
  };

  contact: {
    telephone: string;
    mobile: string;
    email: string;
    secondaryContact: string;
  };

  taxRate: number;

  items: DocumentItem[];

  signature?: {
    name?: string;
    date?: string;
  };
};

type DocumentItem = {
  quantity: number;
  description: string;
  unitPrice: number;
};
```

Calculated values remain derived values:

``` ts
type DocumentTotals = {
  subtotal: Decimal;
  vat: Decimal;
  total: Decimal;
};
```

The server recalculates all totals before PDF generation.

## 10. Document Type Architecture

The supported types are:

``` text
Delivery Note
Quotation
Invoice
```

The title mapping is:

``` text
delivery_note -> DELIVERY NOTE
quotation     -> QUOTATION
invoice       -> INVOICE
```

All three use the same approved template.

Do not create separate quotation/invoice designs unless approved source
PDFs are later supplied.

## 11. PDF Generation Flow

``` text
User clicks Generate PDF
          |
          v
Client validates form
          |
          v
POST /api/generate-pdf
          |
          v
Server validates schema
          |
          v
Server calculates totals
          |
          v
Load master PDF
          |
          v
Load coordinate map
          |
          v
Render title and fields
          |
          v
Render line items
          |
          v
Render totals
          |
          v
Handle overflow pages
          |
          v
Serialize PDF
          |
          v
Return application/pdf
          |
          +------> Download
          |
          +------> Web Share / WhatsApp
```

## 12. PDF Endpoint

Recommended endpoint:

``` text
POST /api/generate-pdf
```

Request contains source values only. The server must not trust
client-calculated totals.

Response:

``` http
Content-Type: application/pdf
Content-Disposition: attachment; filename="invoice-123.pdf"
```

Validation errors return JSON with field-level errors.

Unexpected generation failures return a generic server error without
exposing stack traces or internal paths.

## 13. Template Architecture

The master PDF is an immutable application asset.

Conceptually:

``` text
MASTER PDF
   |
   +-- Static artwork
   |     +-- logo
   |     +-- labels
   |     +-- borders
   |     +-- table
   |     +-- signature lines
   |
   +-- Dynamic areas
         +-- title
         +-- document details
         +-- customer/supplier data
         +-- line items
         +-- totals
```

The production master should be prepared once from the supplied PDF:

1.  Remove/cover sample dynamic values.
2.  Preserve static artwork.
3.  Preserve labels and borders.
4.  Calibrate coordinates.
5.  Freeze the master template.
6.  Store it under version control.

The renderer should not repeatedly reconstruct the entire page.

## 14. Dynamic Field Rendering

Use a field definition such as:

``` ts
type PdfFieldDefinition = {
  page: number;
  x: number;
  y: number;
  width?: number;
  height?: number;
  font: string;
  fontSize: number;
  align: "left" | "center" | "right";
  minFontSize?: number;
  maxFontSize?: number;
  clip?: boolean;
};
```

Centralized renderer functions should handle:

``` text
drawTextField()
drawCurrencyField()
drawDateField()
drawRightAlignedField()
drawWrappedDescription()
```

This prevents rendering behavior from being duplicated.

## 15. Multiple Line Items and Additional Pages

The user selected multiple line items with automatic additional pages.

Page 1 must retain the approved source layout.

When line items exceed the available table space:

``` text
Page 1
  Original header
  Customer information
  Original table
  First N items

Page 2+
  Controlled continuation table
  Remaining items

Final page
  Remaining items
  Subtotal
  VAT
  Total
```

The source document currently has a blank second page in its base
two-page structure. Therefore the base single-item output should
preserve that behavior.

For overflow documents, additional pages may be populated/created only
when required.

The continuation-page design must be validated against the approved
source style. Do not invent unrelated visual styling.

## 16. Financial Calculations

Use decimal-safe arithmetic.

``` text
lineAmount = quantity × unitPrice
subtotal = sum(lineAmount)
vat = subtotal × taxRate / 100
total = subtotal + vat
```

Use `decimal.js` or an equivalent decimal arithmetic library.

The server is authoritative for these calculations.

## 17. Company Configuration

The application is for one company, so company information is
application configuration rather than per-document user input.

Keep company constants in one place:

``` ts
const companyConfig = {
  name: "...",
  registrationNumber: "...",
  vatNumber: "...",
  address: [...],
  telephone: "...",
  bank: "...",
  accountNumber: "...",
  accountType: "...",
};
```

Do not duplicate these values throughout the codebase.

## 18. No Database

No database is required.

The application is stateless:

``` text
Request
  -> Validate
  -> Calculate
  -> Generate
  -> Return PDF
```

No generated document is retained.

No document history or saved-document dashboard is part of the first
release.

## 19. No Authentication

No login is required.

Therefore there is no:

-   user table
-   password storage
-   session database
-   account dashboard

Security instead focuses on request validation, resource limits, safe
PDF rendering, and protection of template assets.

## 20. Admin Area Constraint

The selected requirements include an admin area while also specifying no
authentication.

A protected admin area cannot safely exist without
authentication/authorization.

Therefore, for the first release:

-   company configuration should remain source-controlled;
-   no public unauthenticated admin mutation endpoint should be exposed;
-   the admin architecture may be prepared, but actual browser-based
    administration should only be enabled after authentication is
    introduced.

Future admin functionality can include company information, logo, tax
defaults, template management, and numbering configuration.

## 21. Document Numbering

The user manually enters the document number.

There is therefore no numbering service, database sequence, or
concurrency mechanism.

The form uses:

``` text
Document Number
```

The PDF label remains controlled by the approved template.

## 22. Signature

The selected requirement is to preserve the existing blank signature
area.

Do not add:

-   signature pads
-   uploaded signatures
-   electronic signature graphics

The existing Name / DATE / Signature area remains part of the template.

## 23. Sharing

### Download

Always supported.

### Web Share

Where supported:

``` ts
navigator.share({
  files: [pdfFile],
  title: documentTitle
});
```

### WhatsApp

The application should not assume a browser can directly attach an
arbitrary local PDF to a WhatsApp URL.

Use this priority:

1.  Native Web Share file sharing when supported.
2.  Share/WhatsApp fallback where appropriate.
3.  Download as the universal fallback.

Because generated PDFs are not stored, the application cannot create a
permanent public PDF URL for WhatsApp without introducing document
storage.

## 24. Validation

Validate on both client and server.

Minimum rules:

``` text
documentType is valid
required text fields are non-empty
date is valid
quantity >= 0
unitPrice >= 0
0 <= taxRate <= 100
email values are valid when supplied
at least one line item exists
```

Also impose maximum string lengths based on the physical PDF field
dimensions.

## 25. Long Text Strategy

The fixed PDF layout cannot accept unlimited text.

Rendering behavior:

``` text
Text fits
  -> render at approved font size

Text does not fit
  -> reduce font size within approved range
      |
      +-> still does not fit
            -> reject generation with a clear validation error
```

Never allow text to overlap borders, labels, or other fields.

## 26. Security

Even without accounts or a database, the PDF endpoint is publicly
callable.

Implement:

-   server-side schema validation
-   request-size limits
-   field-length limits
-   maximum line-item limits
-   maximum generated-page limits
-   safe text rendering
-   no evaluation of user input
-   no user-controlled file paths
-   protected server-side template access
-   rate limiting where supported

Do not log complete customer data unnecessarily.

## 27. Error Handling

Use structured errors:

``` json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "One or more fields are invalid.",
    "fields": {
      "customer.name": "Customer name is required."
    }
  }
}
```

Never return internal stack traces or filesystem paths to users.

## 28. Testing Strategy

### Unit tests

Test:

-   tax calculation
-   subtotal
-   totals
-   currency formatting
-   title mapping
-   date formatting
-   validation
-   pagination calculations

### Integration tests

Test:

-   API validation
-   PDF generation
-   PDF response headers
-   document types
-   blank optional values
-   multiple line items
-   continuation pages

### End-to-end tests

Use Playwright:

``` text
Open application
  -> Fill form
  -> Select document type
  -> Add items
  -> Generate PDF
  -> Receive PDF
  -> Download/share
```

### Visual regression

This is the most important test category.

For each document type:

1.  Generate a deterministic PDF.
2.  Render it to an image at a fixed DPI.
3.  Compare against an approved reference.
4.  Verify static regions remain unchanged.
5.  Verify dynamic fields occupy the intended locations.
6.  Verify page size and page count.
7.  Verify no unexpected layout movement.

## 29. Test Fixtures

Create deterministic fixtures:

``` text
tests/fixtures/
  delivery-note.json
  quotation.json
  invoice.json
  multiple-items.json
  blank-optionals.json
  long-text.json
```

Maintain approved visual references for regression testing.

## 30. Deployment

Recommended flow:

``` text
Git Repository
      |
      v
Netlify Build
      |
      +--> TypeScript checks
      +--> Unit tests
      +--> PDF tests
      +--> Production build
      |
      v
Netlify Deployment
```

Use:

``` text
Local
Preview
Production
```

Preview deployments should be used to validate PDF rendering before
production.

## 31. Template Versioning

Track the approved PDF template internally:

``` ts
const TEMPLATE_VERSION = "1.0.0";
```

This is an engineering identifier and does not need to appear on the
generated document.

When the template changes, increment its version and regenerate the
coordinate map and visual regression baselines.

## 32. Observability

Because documents are not stored, logging should focus on system health.

Safe metadata includes:

``` text
PDF generation started
PDF generation completed
PDF generation failed
generation duration
document type
template version
line-item count
```

Do not log full customer addresses, phone numbers, email addresses, or
document contents unless explicitly required.

## 33. Performance

Priorities:

1.  Keep the master PDF small.
2.  Avoid rasterizing the whole document.
3.  Reuse static PDF content.
4.  Load fonts efficiently.
5.  Prevent duplicate generation while a request is active.

The UI should show:

``` text
Generating PDF...
```

and disable the Generate button until the request completes.

## 34. Accessibility

The web form should support:

-   semantic labels
-   keyboard navigation
-   visible validation messages
-   accessible buttons
-   focus management
-   descriptive field labels
-   non-color-only validation

These requirements apply to the web UI and must not alter the PDF
design.

## 35. Mobile

The web form should be responsive.

The generated PDF remains:

``` text
A4
Portrait
Fixed dimensions
```

regardless of device.

## 36. Separation of UI and PDF

``` text
WEB APP
Responsive
Accessible
Tailwind allowed
Mobile-friendly

PDF
Fixed
Template-driven
Coordinate-based
No browser rendering
No responsive layout
No redesign
```

Changing the web UI must never change the PDF output.

## 37. Development Order

### Phase 1 --- Template preparation

1.  Inspect supplied PDF.
2.  Create clean master.
3.  Identify dynamic fields.
4.  Create coordinate map.
5.  Verify dimensions/fonts.
6.  Create visual baselines.

### Phase 2 --- Domain

1.  Document types.
2.  Document schema.
3.  Multiple line items.
4.  Financial calculations.
5.  Formatting.

### Phase 3 --- PDF engine

1.  Load template.
2.  Render fields.
3.  Render document title.
4.  Render table.
5.  Render totals.
6.  Handle long text.
7.  Handle overflow pages.

### Phase 4 --- Web form

1.  Document type.
2.  Document details.
3.  Supplier/customer.
4.  Contact details.
5.  Tax.
6.  Line items.
7.  Totals.
8.  Generate PDF.

### Phase 5 --- Sharing

1.  Download.
2.  Web Share.
3.  WhatsApp fallback.
4.  Mobile testing.

### Phase 6 --- Testing

1.  Unit tests.
2.  API tests.
3.  Playwright.
4.  Visual regression.
5.  Cross-browser testing.

### Phase 7 --- Deployment

1.  Netlify configuration.
2.  Preview deployment.
3.  Production deployment.
4.  Smoke tests.

## 38. Architecture Risks

### Exact PDF fidelity

**Risk:** small font/coordinate/template differences can make the
generated PDF visibly different.

**Mitigation:** fixed master PDF, coordinate map, approved fonts, and
visual regression.

### Multiple line items

**Risk:** the supplied source was not designed as an unlimited-item
document.

**Mitigation:** preserve page 1 and implement controlled continuation
pages. Validate the continuation design before treating it as final.

### Long text

**Risk:** customer names/descriptions may exceed fixed field widths.

**Mitigation:** maximum lengths, controlled font reduction, and
validation failure when necessary.

### WhatsApp file sharing

**Risk:** browsers cannot universally attach generated local files
directly through a WhatsApp URL.

**Mitigation:** Web Share API first, download fallback.

### Unauthenticated admin

**Risk:** public configuration changes would be insecure.

**Mitigation:** keep configuration source-controlled until
authentication is introduced.

## 39. Architecture Decision Records

### ADR-001 --- Next.js + TypeScript

**Decision:** Use Next.js, React, and TypeScript.

**Reason:** Provides a unified web UI and server-side PDF endpoint
suitable for Netlify.

### ADR-002 --- Fixed PDF master

**Decision:** Use the supplied PDF as the master visual template.

**Reason:** Exact visual reproduction is the primary requirement.

### ADR-003 --- Server-side PDF generation

**Decision:** Generate PDFs server-side.

**Reason:** Centralizes fonts, template assets, coordinate rendering,
and deterministic output.

### ADR-004 --- No database

**Decision:** Do not introduce a database.

**Reason:** Generated documents are not required to be persisted.

### ADR-005 --- Manual numbering

**Decision:** Users enter document numbers.

**Reason:** Automatic numbering was not selected.

### ADR-006 --- Shared template

**Decision:** Delivery Note, Quotation, and Invoice share the approved
template.

**Reason:** The requirement specifies changing the title while retaining
the existing design.

### ADR-007 --- Controlled pagination

**Decision:** Support multiple line items using controlled continuation
pages.

**Reason:** Multiple items were selected while the original page layout
must remain intact.

## 40. Definition of Done

-   [ ] Application runs on Netlify.
-   [ ] No login is required.
-   [ ] No database is required.
-   [ ] User can select Delivery Note, Quotation, or Invoice.
-   [ ] User manually enters the document number.
-   [ ] User can enter multiple line items.
-   [ ] Totals are calculated server-side using decimal-safe arithmetic.
-   [ ] PDF is generated server-side.
-   [ ] PDF uses the approved master template.
-   [ ] Document title changes according to document type.
-   [ ] Page 1 remains faithful to the source.
-   [ ] Additional pages are created only when line-item overflow
    requires them.
-   [ ] Base template page 2 remains blank as specified.
-   [ ] User can download the PDF.
-   [ ] Supported devices can share the generated PDF.
-   [ ] WhatsApp/share fallback is provided where direct file sharing is
    unavailable.
-   [ ] Generated documents are not persisted.
-   [ ] No unauthenticated admin mutation endpoint is exposed.
-   [ ] Visual regression tests pass.
-   [ ] Desktop and mobile form workflows work correctly.
-   [ ] Production smoke tests pass.

## 41. Final Architecture Principle

> **The web application is flexible; the PDF is not.**

The browser application may use modern responsive technologies, but the
generated document must remain a deterministic reproduction of the
approved source template.

The system is therefore:

``` text
                 USER
                  |
                  v
        ┌───────────────────┐
        │ Responsive Form   │
        │ React / Next.js   │
        └─────────┬─────────┘
                  |
                  v
        ┌───────────────────┐
        │ Typed Document    │
        │ + Validation      │
        └─────────┬─────────┘
                  |
                  v
        ┌───────────────────┐
        │ Server PDF Engine │
        │ pdf-lib           │
        └─────────┬─────────┘
                  |
                  v
        ┌───────────────────┐
        │ Fixed PDF Master  │
        │ + Coordinates     │
        │ + Fonts           │
        └─────────┬─────────┘
                  |
                  v
        ┌───────────────────┐
        │ Generated PDF     │
        └───────┬─────┬─────┘
                |     |
             Download Share
                      |
                  Device / WhatsApp
```

The existing `IMPLEMENTATION.md` remains the functional source of truth.
This `ARCHITECTURE.md` defines the technical implementation strategy.
