"""Publish source pose landmarks in the exact coordinate system of each HD tile.

Run after refine-angles.py. Recover its uniform image registration from the four
published knee/ankle coordinates, applying the same reviewed pose overrides.
No new pose inference, image resizing, or monocular angle calibration is done.
"""
import argparse
import json
from pathlib import Path
import numpy as np

NAMES = ['nose','left_eye_inner','left_eye','left_eye_outer','right_eye_inner','right_eye','right_eye_outer','left_ear','right_ear','mouth_left','mouth_right','left_shoulder','right_shoulder','left_elbow','right_elbow','left_wrist','right_wrist','left_pinky','right_pinky','left_index','right_index','left_thumb','right_thumb','left_hip','right_hip','left_knee','right_knee','left_ankle','right_ankle','left_heel','right_heel','left_foot_index','right_foot_index']
CONNECTIONS = [[0,1],[1,2],[2,3],[3,7],[0,4],[4,5],[5,6],[6,8],[9,10],[11,12],[11,13],[13,15],[15,17],[15,19],[15,21],[17,19],[12,14],[14,16],[16,18],[16,20],[16,22],[18,20],[11,23],[12,24],[23,24],[23,25],[25,27],[27,29],[29,31],[27,31],[24,26],[26,28],[28,30],[30,32],[28,32]]

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--cache', type=Path, required=True)
parser.add_argument('--output', type=Path, required=True)
args = parser.parse_args()
manifest = json.loads((args.output/'angles.json').read_text())
clips = {c['id']: c for c in manifest['clips']}
sources = {s['id']: s for s in manifest['sources']}
poses = {}
rows = []
worst_error = 0
for frame in manifest['frames']:
    clip = clips[frame['clip']]
    if clip['id'] not in poses:
        cache = json.loads((args.cache/'angles'/clip['id']/'rows.json').read_text())
        poses[clip['id']] = {r['sourceFrame']: r['pose'] for r in cache['rows']}
    pose = np.array(poses[clip['id']][frame['sourceFrame']], dtype=float)
    for joint, xy in clip.get('poseXYOverrides', {}).get(str(frame['sourceFrame']), {}).items():
        pose[int(joint), :2] = xy
    roi = [round(v*sources[frame['source']]['roiScale']) for v in clip['roi']]
    xy = pose[:, :2]*roi[2:]
    source = xy[[25,26,27,28]]
    target = np.array(frame['gait']).reshape(4,2)*[512,768]
    matrix = np.zeros((8,3))
    matrix[:,0] = source.flatten()
    matrix[::2,1] = 1
    matrix[1::2,2] = 1
    scale, tx, ty = np.linalg.lstsq(matrix, target.flatten(), rcond=None)[0]
    registered = xy*scale+[tx,ty]
    error = float(np.abs(registered[[25,26,27,28]]-target).max())
    assert scale > 0 and error < .015, (frame, error)
    worst_error = max(worst_error, error)
    points = np.column_stack((registered/[512,768], pose[:,3])).round(5).tolist()
    rows.append({'key': f"{frame['source']}:{frame['sourceFrame']}", 'points': points,
                 'roi': roi, 'transform': [round(scale,8),round(tx,5),round(ty,5)]})
output = {'assetVersion': manifest['assetVersion'], 'names': NAMES,
          'connections': CONNECTIONS, 'frames': rows}
(args.output/'debug-poses.json').write_text(json.dumps(output,separators=(',',':'))+'\n')
print(f'{len(rows)} photographs, 33 joints each; maximum registration residual {worst_error:.6f}px')
