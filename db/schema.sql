-- 교육 웹앱 배포 DB (server.js 시작 시 자동 실행 · 여러 번 실행해도 안전)
--   participants : 인적사항 (휴대폰 번호 기준 1인 1행, 재방문 시 최신 정보로 갱신)
--   downloads    : '링크 받기' 1회 = 1행 (앱 건별 기록)
--   apps         : 앱 목록과 앱별 누적 다운로드 건수
--   settings     : 운영 설정 (앱 선택 시작 시각 등)

CREATE TABLE IF NOT EXISTS participants (
  id          BIGSERIAL PRIMARY KEY,
  name        TEXT NOT NULL,
  univ        TEXT NOT NULL,
  dept        TEXT NOT NULL,
  major       TEXT NOT NULL,
  role        TEXT NOT NULL,
  phone       TEXT NOT NULL UNIQUE,
  agreed_at   TIMESTAMPTZ NOT NULL,           -- 개인정보 수집·이용 동의 시각 (최근)
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS apps (
  id              SMALLINT PRIMARY KEY,
  name            TEXT NOT NULL,
  url             TEXT NOT NULL,
  download_count  INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS downloads (
  id              BIGSERIAL PRIMARY KEY,
  participant_id  BIGINT NOT NULL REFERENCES participants(id),
  app_id          SMALLINT NOT NULL REFERENCES apps(id),
  app_name        TEXT NOT NULL,              -- 받은 시점의 앱 이름
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 운영 설정 (예: start_at = 앱 선택 시작 시각, ISO 8601)
CREATE TABLE IF NOT EXISTS settings (
  key         TEXT PRIMARY KEY,
  value       TEXT,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS downloads_created_at_idx ON downloads (created_at DESC);
CREATE INDEX IF NOT EXISTS downloads_participant_idx ON downloads (participant_id);
CREATE INDEX IF NOT EXISTS downloads_app_idx ON downloads (app_id);
