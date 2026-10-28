const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

/** 한국 시간 기준 날짜 부품 */
export function kstParts(d: Date = new Date()) {
  const k = new Date(d.getTime() + KST_OFFSET_MS);
  return { y: k.getUTCFullYear(), m: k.getUTCMonth() + 1, day: k.getUTCDate(), hour: k.getUTCHours() };
}

/** KST 기준 YYYYMM, monthsAgo개월 전 */
export function kstYmd(monthsAgo = 0, now: Date = new Date()): string {
  const { y, m } = kstParts(now);
  const idx = y * 12 + (m - 1) - monthsAgo;
  const yy = Math.floor(idx / 12);
  const mm = (idx % 12) + 1;
  return `${yy}${String(mm).padStart(2, '0')}`;
}

/** KST 기준 오늘 0시의 ISO 문자열 (UTC 표기) */
export function kstStartOfDayIso(now: Date = new Date()): string {
  const { y, m, day } = kstParts(now);
  return new Date(Date.UTC(y, m - 1, day) - KST_OFFSET_MS).toISOString();
}

/** 22시~07시(KST)인지 */
export function isQuietHour(now: Date = new Date(), start = 22, end = 7): boolean {
  const { hour } = kstParts(now);
  return start > end ? hour >= start || hour < end : hour >= start && hour < end;
}

/** 만원 단위 금액을 "72.5억" / "9,800만" 형식으로 */
export function formatWon(manwon: number): string {
  if (manwon >= 10000) {
    const eok = manwon / 10000;
    const r = eok >= 100 ? Math.round(eok) : Math.round(eok * 10) / 10;
    return `${Number.isInteger(r) ? r : r.toFixed(1)}억`;
  }
  return `${manwon.toLocaleString('ko-KR')}만`;
}
