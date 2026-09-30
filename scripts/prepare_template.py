from __future__ import annotations

import hashlib
from pathlib import Path

import pymupdf


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "COD 1.pdf"
TEMPLATES = ROOT / "templates"
MASTER = TEMPLATES / "delivery-note-master.pdf"
OVERLAY_MAP = TEMPLATES / "delivery-note-overlay-map.json"
BASELINES = ROOT / "tests" / "visual" / "baselines"
EXPECTED_SOURCE_SHA256 = "323E8913C60A416BF046D2967A4398CDBEE8E03B5BA007AECDB5E8C85F1FB018"
EXPECTED_PAGE_SIZE = (595.2756, 841.8898)

SAMPLE_VALUES = {
    "DELIVERY NOTE",
    "2007/210672/23",
    "4220270799",
    "20260615",
    "Friday, September 18, 2026",
    "PETER",
    "Power park building",
    "No: 50 Reitfontein Road",
    "Primrose, 1401",
    "(011) 026 1210",
    "CABLE TRADING HOUSE",
    "(082) 442 5771",
    "sales@thate.co.za",
    "wanga@thate.co.za",
    "26 BORAX STREET",
    "ALRODE",
    "ALBERTON",
    "1451",
    "15%",
    "2000",
    "120mm X 3 CORE + 25A + 54.6N ABC SANS 1KV AL",
    "THATE ELCTRICAL SUPPLIES",
    "First National Bank",
    "62193132760",
    "Cheque",
}


def source_sha256() -> str:
    return hashlib.sha256(SOURCE.read_bytes()).hexdigest().upper()


def is_currency_cell(span: dict[str, object]) -> bool:
    text = str(span["text"]).strip()
    x0, y0, _, _ = span["bbox"]
    return text == "R" and 295 <= y0 <= 346 and 330 <= x0 <= 500


def is_empty_amount_marker(span: dict[str, object]) -> bool:
    text = str(span["text"]).strip()
    x0, y0, _, _ = span["bbox"]
    return text == "-" and 295 <= y0 <= 346 and x0 >= 380


def main() -> None:
    actual_hash = source_sha256()
    if actual_hash != EXPECTED_SOURCE_SHA256:
        raise SystemExit(
            "COD 1.pdf does not match the inspected source. "
            "Review the PDF and update the expected hash and coordinate map intentionally."
        )

    document = pymupdf.open(SOURCE)
    if len(document) != 2:
        raise SystemExit(f"Expected the inspected two-page source PDF, found {len(document)} pages.")

    for page_number, page in enumerate(document, start=1):
        if any(abs(actual - expected) > 0.02 for actual, expected in zip(page.rect[2:], EXPECTED_PAGE_SIZE)):
            raise SystemExit(f"Page {page_number} is not the inspected A4 portrait size.")

    first_page = document[0]
    spans = [
        span
        for block in first_page.get_text("dict")["blocks"]
        if "lines" in block
        for line in block["lines"]
        for span in line["spans"]
    ]
    source_text = {span["text"].strip() for span in spans}
    missing = SAMPLE_VALUES - source_text
    if missing:
        raise SystemExit(f"Inspected sample values were not found: {sorted(missing)}")

    removals = [
        span
        for span in spans
        if span["text"].strip() in SAMPLE_VALUES
        or is_currency_cell(span)
        or is_empty_amount_marker(span)
    ]
    if not any(span["text"].strip() == "-" for span in removals):
        raise SystemExit("The expected empty amount markers were not found.")
    if not any(is_currency_cell(span) for span in removals):
        raise SystemExit("The expected currency markers were not found.")

    for span in removals:
        x0, y0, x1, y1 = span["bbox"]
        rect = pymupdf.Rect(x0 - 0.35, y0 - 0.35, x1 + 0.35, y1 + 0.35)
        first_page.add_redact_annot(rect, fill=(1, 1, 1), cross_out=False)
    first_page.apply_redactions(images=0, graphics=0)

    clean_text = first_page.get_text()
    remaining = sorted(value for value in SAMPLE_VALUES if value in clean_text)
    if remaining:
        raise SystemExit(f"Sample values remain in the clean master: {remaining}")
    for label in ("Reg no", "DEL NO", "PURCHASE ORDER NO", "Sold to", "Description", "Sub-total", "Signature"):
        if label not in clean_text:
            raise SystemExit(f"Static template label was removed: {label}")
    if document[1].get_text().strip():
        raise SystemExit("The source's blank second page was changed unexpectedly.")

    TEMPLATES.mkdir(parents=True, exist_ok=True)
    BASELINES.mkdir(parents=True, exist_ok=True)
    document.save(MASTER, garbage=4, deflate=True)
    document.close()

    clean_document = pymupdf.open(MASTER)
    for page_number, page in enumerate(clean_document, start=1):
        image = page.get_pixmap(dpi=144, alpha=False)
        image.save(BASELINES / f"delivery-note-page-{page_number}.png")
    clean_document.close()

    if not OVERLAY_MAP.is_file():
        raise SystemExit(f"Coordinate map is missing: {OVERLAY_MAP}")
    print(f"Created {MASTER.relative_to(ROOT)}")
    print(f"Created clean visual baselines in {BASELINES.relative_to(ROOT)}")
    print("Verified two A4 portrait pages, embedded source text, static labels, and blank continuation page.")


if __name__ == "__main__":
    main()