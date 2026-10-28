import { config } from './config.js';
import type { DB } from './db.js';
import { getMeta, setMeta } from './db.js';
import { runBackfillIfNeeded, runIngest } from './ingest.js';
import type { Fetcher } from './molit.js';
import { flushPushes, type PushSender, routeEvents, routeWeekly } from './notify.js';
import { kstParts } from './time.js';

export interface JobDeps {
  db: DB;
  send: PushSender;
  fetcher?: Fetcher;
  log?: (msg: string) => void;
}

function ingestOpts(deps: JobDeps) {
  return {
    baseUrl: config.molitBaseUrl,
    serviceKey: config.molitKey,
    regions: config.regions,
    fetcher: deps.fetcher,
    log: deps.log,
  };
}

/** 한 번의 수집 → 알림함 분배 → 푸시 전송 */
export async function tick(deps: JobDeps, now: Date = new Date()) {
  const log = deps.log ?? console.log;
  const events = await runIngest(deps.db, { ...ingestOpts(deps), now });
  const routed = routeEvents(deps.db, events, now);

  // 월요일 9시 이후 첫 실행에서 주간 요약
  const k = kstParts(now);
  const weekday = new Date(Date.UTC(k.y, k.m - 1, k.day)).getUTCDay();
  const todayKey = `${k.y}-${k.m}-${k.day}`;
  if (weekday === 1 && k.hour >= 9 && getMeta(deps.db, 'weekly_sent') !== todayKey) {
    routeWeekly(deps.db, now);
    setMeta(deps.db, 'weekly_sent', todayKey);
  }

  const pushed = await flushPushes(deps.db, deps.send, now);
  log(`[tick] 새 이벤트 ${events.length}, 알림함 ${routed}, 푸시 ${pushed}`);
}

export function startScheduler(deps: JobDeps) {
  const log = deps.log ?? console.log;
  let running = false;
  const run = async () => {
    if (running) return;
    running = true;
    try {
      if (await runBackfillIfNeeded(deps.db, { ...ingestOpts(deps), months: config.backfillMonths })) {
        log('[backfill] 과거 거래 채우기 완료');
      }
      await tick(deps);
    } catch (e) {
      log(`[scheduler] 오류: ${(e as Error).message}`);
    } finally {
      running = false;
    }
  };
  void run();
  return setInterval(run, config.ingestIntervalMin * 60_000);
}
