# NBA 球员可视化网站

杭电《软件开发实践1》大作业《NBA 球员信息统计及可视化》的浏览器端可视化前端。

## 技术栈

- 原生 HTML5 + CSS3 + 原生 JS（ES Modules），零构建链
- ECharts 5.x 
- 数据层：`web/data/` 六类 JSON（由项目 `web_generate.py` 从分析模块离线生成，与命令行口径一致）
- 接口层：`js/api.js` REST 风格契约
- 主题：暗夜红金（#070F1E / #C8102E / #FDB927）

## 页面

| 页面 | 地址 | 功能 |
|---|---|---|
| 首页 | `index.html` | 数据卡、即时搜索、30 位名人堂快捷、全量列表（筛选+分页） |
| 球星页 | `player.html` | 汇总卡、5 指标叠加走势（转会红/青线 + 球队色块）、7 维雷达、转会对比、聚类归属 |
| 对比页 | `compare.html` | 双星雷达、差值表、自动点评 |
| 总览页 | `overview.html` | 模块图、四类统计表、图画廊、算法结论 |

## 本地预览

```bash
cd web
python -m http.server 8080
# 打开 http://localhost:8080/index.html
```

## 重新生成数据

在项目根目录（`nba_analysis/`）运行 `python web_generate.py`，更新数据后需同步修改 `js/api.js` 顶部的 `VER` 常量（缓存版本号）。
