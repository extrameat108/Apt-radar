import { XMLParser } from 'fast-xml-parser';

/** 국토부 아파트 매매 실거래가 상세 API의 item 하나를 정리한 형태 */
export interface Deal {
  id: string;
  aptSeq: string;
  aptName: string;
  sggCd: string;
  umdName: string;
  buildYear: number | null;
  /** 전용면적(㎡) */
  area: number;
  /** 면적 구분용: 전용면적 반올림(㎡) */
  areaKey: number;
  floor: number | null;
  /** 거래금액(만원) */
  amount: number;
  /** 계약일 YYYY-MM-DD */
  dealDate: string;
  /** 중개거래 / 직거래 */
  dealingType: string;
  /** 개인 / 법인 / 공공기관 / 기타 (국토부가 공개하는 구분값만) */
  buyerType: string;
  sellerType: string;
  cancelled: boolean;
  cancelDate: string | null;
}

export class MolitApiError extends Error {
  constructor(
    message: string,
    readonly code?: string,
  ) {
    super(message);
  }
}

const parser = new XMLParser({
  ignoreAttributes: true,
  parseTagValue: false,
  trimValues: true,
  isArray: (name) => name === 'item',
});

const str = (v: unknown): string => (v === undefined || v === null ? '' : String(v).trim());

function pad2(n: string): string {
  return n.padStart(2, '0');
}

/** "26.10.15" 형식의 해제일을 YYYY-MM-DD로 */
function parseShortDate(v: string): string | null {
  const m = v.match(/^(\d{2})\.(\d{1,2})\.(\d{1,2})$/);
  if (!m) return v ? v : null;
  return `20${m[1]}-${pad2(m[2])}-${pad2(m[3])}`;
}

export function normalizeItem(raw: Record<string, unknown>): Deal | null {
  const aptSeq = str(raw.aptSeq);
  const amount = Number(str(raw.dealAmount).replace(/,/g, ''));
  const area = Number(str(raw.excluUseAr));
  const y = str(raw.dealYear);
  const mo = str(raw.dealMonth);
  const d = str(raw.dealDay);
  if (!aptSeq || !Number.isFinite(amount) || amount <= 0 || !Number.isFinite(area) || !y || !mo || !d) {
    return null;
  }
  const floorRaw = str(raw.floor);
  const floor = floorRaw === '' ? null : Number(floorRaw);
  const dealDate = `${y}-${pad2(mo)}-${pad2(d)}`;
  const by = Number(str(raw.buildYear));
  const id = [aptSeq, dealDate, floorRaw, area.toFixed(2), amount].join('|');
  return {
    id,
    aptSeq,
    aptName: str(raw.aptNm),
    sggCd: str(raw.sggCd),
    umdName: str(raw.umdNm),
    buildYear: Number.isFinite(by) && by > 0 ? by : null,
    area,
    areaKey: Math.round(area),
    floor: floor !== null && Number.isFinite(floor) ? floor : null,
    amount,
    dealDate,
    dealingType: str(raw.dealingGbn),
    buyerType: str(raw.buyerGbn),
    sellerType: str(raw.slerGbn),
    cancelled: str(raw.cdealType).toUpperCase() === 'O',
    cancelDate: parseShortDate(str(raw.cdealDay)),
  };
}

export interface PageResult {
  items: Deal[];
  totalCount: number;
}

export function parseResponse(xml: string): PageResult {
  const doc = parser.parse(xml);
  // 인증키 오류 등은 OpenAPI_ServiceResponse 형식으로 옵니다
  const err = doc?.OpenAPI_ServiceResponse?.cmmMsgHeader;
  if (err) {
    throw new MolitApiError(str(err.returnAuthMsg) || str(err.errMsg) || 'API error', str(err.returnReasonCode));
  }
  const res = doc?.response;
  if (!res) throw new MolitApiError('Unexpected response');
  const code = str(res.header?.resultCode);
  if (code !== '000' && code !== '00') {
    throw new MolitApiError(str(res.header?.resultMsg) || 'API error', code);
  }
  const rawItems: Record<string, unknown>[] = res.body?.items?.item ?? [];
  const items = rawItems.map(normalizeItem).filter((x): x is Deal => x !== null);
  return { items, totalCount: Number(str(res.body?.totalCount)) || 0 };
}

export type Fetcher = (url: string) => Promise<string>;

export const defaultFetcher: Fetcher = async (url) => {
  const res = await fetch(url, {
    // data.go.kr은 기본 스크립트 User-Agent를 막는 경우가 있습니다
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; apt-radar/0.1)', Accept: 'application/xml' },
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) throw new MolitApiError(`HTTP ${res.status}`);
  return res.text();
};

/** 한 구(LAWD_CD)의 한 달(YYYYMM) 거래를 모두 가져옵니다 */
export async function fetchMonth(opts: {
  baseUrl: string;
  serviceKey: string;
  lawdCd: string;
  ymd: string;
  fetcher?: Fetcher;
  pageSize?: number;
}): Promise<Deal[]> {
  const fetcher = opts.fetcher ?? defaultFetcher;
  const pageSize = opts.pageSize ?? 1000;
  const out: Deal[] = [];
  for (let page = 1; page <= 50; page++) {
    const q = new URLSearchParams({
      serviceKey: opts.serviceKey,
      LAWD_CD: opts.lawdCd,
      DEAL_YMD: opts.ymd,
      pageNo: String(page),
      numOfRows: String(pageSize),
    });
    const { items, totalCount } = parseResponse(await fetcher(`${opts.baseUrl}?${q}`));
    out.push(...items);
    if (page * pageSize >= totalCount || items.length === 0) break;
  }
  return out;
}
