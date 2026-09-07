/**
 * overview.js —— 数据总览页：概览数据卡 / 模块图 / 4 张统计表 / 图1~8 画廊 / 聚类对比 / 预测对比
 * 数据：stats.json（cards/tables/predict）+ clusters.json（compare/clusters）
 */
import { Api } from "./api.js?v=20260907";
import { $, $$, fmt, esc } from "./util.js?v=20260907";

const GALLERY = [
  ["fig01_位置分布饼图.png", "图1 位置分布（复合位置合并后的主位置）"],
  ["fig02_身高分布直方图.png", "图2 身高分布（英寸，均数约 78 英寸）"],
  ["fig03_体重分布直方图.png", "图3 体重分布（磅；约 209 公斤量级的中锋分布）"],
  ["fig04_身高体重散点图.png", "图4 身高 × 体重散点（体型分群）"],
  ["fig05_生涯总得分TOP20.png", "图5 生涯总得分 TOP20（贾巴尔 38,387 分领跑）"],
  ["fig06_年代风格演变.png", "图6 每十年风格演变（三分出手/篮板/PER）"],
  ["fig07_位置身高箱线图.png", "图7 各位置身高箱线（内线显著更高）"],
  ["fig08_球员出生地分布.png", "图8 出生地分布（加州 344 / 纽约 290 / 国际 439）"],
];

/** 通用表格渲染（首列为行标签，其余为数值列） */
function tableHTML(title, rows, note = "") {
  if (!rows?.length) return "";
  const keys = Object.keys(rows[0]);
  return `
    <div class="panel" style="margin-top:18px">
      <h3>${esc(title)}${note ? `<span class="tag">${esc(note)}</span>` : ""}</h3>
      <div class="otable-wrap">
        <table class="otable">
          <thead><tr>${keys.map(k => `<th>${esc(k)}</th>`).join("")}</tr></thead>
          <tbody>${rows.map(r => `<tr>${keys.map(k => {
            const v = r[k];
            return `<td>${typeof v === "number" && v > -10000 ? fmt(v, 2) : esc(v)}</td>`;
          }).join("")}</tr>`).join("")}</tbody>
        </table>
      </div>
    </div>`;
}

async function main() {
  try {
    const [stats, clusters] = await Promise.all([Api.stats(), Api.clusters()]);
    const cards = stats.cards;
    const zone = $("#overview-zone");

    // ---- 模块导航锚点 ----
    $("#module-nav").innerHTML = [
      ["#s-overview", "项目概览"], ["#s-stats", "描述统计"], ["#s-viz", "可视化分析"],
      ["#s-cluster", "聚类分析"], ["#s-predict", "得分预测"],
    ].map(([href, label]) => `<a class="chip" href="${href}">${label}</a>`).join("");
    $$("#module-nav .chip").forEach(a => a.onclick = (e) => {
      e.preventDefault();
      const el = $(a.getAttribute("href"));
      if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
    });

    // ---- 1. 项目概览 ----
    zone.innerHTML = `
      <section class="section" id="s-overview">
        <div class="head"><h2>项目概览</h2>
          <span class="count">清洗 → 统计 → 可视化 → 挖掘 全流程</span></div>
        <div class="cards">
          <div class="scorecard"><div class="label">赛季跨度</div>
            <div class="value">${cards.year0}–${cards.year1}</div>
            <div class="note">${cards.year1 - cards.year0 + 1} 个赛季记录</div></div>
          <div class="scorecard"><div class="label">生涯球员</div>
            <div class="value">${fmt(cards.players)}</div>
            <div class="note">去星归一化去重</div></div>
          <div class="scorecard"><div class="label">赛季记录</div>
            <div class="value">${fmt(cards.records)}</div>
            <div class="note">TOT 合计行已去重</div></div>
          <div class="scorecard"><div class="label">预测最优</div>
            <div class="value" style="font-size:20px">${esc(cards.predict_best?.算法 ?? "-")}</div>
            <div class="note">${cards.predict_best ? `R² ${cards.predict_best.R2} · MAE ${cards.predict_best.MAE} 分` : ""}</div></div>
        </div>
        <figure class="panel" style="margin-top:18px">
          <img src="figures/fig00_系统功能模块图.png?v=20260907" alt="系统功能模块图" style="width:100%">
          <figcaption style="color:#8ca3c9;font-size:12.5px;margin-top:10px">系统功能模块图（7 模块 + web 出口）</figcaption></figure>
        <figure class="panel" style="margin-top:18px">
          <img src="figures/fig00_业务流程图.png?v=20260907" alt="业务流程图" style="width:100%">
          <figcaption style="color:#8ca3c9;font-size:12.5px;margin-top:10px">业务流程图（读入→清洗→统计→分析→挖掘→交互→网页→输出）</figcaption></figure>
      </section>`;

    // ---- 2. 描述性统计（4 张表） ----
    zone.insertAdjacentHTML("beforeend",
      `<section class="section" id="s-stats">
        <div class="head"><h2>描述性统计分析</h2>
          <span class="count">球员级生涯平均口径 · 累计值均已转场均</span></div>
        ${stats.tables.map(t => tableHTML(t.title, t.rows)).join("")}
      </section>`);

    // ---- 3. 可视化分析画廊 ----
    zone.insertAdjacentHTML("beforeend",
      `<section class="section" id="s-viz">
        <div class="head"><h2>可视化分析</h2>
          <span class="count">8 张 300dpi 静态分析图（交互版见首页/对比页）</span></div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:18px">
          ${GALLERY.map(([f, cap]) => `
            <figure class="panel" style="margin:0">
              <img src="figures/${f}" alt="${esc(cap)}" loading="lazy" style="width:100%">
              <figcaption style="color:#8ca3c9;font-size:12.5px;margin-top:10px">${esc(cap)}</figcaption>
            </figure>`).join("")}
        </div>
      </section>`);

    // ---- 4. 聚类分析 ----
    zone.insertAdjacentHTML("beforeend",
      `<section class="section" id="s-cluster">
        <div class="head"><h2>聚类分析 · KMeans（K=${clusters.k}）</h2>
          <span class="count">样本 ${fmt(clusters.samples)} 人（生涯 ≥3 赛季）· 轮廓系数 ${clusters.silhouette}</span></div>
        <figure class="panel">
          <img src="figures/fig09_KMeans聚类散点图.png" alt="KMeans 聚类散点图" style="width:100%">
          <figcaption style="color:#8ca3c9;font-size:12.5px;margin-top:10px">
            图9 KMeans 聚类（得分 × 篮板平面投影；5 簇风格接近实际篮球位置语义）</figcaption></figure>
        ${tableHTML("三种聚类算法横向对比", clusters.compare,
          "为什么选 KMeans：簇数可由领域知识设定、不丢弃球员、质心可解读")}
        <div class="panel" style="margin-top:18px">
          <h3>五簇画像<span class="tag">质心特征 · 语义标签</span></h3>
          <div class="otable-wrap">
            <table class="otable">
              <thead><tr><th>簇</th><th>画像标签</th><th>人数</th><th>场均得分</th>
                <th>场均篮板</th><th>场均助攻</th><th>PER</th><th>代表球星</th></tr></thead>
              <tbody>${clusters.clusters.map(c => `
                <tr><td>${c.id}</td><td>${esc(c.label)}</td><td>${fmt(c.size)}</td>
                <td>${fmt(c.centers.pts_pg, 1)}</td><td>${fmt(c.centers.trb_pg, 1)}</td>
                <td>${fmt(c.centers.ast_pg, 1)}</td><td>${fmt(c.centers.per, 1)}</td>
                <td>${c.reps.map(r => esc(r.name)).join("、")}</td></tr>`).join("")}</tbody>
            </table>
          </div>
        </div>
      </section>`);

    // ---- 5. 得分预测 ----
    zone.insertAdjacentHTML("beforeend",
      `<section class="section" id="s-predict">
        <div class="head"><h2>赛季场均得分预测</h2>
          <span class="count">6 种算法对比，拟合赛季基础统计 → 场均得分</span></div>
        <div class="panel">
          <h3>六算法横向对比<span class="tag">R² 越高越好 · MAE/RMSE 越小越好（单位：分/场）</span></h3>
          <div class="otable-wrap">
            <table class="otable">
              <thead><tr><th>算法</th><th>R²</th><th>MAE</th><th>RMSE</th><th>样本数</th></tr></thead>
              <tbody>${stats.predict.map(r => `
                <tr><td>${esc(r.算法)}</td><td>${fmt(r.R2, 4)}</td><td>${fmt(r.MAE, 2)}</td>
                <td>${fmt(r.RMSE, 2)}</td><td>${fmt(r.样本数)}</td></tr>`).join("")}</tbody>
            </table>
          </div>
          <div class="tips"><b>结论</b>：线性回归 R²=${fmt(stats.predict[0]?.R2 ?? 0, 4)} 已接近集成算法 → 得分与所选特征基本线性；
            集成（森林/GBRT）普遍优于单决策树；<b>GBRT 最优</b>（R²=${esc(cards.predict_best?.R2 ?? "-")}）</div>
        </div>
        <div class="twocol" style="margin-top:18px">
          <figure class="panel"><img src="figures/fig10_线性回归预测效果.png" alt="线性回归预测效果" style="width:100%">
            <figcaption style="color:#8ca3c9;font-size:12.5px;margin-top:10px">图10-1 线性回归预测效果</figcaption></figure>
          <figure class="panel"><img src="figures/fig10_随机森林预测效果.png" alt="随机森林预测效果" style="width:100%">
            <figcaption style="color:#8ca3c9;font-size:12.5px;margin-top:10px">图10-2 随机森林预测效果</figcaption></figure>
        </div>
      </section>`);
  } catch (e) {
    console.error(e);
    $("#overview-zone").innerHTML = `<div class="alert">总览数据加载失败：${esc(e.message)}<br/>
      请先运行 <code>python web_generate.py</code> 生成 web/data/ 与 web/figures/。</div>`;
  }
}

main();
