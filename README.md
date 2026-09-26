# Sarah · 动效组件库

Animated component library for UI motion. Every component is a **pure function of time** — one shape, never cut, morphing its own size, radius and colour while content switches inside a brief blur. The cursor drives every change. Springs everywhere, slight overshoot at most.

不是一堆动效 demo，是一套有语法的库。

---

## 语法（六条硬规则）

1. **每帧从时间计算。** `seek(t)` 是纯函数：无 CSS transition、无定时器、无帧间状态携带。任意时刻可求值，可任意跳转。
2. **弹簧是闭式阶跃响应。** 多次改变目标 = 每次变化一个弹簧之和，所以值始终是时间的纯函数。
   `x(t) = x₀ + Σ Δᵢ · step(t − tᵢ)`，`step(τ) = 1 − e^(−ζωτ)(cos ω_d τ + ζω/ω_d · sin ω_d τ)`
3. **拖拽是直接操作。** 光标按住时，值由光标位置直接算出；释放时从**当前实际位置**弹回，不是从预设值弹回。
4. **领先边缘与尾随边缘骑不同弹簧。** 标签指示器、开关旋钮用两个弹簧（领先 ω 17 / 尾随 ω 13），领先边缘先到，形状在行程中被拉伸。
5. **内容切换自带进出时机。** 旧内容先模糊退出（0.20s），新内容再模糊进入（0.25s），不重叠。
6. **循环必须闭合。** 末帧 = 首帧，含光标位置与速度。最后一段弹簧留 ≥0.6s 且 ω ≥ 20，否则残差可见。

## 设计 Token

| 项 | 值 |
|---|---|
| 画布 | `#F2F0ED` 浅暖灰 |
| 墨 / 纸 | `#0A0A0A` / `#FFFFFF` |
| 强调色 | `#4F8CFF`（只在"有值 / 激活"处出现） |
| 线 | `#DCD7CE` |
| 涨 / 跌 | `#30A46C` 绿 / `#E5484D` 红（国际口径） |
| 弹簧 | ω 13–17 rad/s，ζ 0.60–0.72，最多轻微超调 |
| 字体 | Geist（woff2 内联，渲染零外链） |
| 画布 | 1440 × 1440，60fps |
| 节拍 | 120 BPM，1 拍 = 0.5s，重拍对小节线 |

## 组件清单

**基础 · Basic**（已交付 11 个）

Button · Loader · Checkmark · Music player · Progress · Volume slider · Switch · Liquid tabs · Chart · Command ⌘K · Notification

**数据 · Data**（规划 6 个）

Sparkline · Candle · Donut · Gauge · Heatbar · Ticker

**金融 · Quote Morph**（已交付 11 个）

Price tag · Tick feed · Fill confirm · Session replay · Scrub timeline · **Leverage** · Paper/Live · Timeframe · Equity curve · Symbol ⌘K · Watchlist toast

金融区块只守一条配色纪律：**蓝 = 中性 / 操作，绿 = 涨 / 盈利，红 = 跌 / 风险过载**（国际口径，涨绿跌红）。勾选、进度填充、开关 ON、指示器一律用蓝，绿红只留给盈亏方向。

## Quote Morph — 金融展示页组件

沿用已验证的 10 拍语法，把语义整体换成金融。120 BPM / 10 小节 / 40 拍 / 20.0s 闭合循环。

| 小节 | 形态 | 金融语义 | 关键动作 |
|---|---|---|---|
| 1 | 价格标签 | 报价 pill | ¥ 数字 + 涨跌幅，光标按下回弹 |
| 2 | 加载器 | tick 流接入 | 收成圆，弧扫 3 圈 |
| 3 | 成交确认 | 打勾 | 笔画自绘 |
| 4 | 行情播放器 | 分时回放 | 播放 / 暂停变形 |
| 5 | 回放进度条 | 拖时间轴 | 光标抓住播放头拖动 |
| 6 | **杠杆滑块** | 拖过最大值 | **过载：元素拉伸 + 转警示色** |
| 7 | 开关 | 模拟 / 实盘 | 翻转 |
| 8 | 液体标签 | 1m / 5m / 1h / 1D | 指示器拉伸 |
| 9 | 净值曲线 | 自绘 + tooltip | 悬停显示最大回撤 |
| 10 | ⌘K 代码搜索 | 过滤 → 回车 → 通知 → 回标签 | 加入自选 |

第 6 拍是这套组件独有的张力：**滑块拖过最大杠杆时，整个元素拉伸、填充转风险红、相机同时后退**——通用组件库做不出来。

引擎是 spec 驱动的（`MorphEngine.engines.basic` / `.quote`），加一个组件族 = 加一份 spec（geometry / windows / 内容渲染 / 光标），不动核心。

## 循环闭合

两个 spec 的 t=0 与 t=20 逐像素比对 **max diff = 0**。做法：最后两次形态变形用 ω 24 / ζ 0.85 快收（残差 1e-7 级），光标最后一次位移同理。之前用默认 ω 14 时残差 0.03px，会让 Chrome 把文字栅格化相位挪一个整设备像素，肉眼看是循环点上文字抖一下。

```bash
python render.py loop basic   # basic  loop closure: max=[0,0,0] pixels>20=0
python render.py loop quote   # quote  loop closure: max=[0,0,0] pixels>20=0
```

**验收 mp4 时别看首尾帧的绝对值。** 编码后 `frame 0` 与 `frame 1199` 永远有差，因为 tmix 把 4 个子帧混成 1 帧：第 0 帧混的是 t∈[0, 0.0125]，末帧混的是 t∈[19.983, 20]。正确的判据是**和噪声底比**：

```
0 vs 1    (相邻帧)   = 60      ← 噪声底
0 vs 1199 (循环点)   = 60      ← 同级 → 无缝
0 vs 600  (无关帧)   = 245     ← 真实内容差异
```

## 目录结构

```
src/engine.js              引擎：弹簧 / 时间轴 / 11 个状态渲染器
src/morph.template.html    20s 循环动画模板（含播放控制与逐帧拖条）
src/library.template.html  组件库总览页模板（实时渲染）
src/component.template.html 单组件视频渲染页（画面内带标题与一句话说明）
src/docs.template.html     视频总览页模板
build.mjs                  把字体与引擎内联进模板 → dist/*.html + 根目录 index.html
render.py                  Playwright 逐帧渲染 + ffmpeg tmix 动态模糊
fonts/                     Geist woff2
index.html                 组件视频总览页（每个组件 MP4 + 一句话说明）
media/                     每个组件一段独立 MP4（basic 11 + quote 11，往返循环保证无缝）
dist/                      单文件 HTML + showreel mp4
```

## 本地运行

```bash
node build.mjs                        # 生成 dist/*.html（单文件，零外链）+ index.html
python render.py sheet                # 40 拍检查表，渲染前查偏离网格 / 拥挤
python render.py one 12.75            # 单帧
python render.py components basic     # 11 个基础组件各出一段 MP4 → media/
python render.py components quote     # 11 个金融组件 → media/quote-*.mp4
python render.py video basic          # → dist/morph.mp4
python render.py video quote          # → dist/quote.mp4
python render.py loop quote           # 循环闭合校验
```

渲染管线：Playwright 逐子帧截图 → PIL 解码 → rawvideo rgb24 直灌 ffmpeg stdin（不落盘）→ `tmix=frames=4` + 每 4 取 1 → h264。1200 帧 × 4 子帧约 4 分钟。

## 路线图

- [x] 10 状态语法 + 引擎 + 组件库总览页 + 20s showreel
- [x] 每组件独立 MP4（画面内带标题与一句话说明）+ 视频总览页 `index.html`
- [x] Quote Morph 金融展示页组件（11 状态）
- [x] 引擎重构为 spec 驱动 + 循环闭合做到 0 像素差异
- [ ] 数据类 6 个组件（Sparkline / Candle / Donut / Gauge / Heatbar / Ticker）
- [ ] 金融类 5 个组件（Quote board / P&L card / Depth bar / Position card / Order toast）
- [ ] 设计 token 页面 / 可复制参数面板
