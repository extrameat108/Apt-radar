import { Expo, type ExpoPushMessage } from 'expo-server-sdk';
import type { DB } from './db.js';
import type { DealEvent } from './ingest.js';
import { guName } from './regions.js';
import { formatWon, isQuietHour } from './time.js';

export interface Prefs {
  /** 관심 단지·지역 신고가 알림 */
  record: boolean;
  /** 관심 단지의 모든 신규 거래 */
  complexAll: boolean;
  /** 관심 단지 거래 해제 */
  cancel: boolean;
  /** 월요일 아침 관심 지역 주간 요약 */
  weekly: boolean;
  /** 22:00~07:00 푸시 보류(아침에 모아서) */
  quiet: boolean;
}

export const DEFAULT_PREFS: Prefs = { record: true, complexAll: true, cancel: true, weekly: false, quiet: true };

export function readPrefs(json: string | null | undefined): Prefs {
  try {
    return { ...DEFAULT_PREFS, ...(json ? JSON.parse(json) : {}) };
  } catch {
    return { ...DEFAULT_PREFS };
  }
}

export interface Notice {
  kind: 'record' | 'new' | 'cancel' | 'weekly';
  title: string;
  body: string;
  aptSeq: string | null;
}

function shortDate(iso: string): string {
  const [, m, d] = iso.split('-');
  return `${Number(m)}월 ${Number(d)}일`;
}

export function describeEvent(e: DealEvent): Notice {
  const d = e.deal;
  const area = `${d.areaKey}㎡`;
  const floor = d.floor !== null ? ` · ${d.floor}층` : '';
  if (e.kind === 'cancel') {
    return {
      kind: 'cancel',
      title: `거래 해제 · ${d.aptName} ${area}`,
      body: `${shortDate(d.dealDate)} 계약 ${formatWon(d.amount)} 거래가 해제 신고됐어요`,
      aptSeq: d.aptSeq,
    };
  }
  const diff =
    e.prevAmount !== null && e.prevAmount !== d.amount
      ? ` (직전 ${formatWon(e.prevAmount)}, ${d.amount > e.prevAmount ? '▲' : '▼'}${formatWon(Math.abs(d.amount - e.prevAmount))})`
      : '';
  return {
    kind: e.isRecord ? 'record' : 'new',
    title: `${e.isRecord ? '신고가' : '새 거래'} · ${d.aptName} ${area}`,
    body: `${formatWon(d.amount)}${diff}${floor} · ${shortDate(d.dealDate)} 계약`,
    aptSeq: d.aptSeq,
  };
}

/** 이벤트를 관심 등록한 기기별 알림함에 넣습니다 */
export function routeEvents(db: DB, events: DealEvent[], now: Date = new Date()): number {
  if (events.length === 0) return 0;
  const devices = db.prepare('SELECT install_id, prefs FROM devices').all() as { install_id: string; prefs: string }[];
  const watchStmt = db.prepare('SELECT kind, target FROM watches WHERE install_id = ?');
  const add = db.prepare(
    'INSERT INTO inbox(install_id, kind, title, body, apt_seq, created_at) VALUES(?, ?, ?, ?, ?, ?)',
  );
  let count = 0;
  db.transaction(() => {
    for (const dev of devices) {
      const prefs = readPrefs(dev.prefs);
      const watches = watchStmt.all(dev.install_id) as { kind: string; target: string }[];
      if (watches.length === 0) continue;
      const complexes = new Set(watches.filter((w) => w.kind === 'complex').map((w) => w.target));
      const sggs = new Set(watches.filter((w) => w.kind === 'sgg').map((w) => w.target));
      for (const e of events) {
        const watchingComplex = complexes.has(e.deal.aptSeq);
        const watchingSgg = sggs.has(e.deal.sggCd);
        let send = false;
        if (e.kind === 'cancel') send = watchingComplex && prefs.cancel;
        else if (watchingComplex) send = prefs.complexAll || (e.isRecord && prefs.record);
        else if (watchingSgg) send = e.isRecord && prefs.record;
        if (!send) continue;
        const n = describeEvent(e);
        add.run(dev.install_id, n.kind, n.title, n.body, n.aptSeq, now.toISOString());
        count++;
      }
    }
  })();
  return count;
}

/** 지난 7일 관심 지역 요약을 알림함에 넣습니다 */
export function routeWeekly(db: DB, now: Date = new Date()): number {
  const since = new Date(now.getTime() - 7 * 86400_000).toISOString();
  const devices = db.prepare('SELECT install_id, prefs FROM devices').all() as { install_id: string; prefs: string }[];
  const sggOf = db.prepare("SELECT target FROM watches WHERE install_id = ? AND kind = 'sgg'");
  const stat = db.prepare(
    `SELECT COUNT(*) AS n, SUM(is_record) AS r FROM deals
     WHERE sgg_cd = ? AND first_seen_at >= ? AND backfilled = 0 AND cancelled = 0`,
  );
  const add = db.prepare(
    "INSERT INTO inbox(install_id, kind, title, body, apt_seq, created_at) VALUES(?, 'weekly', ?, ?, NULL, ?)",
  );
  let count = 0;
  db.transaction(() => {
    for (const dev of devices) {
      if (!readPrefs(dev.prefs).weekly) continue;
      const lines = (sggOf.all(dev.install_id) as { target: string }[]).map((w) => {
        const s = stat.get(w.target, since) as { n: number; r: number | null };
        return `${guName(w.target)} ${s.n}건(신고가 ${s.r ?? 0})`;
      });
      if (lines.length === 0) continue;
      add.run(dev.install_id, '지난주 관심 지역 거래', lines.join(' · '), now.toISOString());
      count++;
    }
  })();
  return count;
}

export type PushSender = (messages: ExpoPushMessage[]) => Promise<{ invalidTokens: string[] }>;

export function expoSender(accessToken?: string): PushSender {
  const expo = new Expo({ accessToken });
  return async (messages) => {
    const invalidTokens: string[] = [];
    for (const chunk of expo.chunkPushNotifications(messages)) {
      try {
        const tickets = await expo.sendPushNotificationsAsync(chunk);
        tickets.forEach((t, i) => {
          if (t.status === 'error' && t.details?.error === 'DeviceNotRegistered') {
            invalidTokens.push(String(chunk[i].to));
          }
        });
      } catch (e) {
        console.error('[push] 전송 실패', (e as Error).message);
      }
    }
    return { invalidTokens };
  };
}

/**
 * 알림함에서 아직 푸시하지 않은 항목을 기기별로 보냅니다.
 * 1건이면 그대로, 여러 건이면 한 번에 요약해서 보내 알림 폭주를 막습니다.
 */
export async function flushPushes(db: DB, send: PushSender, now: Date = new Date()): Promise<number> {
  const rows = db
    .prepare(
      `SELECT i.id, i.install_id, i.title, i.body, i.apt_seq, d.push_token, d.prefs
       FROM inbox i JOIN devices d ON d.install_id = i.install_id
       WHERE i.pushed = 0 ORDER BY i.id`,
    )
    .all() as {
    id: number;
    install_id: string;
    title: string;
    body: string;
    apt_seq: string | null;
    push_token: string | null;
    prefs: string;
  }[];

  const byDevice = new Map<string, typeof rows>();
  for (const r of rows) {
    if (!byDevice.has(r.install_id)) byDevice.set(r.install_id, []);
    byDevice.get(r.install_id)!.push(r);
  }

  const quiet = isQuietHour(now);
  const messages: ExpoPushMessage[] = [];
  const done: number[] = [];
  for (const items of byDevice.values()) {
    const head = items[0];
    const token = head.push_token;
    if (!token || !Expo.isExpoPushToken(token)) {
      done.push(...items.map((i) => i.id)); // 푸시를 못 받는 기기는 알림함에만 둡니다
      continue;
    }
    if (quiet && readPrefs(head.prefs).quiet) continue; // 아침에 모아서 보냅니다
    if (items.length === 1) {
      messages.push({ to: token, title: head.title, body: head.body, sound: 'default', data: { aptSeq: head.apt_seq } });
    } else {
      messages.push({
        to: token,
        title: `관심 단지·지역 소식 ${items.length}건`,
        body: items
          .slice(0, 3)
          .map((i) => i.title)
          .join('\n'),
        sound: 'default',
        data: { screen: 'alerts' },
      });
    }
    done.push(...items.map((i) => i.id));
  }

  if (messages.length > 0) {
    const { invalidTokens } = await send(messages);
    if (invalidTokens.length) {
      const clear = db.prepare('UPDATE devices SET push_token = NULL WHERE push_token = ?');
      for (const t of invalidTokens) clear.run(t);
    }
  }
  const mark = db.prepare('UPDATE inbox SET pushed = 1 WHERE id = ?');
  db.transaction(() => done.forEach((id) => mark.run(id)))();
  return messages.length;
}
