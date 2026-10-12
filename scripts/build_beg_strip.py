#!/usr/bin/env python3
"""
Build a horizontal CSS sprite strip from the bag/beg animation frames.

Source:  public/assets/mascot/frames/bag/frame_*.png  (61 frames, 640×640)
Output:  public/assets/beg@2x.png  (3072 × 384 — 8 frames × 384px)

The strip is consumed by .tapko-pleading-sprite via:
  background-size: 768px 96px;  (displayed at 96×96 on screen)
  animation: beg-sprite 1s steps(8) infinite;
"""
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).parent.parent
SRC  = ROOT / 'public/assets/mascot/frames/bag'
OUT  = ROOT / 'public/assets'

N_FRAMES   = 8
FRAME_SIZE = 384


def sample_indices(total: int, n: int) -> list[int]:
    if n >= total:
        return list(range(total))
    return [round(i * (total - 1) / (n - 1)) for i in range(n)]


def load_frames(src: Path, n: int) -> list[Image.Image]:
    files = sorted(f for f in src.glob('frame_*.png'))
    if not files:
        raise FileNotFoundError(f'No frame_*.png in {src}')
    indices = sample_indices(len(files), n)
    print(f'Sampling frames at indices: {indices}')
    return [Image.open(files[i]).convert('RGBA') for i in indices]


def normalise(frames: list[Image.Image], canvas: int) -> list[Image.Image]:
    """Scale all frames uniformly so the largest subject fills 88 % of canvas."""
    bboxes = [img.getbbox() for img in frames]
    valid  = [bb for bb in bboxes if bb]
    if not valid:
        raise ValueError('All frames fully transparent')

    max_w = max(bb[2] - bb[0] for bb in valid)
    max_h = max(bb[3] - bb[1] for bb in valid)
    scale  = min(canvas * 0.88 / max_w, canvas * 0.88 / max_h)

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


frames  = load_frames(SRC, N_FRAMES)
frames  = normalise(frames, FRAME_SIZE)

strip = Image.new('RGBA', (FRAME_SIZE * N_FRAMES, FRAME_SIZE), (0, 0, 0, 0))
for i, frame in enumerate(frames):
    strip.paste(frame, (i * FRAME_SIZE, 0), frame)

out_path = OUT / 'beg@2x.png'
strip.save(out_path, 'PNG', optimize=False)
print(f'✓ {out_path}  ({strip.width}×{strip.height}px, {out_path.stat().st_size // 1024} KB)')
