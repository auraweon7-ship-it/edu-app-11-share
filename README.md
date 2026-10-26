# 교육 웹앱 10선 링크 배포 웹앱

QR 촬영 → 인적사항 입력(성명·대학·학과·전공·신분·휴대폰, 모두 필수) → **개인정보 수집·이용 동의(필수)** → 웹앱 1개 선택 → 링크 제공.
1회 1개만 받을 수 있고, 매 다운로드는 **Postgres** `download_history` 테이블에 동의 시각(`agreed_at`)과 함께 기록됩니다.
동의하지 않으면 앱 선택 단계로 넘어갈 수 없고, 서버도 동의 없는 요청을 거부합니다.
안내 문구(수집 항목·목적·보유 기간)는 `config.js`의 `PRIVACY`에서 기관 정책에 맞게 수정하세요.

| 파일 | 역할 |
|---|---|
| `index.html` | 대문: 관리자 대시보드 — KPI, 앱별·신분별·일자별·시간대별·대학/학과 Top10 차트, 필터, 히스토리 표, CSV, 배포용 QR |
| `download.html` | 사용자 페이지: 인적사항 → 앱 1개 선택 → 링크 (QR로 접속) |
| `server.js` | Node 서버: 위 페이지 제공 + 히스토리 API (`POST/GET /api/history`) |
| `db/schema.sql` | 테이블 정의 (서버 시작 시 자동 생성) |
| `qr-poster.js` | 배포용 QR 포스터 렌더러 — 중앙 문구(기본 "교수신문"), 포스터/QR만, 라운드/사각, 포인트 색상, PNG·인쇄 (오류 복원 H 등급) |
| `config.js` | 버전, 앱 목록, 개인정보 안내 문구, `API_URL` |
| `style.css`, `common.js` | Soft UI 디자인(웹앱 01 퀴즈 생성기와 동일 톤), 헤더 날짜 |

## 실행

1. Postgres에 DB 생성 (예: `createdb -U postgres edu_app_share`)
2. `.env.example`을 `.env`로 복사하고 `DATABASE_URL`, `ADMIN_KEY` 입력
3. 설치 후 실행 (Node 20.12 이상)

```bash
npm install
npm start
```

4. 대시보드 `http://localhost:8080/` → 관리자 키 입력 → 불러오기
5. 대시보드에서 QR 생성(→ `/download.html`) → PNG 저장 → 배포

참가자 휴대폰에서 접속하려면 서버가 외부에서 접근 가능한 주소(공인 IP·도메인, 또는 Render·Railway·Fly.io 등)에 떠 있어야 합니다.

## API

| 요청 | 설명 |
|---|---|
| `POST /api/history` | `{name, univ, dept, major, role, phone, appId}` 기록. 일시는 DB 서버 시각, 앱 이름은 `config.js` 기준. IP당 분당 30건 제한 |
| `GET /api/history` | 헤더 `x-admin-key: <ADMIN_KEY>` 필요. 최신순 전체 기록 |

## GitHub Pages에 페이지를 두고 API만 따로 띄우는 경우

- `config.js`의 `API_URL`을 `https://<서버주소>/api/history`로 변경
- 서버 `.env`의 `ALLOWED_ORIGIN=https://auraweon7-ship-it.github.io`
- HTTPS 페이지에서 HTTP API는 차단되므로 서버도 HTTPS여야 합니다.
