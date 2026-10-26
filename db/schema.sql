-- 다운로드 히스토리 (server.js 시작 시 자동 생성되며, 수동 실행도 가능)
CREATE TABLE IF NOT EXISTS download_history (
  id          BIGSERIAL PRIMARY KEY,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  name        TEXT NOT NULL,
  univ        TEXT NOT NULL,
  dept        TEXT NOT NULL,
  major       TEXT NOT NULL,
  role        TEXT NOT NULL,
  phone       TEXT NOT NULL,
  app_id      SMALLINT NOT NULL CHECK (app_id BETWEEN 1 AND 99),
  app_name    TEXT NOT NULL
);

-- 개인정보 수집·이용 동의 시각 (이전 버전 테이블에도 추가)
ALTER TABLE download_history ADD COLUMN IF NOT EXISTS agreed_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS download_history_created_at_idx ON download_history (created_at DESC);
