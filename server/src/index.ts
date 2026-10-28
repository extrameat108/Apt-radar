import { buildApp } from './app.js';
import { config } from './config.js';
import { openDb } from './db.js';
import { startScheduler } from './jobs.js';
import { expoSender } from './notify.js';

const db = openDb(config.dbPath);
const app = buildApp(db, { logger: true });

if (!config.molitKey) {
  app.log.warn('MOLIT_SERVICE_KEY가 비어 있어 실거래 수집을 건너뜁니다. README의 "인증키 발급"을 참고하세요.');
} else if (config.schedulerEnabled) {
  startScheduler({ db, send: expoSender(config.expoAccessToken), log: (m) => app.log.info(m) });
}

await app.listen({ port: config.port, host: config.host });

for (const sig of ['SIGINT', 'SIGTERM'] as const) {
  process.on(sig, async () => {
    await app.close();
    db.close();
    process.exit(0);
  });
}
