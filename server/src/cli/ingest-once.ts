/** 수동 1회 수집: npm run ingest */
import { config } from '../config.js';
import { openDb } from '../db.js';
import { tick } from '../jobs.js';
import { expoSender } from '../notify.js';

if (!config.molitKey) {
  console.error('MOLIT_SERVICE_KEY 환경변수를 설정하세요.');
  process.exit(1);
}
const db = openDb(config.dbPath);
await tick({ db, send: expoSender(config.expoAccessToken) });
db.close();
