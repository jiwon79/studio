"""Compose separate clothing-color and annotated-footfall walking studies."""

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
clips = load_clips(args.cache)
reference = reference_poses(clips)
render = make_renderer(clips, args.cache)
by_look = {clip["center"]: i for i, clip in enumerate(clips)}
joints = [25, 26, 27, 28, 29, 30, 31, 32]
# A circular editorial order of the original clothes, without recoloring pixels.
# Dark -> teal/blue -> pale blue/gray -> cream -> ochre -> red -> dark.
color_order = [
    774,
    816,
    94,
    244,
    168,
    276,
    558,
    514,
    602,
    424,
    506,
    488,
    448,
    406,
    394,
    584,
    766,
    334,
    696,
    662,
    750,
    638,
    736,
    728,
]
color_frames, color_edits = [], []
previous, previous_look = None, None
for frame in range(180):
    target_position = frame / 180
    target_phase = (frame % 30) / 30 * 2 * np.pi
    target = reference[frame % 30]
    distances = np.abs(
        (np.arange(len(color_order)) / len(color_order) - target_position + 0.5) % 1
        - 0.5
    )
    candidates = np.argsort(distances)[:3]
    options = []
    for order_index in candidates:
        ci = by_look[color_order[order_index]]
        if ci == previous_look:
            continue
        clip = clips[ci]
        phase_error = np.abs(np.angle(np.exp(1j * (clip["phase"] - target_phase))))
        pose_error = np.mean(
            (clip["feature"][:, joints] - target[joints]) ** 2, axis=(1, 2)
        )
        continuity = (
            0
            if previous is None
            else np.mean(
                (clip["feature"][:, joints] - previous[joints]) ** 2, axis=(1, 2)
            )
        )
        color_error = (distances[order_index] * len(color_order)) ** 2
        cost = (
            phase_error**2 * 0.035
            + pose_error * 2
            + continuity * 0.8
            + color_error * 0.018
        )
        ri = int(np.argmin(cost))
        options.append((float(cost[ri]), ci, ri, int(order_index)))
    _, ci, ri, order_index = min(options)
    clip = clips[ci]
    previous = clip["feature"][ri]
    previous_look = ci
    color_frames.append(render(ci, ri))
    color_edits.append(
        {
            "look": clip["center"],
            "sourceFrame": clip["rows"][ri]["frame"],
            "colorOrder": order_index,
        }
    )
encode_video(color_frames, media / "runway-color.mp4")
cv2.imwrite(str(media / "poster-color.jpg"), color_frames[0])

# Each marker was checked against the original shoe/ground contact frames.
# Start at one heel strike, end immediately before the next opposite-foot strike.
steps = json.loads(Path(__file__).with_name("footfalls.json").read_text())
contact_clips = load_clips(args.cache, pose_file="poses-contact.json")
contact_by_look = {clip["center"]: i for i, clip in enumerate(contact_clips)}
contact_render = make_renderer(contact_clips, args.cache)
foot_frames, foot_edits, step_edits = [], [], []
for index, step in enumerate(steps):
    ci = contact_by_look[step["look"]]
    clip = contact_clips[ci]
    lookup = {row["frame"]: i for i, row in enumerate(clip["rows"])}
    required = range(step["from"], step["to"] + 1)
    missing = [frame for frame in required if frame not in lookup]
    if missing:
        raise RuntimeError(
            f"Missing contact frames {missing}; run extract.py --footfalls first"
        )
    foot = step["foot"]
    next_foot = "left" if foot == "right" else "right"

    def ground(source_frame, side):
        ids = [27, 29, 31] if side == "left" else [28, 30, 32]
        return 565 + 370 * float(clip["feature"][lookup[source_frame], ids, 1].max())

    start_offset = 990 - ground(step["from"], foot)
    end_offset = 990 - ground(step["to"], next_foot)
    step_edits.append(
        {
            **step,
            "outputFrame": len(foot_frames),
            "outputFrames": 15,
            "nextFoot": next_foot,
        }
    )
    # Equalize each half-stride to 0.6 seconds. Sample forward; retain the heel strike.
    source_frames = np.rint(np.linspace(step["from"], step["to"], 16)[:-1]).astype(int)
    for j, source_frame in enumerate(source_frames):
        ri = lookup[int(source_frame)]
        dy = start_offset + (end_offset - start_offset) * j / 15
        image = cv2.warpAffine(
            contact_render(ci, ri),
            np.float32([[1, 0, 0], [0, 1, dy]]),
            (720, 1080),
            flags=cv2.INTER_LINEAR,
            borderValue=(244, 244, 244),
        )
        foot_frames.append(image)
        foot_edits.append(
            {
                "look": step["look"],
                "sourceFrame": int(source_frame),
                "step": index,
                "contact": j == 0,
                "foot": foot,
                "verticalOffset": round(dy, 3),
            }
        )
encode_video(foot_frames, media / "runway-footfall.mp4")
cv2.imwrite(str(media / "poster-footfall.jpg"), foot_frames[0])
metadata = {
    "fps": 25,
    "frames": 180,
    "duration": 7.2,
    "color": {"looks": len({row["look"] for row in color_edits}), "order": color_order},
    "footfall": {
        "looks": len(steps),
        "steps": step_edits,
        "contactMethod": "Manually reviewed 25fps heel-ground contact frames; retimed half-strides.",
    },
}
(args.output / "variants.json").write_text(json.dumps(metadata, indent=2) + "\n")
(args.output / "variant-edits.json").write_text(
    json.dumps({"color": color_edits, "footfall": foot_edits}, indent=2) + "\n"
)
print(
    "Done: color",
    metadata["color"]["looks"],
    "looks; footfall",
    len(steps),
    "steps.",
    flush=True,
)
