/** 서버 주소: 빌드 시 EXPO_PUBLIC_API_URL로 지정 (app/.env 참고) */
export const API_URL = (process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:8080').replace(/\/$/, '');

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      ...init,
      // 본문이 없는 요청에 JSON 헤더를 붙이면 서버가 400을 돌려줍니다
      headers: init?.body ? { 'Content-Type': 'application/json' } : undefined,
    });
  } catch {
    throw new ApiError(0, '서버에 연결할 수 없어요. 인터넷 연결을 확인해 주세요.');
  }
  if (!res.ok) throw new ApiError(res.status, `요청 실패 (${res.status})`);
  return res.json() as Promise<T>;
}

export interface Deal {
  id: string;
  aptSeq: string;
  name: string;
  sggCd: string;
  gu: string;
  dong: string;
  area: number;
  areaKey: number;
  floor: number | null;
  amount: number;
  dealDate: string;
  dealingType: string;
  cancelled: boolean;
  cancelDate: string | null;
  isRecord: boolean;
  prevAmount: number | null;
  seenAt: string;
  isNew: boolean;
}

export interface Region {
  code: string;
  name: string;
}

export interface Summary {
  todayCount: number;
  todayRecords: number;
  lastIngestAt: string | null;
  ticker: Deal[];
}

export interface Complex {
  aptSeq: string;
  name: string;
  sggCd: string;
  gu: string;
  dong: string;
  buildYear: number | null;
  areas: { areaKey: number; count: number; maxAmount: number }[];
  areaKey: number | null;
  deals: Deal[];
  monthly: { ym: string; max: number; avg: number; count: number }[];
}

export interface Stats {
  sggCd: string;
  gu: string;
  ym: string;
  total: number;
  prevTotal: number;
  cancelled: number;
  records: number;
  median: number | null;
  buyerTypes: { label: string; count: number }[];
  dealingTypes: { label: string; count: number }[];
  top: Deal[];
  volume: { ym: string; count: number }[];
}

export interface SearchHit {
  aptSeq: string;
  name: string;
  gu: string;
  sggCd: string;
  dong: string;
  buildYear: number | null;
  lastAmount: number | null;
}

export interface Prefs {
  record: boolean;
  complexAll: boolean;
  cancel: boolean;
  weekly: boolean;
  quiet: boolean;
}

export interface Watch {
  kind: 'complex' | 'sgg';
  target: string;
  label: string;
}

export interface DeviceState {
  installId: string;
  hasPushToken: boolean;
  prefs: Prefs;
  watches: Watch[];
}

export interface InboxItem {
  id: number;
  kind: 'record' | 'new' | 'cancel' | 'weekly';
  title: string;
  body: string;
  aptSeq: string | null;
  createdAt: string;
}

const qs = (o: Record<string, string | number | undefined>) => {
  const p = Object.entries(o).filter(([, v]) => v !== undefined && v !== '');
  return p.length ? `?${new URLSearchParams(p.map(([k, v]) => [k, String(v)]))}` : '';
};

export const api = {
  regions: () => request<Region[]>('/regions'),
  summary: (sgg?: string) => request<Summary>(`/summary${qs({ sgg })}`),
  feed: (p: { sgg?: string; records?: boolean; offset?: number }) =>
    request<{ items: Deal[]; nextOffset: number | null }>(
      `/feed${qs({ sgg: p.sgg, records: p.records ? '1' : undefined, offset: p.offset })}`,
    ),
  complex: (aptSeq: string, area?: number) =>
    request<Complex>(`/complexes/${encodeURIComponent(aptSeq)}${qs({ area })}`),
  stats: (sgg: string, ym?: string) => request<Stats>(`/stats/${sgg}${qs({ ym })}`),
  search: (q: string) => request<SearchHit[]>(`/search${qs({ q })}`),
  registerDevice: (installId: string, pushToken?: string | null) =>
    request<DeviceState>('/devices', { method: 'POST', body: JSON.stringify({ installId, pushToken }) }),
  setPrefs: (installId: string, prefs: Partial<Prefs>) =>
    request<DeviceState>(`/devices/${installId}/prefs`, { method: 'PUT', body: JSON.stringify(prefs) }),
  addWatch: (installId: string, kind: Watch['kind'], target: string) =>
    request<DeviceState>(`/devices/${installId}/watches`, { method: 'POST', body: JSON.stringify({ kind, target }) }),
  removeWatch: (installId: string, kind: Watch['kind'], target: string) =>
    request<DeviceState>(`/devices/${installId}/watches${qs({ kind, target })}`, { method: 'DELETE' }),
  inbox: (installId: string) => request<InboxItem[]>(`/devices/${installId}/inbox`),
};
