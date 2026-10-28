/**
 * 인증키 없이 앱 화면을 확인하기 위한 가짜 데이터 생성: npm run seed:demo
 * 모든 단지 이름에 [데모]가 붙고, 기본으로 data/demo.db에만 씁니다. 운영 DB에는 쓰지 마세요.
 */
import { openDb, setMeta } from '../db.js';
import { storeDeals } from '../ingest.js';
import type { Deal } from '../molit.js';

const path = process.env.DB_PATH ?? './data/demo.db';
const db = openDb(path);

const complexes = [
  { aptSeq: 'DEMO-1', aptName: '[데모] 반포 한강하이츠', sggCd: '11650', umdName: '반포동', base: 600000 },
  { aptSeq: 'DEMO-2', aptName: '[데모] 대치 은빛마을', sggCd: '11680', umdName: '대치동', base: 280000 },
  { aptSeq: 'DEMO-3', aptName: '[데모] 잠실 호수파크', sggCd: '11710', umdName: '잠실동', base: 240000 },
  { aptSeq: 'DEMO-4', aptName: '[데모] 압구정 노을빌', sggCd: '11680', umdName: '압구정동', base: 700000 },
  { aptSeq: 'DEMO-5', aptName: '[데모] 서초 숲속마을', sggCd: '11650', umdName: '서초동', base: 180000 },
];
const areas = [59.9, 84.97, 114.5];
const kinds = ['중개거래', '중개거래', '중개거래', '직거래'];
const buyers = ['개인', '개인', '개인', '개인', '법인'];

let seed = 7;
const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

const today = new Date();
const history: Deal[] = [];
const recent: Deal[] = [];
for (const c of complexes) {
  for (const area of areas) {
    const factor = area / 84.97;
    for (let monthsAgo = 24; monthsAgo >= 0; monthsAgo--) {
      const n = 1 + Math.floor(rand() * 3);
      for (let i = 0; i < n; i++) {
        const d = new Date(today.getFullYear(), today.getMonth() - monthsAgo, 1 + Math.floor(rand() * 27));
        if (d > today) continue;
        const trend = 1 + (24 - monthsAgo) * 0.009;
        const amount = Math.round((c.base * factor * trend * (0.95 + rand() * 0.08)) / 100) * 100;
        const dealDate = d.toISOString().slice(0, 10);
        const deal: Deal = {
          id: `${c.aptSeq}|${dealDate}|${i}|${area}`,
          aptSeq: c.aptSeq,
          aptName: c.aptName,
          sggCd: c.sggCd,
          umdName: c.umdName,
          buildYear: 2015,
          area,
          areaKey: Math.round(area),
          floor: 2 + Math.floor(rand() * 25),
          amount,
          dealDate,
          dealingType: kinds[Math.floor(rand() * kinds.length)],
          buyerType: buyers[Math.floor(rand() * buyers.length)],
          sellerType: '개인',
          cancelled: rand() < 0.03,
          cancelDate: null,
        };
        (monthsAgo === 0 && rand() < 0.5 ? recent : history).push(deal);
      }
    }
  }
}
storeDeals(db, history, { backfill: true });
storeDeals(db, recent, { backfill: false });
setMeta(db, 'backfill_done', 'demo');
setMeta(db, 'last_ingest_at', new Date().toISOString());
console.log(`데모 데이터 ${history.length + recent.length}건을 ${path}에 넣었습니다.`);
db.close();
