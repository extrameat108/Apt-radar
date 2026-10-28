/** 과거 거래 채우기: npm run backfill (이미 했으면 FORCE=1로 다시) */
import { config } from '../config.js';
import { openDb, setMeta } from '../db.js';
import { runBackfillIfNeeded } from '../ingest.js';

if (!config.molitKey) {
  console.error('MOLIT_SERVICE_KEY 환경변수를 설정하세요.');
  process.exit(1);
}
const db = openDb(config.dbPath);
if (process.env.FORCE === '1') db.prepare("DELETE FROM meta WHERE key = 'backfill_done'").run();
await runBackfillIfNeeded(db, {
  baseUrl: config.molitBaseUrl,
  serviceKey: config.molitKey,
  regions: config.regions,
  months: config.backfillMonths,
});
setMeta(db, 'last_backfill_cli', new Date().toISOString());
db.close();
