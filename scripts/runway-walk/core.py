"""Shared pose registration and encoding for the Runway Walk studies."""

from pathlib import Path
import cv2
import json
import numpy as np
import subprocess
from scipy.ndimage import gaussian_filter1d

W, H = 720, 1080


def load_clips(root: Path, pose_file="poses.json"):
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
        file = root / str(center) / pose_file
        if not file.exists():
            file = root / str(center) / "poses.json"
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
        phase = (2 * np.pi * freq * (t - t[0]) + np.arctan2(coef[1], coef[0])) % (
            2 * np.pi
        )
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
        print(
            center, len(rows), "hz", round(freq, 2), "fit", round(error, 4), flush=True
        )
    return clips


def reference_poses(clips):
    # Reference is the blue sweater walk, with clearly visible, regular steps.
    ref = next(c for c in clips if c["center"] == 276)
    reference = []
    for phase in np.arange(30) / 30 * 2 * np.pi:
        distance = np.abs(np.angle(np.exp(1j * (ref["phase"] - phase))))
        reference.append(ref["feature"][np.argmin(distance)])
    reference = np.array(reference)
    return reference


def make_renderer(clips, root: Path):
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
                str(root / f"{c['center']}/{r['file']}"), cv2.IMREAD_UNCHANGED
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

    return render


def encode_video(frames, output: Path):
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
            str(output),
        ],
        stdin=subprocess.PIPE,
    )
    for f in frames:
        proc.stdin.write(f.tobytes())
    proc.stdin.close()
    if proc.wait() != 0:
        raise RuntimeError("Encoding failed")
