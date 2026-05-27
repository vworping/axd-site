from __future__ import annotations

import argparse
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont, ImageOps, ImageStat


IMAGE_EXTS = {".jpg", ".jpeg", ".png", ".webp", ".tif", ".tiff"}
DEFAULT_TEXT = "[AXD]"
FONT_CANDIDATES = [
    ("/System/Library/Fonts/Avenir Next.ttc", 8),  # Avenir Next Heavy
    ("/System/Library/Fonts/Avenir Next.ttc", 0),  # Avenir Next Bold
    ("/System/Library/Fonts/Supplemental/Arial Black.ttf", 0),
    ("/System/Library/Fonts/HelveticaNeue.ttc", 0),
]


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Create resized, watermarked web copies of image files."
    )
    parser.add_argument("--src", required=True, type=Path, help="Source image file or directory.")
    parser.add_argument("--out", required=True, type=Path, help="Output file or directory.")
    parser.add_argument("--text", default=DEFAULT_TEXT, help="Watermark text.")
    parser.add_argument("--max-edge", default=1800, type=int, help="Longest output edge in pixels.")
    parser.add_argument("--quality", default=88, type=int, help="JPEG/WebP output quality.")
    parser.add_argument("--opacity", default=0.82, type=float, help="Watermark opacity from 0 to 1.")
    parser.add_argument("--font-scale", default=0.026, type=float, help="Watermark size as a fraction of the shorter image edge.")
    parser.add_argument("--margin-scale", default=0.020, type=float, help="Watermark margin as a fraction of the shorter image edge.")
    parser.add_argument("--font", type=Path, help="Optional path to a .ttf/.ttc font.")
    parser.add_argument("--font-index", default=0, type=int, help="Font collection index for .ttc files.")
    parser.add_argument(
        "--format",
        choices=("jpg", "webp", "keep"),
        default="jpg",
        help="Output format. Use jpg for broad GitHub Pages compatibility.",
    )
    parser.add_argument(
        "--overwrite",
        action="store_true",
        help="Replace existing output files.",
    )
    return parser.parse_args()


def output_suffix(source: Path, output_format: str) -> str:
    if output_format == "keep":
        return source.suffix.lower()
    return f".{output_format}"


def collect_images(source: Path) -> list[Path]:
    if source.is_file():
        return [source] if source.suffix.lower() in IMAGE_EXTS else []
    return sorted(path for path in source.rglob("*") if path.suffix.lower() in IMAGE_EXTS)


def output_path(source: Path, source_root: Path, out_root: Path, output_format: str) -> Path:
    if source_root.is_file() and out_root.suffix:
        return out_root
    relative = source.relative_to(source_root if source_root.is_dir() else source_root.parent)
    return (out_root / relative).with_suffix(output_suffix(source, output_format))


def load_font(font_path: Path | None, size: int) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    candidates: list[tuple[Path, int]] = []
    if font_path:
        candidates.append((font_path, 0))
    candidates.extend((Path(path), index) for path, index in FONT_CANDIDATES)
    for candidate, index in candidates:
        if candidate.exists():
            try:
                return ImageFont.truetype(str(candidate), size=size, index=index)
            except OSError:
                continue
    return ImageFont.load_default()


def fit_font(
    text: str,
    image_width: int,
    target_size: int,
    max_width: int,
    font_path: Path | None,
    font_index: int,
):
    size = target_size
    while size >= 12:
        font = (
            ImageFont.truetype(str(font_path), size=size, index=font_index)
            if font_path
            else load_font(None, size)
        )
        bbox = ImageDraw.Draw(Image.new("RGB", (1, 1))).textbbox((0, 0), text, font=font)
        if bbox[2] - bbox[0] <= max_width:
            return font, bbox
        size -= 2
    font = (
        ImageFont.truetype(str(font_path), size=12, index=font_index)
        if font_path
        else load_font(None, 12)
    )
    bbox = ImageDraw.Draw(Image.new("RGB", (1, 1))).textbbox((0, 0), text, font=font)
    return font, bbox


def contrast_color(image: Image.Image, sample_box: tuple[int, int, int, int], opacity: float):
    patch = image.crop(sample_box).convert("L")
    luminance = ImageStat.Stat(patch).mean[0]
    alpha = int(max(0.0, min(1.0, opacity)) * 255)
    return (255, 255, 255, alpha) if luminance < 138 else (0, 0, 0, alpha)


def opposite_color(color: tuple[int, int, int, int]) -> tuple[int, int, int, int]:
    return (0, 0, 0, 42) if color[0] > 127 else (255, 255, 255, 46)


def watermark_one(source: Path, dest: Path, args: argparse.Namespace) -> None:
    with Image.open(source) as opened:
        image = ImageOps.exif_transpose(opened).convert("RGB")

    image.thumbnail((args.max_edge, args.max_edge), Image.Resampling.LANCZOS)
    width, height = image.size
    short_edge = min(width, height)
    margin = max(8, round(short_edge * args.margin_scale))
    target_font_size = max(18, min(52, round(short_edge * args.font_scale)))
    max_text_width = max(120, width - (margin * 2))
    font, bbox = fit_font(args.text, width, target_font_size, max_text_width, args.font, args.font_index)

    text_width = bbox[2] - bbox[0]
    text_height = bbox[3] - bbox[1]
    x = margin
    y = height - margin - text_height

    sample_pad = max(12, round(text_height * 0.55))
    sample_box = (
        max(0, x - sample_pad),
        max(0, y - sample_pad),
        min(width, x + text_width + sample_pad),
        min(height, y + text_height + sample_pad),
    )
    fill = contrast_color(image, sample_box, args.opacity)

    overlay = Image.new("RGBA", image.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay)
    draw.text(
        (x, y),
        args.text,
        font=font,
        fill=fill,
        stroke_width=max(1, round(text_height * 0.035)),
        stroke_fill=opposite_color(fill),
    )

    result = Image.alpha_composite(image.convert("RGBA"), overlay)
    dest.parent.mkdir(parents=True, exist_ok=True)
    if dest.suffix.lower() in {".jpg", ".jpeg"}:
        result.convert("RGB").save(dest, quality=args.quality, optimize=True, progressive=True)
    elif dest.suffix.lower() == ".webp":
        result.convert("RGB").save(dest, quality=args.quality, method=6)
    else:
        result.save(dest, optimize=True)


def main() -> None:
    args = parse_args()
    source = args.src.expanduser().resolve()
    out = args.out.expanduser().resolve()
    images = collect_images(source)

    if not images:
        raise SystemExit(f"No supported images found in {source}")

    written = 0
    skipped = 0
    for image_path in images:
        dest = output_path(image_path, source, out, args.format)
        if dest.exists() and not args.overwrite:
            skipped += 1
            continue
        watermark_one(image_path, dest, args)
        written += 1

    print(f"Wrote {written} image(s) to {out}")
    if skipped:
        print(f"Skipped {skipped} existing image(s). Use --overwrite to replace them.")


if __name__ == "__main__":
    main()
