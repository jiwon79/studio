# 0° pose-conditioning prompt set

Tool: built-in GPT image editing (`transparent_background: true`). Every image is generated separately. The twelve time slots, original source IDs, native gait phases and target landmarks are in `manifest.json`. Model pixels are exported from the imported Quaternius mannequin's unchanged `Walk_Formal_Loop` GLB at exactly those phases; the guide is projected from the same animation. Photographic appearance comes from the original runway crop, not from a generated person template.

## Photo first

Input order: original photograph (edit target), exact 3D model frame (pose reference), blue-left/orange-right joint guide.

Prompt template:

> POSE-CONDITIONED PHOTO EDIT, animation frame tick {tick}, front view0 degrees. INPUT1 is the REAL PHOTO edit target: preserve this person's appearance, garments/colors/materials, but deliberately CORRECT THE POSE. INPUT2 is the exact TARGET 3D WALKING POSE at this frame: use its pelvis/shoulder lean, leg configuration, foot depth/contact and precise left/right placement. INPUT3 is the matching projected joint guide: blue=L anatomical LEFT (viewer right), orange=R. Use the 3D POSE and joint guide as authoritative, not the source photograph's old leg pose. Especially keep which foot is forward and which heel/toe contacts the ground exactly as the mannequin. Target ankle/heel/toe IDs27/28ankles29/30heels31/32toes normalized coordinates: {target feet coordinates}. Preserve person scale and the mannequin's exact 2:3 canvas placement, floor y93.75% of canvas. The mannequin is POSE ONLY: do NOT copy its yellow/purple colors, plastic/robot anatomy, blank face, material or body mass. Produce the REAL HUMAN wearing the clothing in photo1, in the target pose2, with natural plausible clothing folds following the corrected pose. Restore restrained photographic detail and clean cutout edges. Remove carried bags/purses/straps/background fragments; keep garment belts, sunglasses, jewelry. No guide dots/letters/lines/text, no robot styling. Genuine transparent alpha background only, no glow/haze/shadow. Single full-body photorealistic cutout of this exact target walking instant.

## Model first

Input order: exact 3D model frame (edit target), original photograph (appearance reference), same joint guide.

Prompt template:

> IMAGE1 is the EDIT TARGET. Completely replace the yellow robot mannequin with the REAL PERSON and clothes from IMAGE2, while preserving IMAGE1's EXACT walking pose, limb and foot locations, heel/toe contact, frontal camera, scale and canvas composition. IMAGE2 is APPEARANCE ONLY: DO NOT COPY ITS OLD POSE OR CROSSED LEGS. IMAGE3 is exact anatomical joint guide, blue LEFT, orange RIGHT. This is animation tick{tick}; {frontLeg} leg is forward. LEFT foot is supporting the body on the ground. RIGHT foot {has toe contact as in target / is lifted in swing, do not put it flat on the ground}. Both feet must be at the locations in image1/image3; no anatomical relabel, no mirror. Match original person's slim fashion-model appearance, clothing colors/patterns, but repose the person to the mannequin. Real human, realistic garments, NOT a robot, no yellow/purple mannequin material. No bags/purses/shoulder straps. Genuine transparent background, no text, no joint markers or glow. Single photorealistic full-body person, exact targetpose.

## Comparison

The page can apply exactly the same whole-photo similarity fit to both methods. It does not deform limbs, mirror images, exchange anatomical labels, or choose a more favorable correspondence. Position and temporal residuals are computed in the page from the supplied pose annotations, with low-confidence estimates marked. This is a twelve-frame partial-cycle test, not a new full-length production gait.

## Head, torso and feet revision

Twelve separate built-in GPT image edits use the previous model-first human cutout as edit target, the new spatial guide as constraint input and the unchanged imported model render as pose reference. The exact per-frame final prompts are in `prompts-v2.json`. Initial full re-generation variants were rejected for changed foot poses. Final selected edits request upper-body changes while preserving the prior lower-body gait; alpha is retained and delivery files are premultiplied-alpha resampled to 768×1152 lossless WebP.

The mannequin has no anatomical eyes. Virtual eye anchors are explicitly attached to its Head mesh bounding box at 65% height, ±18% width and 90% depth. This calibration is recorded in the runtime manifest and is shown as a virtual guide, not a detected anatomical landmark. New playback combines the edited images with joint whole-photo registration across twelve frames. The page exposes generation-only and previous-images-plus-registration ablations. This distinction is necessary because prompt constraints alone did not guarantee exact spatial matches.
