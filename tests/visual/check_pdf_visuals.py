from __future__ import annotations

import json
import math
import sys
from pathlib import Path

import pymupdf
from PIL import Image, ImageChops, ImageDraw


ROOT = Path(__file__).resolve().parents[2]
OVERLAY_MAP = ROOT / "templates" / "delivery-note-overlay-map.json"
DPI = 144
SCALE = DPI / 72
ITEM_ROWS_ON_MASTER = 2


def dynamic_mask(size: tuple[int, int], overlay_map: dict[str, object]) -> Image.Image:
    mask = Image.new("L", size, 255)
    draw = ImageDraw.Draw(mask)

    def cover(bbox: list[float]) -> None:
        x0, top, x1, bottom = bbox
        padding = 3
        draw.rectangle(
            (
                math.floor(x0 * SCALE) - padding,
                math.floor(top * SCALE) - padding,
                math.ceil(x1 * SCALE) + padding,
                math.ceil(bottom * SCALE) + padding,
            ),
            fill=0,
        )

    fields = overlay_map["fields"]
    for name, definition in fields.items():
        if name.startswith("items[]."):
            row_step = definition.get("rowStep", 10.8)
            x0, top, x1, bottom = definition["bbox"]
            for row in range(ITEM_ROWS_ON_MASTER):
                offset = row * row_step
                cover([x0, top + offset, x1, bottom + offset])
        else:
            cover(definition["bbox"])

    return mask


def compare_page(actual_page: pymupdf.Page, baseline_path: Path, page_number: int, overlay_map: dict[str, object]) -> None:
    actual_pixmap = actual_page.get_pixmap(dpi=DPI, alpha=False)
    actual = Image.frombytes("RGB", (actual_pixmap.width, actual_pixmap.height), actual_pixmap.samples)
    baseline = Image.open(baseline_path).convert("RGB")
    if actual.size != baseline.size:
        raise AssertionError(f"Page {page_number} dimensions differ: {actual.size} != {baseline.size}")

    mask = dynamic_mask(actual.size, overlay_map) if page_number == 1 else Image.new("L", actual.size, 255)
    difference = ImageChops.difference(actual, baseline)
    unchanged_pixels = Image.new("RGB", actual.size, (0, 0, 0))
    if Image.composite(difference, unchanged_pixels, mask).getbbox():
        raise AssertionError(f"Static artwork differs from the approved page {page_number} baseline.")


def main() -> None:
    if len(sys.argv) != 3:
        raise SystemExit("Usage: check_pdf_visuals.py <generated.pdf> <baseline-directory>")

    pdf_path = Path(sys.argv[1])
    baseline_directory = Path(sys.argv[2])
    overlay_map = json.loads(OVERLAY_MAP.read_text(encoding="utf-8"))
    document = pymupdf.open(pdf_path)
    if len(document) != overlay_map["page"]["count"]:
        raise AssertionError(f"Expected the base {overlay_map['page']['count']}-page PDF, found {len(document)} pages.")

    for page_number, page in enumerate(document, start=1):
        expected_size = (overlay_map["page"]["width"], overlay_map["page"]["height"])
        actual_size = page.rect.width, page.rect.height
        if any(abs(actual - expected) > 0.02 for actual, expected in zip(actual_size, expected_size)):
            raise AssertionError(f"Page {page_number} dimensions differ from A4 portrait: {actual_size}")
        baseline = baseline_directory / f"delivery-note-page-{page_number}.png"
        compare_page(page, baseline, page_number, overlay_map)

    print(f"{pdf_path.name}: {len(document)} A4 pages; static pixels match approved baselines.")


if __name__ == "__main__":
    main()