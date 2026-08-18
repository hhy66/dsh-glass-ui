# Changelog

本文件记录 dsh-glass-ui 的重要变更。格式参考 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)，
版本号遵循 [语义化版本](https://semver.org/lang/zh-CN/)。

## [0.3.0] - 2026-03

### 重构：非侵入式玻璃层
- **结构容器不再参与玻璃效果**：`_sidebarCol` / `_centerCol` / `_detailsCol` 保持原盒模型
  （不修改 margin/padding/width/height），也不加 `backdrop-filter` —— 避免劫持其他插件
  `fixed`/`absolute` 元素的定位基准，兼容性显著提升。
- **玻璃卡片一律由 `::before` 在容器内部画**（侧栏展开态 / 聊天区 / 详情列）：`inset`
  制造 12px 视觉间隙，`background + backdrop-filter + 描边 + 阴影` 由伪元素承担；
  伪元素没有真实后代，天然不成为其他插件定位的 containing block。侧栏内容
  （Logo / 收缩按钮 / 会话列表）布局完全不动，靠 DOM 顺序盖在玻璃层之上。
- 侧栏收起态（rail）由 SidebarRoot 的 `::before` 画卡片，**保留原 padding**。

### 修复
- 左上角侧栏收缩按钮 SVG 被裁切 —— SidebarRoot 不再被改 margin/padding，Logo 与
  收缩按钮保持在原布局位置。
- 右上角其他插件按钮位置跑偏 —— 三列真实盒模型不再被 margin 改动，插件基于原列
  尺寸/坐标系的定位计算恢复。
- 输入区整条毛玻璃 —— `composerSeat` 只去除原生底部实底、自身不再 `backdrop-filter`；
  磨砂模糊移到真正的输入卡片（`_card`）上，只有输入框是玻璃。
- 侧栏/聊天区下边缘高度不一致 —— 列盒模型不再被 margin 改动，视觉下边缘由统一的
  `inset`（12px）保证对齐。
- 侧栏与聊天区之间缝隙加宽（`--dsh-glass-module-gap` 8→10px，两模块更独立）。
- 暗色下侧栏玻璃更透（`--dsw-specific-sidebar-fill` 暗色 floor 35→25），背景透出更多。
- **侧栏内容（Logo/HARNESS/折叠按钮/会话/设置）不再被模糊** —— 玻璃 `::before` 改放
  `z-index:-1`（内容之下，只模糊背景图），侧栏本体与 SidebarRoot 背景透明
  （`background:transparent!important`、`backdrop-filter:none!important`），
  模糊统一 `blur + saturate(115%)`。
- **聊天区/详情列玻璃质感加强**：`--dsh-glass-chat-fill` 由 10% 提升到
  light `rgba(255,255,255,.30)` / dark `rgba(20,26,36,.32)`，消息主体呈现明显的磨砂玻璃底。
- **修复设置浮层点不到**：移除侧栏的 `isolation:isolate`（它把设置浮层 fixed overlay
  困在 auto 层叠层级，被 composerSeat 等盖住），浮层恢复全局最上层、可正常交互。
- **修复模块化布局完全失效**：`z-index:-1` 的玻璃 `::before` 会掉到 frame 背景之下被
  盖住（frame 原本不创建层叠上下文）——改为给 `_frame` 加 `isolation:isolate`，
  玻璃卡片（边框/圆角/间隙/玻璃底）恢复可见，同时设置浮层在 frame 内仍是最高层。
- **玻璃参数全部可调**：设置面板新增「玻璃面板」（描边/阴影强度）、「玻璃浓度」
  （侧栏/聊天区玻璃浓度）卡片与「模块化布局」外边距/间隙滑块——`--dsh-glass-*-alpha/
  -strength/-inset/-gap` 全部由 JS 实时写入，0–100% 可自由控制。
- **删除霜白度与消息气泡玻璃化**：token 底色改为固定 alpha（含可读底线），不再有全局
  霜白度倍率；气泡恢复原版底色（仅统一圆角跟随）。
- **设置面板重新分类**：玻璃面板（模糊/圆角/描边/阴影）→ 玻璃浓度（侧栏/聊天区浓度）
  → 模块化布局（结构）→ 自定义背景（来源），每类只放影响该类对象的控件。

## [0.2.0] - 2026-03

### 新增
- **浮动模块布局**：侧栏 / 聊天区 / 详情列独立成带明显边框、浮起阴影、圆角的玻璃卡片，
  背景从卡片间隙透出；可分别调节侧栏圆角与聊天区圆角（0–32px）。
- **用户输入框玻璃化**：输入卡片 24px 圆角（对齐 Aqua composer 配方），半透明 + 明显描边 +
  内高光；输入区去掉原版底部实底，磨砂由输入区容器提供。
- **设置浮层玻璃化**：设置面板 / 对话框半透明 + 明显描边 + 浮起阴影。
- **模块间距变量化**：`--dsh-glass-module-inset/gap/squeeze`（暂不暴露到设置面板）。
- **侧栏右侧发光边**（对齐 Aqua）。
- **自定义纯色/双色渐变**：预设新增「自定义」，两个取色器（颜色 A 必选，颜色 B 可选），
  仅 A = 纯色，A+B = 双色渐变；swatch 实时预览当前自定义配色。

### 优化
- **霜白度「可读底线」**：alpha 改为 `floor% + gain% × 霜白度`，霜白度 0 时侧栏/输入框/气泡
  仍保留可读底色（自定义背景上文字可辨）；50 = 1x 基准，封顶 1.4（对齐 Aqua 语义）。
- **backdrop-filter 降级兜底**：老内核 WebView（不支持 backdrop-filter）时自动把 token 底色
  提高 20 个百分点，保证最低可读性。
- **多标签页同步**：监听 `storage` 事件，其他标签页修改设置时本页自动跟随。
- **阴影配方对齐 Aqua**：顶部内高光 + 单层蓝调深度阴影（替代原先的两层黑阴影）。
- 设置面板补充霜白度说明文案。

### 修复
- 侧栏列 `backdrop-filter` 导致设置浮层（`position:fixed`）不再全局居中 —— 已用
  `:not(:has([role='dialog']))` 守卫，浮层打开期间侧栏暂不模糊。
- 侧栏收起态（rail）重影/幽灵线条 —— 收起态时侧栏列被槽位渲染器置为 `display:contents`
  （无盒子），盒模型属性在其上无效且部分 WebView 有渲染残留；已把收起态规则改由真实盒子
  root（`data-slot="sidebar"` / `root+collapsed`）承接，展开态规则显式排除收起态。
- 详情列不加 `backdrop-filter`（轨迹滑出面板为 `position:absolute`，会被劫持定位基准）。
- 侧栏会话区右侧操作图标被模块描边割裂 —— 收窄负 margin 预留位置。
- 聊天区模块不再整体盖半透明底：消息区回归主体背景，仅输入框玻璃化。

## [0.1.0] - 2026-03

### 新增
- 磨砂玻璃面板：侧栏 / 详情列 / 输入区 / 对话框 / 设置面板 `backdrop-filter` 模糊 +
  描边 + 内高光，颜色走主题 alias token 的 `{light, dark}` 双层覆盖（20 个 token），
  与系统明暗模式联动。
- 自定义背景：7 套预设渐变（极光 / 暮色 / 深海 / 森林 / 樱花 / 石墨 / 纯色，明暗两版，
  光斑漂移动画尊重 `prefers-reduced-motion`）+ 本地图片上传（自动压缩为 JPEG dataURL）。
- 可调参数：模糊强度、霜白度、统一圆角、消息气泡玻璃化、背景模糊、背景亮度。
- 总开关：关闭即全量回收（token 层、html 属性、CSS 变量、背景 DOM），完整还原原版界面。
- 设置保存在 localStorage（`dsh.ui-glass.v1`）。
