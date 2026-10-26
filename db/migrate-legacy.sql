-- 이전 버전의 단일 테이블(download_history)을 새 구조로 1회 이전
-- 이전 후 원본은 download_history_legacy 로 이름만 바꿔 보관 (삭제하지 않음)
DO $$
BEGIN
  IF to_regclass('download_history') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM downloads) THEN
    ALTER TABLE download_history ADD COLUMN IF NOT EXISTS agreed_at TIMESTAMPTZ;

    -- 휴대폰 번호별 최신 인적사항, 최초 방문 시각
    INSERT INTO participants (name, univ, dept, major, role, phone, agreed_at, created_at, updated_at)
    SELECT DISTINCT ON (h.phone) h.name, h.univ, h.dept, h.major, h.role, h.phone,
           COALESCE(h.agreed_at, h.created_at),
           (SELECT min(created_at) FROM download_history x WHERE x.phone = h.phone),
           h.created_at
      FROM download_history h
     ORDER BY h.phone, h.created_at DESC
    ON CONFLICT (phone) DO NOTHING;

    INSERT INTO downloads (participant_id, app_id, app_name, created_at)
    SELECT p.id, h.app_id, h.app_name, h.created_at
      FROM download_history h
      JOIN participants p ON p.phone = h.phone
     WHERE h.app_id IN (SELECT id FROM apps)
     ORDER BY h.created_at;

    ALTER TABLE download_history RENAME TO download_history_legacy;
    RAISE NOTICE 'download_history → participants/downloads 이전 완료';
  END IF;
END $$;
