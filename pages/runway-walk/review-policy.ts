import audits from './frame-audit.json';
export { audits };
export function frameAudits(frame: { clip: string; sourceFrame: number }) {
  return audits.filter(a => a.clip===frame.clip && frame.sourceFrame>=a.fromFrame && frame.sourceFrame<=a.toFrame);
}
export function heldForTarget(frame: { clip: string; sourceFrame: number }, target: number) {
  return frameAudits(frame).some(a => a.action==='hold' && a.targets.includes(target));
}
export function blockHeld(clip: string, from: number, to: number, target: number) {
  return audits.some(a => a.action==='hold' && a.clip===clip && a.targets.includes(target) && a.fromFrame<=Math.max(from,to) && a.toFrame>=Math.min(from,to));
}
