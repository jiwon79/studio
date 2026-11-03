export const PROCESS_STEPS = [
  { id: 'skeleton', label: '관절' },
  { id: 'silhouette', label: '실루엣' },
  { id: 'soles', label: '발' },
  { id: 'glass', label: '유리' },
  { id: 'interact', label: '완성' },
] as const;
export type ProcessStage = typeof PROCESS_STEPS[number]['id'];
export function stageLayers(stage: ProcessStage) {
  return {
    joints: stage === 'skeleton',
    soles: stage === 'skeleton',
    far: stage === 'glass' || stage === 'interact',
    legs: stage !== 'skeleton',
    feet: stage === 'soles' || stage === 'glass' || stage === 'interact',
    glass: stage === 'glass' || stage === 'interact',
  };
}
