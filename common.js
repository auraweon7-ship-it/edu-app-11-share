// 헤더 날짜 블록 (예: 10. 26  2026 / MON)
document.querySelectorAll("[data-date]").forEach(el => {
  const d = new Date();
  const wk = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"][d.getDay()];
  el.innerHTML = `<span class="m">${d.getMonth() + 1}.</span><span class="d">${String(d.getDate()).padStart(2, "0")}</span>
    <span class="yw"><span>${d.getFullYear()}</span><span>${wk}</span></span>`;
});
