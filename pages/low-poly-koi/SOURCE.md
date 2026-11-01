# Source attribution

The swimming simulation in `school.ts` is adapted from Blake Cyze's
MIT-licensed **ittybitty/koi**, retrieved November 1, 2026:

https://gist.github.com/blakecyze/fb5a6ce12207d06c82ea0b3a488244d4

Source file: `koi.js`, revision `58d2a3916779e9338607951208f2ef88ba266286`.
The source README explicitly licenses the supplied files under MIT.

The fixed-step movement rules, separation, pointer avoidance, burst/glide
timing, 72-point trails, ten-point spines and swimming wave are retained.
The original procedural fragment shader and dithering are replaced with
dynamic triangular fish geometry, flat lighting and angular silhouettes.
Three.js supplies the renderer; no fish images or models are loaded.
