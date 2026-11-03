export const PROCESS_STEPS = [
  { id: 'motion', label: '01 경로', description: '머리가 지나간 경로를 기록하고, 경계를 만나면 방향을 돌립니다.' },
  { id: 'spine', label: '02 척추', description: '이동 경로를 따라 10개 관절을 놓고, 뒤로 갈수록 큰 파동을 더합니다.' },
  { id: 'body', label: '03 형태', description: '척추 주위에 몸통·지느러미·꼬리의 삼각형을 연결합니다.' },
  { id: 'pixels', label: '04 픽셀', description: '입체 물고기를 작은 칸으로 나누고, 각 칸의 밝기를 읽습니다.' },
  { id: 'ascii', label: '05 문자', description: '칸의 밝기에 맞는 문자를 골라 물고기를 다시 그립니다.' },
  { id: 'depth', label: '06 수심', description: '물고기가 잠수·부상하며, 수심에 따라 크기·선명도·명암이 달라집니다.' },
] as const;
export type ProcessStage = typeof PROCESS_STEPS[number]['id'];
export function isProcessStage(value: string | null): value is ProcessStage {
  return PROCESS_STEPS.some(step => step.id === value);
}
export function processView(stage: ProcessStage) {
  return { mode: ({ motion: 'path', spine: 'spine', body: 'low-poly', pixels: 'pixels', ascii: 'ascii', depth: 'ascii' } as const)[stage], depth: stage === 'depth' };
}
