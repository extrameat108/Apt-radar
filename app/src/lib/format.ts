/** 만원 단위 금액 → "72.5억" / "9,800만" */
export function won(manwon: number): string {
  if (manwon >= 10000) {
    const eok = manwon / 10000;
    const r = eok >= 100 ? Math.round(eok) : Math.round(eok * 10) / 10;
    return `${Number.isInteger(r) ? r : r.toFixed(1)}억`;
  }
  return `${manwon.toLocaleString('ko-KR')}만`;
}

/** 직전 거래 대비 차이 */
export function diff(amount: number, prev: number | null): { text: string; up: boolean } | null {
  if (prev === null || prev === amount) return null;
  const up = amount > prev;
  return { text: `${up ? '▲' : '▼'} ${won(Math.abs(amount - prev))}`, up };
}

/** "3분 전", "2시간 전", "10월 26일" */
export function ago(iso: string, now: Date = new Date()): string {
  const t = new Date(iso).getTime();
  const s = Math.max(0, (now.getTime() - t) / 1000);
  if (s < 60) return '방금';
  if (s < 3600) return `${Math.floor(s / 60)}분 전`;
  if (s < 86400) return `${Math.floor(s / 3600)}시간 전`;
  if (s < 86400 * 7) return `${Math.floor(s / 86400)}일 전`;
  const d = new Date(iso);
  return `${d.getMonth() + 1}월 ${d.getDate()}일`;
}

/** "2026-10-26" → "2026.10.26" */
export const dotDate = (ymd: string) => ymd.replaceAll('-', '.');

/** "2026-10-26" → "10월 26일" */
export function md(ymd: string): string {
  const [, m, d] = ymd.split('-');
  return `${Number(m)}월 ${Number(d)}일`;
}

/** 전용면적 → "84㎡ (25평)" 비슷한 형식에 쓰는 평 환산 (공급면적이 아니므로 참고용) */
export const pyeong = (m2: number) => Math.round(m2 / 3.3058);
