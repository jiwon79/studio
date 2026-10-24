"""Keep the original runway background inside the selected three-frame portrait crops."""

import argparse
import hashlib
import json
from pathlib import Path
import cv2
import numpy as np
from core import load_clips, encode_video

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("--source", required=True, type=Path)
parser.add_argument("--cache", required=True, type=Path)
parser.add_argument("--output", required=True, type=Path)
args = parser.parse_args()
media = args.output / "media"
media.mkdir(parents=True, exist_ok=True)
edits = json.loads((args.output / "color-cadence-edits.json").read_text())["3"]
clips = {clip["center"]: clip for clip in load_clips(args.cache)}
lookups = {
    look: {row["frame"]: i for i, row in enumerate(clip["rows"])}
    for look, clip in clips.items()
}
cap = cv2.VideoCapture(str(args.source))
width, height = (
    int(cap.get(cv2.CAP_PROP_FRAME_WIDTH)),
    int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT)),
)
if (width, height, cap.get(cv2.CAP_PROP_FPS)) != (1920, 1080, 25):
    raise RuntimeError("Expected the original 1920x1080, 25fps show")
frames, provenance = [], []
previous = None
for edit in edits:
    clip = clips[edit["look"]]
    ri = lookups[edit["look"]][edit["sourceFrame"]]
    if previous is None or edit["sourceFrame"] != previous + 1:
        cap.set(cv2.CAP_PROP_POS_FRAMES, edit["sourceFrame"])
    ok, source = cap.read()
    if not ok:
        raise RuntimeError(f"Could not decode source frame {edit['sourceFrame']}")
    previous = edit["sourceFrame"]
    original = cv2.imread(
        str(args.cache / str(edit["look"]) / clip["rows"][ri]["file"]),
        cv2.IMREAD_UNCHANGED,
    )
    # The cached RGB is lossless source footage; its fourth channel is deliberately unused.
    if not np.array_equal(source[:, 480:1440], original[:, :, :3]):
        raise RuntimeError(f"Source/cached frame mismatch at {edit['sourceFrame']}")
    desired_scale = 370 / clip["body"][ri]
    crop_height = min(float(height), 1080 / desired_scale)
    crop_width = crop_height * 720 / 1080
    scale = 1080 / crop_height
    hip = clip["hips"][ri] * [960, 1080] + [480, 0]
    desired_x = float(hip[0] - 360 / scale)
    desired_y = float(hip[1] - 565 / scale)
    x = float(np.clip(desired_x, 0, width - crop_width))
    y = float(np.clip(desired_y, 0, height - crop_height))
    # Shift/zoom a source-bounded rectangle rather than inventing missing background.
    transform = np.float32([[scale, 0, -x * scale], [0, scale, -y * scale]])
    image = cv2.warpAffine(
        source,
        transform,
        (720, 1080),
        flags=cv2.INTER_LANCZOS4,
        borderMode=cv2.BORDER_REPLICATE,
    )
    frames.append(image)
    provenance.append(
        {
            **edit,
            "crop": {"x": x, "y": y, "width": crop_width, "height": crop_height},
            "framingAdjusted": bool(
                abs(x - desired_x) > 0.01
                or abs(y - desired_y) > 0.01
                or crop_height < 1080 / desired_scale - 0.01
            ),
        }
    )
cap.release()
encode_video(frames, media / "runway-color-3-rectangle.mp4")
cv2.imwrite(str(media / "poster-color-3-rectangle.jpg"), frames[0])
(args.output / "rectangle.json").write_text(
    json.dumps(
        {
            "fps": 25,
            "frames": len(frames),
            "duration": len(frames) / 25,
            "holdFrames": 3,
            "timeline": "color-cadence-edits.json#3",
            "timelineSha256": hashlib.sha256(
                json.dumps(edits, sort_keys=True).encode()
            ).hexdigest(),
            "sourcePixelsVerified": len(provenance),
            "framingAdjustedFrames": sum(row["framingAdjusted"] for row in provenance),
            "edits": provenance,
        },
        indent=2,
    )
    + "\n"
)
print(
    "Done:",
    len(frames),
    "source-verified rectangular crops; no alpha compositing.",
    flush=True,
)
