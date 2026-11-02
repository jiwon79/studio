# /// script
# requires-python = ">=3.11,<3.14"
# dependencies = ["opensim==4.6", "numpy>=2,<3"]
# ///
"""Bake OpenSim's distributed Gait2392 CMC result into a small browser clip.
Run with: uv run scripts/export-behind-glass-opensim.py
No muscle dynamics are solved in the browser; OpenSim realizes the joint geometry
from its published muscle-driven CMC trajectory. Fourier fitting makes a C2 loop.
"""
import hashlib
import json
import tempfile
from pathlib import Path
from urllib.request import urlretrieve
import numpy as np
import opensim as osim

REV = 'd9b05d470b1a481c222372c85b75772faf8f7792'
BASE = f'https://raw.githubusercontent.com/opensim-org/opensim-models/{REV}/'
MODEL = 'Pipelines/Gait2392_Simbody/OutputReference/subject01_simbody_adjusted.osim'
MOTION = 'Pipelines/Gait2392_Simbody/OutputReference/ResultsCMC/subject01_walk1_Kinematics_q.sto'
START, END, COUNT, HARMONICS = .6, 1.83, 160, 6
SCALE = 120  # drawing units per metre, same on all axes

def basis(phases):
    return np.column_stack([np.ones_like(phases)] + [f(2*np.pi*k*phases) for k in range(1,HARMONICS+1) for f in (np.cos,np.sin)])

with tempfile.TemporaryDirectory(prefix='behind-glass-opensim-') as tmp:
    files = []
    for name, source in [('model.osim', MODEL), ('motion.sto', MOTION)]:
        target = Path(tmp) / name
        urlretrieve(BASE + source, target)
        files.append(target)
    lines = files[1].read_text().split('endheader')[1].strip().splitlines()
    columns = lines[0].split()
    rows = np.loadtxt(lines[1:])
    rows = rows[(rows[:,0] >= START) & (rows[:,0] <= END)]
    phases = (rows[:,0] - START) / (END-START)
    coeff = np.linalg.lstsq(basis(phases), rows[:,1:], rcond=None)[0]
    values = basis(np.arange(COUNT)/COUNT) @ coeff
    # Historical q.sto says inDegrees=no, but the companion q.mot and the
    # Kinematics analysis setting establish that rotational values are degrees.
    osim.Logger.setLevelString('error')
    model = osim.Model(str(files[0]))
    state = model.initSystem()
    coords = model.getCoordinateSet()
    bodies = model.getBodySet()
    root_x = float(np.mean(values[:,columns.index('pelvis_tx')-1]))
    root_z = float(np.mean(values[:,columns.index('pelvis_tz')-1]))
    def point(body, local=None):
        b = bodies.get(body)
        v = b.getPositionInGround(state) if local is None else b.findStationLocationInGround(state, osim.Vec3(*local))
        return [(v.get(0)-root_x)*SCALE, v.get(1)*SCALE, (v.get(2)-root_z)*SCALE]
    frames = []
    for row in values:
        for name, value in zip(columns[1:], row):
            coords.get(name).setValue(state,float(value if name in ('pelvis_tx','pelvis_ty','pelvis_tz') else np.deg2rad(value)),False)
        model.realizePosition(state)
        legs = []
        for side in ('r','l'):
            # Joint origins come from OpenSim, including its coupled knee translations.
            hip, knee, ankle = [point(f'{body}_{side}') for body in ('femur','tibia','talus')]
            heel = point(f'calcn_{side}', (0,-.035,0))
            toe = point(f'calcn_{side}', (.20,-.035,0))
            legs.append([hip,knee,ankle,heel,toe])
        frames.append(legs)
    result = {
        'sourceRevision': REV, 'model': MODEL, 'motion': MOTION,
        'sourceSha256': [hashlib.sha256(f.read_bytes()).hexdigest() for f in files],
        'opensimVersion': osim.GetVersion(), 'sourceRange': [START,END],
        'period': END-START, 'stride': 1.1*(END-START)*SCALE,
        'unitsPerMetre': SCALE, 'harmonics': HARMONICS,
        'frames': np.round(frames,5).tolist(),
    }
    output = Path(__file__).resolve().parents[1] / 'pages/behind-glass/assets/opensim-walk.json'
    output.write_text(json.dumps(result,separators=(',',':'))+'\n')
    print(f'Wrote {COUNT} frames to {output}')
