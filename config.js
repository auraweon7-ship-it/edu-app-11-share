// ===== 설정 =====
// 히스토리 API 주소 (server.js → Postgres)
// 같은 서버에서 페이지를 열면 그대로 두고,
// GitHub Pages 등 다른 곳에서 열면 서버 전체 주소로 변경: "https://내서버/api/history"
window.API_URL = "/api/history";
// 운영 설정(앱 선택 시작 시각) API — API_URL과 같은 서버
window.SETTINGS_URL = window.API_URL.replace(/history\/?$/, "settings");

window.APP_VERSION = "v1.3.0";
window.APP_TITLE ="교수자를 위한 바이브 코딩 교육 웹앱 10선";

// 개인정보 수집·이용 안내 (운영 기관 정책에 맞게 수정하세요)
window.PRIVACY = {
  items: "성명, 대학, 학과, 전공, 신분, 휴대폰 번호, 기사 유용도 응답, 유료 교육과정 참여 의사",
  purpose: "교육 웹앱 배포 현황 집계 및 관련 안내 연락",
  retention: "수집일로부터 1년 후 파기",
  refuse: "동의를 거부할 수 있으나, 거부 시 웹앱을 받을 수 없습니다."
};

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
