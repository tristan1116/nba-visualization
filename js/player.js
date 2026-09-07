/**
 * player.js —— 球员详情页：汇总卡 / 生涯折线（转会红线）/ 7 维雷达 / 转会卡片 / 聚类归属
 * 数据：career_{id}.json（懒加载）+ clusters.json；图表：ECharts（本地打包）
 */
import { Api } from "./api.js";
import { $, $$, fmt, esc, avatarHtml, posCn } from "./util.js";

const id = new URLSearchParams(location.search).get("id") || "";

// ---------- 通用 ----------
const CN = { mp_pg: "出场时间", pts_pg: "得分", trb_pg: "篮板", ast_pg: "助攻", stl_pg: "抢断", blk_pg: "盖帽", per: "PER" };

const heightCN = (h) => h == null ? "未知" : `${Math.floor(h / 12)}尺${Math.round(h % 12)}寸 (${fmt(h, 1)} 英寸)`;
const weightCN = (w) => w == null ? "未知" : `${fmt(w, 1)} 磅 (${fmt(w * 0.4536, 1)} 公斤)`;

/** 变化率徽章：正=玫瑰红 负=灰蓝（升级优先） */
const rateBadge = (v) => {
  if (v == null) return `<span class="rate-btn">－</span>`;
  const cls = v >= 0 ? "up" : "down";
  return `<span class="rate-btn ${cls}">${v >= 0 ? "▲" : "▼"} ${Math.abs(v)}%</span>`;
};

// ---------- 汇总卡 ----------
function renderSummary(doc) {
  const meta = [
    ["位置", posCn(doc.pos)],
    ["身高", heightCN(doc.height_in)],
    ["体重", weightCN(doc.weight_lb)],
    ["赛季", `${doc.year0}–${doc.year1}`],
    ["出场", `${fmt(doc.games)} 场`],
    ["生涯总得分", `${fmt(doc.pts)} 分`],
  ];
  if (doc.peak && doc.peak.year)
    meta.push(["巅峰赛季", `${doc.peak.year} · 场均 ${fmt(doc.peak.pts_pg, 1)} 分（${doc.peak.g} 场）`]);
  $("#summary").innerHTML = `
    <div class="photo">${avatarHtml(doc.img ?? null, doc.name)}</div>
    <div class="who">
      <h1>${esc(doc.name_cn || doc.name)} <span class="cn">${esc(doc.name_cn ? doc.name : "")}</span></h1>
      <div class="en">${esc(doc.name)} · ${esc(posCn(doc.pos))}</div>
      <div class="meta">
        ${meta.map(([k, v]) => `<span class="m">${k} <b>${v}</b></span>`).join("")}
      </div>
    </div>`;
}

// ---------- 球队阶段划分（跨赛季换队 + 赛季中转会） ----------
// 相邻赛季 tm 不同 = 一次换队；TOT 年 = 赛季中途交易（不算独立阶段，只作转会边界）
// 球队迁址/改名（与后端 FRANCHISE_MOVES 同名单）：如 SEA→OKC 超音速整体搬迁、
// NJN→BRK 篮网改址，非换队 —— 色块合并显示（"SEA/OKC"）
const FRANCHISE_MOVES = new Set(["SEA|OKC", "VAN|MEM", "NJN|BRK", "NOK|NOH", "NOH|NOP",
  "CHH|NOH", "CHA|CHO", "SYR|PHI", "STL|ATL", "BAL|CAP", "CAP|WSB", "WSB|WAS",
  "ROC|CIN", "CIN|KCO", "KCO|KCK", "KCK|SAC", "FTW|DET", "MNL|LAL", "PHW|SFW",
  "SFW|GSW", "BUF|SDC", "SDC|LAC", "MLH|STL", "SDR|HOU", "CHP|CHZ", "CHZ|BAL",
  "NYN|NJN", "TRI|MLH"]);

function teamPhases(yearly, transfers) {
  const phases = [], changes = [];
  // 换队点统一取数据源的检测结果（type: mid=赛季中转会 / off=跨赛季换队）
  for (const t of transfers)
    changes.push({ year: t.year, mid: t.type !== "off", label: t.label });
  changes.sort((a, b) => a.year - b.year);
  // 球队时期段（TOT 转会年不计入段，仅作段空白；迁址改名合并为同一段）
  for (let i = 0; i < yearly.length; i++) {
    const y = yearly[i];
    if (y.tm === "TOT") continue;
    const prev = i > 0 ? yearly[i - 1] : null;
    if (prev && phases.length &&
        (prev.tm === y.tm || FRANCHISE_MOVES.has(prev.tm + "|" + y.tm))) {
      const p = phases[phases.length - 1];
      p.y1 = y.year;
      // 段名追加：SEA → SEA/OKC（连续迁址链逐个追加；按段名末段比较防止重复追加）
      if (p.tm.split("/").pop() !== y.tm) p.tm = p.tm + "/" + y.tm;
      continue;
    }
    phases.push({ tm: y.tm, y0: y.year, y1: y.year });
  }
  return { phases, changes };
}

// ---------- 生涯走势折线（多指标叠加 + 转会红色虚线 + 缩放） ----------
const LINE_METRICS = [
  { key: "pts_pg", label: "场均得分", color: "#fdb927" },
  { key: "per", label: "效率值 PER（评分）", color: "#b48cff" },
  { key: "mp_pg", label: "场均上场时间", color: "#8ca3c9" },
  { key: "trb_pg", label: "场均篮板", color: "#4a72c4" },
  { key: "ast_pg", label: "场均助攻", color: "#e5324e" },
];
let lineChart = null;
const _defSel = ["pts_pg", "per", "mp_pg"];            // 默认同屏：得分 + 效率 + 上场时间
let selected = new Set(_defSel);

function renderLine(doc) {
  const years = doc.yearly.map(y => y.year);
  const mesh = document.createElement("div");
  mesh.id = "line-metrics";
  mesh.classList.add("tabs");
  mesh.innerHTML = LINE_METRICS.map(m => `
    <button class="t ${selected.has(m.key) ? "on" : ""}" data-k="${m.key}">${m.label}</button>`).join("");
  mesh.addEventListener("click", (e) => {
    const b = e.target.closest(".t"); if (!b) return;
    const k = b.dataset.k;
    selected.has(k) ? selected.delete(k) : selected.add(k);
    if (selected.size === 0) selected.add(k);           // 至少保留一条线
    syncTabs();
    drawLine(doc);
  });

  function syncTabs() {
    $$("#line-metrics .t").forEach(x => x.classList.toggle("on", selected.has(x.dataset.k)));
  }

  const t = doc.transfers;
  const nMid = t.filter(x => x.type !== "off").length;
  const nOff = t.length - nMid;
  $("#line-tag").textContent =
    `${t.length ? `共 ${t.length} 次换队（赛季中 ${nMid} / 跨赛季 ${nOff}）` : "生涯单队完整赛季"}`
    + " · 红虚线 = 赛季中转会 · 青虚线 = 跨赛季换队 · 色块 = 球队时期（迁址合并如 SEA/OKC）";
  drawLine(doc);

  function drawLine(d) {
    const active = LINE_METRICS.filter(m => selected.has(m.key));
    const idxOf = new Map(d.yearly.map((y, i) => [y.year, i]));
    const { phases, changes } = teamPhases(d.yearly, d.transfers);
    lineChart = lineChart || echarts.init($("#lineChart"));
    lineChart.setOption({
      backgroundColor: "transparent",
      grid: { left: 44, right: 20, top: 42, bottom: 52 },
      legend: { top: 4, textStyle: { color: "#8ca3c9", fontSize: 11.5 },
                inactiveColor: "#4a5d80", itemWidth: 16, itemHeight: 9 },
      tooltip: {
        trigger: "axis", backgroundColor: "#0d1d3e", borderColor: "#fdb92733",
        textStyle: { color: "#eaf1ff", fontSize: 12.5 },
        formatter: (ps) => {
          const y = d.yearly[ps[0].dataIndex];
          const tmText = y.tm === "TOT"            // 转会赛季显示"PHI→DEN"，而不是合计行 TOT
            ? ((d.transfers.find(x => x.year === y.year) || {}).label || "TOT") : y.tm;
          let s = `<b>${ps[0].axisValue} 赛季 · ${esc(tmText)}</b>（${y.g} 场）`;
          for (const p of ps)
            s += `<br/>${p.marker}${esc(p.seriesName)}：<b style="color:${p.color}">${fmt(p.value, 1)}</b>`;
          for (const tm of d.transfers.filter(x => x.year === ps[0].axisValue))
            s += `<br/><span style="color:#ff5470">◆ ${tm.year} 赛季中转会：${esc(tm.label)}</span>`;
          return s;
        },
      },
      xAxis: {
        type: "category", data: years,
        axisLine: { lineStyle: { color: "#31486f" } },
        axisLabel: { color: "#8ca3c9", fontSize: 10.5, rotate: 40 },
      },
      yAxis: {
        type: "value", scale: true,                    // 量级不同（得分≈20、时间≈35），scale 更舒展
        splitLine: { lineStyle: { color: "#152a4e" } },
        axisLabel: { color: "#8ca3c9", fontSize: 11 },
      },
      dataZoom: [
        { type: "inside", start: 0, end: 100 },
        { type: "slider", height: 18, bottom: 8, borderColor: "#31486f",
          handleStyle: { color: "#c8102e" }, textStyle: { color: "#8ca3c9", fontSize: 10 },
          dataBackground: { lineStyle: { color: "#31486f" }, areaStyle: { color: "#152a4e" } } },
      ],
      series: active.map((m, i) => ({
        type: "line", name: m.label, data: d.yearly.map(y => y[m.key]),
        smooth: true, symbol: "circle", symbolSize: 4.5,
        lineStyle: { width: 2.4, color: m.color }, itemStyle: { color: m.color },
        areaStyle: active.length === 1 ? {                // 单线时才加渐变填充，多线保持干净
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: m.color + "44" }, { offset: 1, color: m.color + "00" }]) } : null,
        markArea: i === 0 ? {                             // 球队时期色块（顶部标队名）
          silent: true,
          data: phases.map((p, j) => [
            { xAxis: Math.max(0, idxOf.get(p.y0) - 0.5),
              itemStyle: { color: j % 2 ? "rgba(93,122,198,0.06)" : "rgba(93,122,198,0.13)" } },
            { xAxis: idxOf.get(p.y1) + 0.5,
              label: { show: true, position: "insideTop", formatter: p.tm,
                       color: "#9db4dd", fontSize: 10.5, fontWeight: 600 } },
          ]),
        } : undefined,
        markLine: i === 0 ? {                             // 竖线：红=赛季中转会，青=跨赛季换队
          silent: true, symbol: "none",
          data: changes.map(c => ({
            xAxis: idxOf.get(c.year) - 0.5,
            lineStyle: c.mid ? { color: "#ff5470", width: 1.6, type: "dashed" }
                             : { color: "#35a2ff", width: 1.6, type: "dashed" },
            label: { show: true, position: "insideEndTop",
                     color: c.mid ? "#ff5470" : "#35a2ff", fontSize: 10.5,
                     formatter: () => c.mid ? `${c.year} 转会` : c.label },
          })),
        } : undefined,
      })),
    }, true);
  }
}

// ---------- 7 维雷达（金环 = 联盟平均 1.0 倍） ----------
function renderRadar(doc) {
  const dims = doc.radar.dims, vals = doc.radar.values;
  const max = Math.max(1.2, ...vals) * 1.15;
  echarts.init($("#radarChart")).setOption({
    backgroundColor: "transparent",
    legend: { bottom: 0, textStyle: { color: "#8ca3c9", fontSize: 11.5 },
              data: [doc.name, "联盟平均"] },
    tooltip: { backgroundColor: "#0d1d3e", borderColor: "#fdb92733",
               textStyle: { color: "#eaf1ff", fontSize: 12.5 },
               formatter: (p) => p.dataIndex === 0
                 ? `${esc(p.name)}：<br/>` + dims.map((dn, i) =>
                     `${dn} <b style="color:#fdb927">${vals[i]}×</b>`).join("<br/>")
                 : "联盟平均水平（1.0 倍基准圈）" },
    radar: {
      indicator: dims.map(dn => ({ name: dn, max })),
      radius: "64%",
      splitNumber: 4,
      axisName: { color: "#8ca3c9", fontSize: 11.5 },
      axisLine: { lineStyle: { color: "#31486f" } },
      splitLine: { lineStyle: { color: "#152a4e" } },
      splitArea: { areaStyle: { color: ["rgba(29,66,138,0.12)", "rgba(7,15,30,0.1)"] } },
    },
    series: [{
      type: "radar",
      data: [
        { value: vals.map(v => Math.max(v, 0.02)), name: doc.name,
          lineStyle: { color: "#fdb927", width: 2.5 },
          itemStyle: { color: "#fdb927" },
          areaStyle: { color: "rgba(200,16,46,0.30)" } },
        { value: dims.map(() => 1.0), name: "联盟平均",
          lineStyle: { color: "#f0f5ff", width: 1.4, type: "dashed" },
          itemStyle: { color: "#f0f5ff" }, symbol: "none", areaStyle: { color: "rgba(255,255,255,0.02)" } },
      ],
    }],
  });
}

// ---------- 转会前后对比卡片 ----------
function renderTransfers(doc) {
  const tlist = doc.transfers;
  $("#transfer-tag").textContent = tlist.length ? `共 ${tlist.length} 次` : "单队完整赛季";
  if (!tlist.length) {
    $("#transfers").innerHTML = `<div class="empty">该球员生涯无球队变化记录（单队完整赛季）</div>`;
    return;
  }
  const keys = Object.keys(CN);
  let cur = tlist[0];
  const wrap = $("#transfers");

  const render = (t) => {
    const rows = keys.map(k => {
      const cls = t.change[k] == null ? "" : t.change[k] > 0 ? "win" : "lose";
      return `
      <tr>
        <td>${CN[k]}</td>
        <td class="${cls === "win" ? "lose" : cls === "lose" ? "win" : ""}">${fmt(t.before[k], 1)}</td>
        <td class="${cls}">${fmt(t.after[k], 1)}</td>
        <td>${rateBadge(t.change[k])}</td>
      </tr>`;
    }).join("");
    wrap.innerHTML = `
      <div class="tabs">
        ${tlist.map(x => `<button class="t ${x === cur ? "on" : ""}" data-i="${tlist.indexOf(x)}">${x.type === "off" ? "跨赛季" : "赛季中"} ${x.year} ${esc(x.label)}</button>`).join("")}
      </div>
      <div style="background:rgba(7,15,30,.45);border-radius:10px;padding:12px 14px">
        <table class="diff-table">
          <thead><tr>
            <th>指标</th><th>转会前 (${esc(t.teams[0])})</th><th>转会后 (${esc(t.teams.slice(-1)[0])})</th><th>变化</th>
          </tr></thead>
          <tbody>${rows}</tbody>
        </table>
        <div style="margin-top:10px;color:#8ca3c9;font-size:12.5px">
          ${t.year} 赛季${t.type === "off" ? "跨赛季换队" : "中转会"}：${esc(t.label)}；
          ${t.type === "off"
            ? `取换队前一个完整赛季（${t.before.g} 场）vs 新队首个完整赛季（${t.after.g} 场）`
            : `TOT 整季合计 ${t.tot.g} 场（前 ${t.before.g} 场 + 后 ${t.after.g} 场）`}。
          阶段场次越短随机波动越大，请结合场次与角色解读。
        </div>
      </div>`;
  };
  wrap.addEventListener("click", (e) => {
    const b = e.target.closest(".t"); if (!b) return;
    cur = tlist[Number(b.dataset.i)];
    render(cur);
  });
  cur = tlist[0];
  render(cur);
}

// ---------- 聚类归属 ----------
function renderCluster(doc, clusters) {
  const cid = doc.cluster;
  if (cid == null) {
    $("#cluster-tag").textContent = "未参与聚类";
    $("#cluster").innerHTML = `<div class="empty">该球员生涯不足 3 个赛季或特征缺失，未进入聚类样本（KMeans 样本 = 生涯 ≥3 赛季的 ${fmt(clusters.samples)} 人）</div>`;
    return;
  }
  const c = clusters.clusters.find(x => x.id === cid);
  $("#cluster-tag").textContent = `簇${cid} · ${c.size} 人`;
  const cen = c.centers;
  $("#cluster").innerHTML = `
    <div style="font-size:17px;font-weight:800;color:#fdb927">❋ ${esc(c.label)}</div>
    <div style="color:#8ca3c9;font-size:13px;margin:6px 0 12px">
      簇特征：场均 ${fmt(cen.pts_pg, 1)} 分 · ${fmt(cen.trb_pg, 1)} 板 · ${fmt(cen.ast_pg, 1)} 助 · PER ${fmt(cen.per, 1)}
      （该簇 ${c.size} 人，含 ${clusters.compare.find(x => x.算法 === "KMeans").轮廓系数} 轮廓的 KMeans 分群）
    </div>
    <div style="font-size:12.5px;color:#8ca3c9;margin-bottom:8px">同簇代表球星：</div>
    <div class="hall" style="padding-bottom:4px">
      ${c.reps.map(r => `
        <a class="ht" href="player.html?id=${esc(r.id)}" title="${esc(r.name)}">
          <span class="cn" style="font-size:12.5px">${esc(r.name)}</span>
          <span class="en">${fmt(r.pts_pg, 1)} 分</span>
        </a>`).join("")}
    </div>`;
}

// ---------- 主流程 ----------
async function main() {
  if (!id || id.includes("..")) { location.href = "index.html"; return; }
  try {
    const [doc, clusters] = await Promise.all([Api.career(id), Api.clusters()]);
    document.title = `${doc.name} · NBA 球员数据中心`;
    renderSummary(doc);
    renderLine(doc);
    renderRadar(doc);
    renderTransfers(doc);
    renderCluster(doc, clusters);
    $("#vs-link").href = `compare.html?p1=${encodeURIComponent(id)}`;
    $("#summary").querySelector("#summary-skeleton")?.remove();
  } catch (e) {
    console.error(e);
    $("#summary").innerHTML = `<div class="alert">球员详情加载失败：${esc(e.message)}<br/>
      请确认 id 正确（如 player.html?id=michael_jordan）。</div>`;
  }
  window.addEventListener("resize", () => {
    ["#lineChart", "#radarChart"].forEach(s => {
      const el = $(s); if (el) echarts.getInstanceByDom(el)?.resize();
    });
  });
}

main();
