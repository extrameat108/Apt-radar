# 실거래 레이더

서울 아파트 실거래가를 수집해 **새로 신고된 거래와 신고가를 실시간에 가깝게 알려주는** 모바일 앱입니다.

- `server/` — 국토교통부 실거래가 API를 주기적으로 수집하고, 신고가·거래해제를 판정해 Expo 푸시로 알림을 보내는 Node.js 서버 (SQLite)
- `app/` — Expo(React Native) 앱. 실거래 피드, 단지 상세(가격 그래프), 관심단지, 지역 통계, 알림 설정

## 다루는 정보와 다루지 않는 정보

국토부가 공개하는 항목만 사용합니다: 단지·면적·층·계약일·거래금액·거래유형(중개/직거래)·해제 여부, 그리고 매수자/매도자 **구분값**(개인·법인 등).
매수인·매도인 개인을 식별할 수 있는 정보(신상, 대출 내역 등)는 수집하지도, 추정하지도 않습니다.

앱이 서버에 저장하는 사용자 정보는 기기 설치 ID(앱이 임의로 만든 값), 푸시 토큰, 알림 설정, 관심 목록뿐입니다.

## 동작 방식

```
국토부 API ──(매시간: 이번 달·지난달)──▶ 서버 ──▶ SQLite
                                         │  새 거래? 같은 단지·면적 최고가 초과? 해제?
                                         ▼
                              관심 등록한 기기별 알림함 ──▶ Expo 푸시 (여러 건이면 묶어서 1건)
```

- **신고가**: 같은 단지·같은 전용면적(㎡ 반올림)에서, 해제되지 않은 기존 최고가보다 비싼 거래
- **"실시간"의 의미**: 거래는 계약 후 30일 안에 신고되므로, 앱은 *신고되어 공개된 시점* 기준으로 알립니다
- 첫 실행 때 과거 60개월을 채워(알림 없음) 그래프와 신고가 판정 기준을 만듭니다
- 방해 금지(22:00–07:00)를 켠 기기는 밤사이 알림을 아침에 모아서 받습니다

---

## 1. 인증키 발급 (공공데이터포털)

1. [data.go.kr](https://www.data.go.kr) 회원가입
2. **「국토교통부_아파트 매매 실거래가 상세 자료」**(데이터 ID 15126468) 페이지에서 **활용신청**
3. 마이페이지 → 개발계정 → 해당 API의 **일반 인증키(Decoding)** 복사
4. `server/.env`의 `MOLIT_SERVICE_KEY`에 붙여넣기

승인 직후에는 키가 동작하기까지 시간이 걸릴 수 있습니다(`SERVICE_KEY_IS_NOT_REGISTERED_ERROR`가 나오면 잠시 후 다시).
서울 25개 구 기준 첫 백필은 약 1,500회, 이후 매시간 약 50~80회 호출합니다. 개발계정 일일 한도를 넘으면 `INGEST_INTERVAL_MIN`을 늘리거나 `REGIONS`로 지역을 줄이세요.

## 2. 내 컴퓨터에서 먼저 돌려보기 (인증키 없이)

```bash
# 서버: [데모] 표시가 붙은 가짜 데이터로 실행
cd server
npm install
npm run seed:demo      # data/demo.db 생성
npm run dev:demo       # http://localhost:8080

# 앱
cd ../app
npm install
cp .env.example .env   # 실기기라면 localhost 대신 PC의 내부 IP로
npx expo start --web   # 웹에서 화면 확인
```

인증키가 생기면 `server/.env`를 채우고 `npm run dev`로 실제 데이터 수집을 시작합니다.

## 3. 서버 배포

HTTPS 주소와 **영구 디스크**가 있는 곳이면 어디든 됩니다(Fly.io, Railway, Render, 자체 서버 등). `server/Dockerfile`이 준비돼 있습니다. Fly.io 예시:

```bash
cd server
fly launch --no-deploy                 # 앱 이름·지역(nrt 또는 icn) 선택
fly volumes create data --size 1
# fly.toml에 추가:  [mounts] source="data" destination="/data"
fly secrets set MOLIT_SERVICE_KEY=발급받은키
fly deploy
```

서버는 한 대(인스턴스 1개)로 운영하세요. SQLite 파일을 여러 인스턴스가 공유할 수 없습니다.
배포 후 `https://<서버주소>/health`에서 `lastIngestAt`이 채워지면 수집이 돌고 있는 것입니다.

| 환경변수 | 기본값 | 설명 |
|---|---|---|
| `MOLIT_SERVICE_KEY` | (필수) | 공공데이터포털 인증키(Decoding) |
| `DB_PATH` | `./data/apt-radar.db` | SQLite 위치 (Docker는 `/data/apt-radar.db`) |
| `REGIONS` | 서울 25개 구 | 수집할 시군구 코드, 쉼표 구분 |
| `INGEST_INTERVAL_MIN` | 60 | 수집 주기(분) |
| `BACKFILL_MONTHS` | 60 | 첫 실행 시 채울 과거 개월 수 |
| `EXPO_ACCESS_TOKEN` | — | Expo 푸시 보안 강화를 켰을 때만 |

## 4. 앱 빌드와 스토어 출시 (EAS)

푸시 알림 때문에 Expo Go가 아닌 **개발 빌드**가 필요합니다. Xcode/Android Studio 없이 클라우드에서 빌드됩니다.

```bash
cd app
npx eas-cli@latest login
npx eas-cli@latest init          # app.json에 projectId가 추가됩니다 (푸시 토큰 발급에 필요)
```

1. `app.json`의 `ios.bundleIdentifier`, `android.package`를 본인 것으로 변경 (예: `kr.회사명.aptradar`)
2. `eas.json`의 `EXPO_PUBLIC_API_URL` 세 곳을 배포한 서버 주소로 변경
3. 안드로이드 푸시: Firebase 프로젝트를 만들고 FCM V1 서비스 계정 키를 `npx eas-cli credentials`로 등록
   (iOS 푸시 키는 빌드할 때 EAS가 안내에 따라 만들어 줍니다)
4. 빌드
   ```bash
   npx eas-cli build --profile development --platform all   # 내 폰에 설치해 테스트
   npx eas-cli build --profile production --platform all    # 스토어 제출용
   npx eas-cli submit --platform ios                         # App Store Connect로 제출
   npx eas-cli submit --platform android                     # Google Play로 제출
   ```

스토어 심사 전 준비물: 개인정보처리방침 URL(설치 ID·푸시 토큰 수집 사실 명시), 앱 설명에 데이터 출처(국토교통부 실거래가 공개시스템) 표기, 스크린샷.

## 개발

```bash
cd server && npm test && npm run typecheck
cd app && npm run typecheck
```

### 서버 API

| 경로 | 설명 |
|---|---|
| `GET /summary?sgg=` | 오늘 새로 신고된 거래 수, 신고가 수, 최근 신고가 티커 |
| `GET /feed?sgg=&records=1&offset=` | 신고 시점 순 거래 피드 |
| `GET /complexes/:aptSeq?area=` | 단지 정보, 면적별 거래, 월별 최고/평균가 |
| `GET /stats/:sgg?ym=YYYYMM` | 구별 월간 거래량·신고가·매수자 유형·거래유형·최고가 |
| `GET /search?q=` | 단지명·동 검색 |
| `POST /devices` | 기기 등록 `{installId, pushToken?}` |
| `PUT /devices/:id/prefs` | 알림 설정 |
| `POST / DELETE /devices/:id/watches` | 관심 단지(`complex`)·지역(`sgg`) |
| `GET /devices/:id/inbox` | 받은 알림 |

데이터 출처: 국토교통부 실거래가 공개시스템 (공공데이터포털 Open API)
