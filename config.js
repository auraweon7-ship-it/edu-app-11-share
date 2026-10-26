// ===== 설정 =====
// Google Apps Script 웹앱 URL (apps-script/Code.gs 배포 후 붙여넣기)
// 비워두면 이 기기 브라우저(localStorage)에만 기록됨 → 테스트용
window.GAS_URL = "";

window.APP_TITLE = "교수자를 위한 바이브 코딩 교육 웹앱 10선";

window.APPS = [
  { id: 1,  name: "AI 강의자료 퀴즈 생성기",            url: "https://auraweon7-ship-it.github.io/edu-app-01-quiz/" },
  { id: 2,  name: "실시간 투표/퀴즈",                   url: "https://auraweon7-ship-it.github.io/edu-app-02-livequiz/" },
  { id: 3,  name: "디지털 플래시카드 학습기",            url: "https://auraweon7-ship-it.github.io/edu-app-03-cards/" },
  { id: 4,  name: "AI 학습용 챗봇",                     url: "https://edu-app-04-bot.vercel.app/" },
  { id: 5,  name: "학생 발표 평가 웹앱",                 url: "https://github.com/auraweon7-ship-it/edu-app-05-peer/" },
  { id: 6,  name: "강의자료 디지털 ebook",               url: "https://auraweon7-ship-it.github.io/edu-app-06--ebook/" },
  { id: 7,  name: "AI 글쓰기·보고서 피드백",             url: "https://auraweon7-ship-it.github.io/edu-app-07-report/" },
  { id: 8,  name: "인터랙티브 타임라인",                 url: "https://auraweon7-ship-it.github.io/edu-app-08-timeline/" },
  { id: 9,  name: "인터랙티브 개념 지도·마인드맵 제작기", url: "https://auraweon7-ship-it.github.io/edu-app-09-mindmap/" },
  { id: 10, name: "인터랙티브 학습용 동영상 플레이어",     url: "https://auraweon7-ship-it.github.io/edu-app-10-clipplayer/" }
];

window.LOCAL_KEY = "edu_app_share_history";
