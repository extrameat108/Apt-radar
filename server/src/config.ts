import { SEOUL_GU } from './regions.js';

function num(name: string, fallback: number): number {
  const v = process.env[name];
  if (v === undefined || v === '') return fallback;
  const n = Number(v);
  if (!Number.isFinite(n)) throw new Error(`${name} must be a number`);
  return n;
}

export const config = {
  port: num('PORT', 8080),
  host: process.env.HOST ?? '0.0.0.0',
  dbPath: process.env.DB_PATH ?? './data/apt-radar.db',
  /** 공공데이터포털에서 발급받은 일반 인증키(Decoding 키) */
  molitKey: process.env.MOLIT_SERVICE_KEY ?? '',
  molitBaseUrl:
    process.env.MOLIT_BASE_URL ??
    'https://apis.data.go.kr/1613000/RTMSDataSvcAptTradeDev/getRTMSDataSvcAptTradeDev',
  /** 수집 대상 시군구 코드 (쉼표 구분). 기본값: 서울 25개 구 */
  regions: (process.env.REGIONS || SEOUL_GU.map((g) => g.code).join(','))
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
  /** 수집 주기(분). 서울 25개 구 기준 1회 약 50~80회 호출 */
  ingestIntervalMin: num('INGEST_INTERVAL_MIN', 60),
  /** 서버 첫 실행 시 과거 몇 개월치를 채울지 (그래프용, 알림 없음) */
  backfillMonths: num('BACKFILL_MONTHS', 60),
  /** 0이면 스케줄러를 끕니다 (테스트·개발용) */
  schedulerEnabled: process.env.SCHEDULER !== '0',
  /** Expo 푸시 액세스 토큰 (선택, Expo 계정에서 푸시 보안 강화 시 필요) */
  expoAccessToken: process.env.EXPO_ACCESS_TOKEN || undefined,
};
