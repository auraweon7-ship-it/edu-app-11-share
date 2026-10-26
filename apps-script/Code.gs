/**
 * 교육 웹앱 다운로드 히스토리 저장용 Google Apps Script
 *
 * 설치:
 * 1) Google 스프레드시트 새로 만들기 → 확장 프로그램 → Apps Script
 * 2) 이 코드 전체 붙여넣기 → 저장
 * 3) 프로젝트 설정(톱니) → 스크립트 속성 → ADMIN_KEY = (원하는 관리자 비밀번호) 추가
 * 4) 배포 → 새 배포 → 유형: 웹 앱
 *    - 실행 사용자: 나
 *    - 액세스 권한: 모든 사용자
 * 5) 발급된 웹 앱 URL(…/exec)을 config.js 의 GAS_URL 에 붙여넣기
 */

const SHEET_NAME = "history";
const HEAD = ["일시", "성명", "대학", "학과", "전공", "신분", "휴대폰", "다운로드 앱"];
const KEYS = ["time", "name", "univ", "dept", "major", "role", "phone", "app"];

function getSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(SHEET_NAME);
  if (!sh) {
    sh = ss.insertSheet(SHEET_NAME);
    sh.appendRow(HEAD);
    sh.setFrozenRows(1);
    sh.getRange("G:G").setNumberFormat("@"); // 휴대폰 앞자리 0 유지
  }
  return sh;
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

// 기록 추가 (사용자 페이지)
function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const d = JSON.parse(e.postData.contents);
    const row = KEYS.map(k => String(d[k] || "").slice(0, 100));
    if (row.slice(1).some(v => !v)) return json_({ ok: false, error: "missing field" });
    getSheet_().appendRow(row);
    return json_({ ok: true });
  } catch (err) {
    return json_({ ok: false, error: String(err) });
  } finally {
    lock.releaseLock();
  }
}

// 기록 조회 (관리자 페이지, 관리자 키 필요)
function doGet(e) {
  const adminKey = PropertiesService.getScriptProperties().getProperty("ADMIN_KEY");
  if (!adminKey || e.parameter.key !== adminKey) {
    return json_({ ok: false, error: "관리자 키가 올바르지 않습니다." });
  }
  const values = getSheet_().getDataRange().getDisplayValues().slice(1);
  const rows = values.map(v => Object.fromEntries(KEYS.map((k, i) => [k, v[i]])));
  return json_({ ok: true, rows });
}
