#!/usr/bin/env python3
"""
prep_frames.py — Preprocesses AI-generated art into named,
centered, transparent-background frames for TexturePacker.

Install:
    pip install pillow rembg

Usage:
    # Directory of individual PNGs (Midjourney, DALL-E, etc.):
    python scripts/prep_frames.py raw/idle/      mascot_idle    512  out/mascot/
    python scripts/prep_frames.py raw/walk/      wolf_walk      256  out/wolves/

    # Single horizontal spritesheet (4 frames side by side):
    python scripts/prep_frames.py raw/idle.png   mascot_idle    512  out/mascot/  --cols 4

    # Source already has transparency — skip bg removal:
    python scripts/prep_frames.py raw/idle/      mascot_idle    512  out/mascot/  --no-rembg

State → canvas size reference:
    mascot_idle     512     4 frames
    mascot_fear     512     4 frames
    mascot_hit      512     3 frames
    mascot_victory  512     4 frames
    mascot_defeat   512     3 frames
    wolf_walk       256     4 frames
    wolf_dying      256     4 frames
"""

import argparse
import sys
from pathlib import Path
from PIL import Image

IMG_EXTS = {".png", ".jpg", ".jpeg", ".webp"}


# ─── Background removal ───────────────────────────────────────────────────────

def remove_bg(img: Image.Image) -> Image.Image:
    """Remove background using rembg (U²-Net). Falls back to white-key if unavailable."""
    try:
        from rembg import remove as _remove
        result = _remove(img)
        return result.convert("RGBA")
    except ImportError:
        print(
            "\n  ⚠  rembg not installed — falling back to near-white removal.\n"
            "     Edges will be rough. For mascot art, install rembg first:\n"
            "     pip install rembg\n"
        )
        return _white_key(img.convert("RGBA"))


def _white_key(img: Image.Image, thresh: int = 18) -> Image.Image:
    """
    Crude near-white removal. Acceptable for solid dark silhouettes (wolves).
    Not good enough for soft-edged mascot art — use rembg for that.
    """
    data = list(img.getdata())
    result = [
        (r, g, b, 0) if r > 255 - thresh and g > 255 - thresh and b > 255 - thresh
        else (r, g, b, a)
        for r, g, b, a in data
    ]
    out = img.copy()
    out.putdata(result)
    return out


# ─── Source loading ───────────────────────────────────────────────────────────

def split_sheet(img: Image.Image, cols: int) -> list[Image.Image]:
    """Split a horizontal spritesheet into individual frame images."""
    w, h = img.size
    fw = w // cols
    return [img.crop((i * fw, 0, (i + 1) * fw, h)) for i in range(cols)]


def load_sources(src: Path, cols: int | None) -> list[Image.Image]:
    if src.is_file():
        img = Image.open(src).convert("RGBA")
        return split_sheet(img, cols) if cols else [img]
    if src.is_dir():
        files = sorted(f for f in src.iterdir() if f.suffix.lower() in IMG_EXTS)
        if not files:
            sys.exit(f"No image files found in {src}")
        return [Image.open(f).convert("RGBA") for f in files]
    sys.exit(f"Path not found: {src}")


# ─── Two-pass frame normalization ─────────────────────────────────────────────

def normalize_frames(
    sources: list[Image.Image],
    canvas: int,
    skip_rembg: bool,
) -> list[Image.Image]:
    """
    Pass 1: Remove backgrounds.
    Pass 2: Find the UNION bounding box across all frames, then center every
            frame at the same scale. This is what kills AI-frame positional
            drift — every frame uses the same anchor regardless of pose height.
    """
    n = len(sources)

    # ── Pass 1: background removal ──────────────────────────────────────────
    prepped: list[Image.Image] = []
    for i, src in enumerate(sources):
        print(f"  [{i + 1}/{n}] removing background...", end="\r", flush=True)
        prepped.append(src if skip_rembg else remove_bg(src))
    print(f"  [{n}/{n}] background removal done.          ")

    # ── Collect per-frame bounding boxes ────────────────────────────────────
    bboxes: list[tuple[int, int, int, int] | None] = [img.getbbox() for img in prepped]

    valid = [bb for bb in bboxes if bb is not None]
    if not valid:
        sys.exit("All frames are fully transparent after background removal.")

    # Union: widest and tallest subject across all frames
    max_subject_w = max(bb[2] - bb[0] for bb in valid)
    max_subject_h = max(bb[3] - bb[1] for bb in valid)

    # Scale so the largest subject fills 86% of the canvas (7% margin each side)
    margin = 0.86
    scale = min((canvas * margin) / max_subject_w, (canvas * margin) / max_subject_h)

    # ── Pass 2: crop → scale → center ───────────────────────────────────────
    results: list[Image.Image] = []
    for img, bb in zip(prepped, bboxes):
        out = Image.new("RGBA", (canvas, canvas), (0, 0, 0, 0))
        if bb is None:
            results.append(out)
            continue

        cropped = img.crop(bb)
        new_w = max(1, round((bb[2] - bb[0]) * scale))
        new_h = max(1, round((bb[3] - bb[1]) * scale))
        resized = cropped.resize((new_w, new_h), Image.LANCZOS)

        x = (canvas - new_w) // 2
        y = (canvas - new_h) // 2
        out.paste(resized, (x, y), resized)
        results.append(out)

    return results


# ─── Entry point ──────────────────────────────────────────────────────────────

def main() -> None:
    ap = argparse.ArgumentParser(
        description="Prep AI-generated sprites into named frames for TexturePacker.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__,
    )
    ap.add_argument("source",      type=Path, help="Directory of PNGs, or a single spritesheet PNG")
    ap.add_argument("state_name",             help="Frame prefix (e.g. mascot_idle, wolf_walk)")
    ap.add_argument("canvas_size", type=int,  help="Square canvas size in px (512 for mascot @2x, 256 for wolves @2x)")
    ap.add_argument("output_dir",  type=Path)
    ap.add_argument("--cols",      type=int,  default=None, help="Number of columns if source is a horizontal spritesheet")
    ap.add_argument("--no-rembg",  action="store_true",     help="Skip bg removal (source already has transparency)")
    args = ap.parse_args()

    args.output_dir.mkdir(parents=True, exist_ok=True)

    print(f"\n{'─' * 50}")
    print(f"  state : {args.state_name}")
    print(f"  canvas: {args.canvas_size} × {args.canvas_size} px")
    print(f"  source: {args.source}")
    print(f"  output: {args.output_dir}")
    print(f"{'─' * 50}\n")

    sources = load_sources(args.source, args.cols)
    print(f"Loaded {len(sources)} source frame(s)\n")

    frames = normalize_frames(sources, args.canvas_size, args.no_rembg)

    print()
    for i, frame in enumerate(frames):
        name = f"{args.state_name}_{i:04d}.png"
        frame.save(args.output_dir / name, "PNG")
        print(f"  → {name}")

    print(f"\n✓ {len(frames)} frames → {args.output_dir}/")
    print("  Next: drag the output folder into TexturePacker.\n")


if __name__ == "__main__":
    main()
