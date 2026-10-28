import Database from 'better-sqlite3';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

export type DB = Database.Database;

export function openDb(path: string): DB {
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
  const db = new Database(path);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  migrate(db);
  return db;
}

function migrate(db: DB) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS complexes (
      apt_seq     TEXT PRIMARY KEY,
      name        TEXT NOT NULL,
      sgg_cd      TEXT NOT NULL,
      umd_name    TEXT NOT NULL,
      build_year  INTEGER
    );
    CREATE INDEX IF NOT EXISTS complexes_name ON complexes(name);

    CREATE TABLE IF NOT EXISTS deals (
      id            TEXT PRIMARY KEY,
      apt_seq       TEXT NOT NULL REFERENCES complexes(apt_seq),
      sgg_cd        TEXT NOT NULL,
      area          REAL NOT NULL,
      area_key      INTEGER NOT NULL,
      floor         INTEGER,
      amount        INTEGER NOT NULL,
      deal_date     TEXT NOT NULL,
      dealing_type  TEXT NOT NULL,
      buyer_type    TEXT NOT NULL,
      seller_type   TEXT NOT NULL,
      cancelled     INTEGER NOT NULL DEFAULT 0,
      cancel_date   TEXT,
      is_record     INTEGER NOT NULL DEFAULT 0,
      prev_amount   INTEGER,
      first_seen_at TEXT NOT NULL,
      backfilled    INTEGER NOT NULL DEFAULT 0
    );
    CREATE INDEX IF NOT EXISTS deals_seen ON deals(first_seen_at DESC);
    CREATE INDEX IF NOT EXISTS deals_apt ON deals(apt_seq, area_key, deal_date);
    CREATE INDEX IF NOT EXISTS deals_sgg_date ON deals(sgg_cd, deal_date);

    CREATE TABLE IF NOT EXISTS devices (
      install_id  TEXT PRIMARY KEY,
      push_token  TEXT,
      prefs       TEXT NOT NULL DEFAULT '{}',
      created_at  TEXT NOT NULL,
      updated_at  TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS watches (
      install_id  TEXT NOT NULL REFERENCES devices(install_id) ON DELETE CASCADE,
      kind        TEXT NOT NULL CHECK (kind IN ('complex','sgg')),
      target      TEXT NOT NULL,
      PRIMARY KEY (install_id, kind, target)
    );

    CREATE TABLE IF NOT EXISTS inbox (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      install_id  TEXT NOT NULL REFERENCES devices(install_id) ON DELETE CASCADE,
      kind        TEXT NOT NULL,
      title       TEXT NOT NULL,
      body        TEXT NOT NULL,
      apt_seq     TEXT,
      created_at  TEXT NOT NULL,
      pushed      INTEGER NOT NULL DEFAULT 0
    );
    CREATE INDEX IF NOT EXISTS inbox_dev ON inbox(install_id, id DESC);

    CREATE TABLE IF NOT EXISTS meta (
      key   TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);
}

export function getMeta(db: DB, key: string): string | null {
  const row = db.prepare('SELECT value FROM meta WHERE key = ?').get(key) as { value: string } | undefined;
  return row?.value ?? null;
}

export function setMeta(db: DB, key: string, value: string) {
  db.prepare('INSERT INTO meta(key, value) VALUES(?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').run(
    key,
    value,
  );
}
