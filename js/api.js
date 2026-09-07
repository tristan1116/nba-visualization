/**
 * api.js —— 数据接口层（前端契约的唯一入口）
 *
 * 当前实现：读取静态 JSON（web/data/，由 web_generate.py 离线生成）。
 * C++ 后端升级（Drogon 阶段）：只需把本文件 fetch 的 URL 换成 REST API
 * （如 /api/players、/api/players/{id}/career），其余前端代码零改动。
 */
const _cache = new Map();

/** 数据版本号：web_generate.py 重新生成静态数据后，改一下这里即可让浏览器强制取新数据 */
const VER = 20260907;

async function _get(key, url) {
  if (_cache.has(key)) return _cache.get(key);
  const res = await fetch(url + `?v=${VER}`);
  if (!res.ok) throw new Error(`${url} → HTTP ${res.status}`);
  const data = await res.json();
  _cache.set(key, data);
  return data;
}

export const Api = {
  /** 全量球员索引（3921 人，首页列表/搜索） */
  players: () => _get("players", "data/players.json"),
  /** 30 位名人堂快捷名录 */
  famous: () => _get("famous", "data/famous.json"),
  /** 聚类结果（簇画像 + 三算法对比） */
  clusters: () => _get("clusters", "data/clusters.json"),
  /** 总览数据卡 + 统计表 + 预测对比 */
  stats: () => _get("stats", "data/stats.json"),
  /** 单球员详情（懒加载） id = michael_jordan */
  career: (id) => _get(`career:${id}`, `data/career_${id}.json`),
};
