"""Extract frontal, full-body cutouts from the specified Louis Vuitton show."""

import argparse
import hashlib
import cv2, mediapipe as mp, numpy as np, json
from pathlib import Path

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("--source", required=True, type=Path)
parser.add_argument("--pose-model", required=True, type=Path)
parser.add_argument("--cache", required=True, type=Path)
parser.add_argument(
    "--footfalls",
    type=Path,
    help="Also retain all source frames around the annotated contacts",
)
args = parser.parse_args()
args.cache.mkdir(parents=True, exist_ok=True)


def digest(path):
    with path.open("rb") as stream:
        return hashlib.file_digest(stream, "sha256").hexdigest()


def cutout(model, crop, min_visibility=0.65):
    small = cv2.resize(crop, (640, 720))
    r = model.detect(
        mp.Image(
            image_format=mp.ImageFormat.SRGB,
            data=cv2.cvtColor(small, cv2.COLOR_BGR2RGB),
        )
    )
    if not r.pose_landmarks:
        return None
    p = np.array([[a.x, a.y, a.z, a.visibility] for a in r.pose_landmarks[0]])
    if (
        p[0, 1] < 0.04
        or np.max(p[[27, 28, 29, 30, 31, 32], 1]) > 0.985
        or np.min(p[[0, 11, 12, 23, 24, 27, 28], 3]) < min_visibility
    ):
        return None
    h = np.mean(p[[29, 30, 31, 32], 1]) - p[0, 1]
    if (
        h < 0.42
        or abs(p[11, 0] - p[12, 0]) / h < 0.17
        or abs(np.mean(p[[23, 24], 0]) - 0.5) > 0.25
    ):
        return None
    mask = r.segmentation_masks[0].numpy_view().squeeze()
    a = np.clip((mask - 0.12) / 0.76, 0, 1)
    # Retain only the connected foreground component containing the pelvis.
    n, labels, stats, centroids = cv2.connectedComponentsWithStats(
        (a > 0.4).astype("uint8")
    )
    hx, hy = (np.mean(p[[23, 24], :2], axis=0) * [640, 720]).astype(int)
    label = labels[np.clip(hy, 0, 719), np.clip(hx, 0, 639)]
    if label == 0:
        return None
    component = cv2.dilate((labels == label).astype("uint8"), np.ones((5, 5), np.uint8))
    a *= component
    rgba = np.dstack((crop, cv2.resize(a, (960, 1080)) * 255)).astype("uint8")
    return p, rgba


fingerprint = {"source": digest(args.source), "model": digest(args.pose_model)}
cache_key = args.cache / "input.json"
if cache_key.exists() and json.loads(cache_key.read_text()) != fingerprint:
    raise SystemExit("Cache belongs to another input; choose a new --cache directory.")
cache_key.write_text(json.dumps(fingerprint))
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
cap = cv2.VideoCapture(str(args.source))
fps = cap.get(cv2.CAP_PROP_FPS)
if (
    int(cap.get(cv2.CAP_PROP_FRAME_WIDTH)),
    int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT)),
    round(fps),
) != (1920, 1080, 25):
    raise SystemExit("This shot selection expects the 1920×1080, 25fps source.")
opts = mp.tasks.vision.PoseLandmarkerOptions(
    base_options=mp.tasks.BaseOptions(model_asset_path=str(args.pose_model)),
    output_segmentation_masks=True,
    min_pose_detection_confidence=0.55,
)
with mp.tasks.vision.PoseLandmarker.create_from_options(opts) as model:
    for center in centers:
        folder = args.cache / str(center)
        folder.mkdir(parents=True, exist_ok=True)
        if (folder / "poses.json").exists():
            continue
        rows = []
        start = round((center - 1.4) * fps)
        cap.set(cv2.CAP_PROP_POS_FRAMES, start)
        for j in range(75):
            ok, f = cap.read()
            if not ok:
                break
            crop = f[:, 480:1440]
            result = cutout(model, crop)
            if result is None:
                continue
            p, rgba = result
            name = f"{j:03}.png"
            cv2.imwrite(str(folder / name), rgba)
            rows.append({"frame": start + j, "file": name, "pose": p.tolist()})
        json.dump(rows, open(folder / "poses.json", "w"))
        print(center, len(rows), flush=True)

    if args.footfalls:
        for step in json.loads(args.footfalls.read_text()):
            folder = args.cache / str(step["look"])
            rows = json.loads((folder / "poses.json").read_text())
            present = {row["frame"] for row in rows}
            for frame in range(step["from"] - 1, step["to"] + 2):
                if frame in present:
                    continue
                cap.set(cv2.CAP_PROP_POS_FRAMES, frame)
                ok, source = cap.read()
                result = (
                    cutout(model, source[:, 480:1440], min_visibility=0.25)
                    if ok
                    else None
                )
                if result is None:
                    raise RuntimeError(f"Contact frame {frame} could not be segmented")
                pose, rgba = result
                name = f"contact-{frame}.png"
                cv2.imwrite(str(folder / name), rgba)
                rows.append({"frame": frame, "file": name, "pose": pose.tolist()})
            rows.sort(key=lambda row: row["frame"])
            (folder / "poses-contact.json").write_text(json.dumps(rows))
            print("contact", step["look"], len(rows), flush=True)
