export const PROCESS_STEPS = [
  { id: 'skeleton', label: '관절', title: '01 · 움직임의 뼈대', description: '골반·무릎·발목의 궤적을 연결해 걷는 움직임을 만듭니다.' },
  { id: 'silhouette', label: '실루엣', title: '02 · 선에 부피 더하기', description: '관절 사이를 다리 형태로 채우고 위로 갈수록 옅어지게 합니다.' },
  { id: 'soles', label: '발', title: '03 · 바닥에 닿는 발', description: '발 모양과 발목의 회전을 더해 딛고 떼는 동작을 보여줍니다.' },
  { id: 'glass', label: '유리', title: '04 · 유리 너머로', description: '뒤쪽 다리는 넓게 흐리고, 가까운 발은 선명하게 남깁니다.' },
  { id: 'interact', label: '완성', title: '', description: '' },
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
