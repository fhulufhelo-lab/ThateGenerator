import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { PDFDocument } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import type { FontKey, OverlayMap } from "./types";

const fontEnvironmentVariables: Record<FontKey, string> = {
  body: "PDF_FONT_ARIAL_PATH",
  bold: "PDF_FONT_ARIAL_BOLD_PATH",
  contact: "PDF_FONT_CALIBRI_PATH",
};

const defaultFontFiles: Record<FontKey, string> = {
  body: "Arial.ttf",
  bold: "Arial-Bold.ttf",
  contact: "Calibri.ttf",
};

export type LoadedTemplate = {
  pdf: PDFDocument;
  overlayMap: OverlayMap;
  fonts: Record<FontKey, Awaited<ReturnType<PDFDocument["embedFont"]>>>;
};

let templateBytesPromise: Promise<Uint8Array> | undefined;
let overlayMapPromise: Promise<OverlayMap> | undefined;
const fontBytesPromises = new Map<FontKey, Promise<Uint8Array>>();

function templatePath(fileName: string): string {
  return path.join(process.cwd(), "templates", fileName);
}

function loadTemplateBytes(): Promise<Uint8Array> {
  templateBytesPromise ??= readFile(templatePath("delivery-note-master.pdf"));
  return templateBytesPromise;
}

function loadOverlayMap(): Promise<OverlayMap> {
  overlayMapPromise ??= readFile(templatePath("delivery-note-overlay-map.json"), "utf8").then(
    (contents) => JSON.parse(contents) as OverlayMap,
  );
  return overlayMapPromise;
}

function resolveFontPath(key: FontKey): string {
  const candidatePaths = [
    process.env[fontEnvironmentVariables[key]],
    path.join(process.cwd(), "fonts", defaultFontFiles[key]),
    path.join("/usr/share/fonts/truetype/dejavu", key === "bold" ? "DejaVuSans-Bold.ttf" : "DejaVuSans.ttf"),
    key === "body" ? "C:\\Windows\\Fonts\\arial.ttf" : key === "bold" ? "C:\\Windows\\Fonts\\arialbd.ttf" : "C:\\Windows\\Fonts\\calibri.ttf",
  ].filter((candidate): candidate is string => Boolean(candidate));

  for (const candidate of candidatePaths) {
    const resolved = path.resolve(candidate);
    if (existsSync(resolved)) {
      return resolved;
    }
  }

  return path.resolve(candidatePaths[0] ?? path.join(process.cwd(), "fonts", defaultFontFiles[key]));
}

function loadFontBytes(key: FontKey): Promise<Uint8Array> {
  let fontBytesPromise = fontBytesPromises.get(key);
  if (!fontBytesPromise) {
    const filePath = resolveFontPath(key);
    fontBytesPromise = readFile(filePath).catch(() => {
      throw new Error(`Required PDF font is unavailable. Configure ${fontEnvironmentVariables[key]} or add the bundled font to the repo's fonts folder.`);
    });
    fontBytesPromises.set(key, fontBytesPromise);
  }
  return fontBytesPromise;
}

export async function loadTemplate(): Promise<LoadedTemplate> {
  const [templateBytes, overlayMap, bodyFont, boldFont, contactFont] = await Promise.all([
    loadTemplateBytes(),
    loadOverlayMap(),
    loadFontBytes("body"),
    loadFontBytes("bold"),
    loadFontBytes("contact"),
  ]);

  const pdf = await PDFDocument.load(templateBytes);
  const pages = pdf.getPages();
  if (pages.length !== overlayMap.page.count) {
    throw new Error("The PDF template page count does not match its coordinate map.");
  }

  for (const page of pages) {
    const { width, height } = page.getSize();
    if (Math.abs(width - overlayMap.page.width) > 0.02 || Math.abs(height - overlayMap.page.height) > 0.02) {
      throw new Error("The PDF template page size does not match its coordinate map.");
    }
  }

  pdf.registerFontkit(fontkit);
  const fonts = {
    body: await pdf.embedFont(bodyFont, { subset: true }),
    bold: await pdf.embedFont(boldFont, { subset: true }),
    contact: await pdf.embedFont(contactFont, { subset: true }),
  };

  return { pdf, overlayMap, fonts };
}

export async function loadTemplateSource(): Promise<PDFDocument> {
  return PDFDocument.load(await loadTemplateBytes());
}