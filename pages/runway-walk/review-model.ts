export const categories = { angle: '방향 / 각도', matte: '누끼 / 잔상', pose: '관절 추정', gait: '발 / 걸음 연결', scale: '크기 / 기울기', ok: '괜찮음', other: '기타' } as const;
export type Category = keyof typeof categories;
export type FeedbackDraft = { clientId: string; frameKey: string; target: number; category: Category; note: string; suggestedYaw: number | null; joint: number | null; comparedTo: string | null; assetVersion: string };
export type Feedback = FeedbackDraft & { id: string; author: 'user'; createdAt: string };
export function frameKey(frame: { source: string; sourceFrame: number }) { return `${frame.source}:${frame.sourceFrame}`; }
export function validateFeedback(input: unknown, keys: ReadonlySet<string>): FeedbackDraft {
  if (!input || typeof input !== 'object') throw new TypeError('의견 형식이 올바르지 않아요.');
  const row = input as Record<string, unknown>;
  if (typeof row.frameKey !== 'string' || !keys.has(row.frameKey)) throw new TypeError('사진 번호를 확인해 주세요.');
  if (typeof row.clientId !== 'string' || !/^[\w-]{8,80}$/.test(row.clientId)) throw new TypeError('저장 번호를 확인해 주세요.');
  if (typeof row.target !== 'number' || !Number.isFinite(row.target) || Math.abs(row.target)>90 || row.target%5!==0) throw new TypeError('각도는 5도 단위로 골라 주세요.');
  if (typeof row.category !== 'string' || !Object.prototype.hasOwnProperty.call(categories,row.category)) throw new TypeError('문제 종류를 골라 주세요.');
  if (typeof row.note !== 'string' || row.note.trim().length>2000 || (!row.note.trim() && row.category==='other')) throw new TypeError('의견을 2,000자 이내로 적어 주세요.');
  if (row.suggestedYaw!==null && (typeof row.suggestedYaw!=='number' || !Number.isFinite(row.suggestedYaw) || Math.abs(row.suggestedYaw)>180)) throw new TypeError('제안 각도는 -180~180도예요.');
  if (row.joint!==null && (typeof row.joint!=='number' || !Number.isInteger(row.joint) || row.joint<0 || row.joint>32)) throw new TypeError('관절 번호를 확인해 주세요.');
  if (row.comparedTo!==null && (typeof row.comparedTo!=='string' || !keys.has(row.comparedTo))) throw new TypeError('이전 사진 번호를 확인해 주세요.');
  if (typeof row.assetVersion!=='string' || !/^[\w-]{1,64}$/.test(row.assetVersion)) throw new TypeError('사진 버전을 확인해 주세요.');
  return { clientId: row.clientId, frameKey: row.frameKey, target: row.target, category: row.category as Category, note: row.note.trim(), suggestedYaw: row.suggestedYaw as number|null, joint: row.joint as number|null, comparedTo: row.comparedTo as string|null, assetVersion: row.assetVersion };
}
