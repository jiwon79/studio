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

The four edge handles stretch screen-space width or height independently
about the opposite edge. Corner handles retain proportional scaling. Axis
stretches persist through swimming, mode changes and scoped undo/redo, and
apply equally to the mesh, eyes, debug skeleton and selection bounds.

Editing is contextual: dragging from empty water sketches a new fish,
while dragging from a fish moves it. There is no tool toolbar or mode switch.
A click on empty water deselects; short taps do not create fish, so double
click/tap still triggers ripples. Undo/redo remains available by keyboard.

Sketch creation records undo history without selecting the new fish, so it
starts swimming immediately. Interrupted move/resize gestures (focus loss,
resize, pointer cancellation or capture loss) retain the latest pose and
remain undoable. Escape explicitly rolls back the active gesture. Pointer
ownership and capture checks ignore stale events; the final pointer-up
position is applied even if the last move event was omitted.

Pond boundaries account for body length and independent axis stretches.
Look-ahead wall steering starts early and eases swimming speed when heading
toward an edge; heading is never reflected. A conservative envelope around
the posed spine includes fins, nose and spline overshoot. If edits, resize
or a flee impulse exceed the bounds, the whole path is translated inward
without changing its heading or curvature. Oversized fish are limited to a
scale that fits the viewport in every swimming direction.

Wall anticipation uses a compact look-ahead and body-size margin so fish
explore the outer pond before turning. The full-body containment guard and
continuous heading changes remain in place.
