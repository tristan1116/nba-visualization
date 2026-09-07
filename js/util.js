/**
 * util.js —— 展示层通用工具：DOM 查询、数字格式化、占位头像（SVG 渐变首字母）
 */

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

/** 千分位格式化：fmt(38387) -> "38,387"；null -> "-" */
export const fmt = (n, d = 0) => {
  if (n == null || Number.isNaN(n)) return "-";
  return Number(n).toLocaleString("zh-CN", {
    maximumFractionDigits: d, minimumFractionDigits: 0,
  });
};

/** HTML 转义（球员名/球队名进入模板前必须转义，防注入与排版破坏） */
export const esc = (s) => String(s ?? "")
  .replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;").replaceAll("'", "&#39;");

/** SVG 占位头像（红蓝渐变圆 + 姓名首字母，照片缺失时替换，不碎图） */
export function avatarSvg(name, size = 64) {
  const ch = (name || "?").trim().charAt(0).toUpperCase() || "?";
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}">` +
    `<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">` +
    `<stop offset="0" stop-color="#1d428a"/><stop offset="1" stop-color="#c8102e"/>` +
    `</linearGradient></defs>` +
    `<rect width="${size}" height="${size}" rx="${size / 2}" fill="url(#g)"/>` +
    `<text x="50%" y="53%" dominant-baseline="middle" text-anchor="middle" ` +
    `font-family="Segoe UI, Arial, sans-serif" font-size="${Math.round(size * 0.42)}" ` +
    `font-weight="800" fill="#fdb927">${esc(ch)}</text></svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

/** 头像 HTML：有照片用照片，无照片用占位 */
export const avatarHtml = (img, name) => img
  ? `<img src="${esc(img)}" alt="${esc(name)}" loading="lazy">`
  : `<img src="${avatarSvg(name)}" alt="${esc(name)}">`;

/** 防抖（搜索输入用，limit 秒内只触发一次） */
export const debounce = (fn, ms = 220) => {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
};

/** 排名金牌样式（前 3 名强化显示） */
export const rankCls = (i) => i === 0 ? "gold" : "";

/** 位置中文注释（NBA 主位置） */
export const POS_CN = {
  G: "后卫", F: "前锋", C: "中锋",
  PG: "控球后卫", SG: "得分后卫", SF: "小前锋", PF: "大前锋",
  U: "未注明",
};
/** 短注释（列表徽章用） */
export const POS_SHORT = {
  G: "后卫", F: "前锋", C: "中锋",
  PG: "控卫", SG: "分卫", SF: "小前", PF: "大前", U: "未知",
};
export const posCn = (pos) => `${pos} ${POS_CN[pos] ?? "未知"}`;
export const posCnShort = (pos) => `${pos}${POS_SHORT[pos] ?? ""}`;

/** 球员名模糊匹配 + 相关度排序（与 Python 端 find_candidates 同语义）：
 * 全名精确(0) > 姓氏命中 james→LeBron James(1) > 名字命中 james→James Harden(2) > 其他子串(3)
 * 同权重按生涯总得分降序（巨星优先） */
export function searchPlayers(list, qraw) {
  const qmin = String(qraw ?? "").trim().toLowerCase();
  if (!qmin) return [];
  const w = (p) => {
    const nm = p.name.toLowerCase();
    const parts = nm.split(/\s+/);
    const surname = parts[parts.length - 1];
    if (nm === qmin) return 0;
    if (surname === qmin) return 1;
    if (parts[0] === qmin) return 2;
    return 3;
  };
  return list
    .filter(p =>
      p.name.toLowerCase().includes(qmin) ||
      (p.name_cn && p.name_cn.includes(qmin)) ||
      p.id.includes(qmin))
    .sort((a, b) => (w(a) - w(b)) || ((b.pts || 0) - (a.pts || 0)));
}
