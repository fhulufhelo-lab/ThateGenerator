import { documentRequestSchema } from "../../../validation/document-schema";
import { PdfFieldOverflowError, PdfPageLimitError } from "../../../pdf/field-renderer";
import { renderDocument } from "../../../pdf/render-document";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_REQUEST_BYTES = 64 * 1024;

function errorResponse(status: number, code: string, message: string, fields?: Record<string, string>): Response {
  return Response.json({
    error: {
      code,
      message,
      ...(fields ? { fields } : {}),
    },
  }, { status });
}

async function readBoundedBody(request: Request): Promise<string | null> {
  const declaredLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > MAX_REQUEST_BYTES) {
    return null;
  }
  if (!request.body) {
    return "";
  }

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    totalBytes += value.byteLength;
    if (totalBytes > MAX_REQUEST_BYTES) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }

  const body = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(body);
}

function safeFilenamePart(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 64) || "document";
}

export async function POST(request: Request): Promise<Response> {
  const contentType = request.headers.get("content-type")?.split(";", 1)[0].trim().toLowerCase();
  if (contentType !== "application/json") {
    return errorResponse(415, "UNSUPPORTED_MEDIA_TYPE", "Send the document as application/json.");
  }

  const bodyText = await readBoundedBody(request);
  if (bodyText === null) {
    return errorResponse(413, "REQUEST_TOO_LARGE", "The request body exceeds the 64 KiB limit.");
  }

  let body: unknown;
  try {
    body = JSON.parse(bodyText);
  } catch {
    return errorResponse(400, "INVALID_JSON", "The request body must contain valid JSON.");
  }

  const parsed = documentRequestSchema.safeParse(body);
  if (!parsed.success) {
    const fields = Object.fromEntries(
      parsed.error.issues.map((issue) => [issue.path.join(".") || "document", issue.message]),
    );
    return errorResponse(400, "VALIDATION_ERROR", "One or more fields are invalid.", fields);
  }

  try {
    const pdf = await renderDocument(parsed.data);
    const documentNumber = safeFilenamePart(parsed.data.documentNumber);
    const type = parsed.data.documentType.replaceAll("_", "-");
    return new Response(Buffer.from(pdf), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${type}-${documentNumber}.pdf"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("PDF generation failed", error);

    if (error instanceof PdfFieldOverflowError) {
      return errorResponse(400, "VALIDATION_ERROR", "One or more fields do not fit the approved PDF layout.", {
        [error.field]: error.message,
      });
    }
    if (error instanceof PdfPageLimitError) {
      return errorResponse(400, "VALIDATION_ERROR", error.message, {
        items: error.message,
      });
    }
    return errorResponse(500, "PDF_GENERATION_FAILED", "The document could not be generated.");
  }
}