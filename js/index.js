/**
 * index.js —— 首页：数据卡 / 即时搜索 / 名人堂快捷入口 / 全量列表（排序+筛选+分页）
 * 只依赖 Api（数据接口层）与 util（展示工具）。
 */
import { Api } from "./api.js";
import { $, $$, fmt, esc, avatarHtml, debounce, POS_CN, posCnShort, searchPlayers } from "./util.js";

// ---------- 全局状态 ----------
const state = {
  players: [],
  famous: [],
  stats: null,
  q: "",           // 搜索关键字（非空 = 搜索模式）
  pos: "all",      // 位置筛选
  sort: "pts",     // 当前排序字段
  page: 1,         // 当前页
  pageSize: 20,
};

let totalPage = 1;

// ---------- 渲染 ----------

function renderCards() {
  const cards = state.stats.cards;
  const items = [
    { label: "赛季跨度", value: `${cards.year0}–${cards.year1}`, note: `${cards.year1 - cards.year0 + 1} 个赛季记录` },
    { label: "球员总数", value: fmt(cards.players), note: "去星归一化后去重" },
    { label: "赛季记录", value: fmt(cards.records), note: "TOT 合计行已去重" },
    { label: "聚类 KMeans", value: `${cards.k} 簇 · ${cards.silhouette}`, note: `样本 ${fmt(cards.cluster_samples)} 人 · 7 特征` },
  ];
  $("#cards").innerHTML = items.map(i => `
    <div class="scorecard">
      <div class="label">${i.label}</div>
      <div class="value">${i.value}</div>
      <div class="note">${i.note}</div>
    </div>`).join("");
}

function renderHall() {
  const famous = state.famous.players;
  $("#hall-count").textContent = `共 ${famous.length} 位 · 点击直达详情`;
  $("#hall").innerHTML = famous.map(p => `
    <a class="ht" href="player.html?id=${esc(p.id)}" title="${esc(p.name)}">
      <span class="img">${avatarHtml(p.img, p.name)}</span>
      <span class="cn">${esc(p.name_cn)}</span>
      <span class="en">${esc(p.name)}</span>
    </a>`).join("");
}

// ---------- 列表（筛选/排序/分页） ----------

const POS_LIST = ["all", "G", "F", "C", "PG", "SG", "SF", "PF", "U"];

function filtered() {
  const q = state.q.trim().toLowerCase();
  let list = state.players;
  if (state.pos !== "all") list = list.filter(p => p.pos === state.pos);
  if (q) {
    list = list.filter(p =>
      p.name.toLowerCase().includes(q) ||
      (p.name_cn && p.name_cn.includes(q)) ||
      p.id.includes(q));
  }
  return list;
}

function renderFilter() {
  $("#filter").innerHTML = POS_LIST.map(pos => `
    <button class="chip ${pos === state.pos ? "on" : ""}" data-pos="${pos}">
      ${pos === "all" ? "全部位置" : `${pos} ${POS_CN[pos] ?? ""}`}
    </button>`).join("");
  $$("#filter .chip").forEach(ch => ch.onclick = () => {
    state.pos = ch.dataset.pos; state.page = 1;
    renderFilter(); renderList();
  });
}

const SORT_KEYS = [
  ["pts", "总分", "gold"],
  ["pts_pg", "场均", ""],
  ["per", "PER", ""],
  ["games", "场次", ""],
  ["name", "姓名", ""],
];

function renderTh() {
  let html = `<div class="tr th">
      <span>排名</span><span></span><span>球员</span><span>位置</span>
      <span class="cc">赛季</span><span class="cc">场次</span>`;
  for (const [key, label, cls] of SORT_KEYS) {
    const arr = state.sort === key ? (state.dir === 1 ? " ▲" : " ▼") : "";
    html += `<span class="num ${cls}"><span class="sort" data-sort="${key}">${label}${arr}</span></span>`;
  }
  html += `<span></span></div>`;
  $("#table").innerHTML = html;
  $$("#table .sort").forEach(el => el.onclick = () => {
    const key = el.dataset.sort;
    if (state.sort === key) state.dir = -state.dir;
    else { state.sort = key; state.dir = (key === "name") ? 1 : -1; }
    state.page = 1; renderList();
  });
  return html;
}

function renderRows(list) {
  const start = (state.page - 1) * state.pageSize;
  const rows = list.slice(start, start + state.pageSize);
  return rows.map((p, i) => `
    <div class="tr row" data-id="${esc(p.id)}">
      <span class="rank ${i + start < 3 ? "gold" : ""}">${start + i + 1}</span>
      <span class="ava">${avatarHtml(p.img, p.name)}</span>
      <span class="who">
        <div class="cn">${esc(p.name_cn || p.name)}</div>
        <div class="en">${esc(p.name)}</div>
      </span>
      <span><span class="b" title="${esc(`${p.pos} ${POS_CN[p.pos] ?? ""}`)}">${esc(posCnShort(p.pos))}</span></span>
      <span class="num cc">${p.year0}–${p.year1}</span>
      <span class="num cc">${fmt(p.games)}</span>
      <span class="num gold">${fmt(p.pts)}</span>
      <span class="num cc">${fmt(p.pts_pg, 1)}</span>
      <span class="num cc">${fmt(p.per, 1)}</span>
      <span class="go">→</span>
    </div>`).join("");
}

function renderList() {
  const list = state.q ? searchPlayers(state.players, state.q)
                       : [...filtered()];
  if (!state.q) list.sort((a, b) => {
    const ok = state.sort, dir = state.dir;
    if (ok === "name") return dir * String(a.name).localeCompare(b.name, "en");
    const va = a[ok] ?? -Infinity, vb = b[ok] ?? -Infinity;
    return dir * (va - vb);
  });

  totalPage = Math.max(1, Math.ceil(list.length / state.pageSize));
  if (state.page > totalPage) state.page = totalPage;

  renderTh();
  const q = state.q;
  if (q) {
    $("#list-count").textContent = `搜索「${q}」· 命中 ${list.length} 人`;
  } else {
    $("#list-count").textContent = `共 ${fmt(list.length)} 人 · 按${state.sort === "pts" ? "生涯总得分" : state.sort}排序`;
  }

  if (!list.length) {
    $("#table").innerHTML = renderTh() + `<div class="empty">没有找到匹配的球员，试试英文名或中文名？</div>`;
    $("#pager").innerHTML = "";
    return;
  }
  $("#table").innerHTML = renderTh() + renderRows(list);

  // 行点击 → 详情页
  $$("#table .row").forEach(r => r.onclick = () => location.href = `player.html?id=${r.dataset.id}`);

  // 分页器（手动输入页码跳转）
  const pager = $("#pager");
  if (!q) {
    pager.innerHTML = `
      <button class="pg-btn" id="pg-prev" ${state.page <= 1 ? "disabled" : ""}>‹ 上一页</button>
      <span class="info">第 <b>${state.page}</b> / ${totalPage} 页 · 共 ${fmt(list.length)} 人</span>
      <input type="number" class="pg-input" id="pg-goto" min="1" max="${totalPage}"
             placeholder="页码" title="输入页码后回车或点跳转">
      <button class="pg-btn" id="pg-jump">跳转</button>
      <button class="pg-btn" id="pg-next" ${state.page >= totalPage ? "disabled" : ""}>下一页 ›</button>`;
    $("#pg-prev").onclick = () => { state.page--; renderList(); };
    $("#pg-next").onclick = () => { state.page++; renderList(); };
    const jump = () => {
      const v = parseInt($("#pg-goto").value, 10);
      if (!v || v < 1 || v > totalPage) { $("#pg-goto").value = ""; return; }   // 非法输入清空即可
      state.page = v;
      $("#pg-goto").value = "";
      renderList();
      $("#table").scrollIntoView({ behavior: "smooth", block: "start" });      // 回到列表置顶
    };
    $("#pg-jump").onclick = jump;
    $("#pg-goto").addEventListener("keydown", (e) => { if (e.key === "Enter") jump(); });
  } else pager.innerHTML = "";
}

// 搜索：骨架示例（先加载完再列表）
function skeleton() {
  $("#table").innerHTML = Array.from({ length: 5 }, () => `<div class="skeleton"></div>`).join("");
}

// ---------- 搜索交互 ----------

/** 回车/GO：唯一命中直达详情；多命中弹候选浮层（对齐 Python 端"列出候选供选择"） */
function goSearch(first = false) {
  const q = $("#q").value.trim();
  state.q = q; state.page = 1;
  if (!q) { renderFilter(); renderList(); return; }
  const hits = searchPlayers(state.players, q);   // 搜索全库（忽略位置筛选）
  if (first && q) {
    if (!hits.length) {
      $("#search-tip").innerHTML = `未找到「${esc(q)}」，尝试英文名（如 iverson）；中文名（如 乔丹）`;
      closePicker();
      return;
    }
    if (hits.length === 1) location.href = `player.html?id=${hits[0].id}`;
    else showPicker(hits, q);
  } else renderList();
}

function showPicker(hits, q) {
  const list = hits.slice(0, 10);
  const picker = $("#search-picker");
  picker.innerHTML = `
    <div class="p-head">「${esc(q)}」命中 <b>${hits.length}</b> 人${hits.length > 10 ? "，显示前 10 位" : ""} —— 点击选择 / Esc 关闭</div>
    ${list.map(p => `
      <a class="p-item" href="player.html?id=${esc(p.id)}">
        <span class="p-ava">${avatarHtml(p.img, p.name)}</span>
        <span class="p-name">${esc(p.name_cn || p.name)}<small>${esc(p.name)} · ${esc(p.pos)}</small></span>
        <span class="p-meta">${p.year0}–${p.year1} · ${fmt(p.pts)} 分</span>
      </a>`).join("")}`;
  picker.hidden = false;
}

function closePicker() {
  const picker = $("#search-picker");
  if (picker) picker.hidden = true;
}

// ---------- 初始化 ----------

async function main() {
  try {
    const [players, famous, stats] = await Promise.all([Api.players(), Api.famous(), Api.stats()]);
    state.players = players.players;
    state.famous = famous;
    state.stats = stats;

    renderCards();
    renderHall();
    renderFilter();
    renderList();
  } catch (e) {
    console.error(e);
    $("#cards").innerHTML = `<div class="alert">数据加载失败：${esc(e.message)}<br>
      请先运行 <code>python web_generate.py</code> 生成 web/data/，再用 http.server 访问。</div>`;
  }
}

$("#q").addEventListener("input", debounce(() => goSearch(false), 230));
$("#q").addEventListener("keydown", (e) => {
  if (e.key === "Enter") goSearch(true);
  if (e.key === "Escape") closePicker();
});
$("#q-go").addEventListener("click", () => goSearch(true));
document.addEventListener("click", (e) => {
  if (!e.target.closest(".search-zone")) closePicker();   // 点击搜索区外自动关浮层
});

main();
