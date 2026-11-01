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
