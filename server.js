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

  await pool.query(
    `INSERT INTO download_history (name, univ, dept, major, role, phone, app_id, app_name, agreed_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, now())`,
    [v.name, v.univ, v.dept, v.major, v.role, v.phone, appId, APPS.get(appId)]);
  send(res, 201, { ok: true });
}

async function listHistory(req, res) {
  if (!ADMIN_KEY || !safeEqual(req.headers["x-admin-key"] || "", ADMIN_KEY)) {
    return send(res, 401, { ok: false, error: "관리자 키가 올바르지 않습니다." });
  }
  const { rows } = await pool.query(
    `SELECT to_char(created_at AT TIME ZONE 'Asia/Seoul', 'YYYY-MM-DD HH24:MI:SS') AS time,
            name, univ, dept, major, role, phone, app_id || '. ' || app_name AS app
       FROM download_history ORDER BY created_at DESC`);
  send(res, 200, { ok: true, rows });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://localhost");
  const origin = req.headers.origin;
  const cors = origin && origins.includes(origin)
    ? { "Access-Control-Allow-Origin": origin, "Access-Control-Allow-Headers": "Content-Type, x-admin-key",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS", Vary: "Origin" }
    : {};
  for (const [k, v] of Object.entries(cors)) res.setHeader(k, v);

  try {
    if (url.pathname === "/api/history") {
      if (req.method === "OPTIONS") { res.writeHead(204); return res.end(); }
      if (req.method === "POST") return await addHistory(req, res);
      if (req.method === "GET") return await listHistory(req, res);
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

await pool.query(fs.readFileSync(path.join(ROOT, "db", "schema.sql"), "utf8"));
server.listen(PORT, () => console.log(`http://localhost:${PORT}  (대시보드: /  · 사용자: /download.html)`));
