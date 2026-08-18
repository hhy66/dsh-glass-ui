# dsh-glass-ui · 玻璃质感 UI

DSH Web 界面的磨砂玻璃主题插件：把侧边栏、输入区、对话框、设置面板变成磨砂玻璃，
并支持自定义背景（内置预设渐变或本地上传图片）。开关一关，完整还原原版界面。

版本变更见 [CHANGELOG.md](CHANGELOG.md)。

## 功能

- **磨砂玻璃面板**：侧边栏 / 输入框 / 对话框 / 设置浮层，统一 `backdrop-filter`
  模糊 + 明显描边 + 内高光 + 浮起阴影；颜色全部走主题 alias token 的 `{light, dark}`
  双层覆盖，与系统明暗模式无缝联动。
- **浮动模块布局**（默认开启）：把侧栏、聊天区独立成带**明显边框**的圆角玻璃卡片，
  背景从卡片间隙透出。**宿主三列布局保持不变**——不修改 `_sidebarCol / _centerCol /
  _detailsCol` 的盒模型，浮动间隙由内部视觉层（`::before` / SidebarRoot 内缩）形成，
  其他插件基于原始列的定位计算不受影响。
- **可调参数**（设置 → 玻璃质感，全部即时生效）：
  - 玻璃面板：模糊强度 0–40px、统一圆角 0–24px、描边浓度 0–100%（50=默认）、
    阴影强度 0–100%（50=默认）
  - 玻璃浓度：侧栏玻璃浓度 0–100%、聊天区玻璃浓度 0–100%
  - 模块化布局：浮动模块开关、侧栏圆角 0–32px、聊天区圆角 0–32px、
    模块外边距 0–32px、模块间隙 0–24px
- **用户输入框玻璃化**：输入卡片（`uV2eYG_card`）自身承担 `backdrop-filter`（半透明 +
  24px 圆角 + 描边 + 内高光）；`composerSeat` 仅去除原生底部实底、不再整条模糊。
  聊天区消息展示区回归主体背景，不再额外盖半透明底。
- **自定义背景**：
  - 7 套预设渐变（极光 / 暮色 / 深海 / 森林 / 樱花 / 石墨 / 纯色），每套含明暗两版，
    极光类预设带两枚缓慢漂移的光斑（尊重 `prefers-reduced-motion`）
  - **自定义纯色/双色渐变**：两个取色器，仅颜色 A = 纯色，A+B = 双色渐变
  - 本地图片上传（自动压缩为 JPEG dataURL 存进 localStorage），支持移除
  - 背景模糊 0–40px、背景亮度 0–100（50 为原样：亮色模式调亮、暗色模式调暗）
- **总开关**：关闭即移除全部效果（token 层、html 属性、CSS 变量、背景 DOM 全部回收）。
- 设置即时生效并保存在本机浏览器（`localStorage`）。

## 安装

```powershell
dsh plugin --profile web add "C:\Users\hhy99\.dsh\plugins\dsh-glass-ui"
```

link 方式安装（源码改动无需重装，只需重启 `dsh web` 并硬刷新浏览器）。安装后验证：

```powershell
dsh --profile web --dump-config     # 确认 dsh-glass-ui 在配置树中
node "C:\Users\hhy99\.dsh\plugins\dsh-glass-ui\test\smoke.mjs"   # 自带冒烟测试
```

## 使用

重新打开（或硬刷新）Web 界面 → 左下角设置 → 侧栏「玻璃质感」。默认开启。

## 自定义

- 预设渐变：改 `client/client.js` 里的 `PRESETS` 数组（每套 `light/dark` 各一份 `bg` 与
  两枚光斑色 `blobs`，`blobs: []` 表示无光斑）。
- 玻璃透明度：改 `buildTokenOverrides()` 里每个 token 的 `mix(色板, floor, gain)`——
  alpha = `floor% + gain% × 霜白度`。`floor` 是霜白度 0 时的「可读底线」（侧栏 35%、
  气泡/输入框 48%，保证自定义背景上文字仍可辨），`frost=50(1x)` 时 = floor+gain；
  倍率曲线在 `frostMult()`（`frost/50`，50=1x，封顶 1.4）。
- 玻璃描边/高光/阴影：改样式表里 `html[data-dsh-glass]` 的 `--dsh-glass-edge` /
  `--dsh-glass-highlight` / `--dsh-glass-module-edge` / `--dsh-glass-module-shadow` /
  `--dsh-glass-sidebar-glow`（阴影为 Aqua 的「内高光 + 单层蓝调深度阴影」配方）。
- 面板选择器：样式表中 `[class*='_sidebarCol']` 等基于壳层 CSS 模块可读类名，
  DSH 升级后如失效按新类名微调即可。
- ⚠️ **非侵入式原则**：`_sidebarCol` / `_centerCol` / `_detailsCol` 承担 DSH 布局与其他
  插件的定位基准，插件**不修改它们的盒模型（margin/padding/width/height），也不加
  backdrop-filter**。玻璃卡片一律由容器的 `::before` 在内部画（`inset` 制造 12px 视觉
  间隙，`background + backdrop-filter + 描边 + 阴影` 在伪元素上）——伪元素没有真实
  后代，天然不会成为其他插件 `fixed`/`absolute` 元素的定位基准；侧栏内容（Logo /
  收缩按钮 / 会话列表）布局完全不动，靠 DOM 顺序盖在玻璃层之上。设置浮层打开期间
  侧栏 `::before` 的模糊会临时停用（防御个别引擎把伪元素纳入 containing block 计算）。

## 卸载

```powershell
dsh plugin --profile web remove dsh-glass-ui
```

卸载会同时从配置树移除插件并删除链接；刷新页面即完全还原。

## 原理

- 宿主侧无行为（空的 `apply`），全部逻辑在客户端 `exports["./client"]`。
- 颜色通过 `ctx.theme.overrideTokens(source, tokens)` 叠加半透明覆盖层（`color-mix` +
  `--dsh-glass-frost` 变量实时调节），由主题服务负责明暗取值与回收。
- CSS 全部挂在 `html[data-dsh-glass]` 属性钩子上，不修改 DSH 源码。
- 背景层是一个 `position:fixed; z-index:-1` 的全屏元素：壳层 `body` 与主框架的
  `--dsw-alias-bg-base` 被覆盖为半透明后，背景自然透出。
