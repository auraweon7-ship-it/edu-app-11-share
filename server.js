// 교육 웹앱 배포 서버: 정적 페이지 + 다운로드 히스토리 API (Postgres)
//   POST /api/history  기록 추가 (공개)
//   GET  /api/history  기록 조회 (x-admin-key 헤더 필요)
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import pg from "pg";

const ROOT = path.dirname(fileURLToPath(import.meta.url));
try { process.loadEnvFile(path.join(ROOT, ".env")); } catch { /* .env 없으면 환경변수 사용 */ }

const { DATABASE_URL, ADMIN_KEY, PORT = 8080, DATABASE_SSL, ALLOWED_ORIGIN = "" } = process.env;
if (!DATABASE_URL) { console.error("DATABASE_URL 이 설정되지 않았습니다 (.env 확인)"); process.exit(1); }
if (!ADMIN_KEY || ADMIN_KEY === "change-me") console.warn("경고: ADMIN_KEY 를 안전한 값으로 설정하세요.");

const pool = new pg.Pool({
  connectionString: DATABASE_URL,
  ssl: DATABASE_SSL === "true" ? { rejectUnauthorized: false } : undefined,
  max: 5
});

// 앱 목록은 프론트와 같은 config.js 에서 읽음
const cfg = {};
vm.runInNewContext(fs.readFileSync(path.join(ROOT, "config.js"), "utf8"), { window: cfg });
const APPS = new Map(cfg.APPS.map(a => [a.id, a.name]));

const FIELDS = ["name", "univ", "dept", "major", "role", "phone"];
const PHONE_RE = /^01[016789]-\d{3,4}-\d{4}$/;
const STATIC = {
  "/": "index.html", "/index.html": "index.html", "/download.html": "download.html",
  "/style.css": "style.css", "/common.js": "common.js", "/config.js": "config.js", "/qr-poster.js": "qr-poster.js"
};
const TYPES = { ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "text/javascript; charset=utf-8" };
const origins = ALLOWED_ORIGIN.split(",").map(s => s.trim()).filter(Boolean);

// IP당 1분 30건 제한 (도배 방지)
const hits = new Map();
function limited(ip) {
  const now = Date.now(), list = (hits.get(ip) || []).filter(t => now - t < 60_000);
  list.push(now);
  hits.set(ip, list);
  return list.length > 30;
}

function safeEqual(a, b) {
  const x = Buffer.from(String(a)), y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

function send(res, status, body, headers = {}) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", ...headers });
  res.end(JSON.stringify(body));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", c => { data += c; if (data.length > 10_000) { reject(new Error("too large")); req.destroy(); } });
    req.on("end", () => resolve(data));
    req.on("error", reject);
  });
}

async function addHistory(req, res) {
  const ip = req.headers["x-forwarded-for"]?.split(",")[0].trim() || req.socket.remoteAddress;
  if (limited(ip)) return send(res, 429, { ok: false, error: "요청이 너무 많습니다. 잠시 후 다시 시도하세요." });

  let d;
  try { d = JSON.parse(await readBody(req)); } catch { return send(res, 400, { ok: false, error: "잘못된 요청" }); }
  const v = Object.fromEntries(FIELDS.map(f => [f, String(d[f] ?? "").trim().slice(0, 100)]));
  const appId = Number(d.appId);
  if (d.agree !== true) return send(res, 400, { ok: false, error: "개인정보 수집·이용 동의가 필요합니다." });
  if (FIELDS.some(f => !v[f])) return send(res, 400, { ok: false, error: "필수 항목 누락" });
  if (!PHONE_RE.test(v.phone)) return send(res, 400, { ok: false, error: "휴대폰 형식 오류" });
  if (!APPS.has(appId)) return send(res, 400, { ok: false, error: "알 수 없는 앱" });
  const startAt = await getStartAt();
  if (startAt && startAt > new Date()) {
    return send(res, 403, { ok: false, error: "아직 앱 선택 시작 전입니다.", startAt: startAt.toISOString() });
  }

  // '링크 받기' 1회: 인적사항 저장(갱신) → 다운로드 1건 → 앱별 건수 +1 을 한 트랜잭션으로
  const saved = await tx(async client => {
    const { rows: [p] } = await client.query(
      `INSERT INTO participants (name, univ, dept, major, role, phone, agreed_at)
       VALUES ($1, $2, $3, $4, $5, $6, now())
       ON CONFLICT (phone) DO UPDATE
         SET name = EXCLUDED.name, univ = EXCLUDED.univ, dept = EXCLUDED.dept, major = EXCLUDED.major,
             role = EXCLUDED.role, agreed_at = now(), updated_at = now()
       RETURNING id`,
      [v.name, v.univ, v.dept, v.major, v.role, v.phone]);
    const { rows: [dl] } = await client.query(
      `INSERT INTO downloads (participant_id, app_id, app_name) VALUES ($1, $2, $3) RETURNING id`,
      [p.id, appId, APPS.get(appId)]);
    const { rows: [app] } = await client.query(
      `UPDATE apps SET download_count = download_count + 1 WHERE id = $1 RETURNING download_count`, [appId]);
    return { downloadId: Number(dl.id), appCount: app.download_count };
  });
  send(res, 201, { ok: true, ...saved });
}

// ---------- 앱 선택 시작 시각 ----------
async function getStartAt() {
  const { rows: [r] } = await pool.query(`SELECT value FROM settings WHERE key = 'start_at'`);
  return r?.value ? new Date(r.value) : null;
}

// 공개: 시작 시각 + 서버 현재 시각 (기기 시계 오차 보정용)
async function getSettings(req, res) {
  const startAt = await getStartAt();
  send(res, 200, { ok: true, startAt: startAt?.toISOString() ?? null, now: new Date().toISOString() });
}

// 관리자: { startAt: ISO 문자열 | null(해제 = 즉시 시작) }
async function putSettings(req, res) {
  if (!isAdmin(req, res)) return;
  let d;
  try { d = JSON.parse(await readBody(req)); } catch { return send(res, 400, { ok: false, error: "잘못된 요청" }); }
  let value = null;
  if (d.startAt != null) {
    const t = new Date(d.startAt);
    if (Number.isNaN(t.getTime())) return send(res, 400, { ok: false, error: "시작 시각 형식 오류" });
    value = t.toISOString();
  }
  await pool.query(
    `INSERT INTO settings (key, value) VALUES ('start_at', $1)
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`, [value]);
  send(res, 200, { ok: true, startAt: value, now: new Date().toISOString() });
}

async function tx(fn) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const out = await fn(client);
    await client.query("COMMIT");
    return out;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

function isAdmin(req, res) {
  if (ADMIN_KEY && safeEqual(req.headers["x-admin-key"] || "", ADMIN_KEY)) return true;
  send(res, 401, { ok: false, error: "관리자 키가 올바르지 않습니다." });
  return false;
}

const recount = (client, ids) => client.query(
  `UPDATE apps a SET download_count = (SELECT count(*) FROM downloads d WHERE d.app_id = a.id)
    WHERE a.id = ANY($1::smallint[])`, [ids]);

// 관리자 수정: 인적사항(해당 참여자의 모든 기록에 반영) + 이 기록의 앱
async function updateHistory(req, res, id) {
  if (!isAdmin(req, res)) return;
  let d;
  try { d = JSON.parse(await readBody(req)); } catch { return send(res, 400, { ok: false, error: "잘못된 요청" }); }
  const v = Object.fromEntries(FIELDS.map(f => [f, String(d[f] ?? "").trim().slice(0, 100)]));
  const appId = Number(d.appId);
  if (FIELDS.some(f => !v[f])) return send(res, 400, { ok: false, error: "필수 항목 누락" });
  if (!PHONE_RE.test(v.phone)) return send(res, 400, { ok: false, error: "휴대폰 형식 오류" });
  if (!APPS.has(appId)) return send(res, 400, { ok: false, error: "알 수 없는 앱" });

  try {
    const found = await tx(async client => {
      const { rows: [dl] } = await client.query(
        `SELECT participant_id, app_id FROM downloads WHERE id = $1 FOR UPDATE`, [id]);
      if (!dl) return false;
      await client.query(
        `UPDATE participants SET name = $1, univ = $2, dept = $3, major = $4, role = $5, phone = $6, updated_at = now()
          WHERE id = $7`,
        [v.name, v.univ, v.dept, v.major, v.role, v.phone, dl.participant_id]);
      if (dl.app_id !== appId) {
        await client.query(`UPDATE downloads SET app_id = $1, app_name = $2 WHERE id = $3`, [appId, APPS.get(appId), id]);
        await recount(client, [dl.app_id, appId]);
      }
      return true;
    });
    if (!found) return send(res, 404, { ok: false, error: "기록을 찾을 수 없습니다." });
    send(res, 200, { ok: true });
  } catch (err) {
    if (err.code === "23505") return send(res, 409, { ok: false, error: "이미 다른 참여자가 사용 중인 휴대폰 번호입니다." });
    throw err;
  }
}

// 관리자 삭제: 다운로드 1건 삭제, 남은 기록이 없는 참여자는 인적사항도 삭제
async function deleteHistory(req, res, id) {
  if (!isAdmin(req, res)) return;
  const result = await tx(async client => {
    const { rows: [dl] } = await client.query(
      `DELETE FROM downloads WHERE id = $1 RETURNING participant_id, app_id`, [id]);
    if (!dl) return null;
    const { rowCount } = await client.query(
      `DELETE FROM participants p WHERE p.id = $1
         AND NOT EXISTS (SELECT 1 FROM downloads d WHERE d.participant_id = p.id)`, [dl.participant_id]);
    await recount(client, [dl.app_id]);
    return { participantRemoved: rowCount > 0 };
  });
  if (!result) return send(res, 404, { ok: false, error: "기록을 찾을 수 없습니다." });
  send(res, 200, { ok: true, ...result });
}

async function listHistory(req, res) {
  if (!isAdmin(req, res)) return;
  const { rows } = await pool.query(
    `SELECT d.id::int AS id, d.app_id AS "appId",
            count(*) OVER (PARTITION BY p.id)::int AS "personCount",
            to_char(d.created_at AT TIME ZONE 'Asia/Seoul', 'YYYY-MM-DD HH24:MI:SS') AS time,
            p.name, p.univ, p.dept, p.major, p.role, p.phone, d.app_id || '. ' || d.app_name AS app
       FROM downloads d JOIN participants p ON p.id = d.participant_id
      ORDER BY d.created_at DESC, d.id DESC`);
  const { rows: apps } = await pool.query(
    `SELECT id, name, download_count AS count FROM apps ORDER BY id`);
  const { rows: [{ count: participants }] } = await pool.query(`SELECT count(*)::int AS count FROM participants`);
  send(res, 200, { ok: true, rows, apps, participants });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://localhost");
  const origin = req.headers.origin;
  const cors = origin && origins.includes(origin)
    ? { "Access-Control-Allow-Origin": origin, "Access-Control-Allow-Headers": "Content-Type, x-admin-key",
        "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS", Vary: "Origin" }
    : {};
  for (const [k, v] of Object.entries(cors)) res.setHeader(k, v);

  try {
    if (url.pathname === "/api/history") {
      if (req.method === "OPTIONS") { res.writeHead(204); return res.end(); }
      if (req.method === "POST") return await addHistory(req, res);
      if (req.method === "GET") return await listHistory(req, res);
      return send(res, 405, { ok: false, error: "method not allowed" });
    }
    if (url.pathname === "/api/settings") {
      if (req.method === "OPTIONS") { res.writeHead(204); return res.end(); }
      if (req.method === "GET") return await getSettings(req, res);
      if (req.method === "PUT") return await putSettings(req, res);
      return send(res, 405, { ok: false, error: "method not allowed" });
    }
    const m = url.pathname.match(/^\/api\/history\/(\d{1,15})$/);
    if (m) {
      if (req.method === "OPTIONS") { res.writeHead(204); return res.end(); }
      if (req.method === "PUT") return await updateHistory(req, res, m[1]);
      if (req.method === "DELETE") return await deleteHistory(req, res, m[1]);
      return send(res, 405, { ok: false, error: "method not allowed" });
    }
    const file = STATIC[url.pathname];
    if (!file || req.method !== "GET") { res.writeHead(404); return res.end("Not found"); }
    res.writeHead(200, { "Content-Type": TYPES[path.extname(file)], "Cache-Control": "no-cache" });
    fs.createReadStream(path.join(ROOT, file)).pipe(res);
  } catch (err) {
    console.error(err);
    send(res, 500, { ok: false, error: "서버 오류" });
  }
});

// 스키마 생성 → 앱 목록 동기화(config.js) → 이전 버전 데이터 이전 → 앱별 건수 재계산
await pool.query(fs.readFileSync(path.join(ROOT, "db", "schema.sql"), "utf8"));
for (const a of cfg.APPS) {
  await pool.query(
    `INSERT INTO apps (id, name, url) VALUES ($1, $2, $3)
     ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, url = EXCLUDED.url`, [a.id, a.name, a.url]);
}
await pool.query(fs.readFileSync(path.join(ROOT, "db", "migrate-legacy.sql"), "utf8"));
await pool.query(
  `UPDATE apps a SET download_count = (SELECT count(*) FROM downloads d WHERE d.app_id = a.id)`);
server.listen(PORT, () => console.log(`http://localhost:${PORT}  (대시보드: /  · 사용자: /download.html)`));
