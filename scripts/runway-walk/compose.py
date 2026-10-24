"""Match walking phases, register cutouts and encode two silent collage loops."""

import argparse
import cv2, json, numpy as np, subprocess
from scipy.ndimage import gaussian_filter1d
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
# Same frontal runway camera, with a complete left/right step where available.
centers = [
    94,
    168,
    208,
    244,
    276,
    334,
    394,
    406,
    424,
    448,
    488,
    506,
    514,
    558,
    584,
    602,
    638,
    662,
    674,
    696,
    728,
    736,
    750,
    766,
    774,
    800,
    816,
]
clips = []
for center in centers:
    file = ROOT / f"{center}/poses.json"
    if not file.exists():
        continue
    rows = json.load(open(file))
    if len(rows) < 22:
        continue
    p = np.array([r["pose"] for r in rows])
    t = np.array([r["frame"] / 25 for r in rows])
    hips = p[:, [23, 24], :2].mean(axis=1)
    # Pixel aspect correction before measuring anatomical lengths.
    xy = p[:, :, :2] * [960, 1080]
    legs = (
        sum(
            np.linalg.norm(xy[:, a] - xy[:, b], axis=1)
            for a, b in [(23, 25), (25, 27), (24, 26), (26, 28)]
        )
        / 2
    )
    body = gaussian_filter1d(legs, 2)
    # Fit a cycle to the signed left/right ankle height; both phase and direction matter.
    signal = gaussian_filter1d((p[:, 27, 1] - p[:, 28, 1]) * 1080 / body, 1)
    best = None
    for freq in np.linspace(0.65, 1.25, 121):
        angle = 2 * np.pi * freq * (t - t[0])
        basis = np.stack([np.sin(angle), np.cos(angle), np.ones(len(t))], axis=1)
        coef = np.linalg.lstsq(basis, signal, rcond=None)[0]
        error = np.mean((basis @ coef - signal) ** 2)
        if best is None or error < best[0]:
            best = (error, freq, coef)
    error, freq, coef = best
    phase = (2 * np.pi * freq * (t - t[0]) + np.arctan2(coef[1], coef[0])) % (2 * np.pi)
    feature = (xy - hips[:, None, :] * [960, 1080]) / body[:, None, None]
    clips.append(
        dict(
            center=center,
            rows=rows,
            p=p,
            t=t,
            hips=hips,
            body=body,
            phase=phase,
            feature=feature,
            freq=freq,
            error=error,
        )
    )
    print(center, len(rows), "hz", round(freq, 2), "fit", round(error, 4), flush=True)
# Reference is the blue sweater walk, with clearly visible, regular steps.
ref = next(c for c in clips if c["center"] == 276)
reference = []
for phase in np.arange(30) / 30 * 2 * np.pi:
    distance = np.abs(np.angle(np.exp(1j * (ref["phase"] - phase))))
    reference.append(ref["feature"][np.argmin(distance)])
reference = np.array(reference)
W, H = 720, 1080
cache = {}


def render(ci, ri):
    key = (ci, ri)
    if key in cache:
        return cache[key]
    c = clips[ci]
    r = c["rows"][ri]
    rgba = (
        cv2.imread(
            str(ROOT / f"{c['center']}/{r['file']}"), cv2.IMREAD_UNCHANGED
        ).astype(np.float32)
        / 255
    )
    # Premultiply before resampling, to keep the original backdrop out of the edges.
    alpha = rgba[:, :, 3]
    rgba[:, :, :3] *= alpha[:, :, None]
    scale = 370 / c["body"][ri]
    hip = c["hips"][ri] * [960, 1080]
    matrix = np.float32(
        [[scale, 0, W / 2 - hip[0] * scale], [0, scale, 565 - hip[1] * scale]]
    )
    warped = cv2.warpAffine(rgba, matrix, (W, H), flags=cv2.INTER_LANCZOS4)
    a = np.clip(warped[:, :, 3:4], 0, 1)
    rgb = np.clip(warped[:, :, :3] + (244 / 255) * (1 - a), 0, 1)
    frame = (rgb * 255).astype("uint8")
    cache[key] = frame
    return frame


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
    proc = subprocess.Popen(
        [
            "ffmpeg",
            "-hide_banner",
            "-loglevel",
            "error",
            "-y",
            "-f",
            "rawvideo",
            "-pix_fmt",
            "bgr24",
            "-s",
            f"{W}x{H}",
            "-r",
            "25",
            "-i",
            "pipe:0",
            "-an",
            "-c:v",
            "libx264",
            "-preset",
            "slow",
            "-crf",
            "18",
            "-pix_fmt",
            "yuv420p",
            "-movflags",
            "+faststart",
            str(OUT / name),
        ],
        stdin=subprocess.PIPE,
    )
    for f in frames:
        proc.stdin.write(f.tobytes())
    proc.stdin.close()
    if proc.wait() != 0:
        raise RuntimeError("Encoding failed")
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
print("done", len(clips), len(cache), flush=True)
