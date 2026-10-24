"""Render clothing-color walks with 3/4/5/6-frame identity changes."""

import argparse
import json
from pathlib import Path
import cv2
import numpy as np
from core import load_clips, reference_poses, make_renderer, encode_video

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("--cache", required=True, type=Path)
parser.add_argument("--output", required=True, type=Path)
args = parser.parse_args()
media = args.output / "media"
media.mkdir(parents=True, exist_ok=True)
config = json.loads((args.output / "variants.json").read_text())
order = config["color"]["order"]
clips = load_clips(args.cache)
by_look = {clip["center"]: i for i, clip in enumerate(clips)}
reference = reference_poses(clips)
render = make_renderer(clips, args.cache)
joints = [25, 26, 27, 28, 29, 30, 31, 32]
frame_count = 180
holds = [3, 4, 5, 6]
all_edits, versions = {}, []
for hold in holds:
    frames, edits = [], []
    previous, previous_look, first_look = None, None, None
    for start in range(0, frame_count, hold):
        # All versions follow the same palette clock and gait clock at normal speed.
        position = (start + (hold - 1) / 2) / frame_count
        distances = np.abs(
            (np.arange(len(order)) / len(order) - position + 0.5) % 1 - 0.5
        )
        candidates = np.argsort(distances)[:3]
        targets = reference[(start + np.arange(hold)) % 30]
        phases = ((start + np.arange(hold)) % 30) / 30 * 2 * np.pi
        options = []
        for order_index in candidates:
            ci = by_look[order[order_index]]
            if ci == previous_look or (
                start + hold == frame_count and ci == first_look
            ):
                continue
            clip = clips[ci]
            source_frames = np.array([row["frame"] for row in clip["rows"]])
            for ri in range(len(source_frames) - hold + 1):
                # No freezing, reverse playback, or skipping source frames inside a block.
                if source_frames[ri + hold - 1] - source_frames[ri] != hold - 1:
                    continue
                features = clip["feature"][ri : ri + hold]
                phase_error = np.abs(
                    np.angle(np.exp(1j * (clip["phase"][ri : ri + hold] - phases)))
                )
                pose_error = np.mean((features[:, joints] - targets[:, joints]) ** 2)
                boundary_error = (
                    0
                    if previous is None
                    else np.mean((features[0, joints] - previous[joints]) ** 2)
                )
                color_error = (distances[order_index] * len(order)) ** 2
                cost = (
                    np.mean(phase_error**2) * 0.035
                    + pose_error * 2
                    + boundary_error * 0.8
                    + color_error * 0.018
                )
                options.append((float(cost), ci, ri, int(order_index)))
        if not options:
            raise RuntimeError(
                f"No consecutive {hold}-frame match at output frame {start}"
            )
        _, ci, ri, order_index = min(options)
        clip = clips[ci]
        if first_look is None:
            first_look = ci
        for offset in range(hold):
            index = ri + offset
            frames.append(render(ci, index))
            edits.append(
                {
                    "look": clip["center"],
                    "sourceFrame": clip["rows"][index]["frame"],
                    "colorOrder": order_index,
                }
            )
        previous = clip["feature"][ri + hold - 1]
        previous_look = ci
    filename = f"runway-color-{hold}.mp4"
    encode_video(frames, media / filename)
    cv2.imwrite(str(media / f"poster-color-{hold}.jpg"), frames[0])
    all_edits[str(hold)] = edits
    versions.append(
        {
            "holdFrames": hold,
            "secondsPerLook": hold / 25,
            "looks": len({row["look"] for row in edits}),
            "cuts": frame_count // hold,
            "media": filename,
        }
    )
    print(
        hold,
        "frames:",
        versions[-1]["looks"],
        "looks;",
        len(edits),
        "frames;",
        versions[-1]["cuts"],
        "cuts",
        flush=True,
    )


# A single decoded comparison video gives all four panes the exact same clock.
def comparison_frames():
    captures = [
        cv2.VideoCapture(str(media / f"runway-color-{hold}.mp4")) for hold in holds
    ]
    try:
        for frame in range(frame_count):
            canvas = np.full((1080, 720, 3), 244, np.uint8)
            for i, (hold, cap) in enumerate(zip(holds, captures)):
                ok, image = cap.read()
                if not ok:
                    raise RuntimeError(f"Comparison input {hold} ended at {frame}")
                pane = cv2.resize(image, (360, 540), interpolation=cv2.INTER_AREA)
                x = i % 2 * 360
                y = i // 2 * 540
                canvas[y : y + 540, x : x + 360] = pane
                cv2.putText(
                    canvas,
                    f"{hold} FRAMES",
                    (x + 14, y + 34),
                    cv2.FONT_HERSHEY_SIMPLEX,
                    1.0,
                    (90, 90, 90),
                    1,
                    cv2.LINE_AA,
                )
            if frame == 0:
                cv2.imwrite(str(media / "poster-color-cadence.jpg"), canvas)
            yield canvas
    finally:
        for cap in captures:
            cap.release()


encode_video(comparison_frames(), media / "runway-color-cadence.mp4")
(args.output / "color-cadence.json").write_text(
    json.dumps(
        {
            "fps": 25,
            "frames": frame_count,
            "duration": frame_count / 25,
            "colorOrder": order,
            "versions": versions,
        },
        indent=2,
    )
    + "\n"
)
(args.output / "color-cadence-edits.json").write_text(
    json.dumps(all_edits, indent=2) + "\n"
)
print("Done: four cadence loops and a synchronized 2x2 comparison.", flush=True)
