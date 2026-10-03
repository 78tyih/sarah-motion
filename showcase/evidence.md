# evidence.md · sarah-motion

事实清单。展示文案只能引用本文件能支撑的结论；写不出来的一律标「未验证」。

## 已验证（Observed）

| 事实 | 方式 | 日期 |
|---|---|---|
| media/ 下 22 个 mp4 存在（basic 11 + quote 11，最大 468KB） | GitHub API 文件列表实查 | 2026-10-03 |
| 仓库结构 = engine.js + 4 模板 + build.mjs + render.py + fonts/ + dist/ | GitHub API 实查 | 2026-10-03 |
| README 含六条语法、token 表、22 组件清单、渲染命令 | GitHub API 实读 | 2026-10-03 |
| jsDelivr 以 `video/mp4` 分发 media/*.mp4（HTTP 200） | curl 实测 | 2026-10-03 |
| GitHub Pages（main /docs）以 `text/html` 提供 showcase.html 与 spec-atlas.html（HTTP 200） | curl 实测 | 2026-10-03 |
| GitHub README 渲染 Mermaid 代码块（页面含 data-type="mermaid"） | curl 抓取仓库首页实查 | 2026-10-03 |
| jsDelivr 对 .html 返回 `text/plain`（nosniff）→ 不能当 HTML 展示页宿主 | curl 实测 | 2026-10-03 |

## 自述未独立复核（Inferred · Self-reported）

| 声明 | 复核方式 |
|---|---|
| 循环闭合 t=0 vs t=20 max diff = 0 | `python render.py loop basic` / `loop quote`（本地跑一次即可升级为已验证） |
| 60fps、120 BPM、20.0s 闭环 | 设计参数，读 spec 可确认 |
| 渲染管线约 4 分钟 / 1200 帧 × 4 子帧 | 本地跑一次计时 |

## 未验证（Unknown）

| 项 | 计划 |
|---|---|
| GitHub README 内嵌 `<video>` 仓库文件的播放行为 | 当前 README 未内嵌视频（视频走展示页），该项暂不需要；若未来要内嵌再实测 |

## 授权边界

- 仓库无 LICENSE 文件（实查 2026-10-03）→ 默认版权保留，他人不可直接复制代码。展示页「复用」章节的表述须体现这一点：**方法论可参考，代码未授权复制**。建议补 MIT。
