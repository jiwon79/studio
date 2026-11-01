# Source attribution

The swimming simulation in `school.ts` is adapted from Blake Cyze's
MIT-licensed **ittybitty/koi**, retrieved November 1, 2026:

https://gist.github.com/blakecyze/fb5a6ce12207d06c82ea0b3a488244d4

Source file: `koi.js`, revision `58d2a3916779e9338607951208f2ef88ba266286`.
The source README explicitly licenses the supplied files under MIT.

The fixed-step movement, separation, pointer avoidance, burst/glide behaviour,
72-point trails and ten-point spines are retained. The adaptation limits
turning by speed and body length, slows the tail beat, and holds the head
steady while a smaller wave travels down the rear of the body. Rendering
interpolates fixed-step poses, and a smooth centreline drives the faceted mesh.
The original procedural fragment shader and dithering are replaced with
dynamic triangular fish geometry, flat lighting and angular silhouettes.
Three.js supplies the renderer; no fish images or models are loaded.

The silhouette follows the source body-width profile, rounded snout, small
oval pectoral fans and shallow forked tail. Fins use a separate translucent
material. The palette uses the source blue (`#1d4ce9`) with white faceted fish.

`ascii.ts` adds an original GPU post-process: the same fish scene is drawn
into a character-sized grid, then luminance selects a glyph from a local
monospace atlas. ASCII and low-poly modes share geometry and simulation.

ASCII character sizing has four evenly spaced presets between original
(6 CSS px wide) and small (4 px, default): original, medium, compact, small.
Portrait screens scale these by 0.75. Each preset is directly addressable using `?ascii=<preset>`.

The sketch-to-creature and selection-box interaction is inspired by areadne's
sheep editor video, referenced via Cosmos (no media or code is copied):
https://www.cosmos.so/e/1698214616
https://x.com/areadnemaria/status/2114898325451444419

The editor interprets the drawn footprint's principal direction and length
as a new fish's placement and scale. The simulation supports up to 64 fish,
individual path transforms, deletion, and snapshot-based undo/redo.

Hover outlines follow the fish bounds. Selection freezes only that fish's
simulation state; undo/redo restores only the affected fish without rewinding
its neighbours. Cursor movement does not steer the school. A double-click
(or double-tap) starts a fixed-position, 0.85-second avoidance impulse and
three fading ripple rings, shared by the ASCII and low-poly views.

Rendering controls live in lil-gui: ASCII, low-poly, and spine debug views,
with the four character-size presets exposed only in ASCII mode. The debug
view draws the same ten interpolated spine joints used by the fish mesh,
body-width crossbars and a head-direction arrow; a toggle overlays the
wireframe body. All views retain selection, transforms and swimming.
Use `?view=ascii|low-poly|spine` to link directly to a rendering mode.
