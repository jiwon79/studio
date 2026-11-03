export const PROCESS_STEPS = [
  { id: 'motion', label: '01 경로' },
  { id: 'spine', label: '02 척추' },
  { id: 'body', label: '03 형태' },
  { id: 'pixels', label: '04 픽셀' },
  { id: 'ascii', label: '05 문자' },
  { id: 'depth', label: '06 수심' },
] as const;
export type ProcessStage = typeof PROCESS_STEPS[number]['id'];
export function isProcessStage(value: string | null): value is ProcessStage {
  return PROCESS_STEPS.some(step => step.id === value);
}
export function processView(stage: ProcessStage) {
  return { mode: ({ motion: 'path', spine: 'spine', body: 'low-poly', pixels: 'pixels', ascii: 'ascii', depth: 'ascii' } as const)[stage], depth: stage === 'depth' };
}
