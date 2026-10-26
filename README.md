# 교육 웹앱 10선 링크 배포 웹앱

QR 촬영 → 인적사항 입력(성명·대학·학과·전공·신분·휴대폰 + "기사가 유용했나요?" 별 1~5 + "교육 웹앱, 미디어 제작, 웹플랫폼 구축에 대한 유료 교육과정에 참여할 의사는?" 예/아니오, 모두 필수) → **개인정보 수집·이용 동의(필수)** → 웹앱 1개 선택 → 링크 제공.
1회 1개만 받을 수 있고, **'링크 받기'를 누르는 순간** Postgres에 한 트랜잭션으로 저장됩니다.

| 테이블 | 내용 |
|---|---|
| `participants` | 인적사항 + 기사 유용도 별점(`rating` 1~5) + 유료 교육과정 참여 의사(`paid_interest` 예/아니오) + 동의 시각. 휴대폰 번호 기준 1인 1행, 재방문 시 최신 정보로 갱신 |
| `downloads` | '링크 받기' 1회 = 1행 (참여자·앱·일시) — 앱 건별 기록 |
| `apps` | 앱 목록(`config.js`와 자동 동기화) + 앱별 누적 다운로드 건수 `download_count` |
| `settings` | 운영 설정 — `start_at`(앱 선택 시작 시각) |

이전 버전의 `download_history` 테이블이 있으면 서버 시작 시 새 구조로 1회 이전하고, 원본은 `download_history_legacy`로 이름만 바꿔 보관합니다.
동의하지 않으면 앱 선택 단계로 넘어갈 수 없고, 서버도 동의 없는 요청을 거부합니다.
안내 문구(수집 항목·목적·보유 기간)는 `config.js`의 `PRIVACY`에서 기관 정책에 맞게 수정하세요.

| 파일 | 역할 |
|---|---|
| `index.html` | 대문: 관리자 대시보드 — KPI, 앱별·신분별·일자별·시간대별·대학/학과 Top10 차트, 필터, 히스토리 표, CSV, 배포용 QR |
| `download.html` | 사용자 페이지: 인적사항 → 앱 1개 선택 → 링크 (QR로 접속) |
| `server.js` | Node 서버: 위 페이지 제공 + 히스토리 API (`POST/GET /api/history`) |
| `db/schema.sql`, `db/migrate-legacy.sql` | 테이블 정의, 이전 버전 데이터 이전 (서버 시작 시 자동 실행) |
| `qr-poster.js` | 배포용 QR 렌더러 — 중앙 문구(기본 "교수신문"), 포스터/QR만 미리보기·인쇄, **PNG 저장은 카드형(제목·부제·QR)**, 라운드/사각, 포인트 색상 (오류 복원 H 등급) |
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
| `POST /api/history` | `{name, univ, dept, major, role, phone, appId, agree: true}` → 참여자 저장/갱신 + 다운로드 1건 + 앱 건수 +1. 일시는 DB 서버 시각. IP당 분당 30건 제한 |
| `GET /api/history` | 헤더 `x-admin-key: <ADMIN_KEY>` 필요. `rows`(최신순 다운로드 + 인적사항), `apps`(앱별 누적 건수), `participants`(참여자 수) |
| `PUT /api/history/:id` | 관리자. 인적사항(해당 참여자의 모든 기록에 반영)과 이 기록의 앱 수정. 앱 변경 시 앱별 건수 재계산. 다른 참여자의 휴대폰 번호면 409 |
| `DELETE /api/history/:id` | 관리자. 다운로드 1건 삭제 + 앱별 건수 재계산. 참여자의 마지막 기록이면 인적사항도 삭제 |

| `GET /api/settings` | 공개. `startAt`(앱 선택 시작 시각, 없으면 `null`)과 서버 현재 시각 `now` |
| `PUT /api/settings` | 관리자. `{startAt: ISO 시각 | null}` — `null`이면 제한 해제(즉시 시작) |
| `PUT /api/settings/apps` | 관리자. `{apps: [{id, startAt: ISO | null}]}` 앱별 공개 시각 일괄 저장 (`GET /api/settings`의 `apps`로 조회) |

**앱별 공개 일정**: SCHEDULE 카드(머리글을 눌러 펼치기/숨기기, 숨기면 요약 표시) 아래 표에서 앱마다 공개 시각을 미리 지정합니다 ("모든 앱에 채우기", "1번부터 간격 채우기" — 10분·30분·1시간·하루·일주일 간격). 각 행의 **저장** 버튼으로 앱 하나씩, 또는 **변경된 N개 앱 저장**으로 한 번에 DB에 저장합니다. 저장하지 않은 행은 "변경됨 · 저장 필요"로 표시되고, 그 상태로 페이지를 떠나면 경고합니다. 참가자 화면에는 공개 전 앱에 "10/27 14:00 공개 · 01:23:45" 배지가 붙고 선택할 수 없으며, 시각이 되면 자동으로 열립니다. 전체 시작 시각과 앱별 시각이 모두 지나야 선택할 수 있습니다.

**CSV 다운로드**: HISTORY 머리글(또는 DATA 카드)의 버튼으로 현재 필터가 적용된 기록을 저장합니다. 엑셀에서 한글이 깨지지 않도록 BOM을 넣고, `=`·`+`·`-`·`@`로 시작하는 값은 수식으로 실행되지 않게 처리합니다.

**앱 선택 시작 시각**: 대시보드 SCHEDULE 카드에서 설정합니다. 시작 전에는 참가자가 인적사항은 입력할 수 있지만 앱 선택이 잠기고 카운트다운이 표시되며, 시작 시각에 자동으로 열립니다. 기기 시계가 틀려도 서버 시각 기준으로 계산하고, 시작 전 기록 요청은 서버가 거부(403)합니다.

대시보드 HISTORY 표의 **수정 / 삭제** 버튼이 위 API를 사용합니다 (삭제는 확인 후 실행, 되돌릴 수 없음).

## GitHub Pages에 페이지를 두고 API만 따로 띄우는 경우

- `config.js`의 `API_URL`을 `https://<서버주소>/api/history`로 변경
- 서버 `.env`의 `ALLOWED_ORIGIN=https://auraweon7-ship-it.github.io`
- HTTPS 페이지에서 HTTP API는 차단되므로 서버도 HTTPS여야 합니다.
