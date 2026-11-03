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

ASCII cells are fixed at the former medium size (16/3 CSS px wide), with
the existing 0.75 portrait-screen multiplier. Old size links normalize to
`?ascii=medium`. Five palettes (classic, dots, lines, code and blocks) use
distinct glyph sets, tone curves and stable per-cell texture variation.
Use `?style=<palette>` to share a style; lil-gui exposes the style selector.

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
(or double-tap) starts a fixed-position, 1.5-second avoidance impulse and
three fading ripple rings, shared by the ASCII and low-poly views.

Rendering controls live in lil-gui: ASCII, low-poly, and spine debug views,
with the five texture styles exposed only in ASCII mode. The debug
view draws the same ten interpolated spine joints used by the fish mesh,
body-width crossbars and a head-direction arrow; a toggle overlays the
wireframe body. All views retain selection, transforms and swimming.
Use `?view=ascii|low-poly|spine` to link directly to a rendering mode.

The four edge handles stretch screen-space width or height independently
about the opposite edge. Corner handles independently resize both axes
around the fixed opposite corner without locking aspect ratio. Axis
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

Pond edges influence heading and speed only: compact look-ahead steering
accounts for body length and axis stretch, easing speed toward an edge and
turning continuously without reflecting heading. No containment step moves
fish inward, fits their size to the viewport, or limits a resize by available
screen space. Fish may extend offscreen. Side and corner handles retain their
fixed opposite anchors; only the normal 0.25–4 editing scale limits apply.

Double-click disturbances have a broad influence radius and stronger radial
steering, immediate turning and burst acceleration. A softer distance falloff
includes fish beyond the old local radius; three ripple rings expand faster
to match the wider response. Normal cruising remains unchanged.

Initial positions span more of the viewport, wandering has longer straight
sections, and a shorter wall look-ahead with a smaller size-aware margin lets
fish explore the outer pond. These changes do not introduce containment.

`depth.ts` drives independent, smooth 18–26-second dive/surface cycles with
perspective scale and a subtle body pitch.
Real scene z positions drive a depth-texture composite in `depth-pass.ts`:
blur and water-color attenuation increase with depth. In ASCII mode this
runs after glyph rendering, so deep characters themselves soften. Low-poly
uses the same composite; spine debug bypasses it. Surface ripples stay at
the focus plane. A lil-gui toggle compares the effect, and selection sorts
fish by visible depth. Selecting a fish freezes its private dive clock;
deselecting resumes that clock without catching up or jumping. The upper
water band has no blur or attenuation and receives a modest contrast boost.
Body pitch changes z geometry and lighting without changing its x/y outline.

The optional making-of mode uses the shared artwork stepper: recorded path
→ posed spine → triangular body → luminance pixels → ASCII characters →
animated depth composite. Each view reads the same school state. Global
pause keeps the same moment for stage comparison; switching stages does not
reset the pond. `?process=1&stage=motion` opens the tour. The normal artwork
hides the stepper/caption; lil-gui exposes the tour and pause controls.
