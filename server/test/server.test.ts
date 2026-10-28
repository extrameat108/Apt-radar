import { beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';
import { type DB, openDb } from '../src/db.js';
import { storeDeals } from '../src/ingest.js';
import { fetchMonth, MolitApiError, normalizeItem, parseResponse } from '../src/molit.js';
import { flushPushes, routeEvents } from '../src/notify.js';
import { formatWon, isQuietHour, kstYmd } from '../src/time.js';
import { item, xmlOf } from './fixtures.js';

const deals = (xs: ReturnType<typeof item>[]) => parseResponse(xmlOf(xs)).items;
const NOON_KST = new Date('2026-10-28T03:00:00Z');
const NIGHT_KST = new Date('2026-10-28T14:00:00Z'); // 23시

describe('국토부 응답 파싱', () => {
  it('금액·면적·날짜·해제여부를 정리한다', () => {
    const d = normalizeItem(
      item({ aptSeq: '11650-1', dealAmount: '725,000', dealMonth: '9', dealDay: '3', cdealType: 'O', cdealDay: '26.10.05' }),
    )!;
    expect(d.amount).toBe(725000);
    expect(d.dealDate).toBe('2026-09-03');
    expect(d.areaKey).toBe(85);
    expect(d.cancelled).toBe(true);
    expect(d.cancelDate).toBe('2026-10-05');
  });

  it('인증키 오류 응답은 예외로 던진다', () => {
    const xml =
      '<OpenAPI_ServiceResponse><cmmMsgHeader><errMsg>SERVICE ERROR</errMsg><returnAuthMsg>SERVICE_KEY_IS_NOT_REGISTERED_ERROR</returnAuthMsg><returnReasonCode>30</returnReasonCode></cmmMsgHeader></OpenAPI_ServiceResponse>';
    expect(() => parseResponse(xml)).toThrow(MolitApiError);
  });

  it('페이지를 넘기며 모두 가져온다', async () => {
    const urls: string[] = [];
    const all = Array.from({ length: 5 }, (_, i) => item({ aptSeq: `11650-${i}`, dealAmount: '100,000' }));
    const out = await fetchMonth({
      baseUrl: 'https://example.test/api',
      serviceKey: 'k',
      lawdCd: '11650',
      ymd: '202610',
      pageSize: 2,
      fetcher: async (url) => {
        urls.push(url);
        const page = Number(new URL(url).searchParams.get('pageNo'));
        return xmlOf(all.slice((page - 1) * 2, page * 2), all.length, page);
      },
    });
    expect(out).toHaveLength(5);
    expect(urls).toHaveLength(3);
    expect(urls[0]).toContain('LAWD_CD=11650');
  });
});

describe('저장과 신고가 판정', () => {
  let db: DB;
  beforeEach(() => {
    db = openDb(':memory:');
  });

  it('같은 단지·면적의 기존 최고가를 넘으면 신고가', () => {
    storeDeals(db, deals([item({ aptSeq: 'A', dealAmount: '700,000', dealDay: '1' })]), { backfill: true });
    const ev = storeDeals(
      db,
      deals([
        item({ aptSeq: 'A', dealAmount: '725,000', dealDay: '20', floor: '15' }),
        item({ aptSeq: 'A', dealAmount: '690,000', dealDay: '21', floor: '3' }),
        item({ aptSeq: 'A', dealAmount: '900,000', dealDay: '22', excluUseAr: '114.2' }), // 다른 면적의 첫 거래
      ]),
      { backfill: false },
    );
    expect(ev.map((e) => [e.deal.amount, e.isRecord])).toEqual([
      [725000, true],
      [690000, false],
      [900000, false],
    ]);
    expect(ev[0].prevAmount).toBe(700000);
  });

  it('이미 저장된 거래는 다시 알리지 않고, 해제되면 해제 이벤트', () => {
    const x = item({ aptSeq: 'A', dealAmount: '700,000' });
    storeDeals(db, deals([x]), { backfill: false });
    expect(storeDeals(db, deals([x]), { backfill: false })).toHaveLength(0);
    const ev = storeDeals(db, deals([{ ...x, cdealType: 'O', cdealDay: '26.10.20' }]), { backfill: false });
    expect(ev).toHaveLength(1);
    expect(ev[0].kind).toBe('cancel');
  });

  it('백필은 이벤트를 만들지 않는다', () => {
    expect(storeDeals(db, deals([item({ aptSeq: 'A', dealAmount: '1' })]), { backfill: true })).toHaveLength(0);
  });
});

describe('알림 분배와 푸시', () => {
  let db: DB;
  const sent: { to: unknown; title?: string }[][] = [];
  const sender = async (m: { to: unknown; title?: string }[]) => {
    sent.push(m);
    return { invalidTokens: [] };
  };
  beforeEach(async () => {
    db = openDb(':memory:');
    sent.length = 0;
    const app = buildApp(db);
    await app.inject({ method: 'POST', url: '/devices', payload: { installId: 'dev-aaaa-1111', pushToken: 'ExponentPushToken[abc]' } });
    await app.inject({ method: 'POST', url: '/devices/dev-aaaa-1111/watches', payload: { kind: 'sgg', target: '11650' } });
    storeDeals(db, deals([item({ aptSeq: 'A', dealAmount: '700,000', dealDay: '1' })]), { backfill: true });
  });

  it('관심 지역은 신고가만 받는다', async () => {
    const ev = storeDeals(
      db,
      deals([
        item({ aptSeq: 'A', dealAmount: '650,000', dealDay: '10' }),
        item({ aptSeq: 'A', dealAmount: '725,000', dealDay: '20' }),
      ]),
      { backfill: false },
    );
    expect(routeEvents(db, ev, NOON_KST)).toBe(1);
    expect(await flushPushes(db, sender, NOON_KST)).toBe(1);
    expect(sent[0][0].title).toContain('신고가');
    expect(await flushPushes(db, sender, NOON_KST)).toBe(0); // 중복 전송 없음
  });

  it('방해 금지 시간에는 보류했다가 아침에 모아 보낸다', async () => {
    const ev = storeDeals(
      db,
      deals([
        item({ aptSeq: 'A', dealAmount: '725,000', dealDay: '20' }),
        item({ aptSeq: 'A', dealAmount: '730,000', dealDay: '21' }),
      ]),
      { backfill: false },
    );
    routeEvents(db, ev, NIGHT_KST);
    expect(await flushPushes(db, sender, NIGHT_KST)).toBe(0);
    expect(await flushPushes(db, sender, NOON_KST)).toBe(1);
    expect(sent[0][0].title).toBe('관심 단지·지역 소식 2건');
  });
});

describe('API', () => {
  it('피드·단지·통계를 돌려준다', async () => {
    const db = openDb(':memory:');
    storeDeals(
      db,
      deals([
        item({ aptSeq: 'A', aptNm: '반포테스트', dealAmount: '700,000', dealMonth: '9', dealDay: '1' }),
        item({ aptSeq: 'A', aptNm: '반포테스트', dealAmount: '725,000', dealMonth: '9', dealDay: '20', dealingGbn: '직거래', buyerGbn: '법인' }),
      ]),
      { backfill: false },
    );
    const app = buildApp(db);
    const feed = (await app.inject({ url: '/feed?sgg=11650' })).json();
    expect(feed.items[0].isRecord).toBe(true);
    const c = (await app.inject({ url: '/complexes/A' })).json();
    expect(c.monthly[0]).toMatchObject({ ym: '2026-09', max: 725000, count: 2 });
    const s = (await app.inject({ url: '/stats/11650?ym=202609' })).json();
    expect(s).toMatchObject({ total: 2, records: 1, gu: '서초구' });
    expect(s.buyerTypes).toEqual(expect.arrayContaining([{ label: '법인', count: 1 }]));
    expect((await app.inject({ url: '/search?q=반포' })).json()[0].aptSeq).toBe('A');
    expect((await app.inject({ url: '/feed?limit=9999' })).statusCode).toBe(400);
  });
});

describe('시간·금액 표기', () => {
  it('KST 기준으로 계산한다', () => {
    expect(kstYmd(0, new Date('2026-10-31T16:00:00Z'))).toBe('202611'); // KST 11/1 01시
    expect(kstYmd(1, new Date('2026-01-15T00:00:00Z'))).toBe('202512');
    expect(isQuietHour(NIGHT_KST)).toBe(true);
    expect(isQuietHour(NOON_KST)).toBe(false);
  });
  it('억 단위로 표기한다', () => {
    expect(formatWon(725000)).toBe('72.5억');
    expect(formatWon(720000)).toBe('72억');
    expect(formatWon(9800)).toBe('9,800만');
    expect(formatWon(1234567)).toBe('123억');
  });
});
