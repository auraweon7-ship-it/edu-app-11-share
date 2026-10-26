# 교육 웹앱 10선 링크 배포 웹앱

QR 촬영 → 인적사항 입력(성명·대학·학과·전공·신분·휴대폰, 모두 필수) → 웹앱 1개 선택 → 링크 제공.
1회 1개만 받을 수 있고, 매 다운로드는 히스토리에 기록됩니다.

| 파일 | 역할 |
|---|---|
| `index.html` | 사용자 페이지 (QR로 접속) |
| `admin.html` | 관리자 대시보드: KPI, 앱별·신분별·일자별·시간대별·대학/학과 Top10 차트, 필터, 히스토리 표, CSV, 배포용 QR |
| `style.css`, `common.js` | Soft UI 디자인(웹앱 01 퀴즈 생성기와 동일 톤), 헤더 날짜 |
| `config.js` | 앱 목록, `GAS_URL` 설정 |
| `apps-script/Code.gs` | Google Sheets 저장 백엔드 |

## 운영 설정 (여러 사람 기록을 한 곳에 모으려면 필수)

1. Google 스프레드시트 생성 → 확장 프로그램 → Apps Script → `apps-script/Code.gs` 붙여넣기
2. 프로젝트 설정 → 스크립트 속성에 `ADMIN_KEY` 추가 (관리자 비밀번호)
3. 배포 → 새 배포 → 웹 앱 (실행: 나 / 액세스: 모든 사용자) → `…/exec` URL 복사
4. `config.js`의 `GAS_URL`에 붙여넣기
5. 폴더를 GitHub Pages 등에 올리고, `admin.html`에서 QR 생성 → PNG 저장 → 배포

`GAS_URL`이 비어 있으면 기록이 해당 기기 브라우저에만 저장됩니다(테스트 모드).
