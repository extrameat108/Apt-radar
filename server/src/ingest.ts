import type { DB } from './db.js';
import { getMeta, setMeta } from './db.js';
import { type Deal, type Fetcher, fetchMonth, MolitApiError } from './molit.js';
import { kstYmd } from './time.js';

export type DealEventKind = 'new' | 'cancel';

export interface DealEvent {
  kind: DealEventKind;
  deal: Deal;
  isRecord: boolean;
  /** 같은 단지·면적의 직전 거래가(만원) */
  prevAmount: number | null;
}

interface StoreOptions {
  backfill: boolean;
  now?: Date;
}

/**
 * 거래를 저장하고, 새로 발견된 거래·해제된 거래 이벤트를 돌려줍니다.
 * 신고가 = 같은 단지·같은 면적(㎡ 반올림)에서 해제되지 않은 기존 최고가보다 비싼 거래.
 */
export function storeDeals(db: DB, deals: Deal[], opts: StoreOptions): DealEvent[] {
  const nowIso = (opts.now ?? new Date()).toISOString();
  const upsertComplex = db.prepare(`
    INSERT INTO complexes(apt_seq, name, sgg_cd, umd_name, build_year) VALUES(@aptSeq, @aptName, @sggCd, @umdName, @buildYear)
    ON CONFLICT(apt_seq) DO UPDATE SET name = excluded.name, umd_name = excluded.umd_name,
      build_year = COALESCE(excluded.build_year, complexes.build_year)`);
  const findDeal = db.prepare('SELECT cancelled FROM deals WHERE id = ?');
  const maxPrev = db.prepare(
    'SELECT MAX(amount) AS m FROM deals WHERE apt_seq = ? AND area_key = ? AND cancelled = 0',
  );
  const lastPrev = db.prepare(
    `SELECT amount FROM deals WHERE apt_seq = ? AND area_key = ? AND cancelled = 0 AND deal_date <= ?
     ORDER BY deal_date DESC, first_seen_at DESC LIMIT 1`,
  );
  const insert = db.prepare(`
    INSERT INTO deals(id, apt_seq, sgg_cd, area, area_key, floor, amount, deal_date, dealing_type, buyer_type,
      seller_type, cancelled, cancel_date, is_record, prev_amount, first_seen_at, backfilled)
    VALUES(@id, @aptSeq, @sggCd, @area, @areaKey, @floor, @amount, @dealDate, @dealingType, @buyerType,
      @sellerType, @cancelled, @cancelDate, @isRecord, @prevAmount, @firstSeenAt, @backfilled)`);
  const markCancelled = db.prepare('UPDATE deals SET cancelled = 1, cancel_date = ?, is_record = 0 WHERE id = ?');

  const events: DealEvent[] = [];
  const sorted = [...deals].sort((a, b) => a.dealDate.localeCompare(b.dealDate));

  db.transaction(() => {
    for (const d of sorted) {
      upsertComplex.run(d);
      const existing = findDeal.get(d.id) as { cancelled: number } | undefined;
      if (existing) {
        if (!existing.cancelled && d.cancelled) {
          markCancelled.run(d.cancelDate, d.id);
          if (!opts.backfill) events.push({ kind: 'cancel', deal: d, isRecord: false, prevAmount: null });
        }
        continue;
      }
      const max = (maxPrev.get(d.aptSeq, d.areaKey) as { m: number | null }).m;
      const prev = (lastPrev.get(d.aptSeq, d.areaKey, d.dealDate) as { amount: number } | undefined)?.amount ?? null;
      const isRecord = !d.cancelled && max !== null && d.amount > max;
      insert.run({
        ...d,
        cancelled: d.cancelled ? 1 : 0,
        isRecord: isRecord ? 1 : 0,
        prevAmount: prev,
        // 백필한 과거 거래는 계약일을 "발견 시각"으로 둬서 피드가 과거 거래로 도배되지 않게 합니다
        firstSeenAt: opts.backfill ? `${d.dealDate}T00:00:00.000Z` : nowIso,
        backfilled: opts.backfill ? 1 : 0,
      });
      if (!opts.backfill && !d.cancelled) events.push({ kind: 'new', deal: d, isRecord, prevAmount: prev });
    }
  })();

  return events;
}

export interface IngestOptions {
  baseUrl: string;
  serviceKey: string;
  regions: string[];
  fetcher?: Fetcher;
  now?: Date;
  log?: (msg: string) => void;
}

const isAuthError = (e: unknown) => e instanceof MolitApiError && ['20', '30', '31', '32', '33'].includes(e.code ?? '');

/** 이번 달과 지난달(신고 기한 30일) 거래를 수집합니다 */
export async function runIngest(db: DB, opts: IngestOptions): Promise<DealEvent[]> {
  const log = opts.log ?? console.log;
  const months = [kstYmd(1, opts.now), kstYmd(0, opts.now)];
  const events: DealEvent[] = [];
  for (const lawdCd of opts.regions) {
    for (const ymd of months) {
      try {
        const deals = await fetchMonth({ ...opts, lawdCd, ymd });
        events.push(...storeDeals(db, deals, { backfill: false, now: opts.now }));
      } catch (e) {
        if (isAuthError(e)) throw e;
        log(`[ingest] ${lawdCd} ${ymd} 실패: ${(e as Error).message}`);
      }
    }
  }
  setMeta(db, 'last_ingest_at', (opts.now ?? new Date()).toISOString());
  return events;
}

/** 첫 실행 때 과거 거래를 채웁니다(알림 없음). 이미 했다면 건너뜁니다. */
export async function runBackfillIfNeeded(db: DB, opts: IngestOptions & { months: number }): Promise<boolean> {
  if (getMeta(db, 'backfill_done')) return false;
  const log = opts.log ?? console.log;
  for (const lawdCd of opts.regions) {
    for (let i = opts.months; i >= 0; i--) {
      const ymd = kstYmd(i, opts.now);
      try {
        const deals = await fetchMonth({ ...opts, lawdCd, ymd });
        storeDeals(db, deals, { backfill: true, now: opts.now });
      } catch (e) {
        if (isAuthError(e)) throw e;
        log(`[backfill] ${lawdCd} ${ymd} 실패: ${(e as Error).message}`);
      }
    }
    log(`[backfill] ${lawdCd} 완료`);
  }
  setMeta(db, 'backfill_done', new Date().toISOString());
  return true;
}
