"""Interpolate reviewed torso angles using the observed shoulder/hip rotation.

MediaPipe image-landmark z uses approximately the same scale as image x. Its
absolute depth is not a calibrated camera measurement: reviewed yawKeys remain
our angle anchors. Only the *relative* torso rotation between anchors controls
intermediate angles; an occlusion, left/right swap, or static estimate falls back
to time interpolation. Head direction, bags and walking displacement are unused.
"""
import math
import statistics


def torso_yaw(pose):
    angles = []
    for left, right in [(11, 12), (23, 24)]:
        a, b = pose[left], pose[right]
        if min(a[3], b[3]) < .5:
            return None
        dx, dz = b[0] - a[0], b[2] - a[2]
        if math.hypot(dx, dz) < .01:
            return None
        angles.append(math.degrees(math.atan2(-dz, -dx)))
    difference = (angles[1] - angles[0] + 180) % 360 - 180
    if abs(difference) > 25:
        return None
    return angles[0] + difference / 2


def _interpolate(x, points):
    if x <= points[0][0]:
        return points[0][1]
    for (a, ya), (b, yb) in zip(points, points[1:]):
        if x <= b:
            return ya + (yb - ya) * (x - a) / (b - a)
    return points[-1][1]


def estimate_yaws(rows, keys, fps=25):
    """Return frame-indexed angles, anchored to reviewed camera-relative views.

    A local five-frame median removes pose flicker. Within each reviewed interval
    the torso signal must agree with the direction of the turn. Limit its
    correction to 5 degrees and preserve every anchor exactly, so uncertain
    monocular depth cannot override the reviewed direction or hide a rear view.
    """
    keys = [(float(t) * fps, float(yaw)) for t, yaw in keys]
    if len(keys) < 2 or any(b[0] <= a[0] for a, b in zip(keys, keys[1:])):
        raise ValueError('At least two increasing reviewed yaw keys are required')
    raw = [(r['sourceFrame'], torso_yaw(r['pose'])) for r in rows]
    valid = [(frame, yaw) for frame, yaw in raw if yaw is not None]
    smooth = [(frame, statistics.median(y for f, y in valid if abs(f-frame) <= 2)) for frame, _ in valid]
    result = {}
    for row in rows:
        frame = row['sourceFrame']
        baseline = _interpolate(frame, keys)
        result[frame] = baseline
        if not smooth or frame < keys[0][0] or frame > keys[-1][0]:
            continue
        for (a, ya), (b, yb) in zip(keys, keys[1:]):
            if not a <= frame <= b:
                continue
            # Missing/occluded or swapped axes must not steer interpolation.
            near = [y for f, y in smooth if abs(f-frame) <= 2]
            endpoints = all(any(abs(f-t) <= 3 for f, _ in smooth) for t in (a, b))
            if not near or not endpoints:
                break
            start, end = _interpolate(a, smooth), _interpolate(b, smooth)
            if (abs(end-start) < 5 or (end-start)*(yb-ya) <= 0
                    or any(abs((measured-anchor+180)%360-180) > 45
                           for measured, anchor in [(start, ya), (end, yb)])):
                break
            fraction = (frame-a)/(b-a)
            observed = _interpolate(frame, smooth)
            progress = max(0, min(1, (observed-start)/(end-start)))
            correction = max(-5, min(5, (progress-fraction)*(yb-ya)))
            # Also cap by an endpoint envelope; corrections vanish at keys.
            limit = abs(yb-ya) * min(fraction, 1-fraction)
            result[frame] = baseline + max(-limit, min(limit, correction))
            break
    return result
