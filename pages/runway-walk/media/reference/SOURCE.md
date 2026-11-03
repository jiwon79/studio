# Quaternius mannequin and formal walk

- Creator: Quaternius; the pack credits animator Gonzalo Furnier.
- Official source: https://quaternius.com/packs/universalanimationlibrary.html
- Official download: https://quaternius.itch.io/universal-animation-library
- Pack: Universal Animation Library Standard, June 2026 release.
- Upstream file: `Unreal-Godot/UAL1_Standard.glb` (root motion disabled).
- Upstream SHA-256: `69591853d817488edaa8fd9bf8fc1d821eaeaf789f8627b3cd23b41c4ed67997`.
- License: CC0 1.0; the original license is preserved in `LICENSE.txt`.

`quaternius-formal-walk.glb` retains the original mesh, skeleton, skin and `Walk_Formal_Loop` clip. Only unrelated animation data was pruned. No character geometry or animation keys were authored for this artwork. The official page identifies authored animations, not a verified motion-capture recording.

Reproduce the GLB and sampled reference with `scripts/runway-walk/import-reference.mjs`. The full downloaded pack remains in the ignored source cache. `reference-motion.json` records the pruned model hash, duration, bone mapping and original mesh sole attachments. Rendering applies yaw and a constant floor registration; matching uses the same sampled animation, with leg-length normalization for comparing photographs.
