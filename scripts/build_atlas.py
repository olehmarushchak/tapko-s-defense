#!/usr/bin/env python3
"""
build_atlas.py — Samples AI-generated frames, normalises them to a
consistent canvas, and packs them into PixiJS-format texture atlases.

Output:
  public/assets/mascot@2x.json + mascot@2x.png
  public/assets/wolves@2x.json  + wolves@2x.png

Usage: python scripts/build_atlas.py
Requires: pip install pillow
"""

import json
import math
from pathlib import Path
from PIL import Image

# ─── Paths ────────────────────────────────────────────────────────────────────
ROOT      = Path(__file__).parent.parent
ASSET_DIR = ROOT / 'public' / 'assets'
OUT_DIR   = ASSET_DIR

# ─── Frame sizes (px in the atlas — displayed at ~0.23–0.16× on a 390px screen) ──
MASCOT_FRAME = 384   # ~90 CSS px on screen @2x
WOLF_FRAME   = 192   # ~64 CSS px on screen @2x

# (atlas_key_prefix, relative_src_dir, n_frames, is_mascot, fps, loop)
STATES = [
    ('mascot_idle',    'mascot/frames/idle',    8,  True,  8,  True),
    ('mascot_fear',    'mascot/frames/fear',     8,  True,  14, True),
    ('mascot_hit',     'mascot/frames/hit',      6,  True,  12, False),
    ('mascot_victory', 'mascot/frames/victory',  8,  True,  8,  True),
    ('mascot_defeat',  'mascot/frames/defeat',   6,  True,  6,  False),
    ('wolf_walk',      'wolves/frames/walk',     8,  False, 10, True),
    ('wolf_dying',     'wolves/frames/dying',    6,  False, 12, False),
]

# ─── Helpers ──────────────────────────────────────────────────────────────────
def sample_indices(total: int, n: int) -> list[int]:
    """Pick n evenly-spaced indices from [0, total-1]."""
    if n >= total:
        return list(range(total))
    return [round(i * (total - 1) / (n - 1)) for i in range(n)]


def load_frames(src: Path, n: int) -> list[Image.Image]:
    files = sorted(src.glob('frame_*.png'))
    if not files:
        raise FileNotFoundError(f'No frame_*.png in {src}')
    return [Image.open(files[i]).convert('RGBA') for i in sample_indices(len(files), n)]


def normalise(frames: list[Image.Image], canvas: int) -> list[Image.Image]:
    """
    Two-pass normalisation:
      1. Find the union bounding-box across all frames.
      2. Scale every frame by the same factor so the largest subject fills
         88 % of the canvas, then centre.
    This eliminates per-frame positional drift from the AI generator.
    """
    bboxes = [img.getbbox() for img in frames]
    valid  = [bb for bb in bboxes if bb]
    if not valid:
        raise ValueError('All frames fully transparent')

    max_w = max(bb[2] - bb[0] for bb in valid)
    max_h = max(bb[3] - bb[1] for bb in valid)
    scale = min(canvas * 0.88 / max_w, canvas * 0.88 / max_h)

    out = []
    for img, bb in zip(frames, bboxes):
        dst = Image.new('RGBA', (canvas, canvas), (0, 0, 0, 0))
        if not bb:
            out.append(dst)
            continue
        cw = max(1, round((bb[2] - bb[0]) * scale))
        ch = max(1, round((bb[3] - bb[1]) * scale))
        resized = img.crop(bb).resize((cw, ch), Image.LANCZOS)
        dst.paste(resized, ((canvas - cw) // 2, (canvas - ch) // 2), resized)
        out.append(dst)
    return out


def pack(
    entries: list[tuple[str, list[Image.Image], int]],  # (prefix, frames, frame_size)
    atlas_name: str,
) -> dict:
    """Pack all frames into one PNG + return PixiJS JSON dict."""
    flat: list[tuple[str, Image.Image]] = []
    for prefix, frames, _ in entries:
        for i, frame in enumerate(frames):
            flat.append((f'{prefix}_{i:04d}.png', frame))

    frame_size = entries[0][2]   # all frames in a group share the same size
    n    = len(flat)
    cols = math.ceil(math.sqrt(n))
    rows = math.ceil(n / cols)
    aw, ah = cols * frame_size, rows * frame_size

    atlas = Image.new('RGBA', (aw, ah), (0, 0, 0, 0))
    frames_json: dict = {}

    for idx, (key, frame) in enumerate(flat):
        c, r = idx % cols, idx // cols
        x, y = c * frame_size, r * frame_size
        atlas.paste(frame, (x, y), frame)
        frames_json[key] = {
            'frame':           {'x': x, 'y': y, 'w': frame_size, 'h': frame_size},
            'rotated':         False,
            'trimmed':         False,
            'spriteSourceSize':{'x': 0, 'y': 0, 'w': frame_size, 'h': frame_size},
            'sourceSize':      {'w': frame_size, 'h': frame_size},
        }

    png_file = f'{atlas_name}.png'
    atlas.save(OUT_DIR / png_file, 'PNG')

    data = {
        'frames': frames_json,
        'meta': {
            'app':    'build_atlas.py',
            'image':  png_file,
            'format': 'RGBA8888',
            'size':   {'w': aw, 'h': ah},
            'scale':  '1',
        },
    }
    (OUT_DIR / f'{atlas_name}.json').write_text(json.dumps(data, indent=2))
    print(f'  {atlas_name}.png  {aw}×{ah}  ({n} frames)')
    print(f'  {atlas_name}.json')
    return data


# ─── Main ─────────────────────────────────────────────────────────────────────
def main() -> None:
    mascot_entries: list[tuple[str, list[Image.Image], int]] = []
    wolf_entries:   list[tuple[str, list[Image.Image], int]] = []

    for name, rel, n, is_mascot, fps, loop in STATES:
        src        = ASSET_DIR / rel
        frame_size = MASCOT_FRAME if is_mascot else WOLF_FRAME
        print(f'  {name}: sampling {n}/{len(list(src.glob("frame_*.png")))} frames …', end=' ', flush=True)
        frames = load_frames(src, n)
        frames = normalise(frames, frame_size)
        print('ok')
        (mascot_entries if is_mascot else wolf_entries).append((name, frames, frame_size))

    print('\nPacking mascot atlas …')
    pack(mascot_entries, 'mascot@2x')

    print('\nPacking wolves atlas …')
    pack(wolf_entries,   'wolves@2x')

    # Emit frame-count map for PixiField.tsx
    counts = {name: n for name, _, n, *_ in STATES}
    print('\nFrame counts (copy into PixiField.tsx if needed):')
    for k, v in counts.items():
        print(f'  {k}: {v}')

    print('\n✓  Assets written to public/assets/')


if __name__ == '__main__':
    main()
