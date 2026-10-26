// 배포용 QR 포스터 렌더러 (qrcodejs의 모듈 행렬을 캔버스에 직접 그림)
// 오류 복원 H 등급(약 30%)이라 중앙 문구 배지로 일부 모듈을 가려도 인식됨
window.QRPoster = (() => {
  const INK = "#1d1d1f", MUTE = "#77777d", SCALE = 2;
  const KR = '"Noto Sans KR", "Apple SD Gothic Neo", "Malgun Gothic", sans-serif';
  const EN = 'Inter, "Noto Sans KR", sans-serif';

  function matrix(text) {
    const tmp = document.createElement("div");
    const q = new QRCode(tmp, { text, width: 64, height: 64, correctLevel: QRCode.CorrectLevel.H });
    const m = q._oQRCode;
    return { n: m.getModuleCount(), dark: (r, c) => m.isDark(r, c) };
  }

  function rr(ctx, x, y, w, h, r) {
    r = Math.max(0, Math.min(r, w / 2, h / 2));
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  // 자간을 준 텍스트 (canvas letterSpacing 미지원 브라우저 대비)
  function spaced(ctx, text, x, y, sp, align = "left") {
    const chars = [...text], ws = chars.map(ch => ctx.measureText(ch).width);
    const total = ws.reduce((a, b) => a + b, 0) + sp * (chars.length - 1);
    let cx = align === "center" ? x - total / 2 : align === "right" ? x - total : x;
    const prev = ctx.textAlign;
    ctx.textAlign = "left";
    chars.forEach((ch, i) => { ctx.fillText(ch, cx, y); cx += ws[i] + sp; });
    ctx.textAlign = prev;
    return total;
  }

  function fitText(ctx, text, maxW) {
    if (ctx.measureText(text).width <= maxW) return text;
    let t = text;
    while (t.length > 4 && ctx.measureText(t + "…").width > maxW) t = t.slice(0, -1);
    return t + "…";
  }

  // QR 본체: 데이터 모듈은 잉크, 위치 검출 패턴(눈)과 배지는 포인트 색상
  function drawCode(ctx, x0, y0, S, mat, o) {
    const { n, dark } = mat, cell = S / n;
    const finder = (r, c) => (r < 7 && c < 7) || (r < 7 && c >= n - 7) || (r >= n - 7 && c < 7);

    // 중앙 배지 크기 계산 (QR 폭의 최대 36%)
    let badge = null;
    if (o.label) {
      let fs = S * 0.058;
      ctx.font = `900 ${fs}px ${KR}`;
      const sp = fs * 0.06;
      const textW = () => ctx.measureText(o.label).width + sp * ([...o.label].length - 1);
      while (textW() + fs * 1.3 > S * 0.36 && fs > 8) { fs -= 1; ctx.font = `900 ${fs}px ${KR}`; }
      const bw = textW() + fs * 1.3, bh = fs * 1.95;
      badge = { x: x0 + (S - bw) / 2, y: y0 + (S - bh) / 2, w: bw, h: bh, fs, sp };
    }
    const pad = cell * 0.7;
    const covered = (r, c) => badge &&
      x0 + (c + 1) * cell > badge.x - pad && x0 + c * cell < badge.x + badge.w + pad &&
      y0 + (r + 1) * cell > badge.y - pad && y0 + r * cell < badge.y + badge.h + pad;

    const dataColor = INK;
    ctx.fillStyle = dataColor;
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) {
      if (!dark(r, c) || finder(r, c) || covered(r, c)) continue;
      const x = x0 + c * cell, y = y0 + r * cell;
      // 도트형은 큰 크기에서 판독 실패가 있어 제외 (라운드/사각만 지원)
      if (o.shape === "round") {
        rr(ctx, x + cell * 0.02, y + cell * 0.02, cell * 0.96, cell * 0.96, cell * 0.3); ctx.fill();
      } else {
        ctx.fillRect(x, y, cell + 0.6, cell + 0.6);
      }
    }

    // 위치 검출 패턴
    const eyeR = o.shape === "square" ? [0, 0, 0] : [2.1, 1.5, 1];
    [[0, 0], [0, n - 7], [n - 7, 0]].forEach(([r0, c0]) => {
      const x = x0 + c0 * cell, y = y0 + r0 * cell;
      ctx.fillStyle = o.color; rr(ctx, x, y, cell * 7, cell * 7, cell * eyeR[0]); ctx.fill();
      ctx.fillStyle = "#fff"; rr(ctx, x + cell, y + cell, cell * 5, cell * 5, cell * eyeR[1]); ctx.fill();
      ctx.fillStyle = o.color; rr(ctx, x + cell * 2, y + cell * 2, cell * 3, cell * 3, cell * eyeR[2]); ctx.fill();
    });

    // 중앙 배지
    if (badge) {
      const { x, y, w, h, fs, sp } = badge;
      ctx.fillStyle = "#fff"; rr(ctx, x - cell * 0.5, y - cell * 0.5, w + cell, h + cell, h * 0.42); ctx.fill();
      ctx.fillStyle = o.color; rr(ctx, x, y, w, h, h * 0.34); ctx.fill();
      ctx.fillStyle = "#fff"; ctx.font = `900 ${fs}px ${KR}`; ctx.textBaseline = "middle";
      spaced(ctx, o.label, x + w / 2, y + h / 2 + fs * 0.04, sp, "center");
      ctx.textBaseline = "alphabetic";
    }
  }

  function engraved(ctx, x1, x2, y) {
    ctx.fillStyle = "rgba(0,0,0,.10)"; ctx.fillRect(x1, y, x2 - x1, 1.5);
    ctx.fillStyle = "#fff"; ctx.fillRect(x1, y + 1.5, x2 - x1, 1.5);
  }

  function poster(ctx, mat, o) {
    const W = 1200, H = 1600, M = 96;
    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, "#f4f4f3"); bg.addColorStop(1, "#e7e7e6");
    ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);

    // 상단 머리글
    ctx.fillStyle = INK; ctx.font = `700 28px ${KR}`; ctx.textAlign = "left";
    ctx.fillText("교수신문 AI 교육 웹앱 시리즈", M, 112);
    ctx.fillStyle = MUTE; ctx.font = `600 24px ${EN}`; ctx.textAlign = "right";
    spaced(ctx, `${new Date().getFullYear()} EDITION`, W - M, 112, 3, "right");
    ctx.textAlign = "left";
    engraved(ctx, M, W - M, 140);

    // 타이틀
    ctx.fillStyle = INK; ctx.font = `500 132px ${EN}`;
    spaced(ctx, "EDU APPS", M - 4, 290, 30);
    ctx.font = `700 40px ${KR}`;
    ctx.fillText(fitText(ctx, window.APP_TITLE || "", W - M * 2), M, 362);
    ctx.fillStyle = MUTE; ctx.font = `500 30px ${KR}`;
    ctx.fillText("QR을 촬영하고 웹앱 1개를 바로 받으세요", M, 412);

    // QR 플레이트
    const P = 720, px = (W - P) / 2, py = 486, S = 600;
    ctx.save();
    ctx.shadowColor = "rgba(0,0,0,.20)"; ctx.shadowBlur = 48; ctx.shadowOffsetY = 22;
    ctx.fillStyle = "#fff"; rr(ctx, px, py, P, P, 52); ctx.fill();
    ctx.restore();
    ctx.strokeStyle = "rgba(0,0,0,.05)"; ctx.lineWidth = 2; rr(ctx, px, py, P, P, 52); ctx.stroke();
    drawCode(ctx, px + (P - S) / 2, py + (P - S) / 2, S, mat, o);

    // SCAN ME 태그 (플레이트 윗변에 걸침)
    ctx.fillStyle = o.color; rr(ctx, W / 2 - 120, py - 30, 240, 60, 30); ctx.fill();
    ctx.fillStyle = "#fff"; ctx.font = `700 24px ${EN}`; ctx.textBaseline = "middle";
    spaced(ctx, "SCAN ME", W / 2, py + 1, 6, "center");
    ctx.textBaseline = "alphabetic";

    // 3단계 안내
    const steps = [["01", "인적사항 입력"], ["02", "앱 1개 선택"], ["03", "링크 받기"]];
    const cw = 314, ch = 92, gap = 29, sx = (W - (cw * 3 + gap * 2)) / 2, sy = 1290;
    steps.forEach(([no, t], i) => {
      const x = sx + i * (cw + gap);
      ctx.save();
      ctx.shadowColor = "rgba(0,0,0,.14)"; ctx.shadowBlur = 18; ctx.shadowOffsetY = 8;
      ctx.fillStyle = "#f8f8f7"; rr(ctx, x, sy, cw, ch, ch / 2); ctx.fill();
      ctx.restore();
      ctx.textBaseline = "middle";
      ctx.fillStyle = o.color; ctx.font = `700 26px ${EN}`; ctx.textAlign = "left";
      ctx.fillText(no, x + 34, sy + ch / 2);
      ctx.fillStyle = INK; ctx.font = `700 28px ${KR}`;
      ctx.fillText(t, x + 86, sy + ch / 2 + 1);
      ctx.textBaseline = "alphabetic";
    });

    // 하단
    engraved(ctx, M, W - M, 1450);
    ctx.fillStyle = MUTE; ctx.font = `500 22px ${EN}`; ctx.textAlign = "center";
    ctx.fillText(fitText(ctx, o.url, W - M * 2), W / 2, 1500);
    ctx.font = `500 22px ${KR}`; ctx.textAlign = "left";
    ctx.fillText("Presented by 교수자를 위한 바이브 코딩", M, 1548);
    ctx.textAlign = "right"; ctx.font = `600 22px ${EN}`;
    ctx.fillText(window.APP_VERSION || "", W - M, 1548);
    ctx.textAlign = "left";
    return [W, H];
  }

  function square(ctx, mat, o) {
    const W = 1000, S = 840;
    ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, W, W);
    drawCode(ctx, (W - S) / 2, (W - S) / 2, S, mat, o);
    return [W, W];
  }

  function draw(canvas, o) {
    const size = o.layout === "square" ? [1000, 1000] : [1200, 1600];
    canvas.width = size[0] * SCALE; canvas.height = size[1] * SCALE;
    const ctx = canvas.getContext("2d");
    ctx.setTransform(SCALE, 0, 0, SCALE, 0, 0);
    let mat;
    try { mat = matrix(o.url || " "); } catch (e) {
      ctx.fillStyle = "#f1f1f0"; ctx.fillRect(0, 0, size[0], size[1]);
      ctx.fillStyle = INK; ctx.font = `700 36px ${KR}`; ctx.fillText("주소가 너무 깁니다", 80, 120);
      return;
    }
    (o.layout === "square" ? square : poster)(ctx, mat, o);
  }

  return { draw };
})();
