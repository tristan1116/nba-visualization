/**
 * compare.js —— 双星对比页：双选择器（模糊搜索）+ 双雷达（图13 口径：按两人较大值归一化）
 * + 差值表 + 自动点评（|差值比例| > 15% 判定明显差距）
 * URL 参数：?p1=michael_jordan&p2=lebron_james 可预填（详情页"与他对比"跳转带 p1）
 */
import { Api } from "./api.js";
import { $, $$, fmt, esc, avatarHtml, posCn, searchPlayers, debounce } from "./util.js";

const CN = { mp_pg: "出场时间", pts_pg: "得分", trb_pg: "篮板", ast_pg: "助攻", stl_pg: "抢断", blk_pg: "盖帽", per: "PER" };
const COLORS = ["#fdb927", "#4a72c4"];     // 球员A金 / 球员B蓝

const params = new URLSearchParams(location.search);
let players = [];
const sel = { a: null, b: null };          // 两人已选数据（career JSON）

// ---------- 选择器（自动补全下拉） ----------

function initCombo(side) {
  const root = $(`#combo-${side}`);
  const input = root.querySelector("input");
  const ul = root.querySelector("ul");

  const show = (q) => {
    const hits = searchPlayers(players, q).slice(0, 8);
    ul.innerHTML = hits.length ? hits.map(p => `
      <li data-id="${esc(p.id)}">
        <span style="width:34px;height:34px;border-radius:50%;overflow:hidden;flex:0 0 auto">
          ${avatarHtml(p.img, p.name)}
        </span>
        <span>${esc(p.name_cn || p.name)}</span>
        <small>${esc(p.name)} · ${esc(posCn(p.pos))}</small>
      </li>`).join("") : `<li class="off">未找到，换个关键词试试</li>`;
    ul.hidden = !hits.length;
  };

  input.addEventListener("input", debounce(() => show(input.value), 180));
  input.addEventListener("focus", () => { if (input.value) show(input.value); });
  ul.addEventListener("click", (e) => {
    const li = e.target.closest("li[data-id]"); if (!li) return;
    pick(side, li.dataset.id);
    ul.hidden = true;
  });
  document.addEventListener("click", (e) => {
    if (!root.contains(e.target)) ul.hidden = true;   // 点外面关闭
  });
}

async function pick(side, id) {
  if (!id || id.includes("..")) return;
  try {
    const doc = await Api.career(id);
    sel[side] = doc;
    const input = $(`#pick-${side}`);
    input.value = `${doc.name_cn || doc.name} (${doc.name})`;
    // URL 同步，可分享/刷新保持
    const p = new URLSearchParams(location.search);
    p.set(side === "a" ? "p1" : "p2", doc.id);
    history.replaceState(null, "", `?${p}`);
    renderCompare();
  } catch (e) {
    console.error(e);
    $(`#pick-${side}`).value = "";   // 无效 id 直接清空
  }
}

// ---------- 对比渲染（双雷达 + 差值表 + 点评） ----------

function renderCompare() {
  const a = sel.a, b = sel.b;
  if (!a || !b) return;
  const $z = $("#compare-zone");

  // 7 维差值（与 data_profile.compare_two 同口径）
  const rows = Object.keys(CN).map(k => {
    const va = a.avg[k], vb = b.avg[k];
    if (va == null || vb == null) return null;
    const denom = Math.max(Math.abs(va), Math.abs(vb));
    const ratio = denom ? ((va - vb) / denom * 100) : 0;
    return { k, cn: CN[k], a: va, b: vb, diff: va - vb, ratio };
  }).filter(Boolean);

  // 点评：|差值比例| > 15% 视为明显差距（最多列前 3）
  const strong = [...rows].filter(r => Math.abs(r.ratio) > 15)
    .sort((x, y) => Math.abs(y.ratio) - Math.abs(x.ratio)).slice(0, 3);
  const tips = strong.length
    ? strong.map(r =>
        `${r.ratio > 0 ? a.name : b.name} 的${r.cn}更高（${Math.abs(r.ratio).toFixed(0)}%）`).join("；")
      + "。两人风格差异清晰。"
    : `${a.name} 与 ${b.name} 各项指标差距均在 15% 以内，风格接近（差异主要来自时代与位置）。`;

  $z.innerHTML = `
    <!-- 两位球星名牌 -->
    <div class="cards" style="grid-template-columns:1fr 1fr;margin-top:26px" id="compare-cards">
      ${[a, b].map((d, i) => `
        <div class="scorecard">
          <div class="label">${i === 0 ? "球员 A" : "球员 B"} · ${esc(posCn(d.pos))}</div>
          <div style="display:flex;gap:14px;align-items:center;margin-top:8px">
            <span class="ava" style="width:64px;height:64px">${avatarHtml(d.img ?? null, d.name)}</span>
            <div>
              <div style="font-size:18px;font-weight:800">${esc(d.name_cn || d.name)}</div>
              <div style="font-size:12px;color:var(--muted)">${esc(d.name)}<br/>${d.year0}–${d.year1} · ${fmt(d.games)} 场 · ${fmt(d.pts)} 分</div>
            </div>
          </div>
        </div>`).join("")}
    </div>

    <div class="twocol">
      <div class="panel">
        <h3>双星 7 维雷达<span class="tag">按两人较大值归一化</span></h3>
        <div class="chart" id="vsChart"></div>
      </div>
      <div class="panel">
        <h3>指标差值</h3>
        <table class="diff-table">
          <thead><tr>
            <th>指标</th><th>${esc(a.name)}</th><th>${esc(b.name)}</th>
            <th>差值</th><th>比例%</th><th>更高</th>
          </tr></thead>
          <tbody>
            ${rows.map(r => `
              <tr>
                <td>${r.cn}</td>
                <td class="${r.a > r.b ? "win" : "lose"}">${fmt(r.a, 2)}</td>
                <td class="${r.b > r.a ? "win" : "lose"}">${fmt(r.b, 2)}</td>
                <td>${fmt(r.diff, 2)}</td>
                <td>${Math.abs(r.ratio).toFixed(1)}%</td>
                <td class="${Math.abs(r.ratio) > 15 ? "win" : ""}">${r.ratio > 0 ? esc(a.name) : r.ratio < 0 ? esc(b.name) : "持平"}</td>
              </tr>`).join("")}
          </tbody>
        </table>
        <div class="tips"><b>点评</b>：${esc(tips)}</div>
      </div>
    </div>`;

  // 双雷达（较大值归一化：每维较高者满格）
  const dims = a.radar.dims;
  const vals = dims.map((_, i) => {
    const va = Math.max(a.radar.values[i] ?? 0, 0.02);
    const vb = Math.max(b.radar.values[i] ?? 0, 0.02);
    const m = Math.max(va, vb);
    return [va / m, vb / m];
  });
  echarts.init($("#vsChart")).setOption({
    backgroundColor: "transparent",
    legend: { bottom: 0, textStyle: { color: "#8ca3c9", fontSize: 11.5 },
              data: [a.name, b.name] },
    tooltip: { backgroundColor: "#0d1d3e", borderColor: "#fdb92733",
               textStyle: { color: "#eaf1ff", fontSize: 12.5 },
               formatter: (p) => `${esc(p.name)}：<br/>` + dims.map((dn, i) =>
                 `${dn} <b style="color:${COLORS[p.dataIndex]}">${[a, b][p.dataIndex].radar.values[i]}×</b>`).join("<br/>") },
    radar: {
      indicator: dims.map(dn => ({ name: dn, max: 1 })),
      radius: "62%", splitNumber: 4,
      axisName: { color: "#8ca3c9", fontSize: 11.5 },
      axisLine: { lineStyle: { color: "#31486f" } },
      splitLine: { lineStyle: { color: "#152a4e" } },
      splitArea: { areaStyle: { color: ["rgba(29,66,138,0.12)", "rgba(7,15,30,0.1)"] } },
    },
    series: [{
      type: "radar",
      data: [
        { value: vals.map(v => v[0]), name: a.name,
          lineStyle: { color: COLORS[0], width: 2.5 }, itemStyle: { color: COLORS[0] },
          areaStyle: { color: "rgba(253,185,39,0.20)" } },
        { value: vals.map(v => v[1]), name: b.name,
          lineStyle: { color: COLORS[1], width: 2.5 }, itemStyle: { color: COLORS[1] },
          areaStyle: { color: "rgba(74,114,196,0.20)" } },
      ],
    }],
  });
}

// ---------- 主流程 ----------

async function main() {
  try {
    players = (await Api.players()).players;
  } catch (e) {
    $("#vs-selects").insertAdjacentHTML("afterend",
      `<div class="alert">球员索引加载失败：${esc(e.message)}（先运行 web_generate.py 生成 web/data/）</div>`);
    return;
  }
  initCombo("a");
  initCombo("b");
  const p1 = params.get("p1"), p2 = params.get("p2");
  if (p1) pick("a", p1);
  if (p2) pick("b", p2);
}

window.addEventListener("resize", () => {
  const el = $("#vsChart");
  if (el) echarts.getInstanceByDom(el)?.resize();
});

main();
