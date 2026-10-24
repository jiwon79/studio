"""Match walking phases, register cutouts and encode two silent collage loops."""

import argparse
import cv2, json, numpy as np
from core import load_clips, reference_poses, make_renderer, encode_video
from pathlib import Path

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("--cache", required=True, type=Path)
parser.add_argument(
    "--output", required=True, type=Path, help="Page directory containing index.html"
)
args = parser.parse_args()
ROOT = args.cache
OUT = args.output / "media"
OUT.mkdir(parents=True, exist_ok=True)
clips = load_clips(ROOT)
reference = reference_poses(clips)
render = make_renderer(clips, ROOT)


def assemble(hold, name):
    frames = []
    chosen = []
    recent = []
    previous = None
    # Six complete gait cycles. 30 phases at 25fps = 7.2 seconds.
    for outframe in range(180):
        targetphase = outframe % 30 / 30 * 2 * np.pi
        target = reference[outframe % 30]
        if outframe % hold == 0:
            options = []
            for ci, c in enumerate(clips):
                if ci in recent[-min(6, len(clips) - 1) :]:
                    continue
                delta = np.abs(np.angle(np.exp(1j * (c["phase"] - targetphase))))
                # Ankle/knee configuration plus the cycle direction selects the matching moment.
                joints = [25, 26, 27, 28, 29, 30, 31, 32]
                diff = np.mean(
                    (c["feature"][:, joints] - target[joints]) ** 2, axis=(1, 2)
                )
                cost = delta**2 * 0.035 + diff * 2
                for ri in np.argsort(cost)[:4]:
                    # Hold modes keep actual consecutive source frames within each block.
                    if ri + hold > len(c["rows"]):
                        continue
                    if (
                        hold > 1
                        and c["rows"][ri + hold - 1]["frame"] - c["rows"][ri]["frame"]
                        != hold - 1
                    ):
                        continue
                    transition = (
                        0
                        if previous is None
                        else np.mean((c["feature"][ri, joints] - previous[joints]) ** 2)
                    )
                    options.append((float(cost[ri] + transition * 0.8), ci, int(ri)))
            if not options:
                raise RuntimeError("No continuous pose match")
            _, ci, start = min(options)
            recent.append(ci)
        ri = start + outframe % hold
        c = clips[ci]
        previous = c["feature"][ri]
        frames.append(render(ci, ri))
        chosen.append({"look": c["center"], "sourceFrame": c["rows"][ri]["frame"]})
    encode_video(frames, OUT / name)
    return chosen


fast = assemble(1, "runway-frame.mp4")
slow = assemble(3, "runway-step.mp4")
first = fast[0]
ci = next(i for i, c in enumerate(clips) if c["center"] == first["look"])
ri = next(
    i for i, r in enumerate(clips[ci]["rows"]) if r["frame"] == first["sourceFrame"]
)
cv2.imwrite(str(OUT / "poster.jpg"), render(ci, ri))
json.dump(
    {"frame": fast, "step": slow}, open(args.output / "edits.json", "w"), indent=2
)
json.dump(
    {
        "source": "https://www.youtube.com/watch?v=qcE5NeDUvIk",
        "title": "Men’s Spring-Summer 2027 Show | LOUIS VUITTON",
        "fps": 25,
        "frames": 180,
        "duration": 7.2,
        "looks": len(set(r["look"] for r in fast)),
        "stepLooks": len(set(r["look"] for r in slow)),
        "sourceSeconds": [c["center"] for c in clips],
    },
    open(args.output / "manifest.json", "w"),
    indent=2,
)
print("done", len(clips), "base loops", flush=True)
