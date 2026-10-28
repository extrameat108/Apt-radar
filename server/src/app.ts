import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import Fastify from 'fastify';
import { z } from 'zod';
import type { DB } from './db.js';
import { getMeta } from './db.js';
import { readPrefs } from './notify.js';
import { guName, SEOUL_GU } from './regions.js';
import { kstStartOfDayIso, kstYmd } from './time.js';

const installId = z.string().regex(/^[A-Za-z0-9-]{8,64}$/);
const sggCode = z.string().regex(/^\d{5}$/);

const prefsSchema = z
  .object({
    record: z.boolean(),
    complexAll: z.boolean(),
    cancel: z.boolean(),
    weekly: z.boolean(),
    quiet: z.boolean(),
  })
  .partial();

interface DealRow {
  id: string;
  apt_seq: string;
  name: string;
  sgg_cd: string;
  umd_name: string;
  area: number;
  area_key: number;
  floor: number | null;
  amount: number;
  deal_date: string;
  dealing_type: string;
  cancelled: number;
  cancel_date: string | null;
  is_record: number;
  prev_amount: number | null;
  first_seen_at: string;
  backfilled: number;
}

function toDeal(r: DealRow) {
  return {
    id: r.id,
    aptSeq: r.apt_seq,
    name: r.name,
    sggCd: r.sgg_cd,
    gu: guName(r.sgg_cd),
    dong: r.umd_name,
    area: r.area,
    areaKey: r.area_key,
    floor: r.floor,
    amount: r.amount,
    dealDate: r.deal_date,
    dealingType: r.dealing_type,
    cancelled: !!r.cancelled,
    cancelDate: r.cancel_date,
    isRecord: !!r.is_record,
    prevAmount: r.prev_amount,
    seenAt: r.first_seen_at,
    isNew: !r.backfilled,
  };
}

const DEAL_COLS = `d.id, d.apt_seq, c.name, d.sgg_cd, c.umd_name, d.area, d.area_key, d.floor, d.amount, d.deal_date,
  d.dealing_type, d.cancelled, d.cancel_date, d.is_record, d.prev_amount, d.first_seen_at, d.backfilled`;

export function buildApp(db: DB, opts: { logger?: boolean } = {}) {
  const app = Fastify({ logger: opts.logger ?? false });
  app.register(cors, { origin: true });
  app.register(rateLimit, { max: 300, timeWindow: '1 minute' });

  app.get('/health', async () => ({ ok: true, lastIngestAt: getMeta(db, 'last_ingest_at') }));

  app.get('/regions', async () => SEOUL_GU);

  app.get('/summary', async (req) => {
    const q = z.object({ sgg: sggCode.optional() }).parse(req.query);
    const since = kstStartOfDayIso();
    const where = q.sgg ? 'AND d.sgg_cd = ?' : '';
    const args = q.sgg ? [since, q.sgg] : [since];
    const today = db
      .prepare(
        `SELECT COUNT(*) AS n, COALESCE(SUM(d.is_record), 0) AS r FROM deals d
         WHERE d.first_seen_at >= ? AND d.backfilled = 0 AND d.cancelled = 0 ${where}`,
      )
      .get(...args) as { n: number; r: number };
    const ticker = db
      .prepare(
        `SELECT ${DEAL_COLS} FROM deals d JOIN complexes c ON c.apt_seq = d.apt_seq
         WHERE d.is_record = 1 AND d.cancelled = 0 ${q.sgg ? 'AND d.sgg_cd = ?' : ''}
         ORDER BY d.first_seen_at DESC, d.deal_date DESC LIMIT 10`,
      )
      .all(...(q.sgg ? [q.sgg] : [])) as DealRow[];
    return {
      todayCount: today.n,
      todayRecords: today.r,
      lastIngestAt: getMeta(db, 'last_ingest_at'),
      ticker: ticker.map(toDeal),
    };
  });

  app.get('/feed', async (req) => {
    const q = z
      .object({
        sgg: sggCode.optional(),
        records: z.enum(['0', '1']).optional(),
        offset: z.coerce.number().int().min(0).max(5000).default(0),
        limit: z.coerce.number().int().min(1).max(50).default(30),
      })
      .parse(req.query);
    const conds = ['d.cancelled = 0'];
    const args: (string | number)[] = [];
    if (q.sgg) {
      conds.push('d.sgg_cd = ?');
      args.push(q.sgg);
    }
    if (q.records === '1') conds.push('d.is_record = 1');
    const rows = db
      .prepare(
        `SELECT ${DEAL_COLS} FROM deals d JOIN complexes c ON c.apt_seq = d.apt_seq
         WHERE ${conds.join(' AND ')}
         ORDER BY d.first_seen_at DESC, d.deal_date DESC, d.id LIMIT ? OFFSET ?`,
      )
      .all(...args, q.limit, q.offset) as DealRow[];
    return { items: rows.map(toDeal), nextOffset: rows.length === q.limit ? q.offset + q.limit : null };
  });

  app.get('/search', async (req) => {
    const q = z.object({ q: z.string().trim().min(1).max(40) }).parse(req.query);
    const like = `%${q.q.replace(/[%_]/g, '')}%`;
    const rows = db
      .prepare(
        `SELECT c.apt_seq, c.name, c.sgg_cd, c.umd_name, c.build_year,
           (SELECT amount FROM deals WHERE apt_seq = c.apt_seq AND cancelled = 0 ORDER BY deal_date DESC LIMIT 1) AS last_amount
         FROM complexes c WHERE c.name LIKE ? OR c.umd_name LIKE ? ORDER BY c.name LIMIT 30`,
      )
      .all(like, like) as {
      apt_seq: string;
      name: string;
      sgg_cd: string;
      umd_name: string;
      build_year: number | null;
      last_amount: number | null;
    }[];
    return rows.map((r) => ({
      aptSeq: r.apt_seq,
      name: r.name,
      gu: guName(r.sgg_cd),
      sggCd: r.sgg_cd,
      dong: r.umd_name,
      buildYear: r.build_year,
      lastAmount: r.last_amount,
    }));
  });

  app.get('/complexes/:aptSeq', async (req, reply) => {
    const { aptSeq } = z.object({ aptSeq: z.string().min(1).max(40) }).parse(req.params);
    const q = z.object({ area: z.coerce.number().int().optional() }).parse(req.query);
    const c = db.prepare('SELECT * FROM complexes WHERE apt_seq = ?').get(aptSeq) as
      | { apt_seq: string; name: string; sgg_cd: string; umd_name: string; build_year: number | null }
      | undefined;
    if (!c) return reply.code(404).send({ error: 'not_found' });

    const areas = db
      .prepare(
        `SELECT area_key AS areaKey, COUNT(*) AS count, MAX(amount) AS maxAmount
         FROM deals WHERE apt_seq = ? AND cancelled = 0 GROUP BY area_key ORDER BY count DESC`,
      )
      .all(aptSeq) as { areaKey: number; count: number; maxAmount: number }[];
    const areaKey = q.area ?? areas[0]?.areaKey ?? null;
    areas.sort((a, b) => a.areaKey - b.areaKey);

    const deals =
      areaKey === null
        ? []
        : (db
            .prepare(
              `SELECT ${DEAL_COLS} FROM deals d JOIN complexes c ON c.apt_seq = d.apt_seq
               WHERE d.apt_seq = ? AND d.area_key = ? ORDER BY d.deal_date DESC, d.first_seen_at DESC LIMIT 100`,
            )
            .all(aptSeq, areaKey) as DealRow[]);

    const monthly =
      areaKey === null
        ? []
        : (db
            .prepare(
              `SELECT substr(deal_date, 1, 7) AS ym, MAX(amount) AS max, CAST(AVG(amount) AS INTEGER) AS avg, COUNT(*) AS count
               FROM deals WHERE apt_seq = ? AND area_key = ? AND cancelled = 0 GROUP BY ym ORDER BY ym`,
            )
            .all(aptSeq, areaKey) as { ym: string; max: number; avg: number; count: number }[]);

    return {
      aptSeq: c.apt_seq,
      name: c.name,
      sggCd: c.sgg_cd,
      gu: guName(c.sgg_cd),
      dong: c.umd_name,
      buildYear: c.build_year,
      areas,
      areaKey,
      deals: deals.map(toDeal),
      monthly,
    };
  });

  app.get('/stats/:sgg', async (req) => {
    const { sgg } = z.object({ sgg: sggCode }).parse(req.params);
    const q = z.object({ ym: z.string().regex(/^\d{6}$/).optional() }).parse(req.query);
    const ym = q.ym ?? kstYmd(1); // 기본값: 지난달 (이번 달은 아직 신고가 덜 들어옴)
    const ymDash = `${ym.slice(0, 4)}-${ym.slice(4)}`;
    const prev = (() => {
      const y = Number(ym.slice(0, 4));
      const m = Number(ym.slice(4));
      const idx = y * 12 + m - 2;
      return `${Math.floor(idx / 12)}-${String((idx % 12) + 1).padStart(2, '0')}`;
    })();
    const base = `FROM deals WHERE sgg_cd = ? AND substr(deal_date, 1, 7) = ?`;
    const totals = (m: string) =>
      db
        .prepare(
          `SELECT SUM(cancelled = 0) AS total, SUM(cancelled = 1) AS cancelled, SUM(is_record) AS records ${base}`,
        )
        .get(sgg, m) as { total: number | null; cancelled: number | null; records: number | null };
    const group = (col: string) =>
      db
        .prepare(`SELECT ${col} AS label, COUNT(*) AS count ${base} AND cancelled = 0 GROUP BY ${col} ORDER BY count DESC`)
        .all(sgg, ymDash) as { label: string; count: number }[];
    const amounts = (
      db.prepare(`SELECT amount ${base} AND cancelled = 0 ORDER BY amount`).all(sgg, ymDash) as { amount: number }[]
    ).map((r) => r.amount);
    const median = amounts.length ? amounts[Math.floor(amounts.length / 2)] : null;
    const top = db
      .prepare(
        `SELECT ${DEAL_COLS} FROM deals d JOIN complexes c ON c.apt_seq = d.apt_seq
         WHERE d.sgg_cd = ? AND substr(d.deal_date, 1, 7) = ? AND d.cancelled = 0 ORDER BY d.amount DESC LIMIT 5`,
      )
      .all(sgg, ymDash) as DealRow[];
    const volume = db
      .prepare(
        `SELECT substr(deal_date, 1, 7) AS ym, SUM(cancelled = 0) AS count FROM deals
         WHERE sgg_cd = ? AND deal_date >= date(?, '-11 months') AND substr(deal_date, 1, 7) <= ?
         GROUP BY ym ORDER BY ym`,
      )
      .all(sgg, `${ymDash}-01`, ymDash) as { ym: string; count: number }[];
    const cur = totals(ymDash);
    const before = totals(prev);
    return {
      sggCd: sgg,
      gu: guName(sgg),
      ym: ymDash,
      total: cur.total ?? 0,
      prevTotal: before.total ?? 0,
      cancelled: cur.cancelled ?? 0,
      records: cur.records ?? 0,
      median,
      buyerTypes: group('buyer_type').map((g) => ({ ...g, label: g.label || '미공개' })),
      dealingTypes: group('dealing_type').map((g) => ({ ...g, label: g.label || '미공개' })),
      top: top.map(toDeal),
      volume,
    };
  });

  // ---- 기기 등록 · 관심 목록 · 알림함 ----

  app.post('/devices', async (req) => {
    const body = z
      .object({ installId, pushToken: z.string().max(200).nullable().optional(), prefs: prefsSchema.optional() })
      .parse(req.body);
    const now = new Date().toISOString();
    const existing = db.prepare('SELECT prefs FROM devices WHERE install_id = ?').get(body.installId) as
      | { prefs: string }
      | undefined;
    const prefs = { ...readPrefs(existing?.prefs), ...(body.prefs ?? {}) };
    db.prepare(
      `INSERT INTO devices(install_id, push_token, prefs, created_at, updated_at) VALUES(?, ?, ?, ?, ?)
       ON CONFLICT(install_id) DO UPDATE SET
         push_token = COALESCE(excluded.push_token, devices.push_token), prefs = excluded.prefs, updated_at = excluded.updated_at`,
    ).run(body.installId, body.pushToken ?? null, JSON.stringify(prefs), now, now);
    return deviceState(db, body.installId);
  });

  app.get('/devices/:id', async (req, reply) => {
    const { id } = z.object({ id: installId }).parse(req.params);
    const s = deviceState(db, id);
    if (!s) return reply.code(404).send({ error: 'not_found' });
    return s;
  });

  app.put('/devices/:id/prefs', async (req, reply) => {
    const { id } = z.object({ id: installId }).parse(req.params);
    const patch = prefsSchema.parse(req.body);
    const row = db.prepare('SELECT prefs FROM devices WHERE install_id = ?').get(id) as { prefs: string } | undefined;
    if (!row) return reply.code(404).send({ error: 'not_found' });
    const prefs = { ...readPrefs(row.prefs), ...patch };
    db.prepare('UPDATE devices SET prefs = ?, updated_at = ? WHERE install_id = ?').run(
      JSON.stringify(prefs),
      new Date().toISOString(),
      id,
    );
    return deviceState(db, id);
  });

  const watchBody = z.object({ kind: z.enum(['complex', 'sgg']), target: z.string().min(1).max(40) });

  app.post('/devices/:id/watches', async (req, reply) => {
    const { id } = z.object({ id: installId }).parse(req.params);
    const w = watchBody.parse(req.body);
    if (!db.prepare('SELECT 1 FROM devices WHERE install_id = ?').get(id)) return reply.code(404).send({ error: 'not_found' });
    const n = (db.prepare('SELECT COUNT(*) AS n FROM watches WHERE install_id = ?').get(id) as { n: number }).n;
    if (n >= 50) return reply.code(400).send({ error: 'too_many_watches' });
    db.prepare('INSERT OR IGNORE INTO watches(install_id, kind, target) VALUES(?, ?, ?)').run(id, w.kind, w.target);
    return deviceState(db, id);
  });

  app.delete('/devices/:id/watches', async (req) => {
    const { id } = z.object({ id: installId }).parse(req.params);
    const w = watchBody.parse(req.query);
    db.prepare('DELETE FROM watches WHERE install_id = ? AND kind = ? AND target = ?').run(id, w.kind, w.target);
    return deviceState(db, id);
  });

  app.get('/devices/:id/inbox', async (req) => {
    const { id } = z.object({ id: installId }).parse(req.params);
    const rows = db
      .prepare(
        'SELECT id, kind, title, body, apt_seq AS aptSeq, created_at AS createdAt FROM inbox WHERE install_id = ? ORDER BY id DESC LIMIT 50',
      )
      .all(id);
    return rows;
  });

  app.setErrorHandler((err, _req, reply) => {
    if (err instanceof z.ZodError) return reply.code(400).send({ error: 'bad_request', issues: err.issues });
    const status = (err as { statusCode?: number }).statusCode ?? 500;
    if (status >= 500) app.log.error(err);
    return reply.code(status).send({ error: status >= 500 ? 'internal_error' : (err as Error).message });
  });

  return app;
}

function deviceState(db: DB, id: string) {
  const d = db.prepare('SELECT install_id, push_token, prefs FROM devices WHERE install_id = ?').get(id) as
    | { install_id: string; push_token: string | null; prefs: string }
    | undefined;
  if (!d) return null;
  const watches = db.prepare('SELECT kind, target FROM watches WHERE install_id = ? ORDER BY rowid').all(id) as {
    kind: 'complex' | 'sgg';
    target: string;
  }[];
  const names = db.prepare('SELECT name FROM complexes WHERE apt_seq = ?');
  return {
    installId: d.install_id,
    hasPushToken: !!d.push_token,
    prefs: readPrefs(d.prefs),
    watches: watches.map((w) => ({
      ...w,
      label: w.kind === 'sgg' ? guName(w.target) : ((names.get(w.target) as { name: string } | undefined)?.name ?? w.target),
    })),
  };
}
