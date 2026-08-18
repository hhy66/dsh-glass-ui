/**
 * dsh-glass-ui — browser half (lazy-CJS 客户端 bundle, v0.1.0)。
 *
 * 玻璃质感 UI 插件，在 DSH 设置页注册「玻璃质感」区块 (settings.section 槽位):
 *   - 玻璃面板: 侧边栏 / 输入区 / 对话框 / 设置面板变成磨砂玻璃
 *     (主题 alias token 半透明覆盖 + backdrop-filter 模糊 + 统一圆角),
 *     可调 模糊强度 / 霜白度 / 统一圆角 / 消息气泡玻璃化。
 *   - 自定义背景: 内置预设渐变(极光/暮色/深海/森林/樱花/石墨/纯色, 含明暗两套)
 *     或本地上传图片(自动压缩为 dataURL), 可调 背景模糊 / 背景亮度。
 *   - 总开关: 关闭即移除全部效果, 完整还原原版界面; 设置保存在 localStorage。
 *
 * 设计要点:
 *   - 所有颜色走 ctx.theme.overrideTokens 的 {light,dark} 双层覆盖,
 *     与主题服务(明暗切换)无缝联动; 效果全部挂在插件 fiber 上, 卸载即还原。
 *   - CSS 一律挂在 html[data-dsh-glass] 属性钩子上, 不触碰壳层源码。
 *   - 面板类名使用本插件私有 .dgu_ 前缀, 不依赖壳层 hash 类。
 */
window.__ModuleLoader__.load({
	id: "dsh-glass-ui",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		let react = require("react");

		const h = react.createElement;

		//#region constants
		/** html 属性: 玻璃层总开关钩子(全部玻璃 CSS 只在该属性下生效)。 */
		const ATTRIBUTE = "data-dsh-glass";
		/** html 属性: 浮动模块布局(侧栏/聊天区/详情列独立成卡片)。 */
		const MODULES_ATTRIBUTE = "data-dsh-glass-modules";
		/** localStorage 键: 设置持久化。 */
		const STORAGE_KEY = "dsh.ui-glass.v1";
		/** 主题覆盖层的来源标识(动态包由运行时自动钉为包 id)。 */
		const TOKEN_SOURCE = "dsh-glass-ui";
		/** 注入样式表的去重标识。 */
		const CSS_ID = "dsh-glass-ui/styles.css";

		const DEFAULT_SETTINGS = {
			enabled: true,      // 总开关
			blur: 16,           // 玻璃模糊 px (0-40)
			radius: 14,         // 统一圆角 px (0-24)
			modules: true,      // 浮动模块布局(侧栏/聊天区/详情列独立成卡片)
			sidebarRadius: 16,  // 侧栏模块圆角 px (0-32)
			chatRadius: 16,     // 聊天区模块圆角 px (0-32)
			sidebarFill: 50,    // 侧栏玻璃浓度 % (0-100, 50 = 当前默认)
			chatFill: 30,       // 聊天区玻璃浓度 % (0-100, 30 = 当前默认)
			edgeStrength: 50,   // 描边浓度 % (0-100, 50 = 1x 默认)
			shadowStrength: 50, // 阴影强度 % (0-100, 50 = 1x 默认)
			moduleInset: 12,    // 模块外边距 px (0-32)
			moduleGap: 10,      // 模块间隙 px (0-24)
			background: "preset", // 背景来源: preset | image
			preset: "aurora",   // 预设 id(含 custom: 自定义纯色/双色渐变)
			image: "",          // 自定义图片 dataURL
			customColorA: "#4A7FD9", // 自定义背景颜色 A(必选)
			customColorB: "#B07FE8", // 自定义背景颜色 B(空 = 纯色, 非空 = 双色渐变)
			bgBlur: 0,          // 背景模糊 px (0-40)
			bgBrightness: 50,   // 背景亮度 (0-100, 50 = 不变)
		};

		/** 预设渐变: 每套含明/暗两份配色与两枚漂移光斑色。 */
		const PRESETS = [
			{
				id: "aurora",
				name: "极光",
				light: {
					bg: "radial-gradient(900px 520px at 12% -8%, rgba(125,180,255,.5), transparent 62%), radial-gradient(820px 520px at 88% 12%, rgba(196,150,255,.34), transparent 62%), radial-gradient(700px 500px at 50% 115%, rgba(110,215,220,.28), transparent 62%), linear-gradient(165deg, #f2f6ff 0%, #e9eefb 48%, #f3edfc 100%)",
					blobs: ["rgba(96,165,250,.42)", "rgba(167,139,250,.34)"],
				},
				dark: {
					bg: "radial-gradient(900px 520px at 12% -8%, rgba(56,120,255,.26), transparent 62%), radial-gradient(820px 520px at 88% 12%, rgba(140,92,255,.2), transparent 62%), radial-gradient(700px 500px at 50% 115%, rgba(34,170,190,.14), transparent 62%), linear-gradient(165deg, #0d1220 0%, #0b101d 50%, #120f22 100%)",
					blobs: ["rgba(56,120,255,.22)", "rgba(140,92,255,.18)"],
				},
			},
			{
				id: "dusk",
				name: "暮色",
				light: {
					bg: "radial-gradient(900px 540px at 18% -10%, rgba(255,170,110,.45), transparent 60%), radial-gradient(820px 520px at 86% 18%, rgba(255,130,160,.32), transparent 60%), linear-gradient(170deg, #fdf3ec 0%, #fbeef1 50%, #f1ecfa 100%)",
					blobs: ["rgba(255,160,100,.4)", "rgba(244,114,182,.3)"],
				},
				dark: {
					bg: "radial-gradient(900px 540px at 18% -10%, rgba(255,140,70,.22), transparent 60%), radial-gradient(820px 520px at 86% 18%, rgba(236,72,153,.16), transparent 60%), linear-gradient(170deg, #191018 0%, #14101c 55%, #0e1220 100%)",
					blobs: ["rgba(255,140,70,.16)", "rgba(236,72,153,.12)"],
				},
			},
			{
				id: "ocean",
				name: "深海",
				light: {
					bg: "radial-gradient(900px 520px at 85% -8%, rgba(64,200,220,.4), transparent 62%), radial-gradient(820px 520px at 12% 110%, rgba(80,140,255,.32), transparent 62%), linear-gradient(160deg, #eef8fb 0%, #e8f2f9 50%, #e9f1ff 100%)",
					blobs: ["rgba(64,200,220,.34)", "rgba(80,140,255,.28)"],
				},
				dark: {
					bg: "radial-gradient(900px 520px at 85% -8%, rgba(24,160,190,.22), transparent 62%), radial-gradient(820px 520px at 12% 110%, rgba(40,90,220,.2), transparent 62%), linear-gradient(160deg, #0a141d 0%, #0a121c 55%, #0b1022 100%)",
					blobs: ["rgba(24,160,190,.18)", "rgba(40,90,220,.16)"],
				},
			},
			{
				id: "forest",
				name: "森林",
				light: {
					bg: "radial-gradient(900px 520px at 15% -8%, rgba(120,210,150,.4), transparent 62%), radial-gradient(820px 520px at 88% 110%, rgba(60,170,140,.3), transparent 62%), linear-gradient(165deg, #effaf2 0%, #eaf6ee 50%, #e9f5f0 100%)",
					blobs: ["rgba(120,210,150,.34)", "rgba(60,170,140,.28)"],
				},
				dark: {
					bg: "radial-gradient(900px 520px at 15% -8%, rgba(40,160,100,.2), transparent 62%), radial-gradient(820px 520px at 88% 110%, rgba(20,130,110,.16), transparent 62%), linear-gradient(165deg, #0c1610 0%, #0b1410 55%, #0a1218 100%)",
					blobs: ["rgba(40,160,100,.16)", "rgba(20,130,110,.12)"],
				},
			},
			{
				id: "sakura",
				name: "樱花",
				light: {
					bg: "radial-gradient(900px 520px at 14% -8%, rgba(255,180,200,.5), transparent 62%), radial-gradient(820px 520px at 88% 14%, rgba(255,150,190,.36), transparent 62%), linear-gradient(165deg, #fdf2f6 0%, #fbeff3 50%, #f4eef9 100%)",
					blobs: ["rgba(255,170,195,.4)", "rgba(244,140,190,.3)"],
				},
				dark: {
					bg: "radial-gradient(900px 520px at 14% -8%, rgba(230,90,140,.2), transparent 62%), radial-gradient(820px 520px at 88% 14%, rgba(180,80,160,.14), transparent 62%), linear-gradient(165deg, #1a0f16 0%, #150e18 55%, #101022 100%)",
					blobs: ["rgba(230,90,140,.16)", "rgba(180,80,160,.12)"],
				},
			},
			{
				id: "graphite",
				name: "石墨",
				light: {
					bg: "linear-gradient(165deg, #f4f5f7 0%, #eef0f3 50%, #eceef2 100%)",
					blobs: [],
				},
				dark: {
					bg: "linear-gradient(165deg, #16181c 0%, #131519 50%, #101216 100%)",
					blobs: [],
				},
			},
			{
				id: "plain",
				name: "纯色",
				light: {
					bg: "linear-gradient(180deg, #f5f7fa 0%, #f0f3f7 100%)",
					blobs: [],
				},
				dark: {
					bg: "linear-gradient(180deg, #101318 0%, #0d1015 100%)",
					blobs: [],
				},
			},
			{
				id: "custom",
				name: "自定义",
				light: { bg: null, blobs: [] },
				dark: { bg: null, blobs: [] },
			},
		];

		/** 玻璃层写入 html 的 CSS 变量名(关闭时逐项清除)。 */
		const HTML_VARS = [
			"--dsh-glass-blur",
			"--dsh-glass-radius",
			"--dsh-glass-bg-blur",
			"--dsh-glass-sidebar-radius",
			"--dsh-glass-chat-radius",
			"--dsh-glass-brightness-white",
			"--dsh-glass-brightness-black",
			"--dsh-glass-sidebar-fill-alpha",
			"--dsh-glass-chat-fill-alpha",
			"--dsh-glass-edge-strength",
			"--dsh-glass-shadow-strength",
			"--dsh-glass-module-inset",
			"--dsh-glass-module-gap",
		];
		//#endregion

		//#region styles
		/**
		 * 玻璃层 + 背景层 + 设置面板样式表。
		 * 玻璃层规则全部挂在 html[data-dsh-glass] 之下, 关闭开关即整体失效。
		 */
		if (typeof document !== "undefined" && document.querySelector('style[data-plugin-css="' + CSS_ID + '"]') === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "dsh-glass-ui";
			tag.dataset.pluginCss = CSS_ID;
			tag.textContent = [
				/* ---- 玻璃层基础变量(明/暗两套: 玻璃描边/高光 + 模块描边/阴影 + 侧栏发光边 + 模块间距) ----
				   阴影配方对齐 Aqua: 顶部内高光 + 单层蓝调深度阴影(非死黑)。
				   可调项: 玻璃浓度/描边/阴影强度由 JS 写入 *-alpha / *-strength 变量,
				   inset/gap 由 JS 覆盖; squeeze=侧栏右侧预留收窄(固定)。 */
				"html[data-dsh-glass]{--dsh-glass-blur:14px;--dsh-glass-radius:14px;--dsh-glass-module-inset:12px;--dsh-glass-module-gap:10px;--dsh-glass-module-squeeze:4px;--dsh-glass-chat-fill:rgba(255,255,255,var(--dsh-glass-chat-fill-alpha,.30));--dsh-glass-sidebar-fill:rgba(255,255,255,var(--dsh-glass-sidebar-fill-alpha,.50));--dsh-glass-edge:rgba(19,45,83,.10);--dsh-glass-highlight:rgba(255,255,255,.5);--dsh-glass-module-edge:rgba(19,45,83,calc(var(--dsh-glass-edge-strength,1) * .26));--dsh-glass-module-shadow:0 10px 34px rgba(19,45,83,calc(var(--dsh-glass-shadow-strength,1) * .16));--dsh-glass-sidebar-glow:rgba(150,190,245,.65)}",
				"html[data-dsh-glass] body[data-ds-dark-theme]{--dsh-glass-chat-fill:rgba(20,26,36,var(--dsh-glass-chat-fill-alpha,.30));--dsh-glass-sidebar-fill:rgba(20,26,36,var(--dsh-glass-sidebar-fill-alpha,.50));--dsh-glass-edge:rgba(148,180,220,.16);--dsh-glass-highlight:rgba(255,255,255,.07);--dsh-glass-module-edge:rgba(148,180,220,calc(var(--dsh-glass-edge-strength,1) * .32));--dsh-glass-module-shadow:0 8px 30px rgba(2,6,14,calc(var(--dsh-glass-shadow-strength,1) * .32));--dsh-glass-sidebar-glow:rgba(148,180,220,.2)}",
				/* ---- 主要玻璃面板: 非侵入式 —— 宿主结构容器(三列)不改盒模型、不加 backdrop-filter;
				   玻璃卡片一律用 ::before 在容器内部画(伪元素无真实后代, 不劫持其他插件的
				   fixed/absolute 定位), 内容靠 DOM 顺序天然盖在 ::before 之上。
				   关键: frame 必须 isolation:isolate —— 否则 z-index:-1 的 ::before 会掉到
				   frame 背景之下(整个玻璃卡片被 frame 半透明背景盖住, 模块化布局"完全没生效");
				   隔离后 ::before 画在 frame 背景之上、内容之下, 且设置浮层(z:1000)困在
				   frame 内仍是最高层, 可正常点击(不同于隔离在 sidebarCol 上会被 z:7 盖住)。 */
				"html[data-dsh-glass-modules] [class*='_frame']{isolation:isolate}",
				/* 侧栏(展开态): 列本体位置/尺寸完全不动, 背景透明(玻璃只由 ::before 画),
				   绝不 backdrop-filter(内容必须锐利)。注意: 不能用 isolation:isolate ——
				   它会把侧栏变成独立层叠上下文, 把设置浮层困在 auto 层级, 被 composerSeat(z:7)
				   等盖住, 导致设置面板点不到。 */
				"html[data-dsh-glass-modules] [class*='_sidebarCol']:not(:has([class*='_collapsed'])){position:relative;background:transparent!important;overflow:visible;border-right:none;backdrop-filter:none!important;-webkit-backdrop-filter:none!important}",
				/* 玻璃层 ::before: z-index:-1 放内容之下 —— 只模糊背景图, 不模糊 Logo/按钮/文字 */
				"html[data-dsh-glass-modules] [class*='_sidebarCol']:not(:has([class*='_collapsed'])):not(:has([role='dialog']))::before{content:'';position:absolute;inset:var(--dsh-glass-module-inset) var(--dsh-glass-module-squeeze) var(--dsh-glass-module-inset) var(--dsh-glass-module-inset);border-radius:var(--dsh-glass-sidebar-radius,16px);background:var(--dsh-glass-sidebar-fill);backdrop-filter:blur(var(--dsh-glass-blur,14px)) saturate(115%);-webkit-backdrop-filter:blur(var(--dsh-glass-blur,14px)) saturate(115%);box-shadow:inset 1px 0 0 var(--dsh-glass-sidebar-glow),0 0 0 1px var(--dsh-glass-module-edge),var(--dsh-glass-module-shadow),inset 0 1px 0 var(--dsh-glass-highlight);pointer-events:none;z-index:-1}",
				/* 设置浮层打开期间停用侧栏 ::before 模糊(防御: 个别引擎把伪元素纳入 containing block 计算) */
				"html[data-dsh-glass-modules] [class*='_sidebarCol']:not(:has([class*='_collapsed'])):has([role='dialog'])::before{backdrop-filter:none;-webkit-backdrop-filter:none}",
				/* SidebarRoot 背景透明: 原 sidebar-fill 背景会盖住玻璃层, 让它透出 */
				"html[data-dsh-glass-modules] [class*='_sidebarCol'] [data-slot='sidebar']{background:transparent!important}",
				/* 侧栏(收起态/rail): sidebarCol 是 display:contents 无盒子; SidebarRoot 保留原 padding
				   (Logo/收缩按钮/rail 图标布局不被破坏), ::before 在内容之上画视觉卡片。 */
				"html[data-dsh-glass-modules] [class*='_sidebarCol'] > [data-slot='sidebar'][class*='_collapsed']{position:relative}",
				"html[data-dsh-glass-modules] [class*='_sidebarCol'] > [data-slot='sidebar'][class*='_collapsed']::before{content:'';position:absolute;inset:var(--dsh-glass-module-inset) 0 var(--dsh-glass-module-inset) var(--dsh-glass-module-inset);border-radius:var(--dsh-glass-sidebar-radius,16px);box-shadow:0 0 0 1px var(--dsh-glass-module-edge),var(--dsh-glass-module-shadow),inset 0 1px 0 var(--dsh-glass-highlight);pointer-events:none;z-index:1}",
				"html[data-dsh-glass] [class*='_sidebarCol'] > [data-slot='sidebar'][class*='_collapsed']:not(:has([role='dialog'])){backdrop-filter:blur(var(--dsh-glass-blur,14px));-webkit-backdrop-filter:blur(var(--dsh-glass-blur,14px))}",
				/* 侧栏会话列表区: 收窄负 margin, 让右侧 hover 操作图标不贴卡片描边(预留 squeeze 空间) */
				"html[data-dsh-glass-modules] [class*='_sidebarCol'] [class*='_regionArea']{margin-right:calc(-1 * var(--dsh-glass-module-squeeze))}",
				/* 聊天区: 列本体盒模型完全不动; ::before 画玻璃卡片(inset 制造 12px 间隙, 淡底 + 模糊) */
				"html[data-dsh-glass-modules] [class*='_centerCol']{position:relative}",
				"html[data-dsh-glass-modules] [class*='_centerCol']::before{content:'';position:absolute;inset:var(--dsh-glass-module-inset) var(--dsh-glass-module-gap);border-radius:var(--dsh-glass-chat-radius,16px);background:var(--dsh-glass-chat-fill);backdrop-filter:blur(var(--dsh-glass-blur,14px)) saturate(115%);-webkit-backdrop-filter:blur(var(--dsh-glass-blur,14px)) saturate(115%);box-shadow:0 0 0 1px var(--dsh-glass-module-edge),var(--dsh-glass-module-shadow),inset 0 1px 0 var(--dsh-glass-highlight);pointer-events:none;z-index:-1}",
				/* 详情列: 列本体不动; ::before 画卡片(淡底 + 描边 + 阴影, 不加模糊避免劫持轨迹滑出面板) */
				"html[data-dsh-glass-modules] [class*='_detailsCol']{position:relative}",
				"html[data-dsh-glass-modules] [class*='_detailsCol']::before{content:'';position:absolute;inset:var(--dsh-glass-module-inset) var(--dsh-glass-module-inset) var(--dsh-glass-module-inset) var(--dsh-glass-module-squeeze);border-radius:var(--dsh-glass-chat-radius,16px);background:var(--dsh-glass-chat-fill);box-shadow:0 0 0 1px var(--dsh-glass-module-edge),var(--dsh-glass-module-shadow),inset 0 1px 0 var(--dsh-glass-highlight);pointer-events:none;z-index:-1}",
				/* 输入区: 只去掉 stock 底部实底(background:none), 自身不 blur ——
				   磨砂模糊由真正的输入卡片(card)承担, 不再模糊整条输入区。 */
				"html[data-dsh-glass] [class*='_composerSeat']{background:none!important;backdrop-filter:none!important;-webkit-backdrop-filter:none!important}",
				/* 设置浮层/对话框: 玻璃半透明 + 明显描边 + 浮起阴影 + 内高光 */
				"html[data-dsh-glass] [class*='_panel']{backdrop-filter:blur(var(--dsh-glass-blur,14px));-webkit-backdrop-filter:blur(var(--dsh-glass-blur,14px));box-shadow:0 0 0 1px var(--dsh-glass-module-edge),var(--dsh-glass-module-shadow),inset 0 1px 0 var(--dsh-glass-highlight)}",
				"html[data-dsh-glass] [role='dialog']{backdrop-filter:blur(var(--dsh-glass-blur,14px));-webkit-backdrop-filter:blur(var(--dsh-glass-blur,14px));box-shadow:0 0 0 1px var(--dsh-glass-module-edge),var(--dsh-glass-module-shadow),inset 0 1px 0 var(--dsh-glass-highlight)}",
				/* ---- 用户输入框(card): 真正的玻璃本体 —— 半透明(token) + backdrop-filter + 24px 圆角 + 描边 + 高光 + 阴影 ---- */
				"html[data-dsh-glass] [class*='_centerCol'] [class$='_card']{background:var(--dsw-specific-input-major);backdrop-filter:blur(var(--dsh-glass-blur,14px));-webkit-backdrop-filter:blur(var(--dsh-glass-blur,14px));border-radius:24px;box-shadow:0 0 0 1px var(--dsh-glass-module-edge),inset 0 1px 0 var(--dsh-glass-highlight),var(--dsh-glass-module-shadow)}",
				/* ---- 统一圆角 ---- */
				"html[data-dsh-glass] [class*='_bubble']{border-radius:var(--dsh-glass-radius,14px)}",
				"html[data-dsh-glass] [class*='_panel']{border-radius:calc(var(--dsh-glass-radius,14px) + 10px)}",
				"html[data-dsh-glass] [role='dialog']{border-radius:calc(var(--dsh-glass-radius,14px) + 6px)}",
				/* ---- 背景层 ---- */
				"[data-dsh-glass-backdrop]{position:fixed;inset:0;z-index:-1;overflow:hidden;pointer-events:none;background-size:cover;background-position:center}",
				"[data-dsh-glass-backdrop] [data-dsh-glass-blob]{position:absolute;border-radius:50%;filter:blur(56px);opacity:.6;will-change:transform}",
				"[data-dsh-glass-backdrop] [data-dsh-glass-blob='1']{width:56vmax;height:56vmax;left:-16vmax;top:-18vmax;animation:dgu-drift-a 46s ease-in-out infinite alternate}",
				"[data-dsh-glass-backdrop] [data-dsh-glass-blob='2']{width:48vmax;height:48vmax;right:-14vmax;bottom:-16vmax;animation:dgu-drift-b 58s ease-in-out infinite alternate}",
				"@keyframes dgu-drift-a{from{transform:translate(0,0) scale(1)}to{transform:translate(14vmax,10vmax) scale(1.18)}}",
				"@keyframes dgu-drift-b{from{transform:translate(0,0) scale(1.12)}to{transform:translate(-11vmax,-9vmax) scale(.94)}}",
				"[data-dsh-glass-backdrop] [data-dsh-glass-veil]{position:absolute;inset:0;background-image:linear-gradient(rgba(255,255,255,var(--dsh-glass-brightness-white,0)),rgba(255,255,255,var(--dsh-glass-brightness-white,0))),linear-gradient(rgba(0,0,0,var(--dsh-glass-brightness-black,0)),rgba(0,0,0,var(--dsh-glass-brightness-black,0)))}",
				"[data-dsh-glass-backdrop] [data-dsh-glass-image]{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}",
				"@media (prefers-reduced-motion:reduce){[data-dsh-glass-backdrop] [data-dsh-glass-blob]{animation:none}}",
				/* ---- 设置面板(.dgu_ 私有前缀) ---- */
				".dgu_root{display:flex;flex-direction:column;gap:12px;font-size:13px;line-height:1.5;color:var(--dsw-alias-label-primary,#1f2328)}",
				".dgu_card{background:var(--dsw-alias-bg-layer-2,rgba(128,128,128,.06));border:1px solid var(--dsw-alias-border-l3,rgba(128,128,128,.15));border-radius:12px;padding:14px 16px;display:flex;flex-direction:column;gap:10px}",
				".dgu_card_head{display:flex;align-items:center;justify-content:space-between;gap:10px}",
				".dgu_title{font-weight:600;font-size:14px;color:var(--dsw-alias-label-primary,#1f2328)}",
				".dgu_desc{font-size:12px;color:var(--dsw-alias-label-tertiary,#8b949e)}",
				".dgu_sub{font-size:12px;font-weight:600;color:var(--dsw-alias-label-secondary,#57606a)}",
				".dgu_row{display:flex;align-items:center;gap:10px}",
				".dgu_label{flex:0 0 92px;color:var(--dsw-alias-label-secondary,#57606a);font-size:12.5px}",
				".dgu_value{flex:0 0 46px;text-align:right;font-variant-numeric:tabular-nums;color:var(--dsw-alias-label-tertiary,#8b949e);font-size:12px}",
				".dgu_range{-webkit-appearance:none;appearance:none;flex:1;height:4px;border-radius:2px;background:var(--dsw-alias-bg-layer-3,rgba(128,128,128,.12));outline:none;cursor:pointer}",
				".dgu_range::-webkit-slider-thumb{-webkit-appearance:none;appearance:none;width:14px;height:14px;border-radius:50%;background:var(--dsw-static-deepseek-500,#3F76D8);border:2px solid #fff;box-shadow:0 0 0 1px rgba(0,0,0,.08)}",
				".dgu_range::-moz-range-thumb{width:12px;height:12px;border-radius:50%;background:var(--dsw-static-deepseek-500,#3F76D8);border:2px solid #fff}",
				".dgu_btn{border:1px solid var(--dsw-alias-border-l2,rgba(128,128,128,.25));background:var(--dsw-alias-bg-layer-1,#fff);color:var(--dsw-alias-label-secondary,#57606a);border-radius:8px;padding:4px 12px;font-size:12px;cursor:pointer;line-height:1.6}",
				".dgu_btn:hover{color:var(--dsw-alias-label-primary,#1f2328);background:var(--dsw-alias-interactive-bg-hover,rgba(128,128,128,.1))}",
				".dgu_btn:disabled{opacity:.55;cursor:default}",
				".dgu_master{display:inline-flex;align-items:center;gap:6px;border:1px solid var(--dsw-alias-border-l3,rgba(128,128,128,.15));border-radius:999px;padding:4px 14px;cursor:pointer;background:var(--dsw-alias-bg-layer-1,#fff);font-size:12.5px;color:var(--dsw-alias-label-secondary,#57606a)}",
				".dgu_master_on{background:var(--dsw-static-deepseek-500,#3F76D8);border-color:transparent;color:#fff}",
				".dgu_seg{display:flex;gap:8px}",
				".dgu_seg_btn{border:1px solid var(--dsw-alias-border-l2,rgba(128,128,128,.25));background:var(--dsw-alias-bg-layer-1,#fff);color:var(--dsw-alias-label-secondary,#57606a);border-radius:8px;padding:4px 12px;font-size:12px;cursor:pointer;line-height:1.6}",
				".dgu_seg_btn:hover{color:var(--dsw-alias-label-primary,#1f2328);background:var(--dsw-alias-interactive-bg-hover,rgba(128,128,128,.1))}",
				".dgu_seg_on{border-color:var(--dsw-static-deepseek-500,#3F76D8);color:var(--dsw-static-deepseek-500,#3F76D8);background:rgba(65,118,230,.08)}",
				".dgu_swatches{display:grid;grid-template-columns:repeat(auto-fill,minmax(96px,1fr));gap:8px}",
				".dgu_swatch{border-radius:8px;height:46px;border:2px solid transparent;padding:0;cursor:pointer;background-size:cover;position:relative;overflow:hidden}",
				".dgu_swatch_on{border-color:var(--dsw-static-deepseek-500,#3F76D8)}",
				".dgu_swatch_name{position:absolute;left:6px;bottom:4px;font-size:11px;color:#fff;text-shadow:0 1px 2px rgba(0,0,0,.55)}",
				".dgu_color{width:38px;height:28px;padding:0;border:1px solid var(--dsw-alias-border-l2,rgba(128,128,128,.25));border-radius:6px;background:none;cursor:pointer}",
				".dgu_color::-webkit-color-swatch-wrapper{padding:2px}",
				".dgu_color::-webkit-color-swatch{border:none;border-radius:4px}",
				".dgu_hint{font-size:11.5px;color:var(--dsw-alias-label-tertiary,#8b949e)}",
				".dgu_error{color:var(--dsw-alias-state-error-primary,#ef4444);font-size:12px}",
				".dgu_muted{opacity:.55}"
			].join("");
			document.head.appendChild(tag);
		}
		//#endregion

		//#region persistence & helpers
		const clamp = (num, min, max) => Math.min(max, Math.max(min, num));

		/** 宿主是否支持 backdrop-filter(老内核 WebView 不支持 → 降级提高底色)。 */
		function supportsBackdropFilter() {
			return typeof CSS !== "undefined" && typeof CSS.supports === "function"
				&& (CSS.supports("backdrop-filter", "blur(1px)") || CSS.supports("-webkit-backdrop-filter", "blur(1px)"));
		}

		function loadSettings() {
			try {
				const raw = localStorage.getItem(STORAGE_KEY);
				if (!raw) return { ...DEFAULT_SETTINGS };
				const parsed = JSON.parse(raw);
				return normalizeSettings({ ...DEFAULT_SETTINGS, ...parsed });
			} catch (e) {
				return { ...DEFAULT_SETTINGS };
			}
		}

		function normalizeSettings(s) {
			s.enabled = s.enabled !== false;
			s.blur = clamp(Math.round(Number(s.blur) || 0), 0, 40);
			s.radius = clamp(Math.round(Number(s.radius) || 0), 0, 24);
			s.modules = s.modules !== false;
			s.sidebarRadius = clamp(Math.round(Number(s.sidebarRadius) || 0), 0, 32);
			s.chatRadius = clamp(Math.round(Number(s.chatRadius) || 0), 0, 32);
			s.sidebarFill = clamp(Math.round(Number(s.sidebarFill) || 0), 0, 100);
			s.chatFill = clamp(Math.round(Number(s.chatFill) || 0), 0, 100);
			s.edgeStrength = clamp(Math.round(Number(s.edgeStrength) || 0), 0, 100);
			s.shadowStrength = clamp(Math.round(Number(s.shadowStrength) || 0), 0, 100);
			s.moduleInset = clamp(Math.round(Number(s.moduleInset) || 0), 0, 32);
			s.moduleGap = clamp(Math.round(Number(s.moduleGap) || 0), 0, 24);
			s.background = s.background === "image" ? "image" : "preset";
			s.preset = PRESETS.some((p) => p.id === s.preset) ? s.preset : "aurora";
			s.image = typeof s.image === "string" ? s.image : "";
			// 自定义背景颜色: 仅接受 #RRGGBB; 颜色 B 为空串 = 纯色, 否则双色渐变。
			const colorOk = (v) => typeof v === "string" && /^#[0-9a-fA-F]{6}$/.test(v);
			s.customColorA = colorOk(s.customColorA) ? s.customColorA : "#4A7FD9";
			s.customColorB = colorOk(s.customColorB) ? s.customColorB : "";
			s.bgBlur = clamp(Math.round(Number(s.bgBlur) || 0), 0, 40);
			s.bgBrightness = clamp(Math.round(Number(s.bgBrightness) || 0), 0, 100);
			return s;
		}

		function findPreset(id) {
			return PRESETS.find((p) => p.id === id) || PRESETS[0];
		}

		/** 自定义背景: 颜色 A 纯色, 或 A→B 双色渐变(非法值回退默认蓝)。 */
		function customBackground(s) {
			const ok = (v) => typeof v === "string" && /^#[0-9a-fA-F]{6}$/.test(v);
			const a = ok(s.customColorA) ? s.customColorA : "#4A7FD9";
			const b = ok(s.customColorB) ? s.customColorB : "";
			return b ? "linear-gradient(160deg, " + a + " 0%, " + b + " 100%)" : a;
		}
		//#endregion

		//#region token overrides
		/**
		 * 主题 alias token 半透明覆盖层。
		 * 值用 color-mix 引用壳层的静态色板(--dsw-static-*), 每个 token 提供
		 * {light, dark} 双模式(主题服务运行期校验)。
		 * alpha 为固定值(含「最低可读底线」: 自定义背景上文字仍可辨)。
		 */
		const mix = (staticVar, alpha) =>
			"color-mix(in srgb, var(" + staticVar + ") " + alpha + "%, transparent)";

		function buildTokenOverrides(boost) {
			// backdrop-filter 不支持时(老内核 WebView)降级: alpha +20, 保证文字可读。
			const b = boost ? 20 : 0;
			const m = (sv, a) => mix(sv, a + b);
			return {
				/* 页面底 + 主框架(body+frame 双层绘制, 故取偏低值) */
				"--dsw-alias-bg-base": { light: m("--dsw-static-neutral-bluish-00", 45), dark: m("--dsw-static-neutral-bluish-1000", 45) },
				"--dsw-alias-bg-layer-1": { light: m("--dsw-static-neutral-bluish-00", 55), dark: m("--dsw-static-neutral-bluish-900", 55) },
				"--dsw-alias-bg-layer-2": { light: m("--dsw-static-neutral-bluish-00", 50), dark: m("--dsw-static-neutral-bluish-875", 50) },
				"--dsw-alias-bg-layer-3": { light: m("--dsw-static-neutral-bluish-00", 42), dark: m("--dsw-static-neutral-bluish-850", 42) },
				"--dsw-alias-bg-overlay": { light: m("--dsw-static-neutral-bluish-150", 58), dark: m("--dsw-static-neutral-bluish-850", 58) },
				"--dsw-alias-bg-module-platform": { light: m("--dsw-static-neutral-bluish-60", 55), dark: m("--dsw-static-neutral-bluish-875", 55) },
				"--dsw-alias-bg-multi-select": { light: m("--dsw-static-neutral-bluish-60", 55), dark: m("--dsw-static-neutral-bluish-875", 55) },
				"--dsw-alias-bg-mask-drop": { light: m("--dsw-static-neutral-bluish-00", 58), dark: m("--dsw-static-neutral-bluish-900", 58) },
				/* 浮起按钮 / 输入控件 */
				"--dsw-alias-button-elevated-fill": { light: m("--dsw-static-neutral-bluish-00", 60), dark: m("--dsw-static-neutral-bluish-850", 60) },
				"--dsw-alias-button-floating-fill": { light: m("--dsw-static-neutral-bluish-00", 60), dark: m("--dsw-static-neutral-bluish-850", 60) },
				"--dsw-alias-button-floating-hover": { light: m("--dsw-static-neutral-bluish-75", 60), dark: m("--dsw-static-neutral-bluish-800", 60) },
				/* 侧边栏(列 + 根双层绘制, 故取偏低值; 45% 双层≈70% 保证可读; 暗色更透 → 玻璃感更强) */
				"--dsw-specific-sidebar-fill": { light: m("--dsw-static-neutral-bluish-50", 45), dark: m("--dsw-static-neutral-bluish-950", 33) },
				"--dsw-specific-sidebar-nav-item-hover": { light: m("--dsw-static-neutral-bluish-75", 55), dark: m("--dsw-static-neutral-bluish-850", 55) },
				"--dsw-specific-sidebar-nav-item-active": { light: m("--dsw-static-neutral-bluish-100", 55), dark: m("--dsw-static-neutral-bluish-800", 55) },
				"--dsw-specific-sidebar-nav-item-active-accent": { light: m("--dsw-static-deepseek-100", 55), dark: m("--dsw-static-deepseek-800", 55) },
				/* 消息气泡 / 输入区 / 浮层 */
				"--dsw-specific-bubble": { light: m("--dsw-static-deepseek-50", 58), dark: m("--dsw-static-deepseek-900", 58) },
				"--dsw-specific-input-major": { light: m("--dsw-static-neutral-bluish-00", 56), dark: m("--dsw-static-neutral-bluish-900", 56) },
				"--dsw-specific-menu": { light: m("--dsw-static-neutral-bluish-00", 58), dark: m("--dsw-static-neutral-bluish-875", 58) },
				"--dsw-specific-selector": { light: m("--dsw-static-neutral-bluish-60", 55), dark: m("--dsw-static-neutral-bluish-850", 55) },
				"--dsw-specific-tip": { light: m("--dsw-static-neutral-bluish-60", 55), dark: m("--dsw-static-neutral-bluish-850", 55) },
			};
		}
		//#endregion

		//#region GlassLayer
		/**
		 * 玻璃层: 拥有全部效果的生命周期(主题 token 覆盖、html 属性与
		 * CSS 变量、背景层 DOM)。总开关关闭或插件卸载时全部回收。
		 */
		class GlassLayer {
			constructor(ctx) {
				this.ctx = ctx;
				this.settings = loadSettings();
				this.tokenDisposer = null;
				this.backdropEl = null;
				this.dark = false;
				// 老内核 WebView 无 backdrop-filter → 降级提高 token 底色, 保证文字可读。
				this.noBackdrop = !supportsBackdropFilter();
				try {
					const snap = ctx.theme && ctx.theme.getTheme();
					this.dark = !!(snap && snap.active && snap.active.colorScheme === "dark");
				} catch (e) { /* 主题快照未就绪时按亮色处理, 订阅会补一次同步 */ }
				// 多标签页同步: 别的标签页改了设置(localStorage)时, 本标签页跟随刷新。
				this.storageHandler = (e) => {
					if (e.key !== STORAGE_KEY || !e.newValue) return;
					try {
						this.settings = normalizeSettings({ ...DEFAULT_SETTINGS, ...JSON.parse(e.newValue) });
						this.applyAll();
					} catch (err) { /* 脏数据按现有设置继续 */ }
				};
				window.addEventListener("storage", this.storageHandler);
				// 订阅主题切换(明/暗), 订阅与清理都挂在插件 fiber 上。
				ctx.effect(() => ctx.on("theme/change", () => this.onThemeChange()), "dsh-glass-ui: theme listener");
				ctx.effect(() => () => this.dispose(), "dsh-glass-ui: glass layer lifecycle");
			}

			getSettings() { return { ...this.settings }; }
			getEnabled() { return this.settings.enabled !== false; }

			update(patch) {
				this.settings = normalizeSettings({ ...this.settings, ...patch });
				this.persist();
				this.applyAll();
			}

			reset() {
				this.settings = { ...DEFAULT_SETTINGS };
				this.persist();
				this.applyAll();
			}

			persist() {
				try {
					localStorage.setItem(STORAGE_KEY, JSON.stringify(this.settings));
				} catch (e) {
					// 图片过大导致配额不足: 仅本次会话生效, 不打断用户。
					if (typeof console !== "undefined") console.warn("dsh-glass-ui: 设置保存失败(可能图片过大), 仅本次会话生效", e);
				}
			}

			onThemeChange() {
				let dark = false;
				try {
					const snap = this.ctx.theme && this.ctx.theme.getTheme();
					dark = !!(snap && snap.active && snap.active.colorScheme === "dark");
				} catch (e) { return; }
				if (dark === this.dark) return;
				this.dark = dark;
				// 明暗变化只影响亮度遮罩与预设配色(双模式 token 由主题服务自取)。
				this.syncAttributes();
				this.syncBackdrop();
			}

			/** 主题 token 覆盖层: 只随总开关进退, 霜白度走 CSS 变量实时生效。 */
			syncTokens() {
				if (this.getEnabled()) {
					if (!this.tokenDisposer) {
						this.tokenDisposer = this.ctx.theme.overrideTokens(TOKEN_SOURCE, buildTokenOverrides(this.noBackdrop));
					}
				} else if (this.tokenDisposer) {
					this.tokenDisposer();
					this.tokenDisposer = null;
				}
			}

			/** html 属性钩子 + 全部 CSS 变量。 */
			syncAttributes() {
				const html = typeof document !== "undefined" ? document.documentElement : null;
				if (!html) return;
				if (this.getEnabled()) {
					const s = this.settings;
					html.setAttribute(ATTRIBUTE, "");
					if (s.modules) html.setAttribute(MODULES_ATTRIBUTE, "");
					else html.removeAttribute(MODULES_ATTRIBUTE);
					html.style.setProperty("--dsh-glass-blur", s.blur + "px");
					html.style.setProperty("--dsh-glass-radius", s.radius + "px");
					html.style.setProperty("--dsh-glass-bg-blur", s.bgBlur + "px");
					html.style.setProperty("--dsh-glass-sidebar-radius", s.sidebarRadius + "px");
					html.style.setProperty("--dsh-glass-chat-radius", s.chatRadius + "px");
					// 玻璃材质可调项: 浓度(0-1) / 描边与阴影强度(50=1x) / 模块间距
					html.style.setProperty("--dsh-glass-sidebar-fill-alpha", String(s.sidebarFill / 100));
					html.style.setProperty("--dsh-glass-chat-fill-alpha", String(s.chatFill / 100));
					html.style.setProperty("--dsh-glass-edge-strength", String(s.edgeStrength / 50));
					html.style.setProperty("--dsh-glass-shadow-strength", String(s.shadowStrength / 50));
					html.style.setProperty("--dsh-glass-module-inset", s.moduleInset + "px");
					html.style.setProperty("--dsh-glass-module-gap", s.moduleGap + "px");
					// 亮度遮罩: 暗色模式只压黑(0-50), 亮色模式只提白(50-100)。
					const drift = (s.bgBrightness - 50) / 50; // -1 .. 1
					html.style.setProperty("--dsh-glass-brightness-white", String(this.dark ? 0 : clamp(drift, 0, 1)));
					html.style.setProperty("--dsh-glass-brightness-black", String(this.dark ? clamp(-drift, 0, 1) : 0));
				} else {
					html.removeAttribute(ATTRIBUTE);
					html.removeAttribute(MODULES_ATTRIBUTE);
					for (const name of HTML_VARS) html.style.removeProperty(name);
				}
			}

			/** 背景层: 预设渐变(含光斑)或本地图片, 顶部叠亮度遮罩。 */
			syncBackdrop() {
				if (!this.getEnabled()) { this.removeBackdrop(); return; }
				const s = this.settings;
				let el = this.backdropEl;
				if (!el) {
					el = document.createElement("div");
					el.setAttribute("data-dsh-glass-backdrop", "");
					document.body.appendChild(el);
					this.backdropEl = el;
				}
				el.style.filter = s.bgBlur > 0 ? "blur(" + s.bgBlur + "px)" : "";
				const useImage = s.background === "image" && s.image !== "";
				el.dataset.mode = useImage ? "image" : "preset";
				if (useImage) {
					el.style.background = "transparent";
					let img = el.querySelector("[data-dsh-glass-image]");
					if (!img) {
						img = document.createElement("img");
						img.setAttribute("data-dsh-glass-image", "");
						img.alt = "";
						el.appendChild(img);
					}
					if (img.getAttribute("src") !== s.image) img.setAttribute("src", s.image);
					this.removeBlobs(el);
				} else if (s.preset === "custom") {
					// 自定义背景: 颜色 A 纯色, 或 A→B 双色渐变(无光斑)。
					el.style.background = customBackground(s);
					const img = el.querySelector("[data-dsh-glass-image]");
					if (img) img.remove();
					this.removeBlobs(el);
				} else {
					const preset = findPreset(s.preset);
					const colors = this.dark ? preset.dark : preset.light;
					el.style.background = colors.bg;
					const img = el.querySelector("[data-dsh-glass-image]");
					if (img) img.remove();
					this.ensureBlobs(el, preset);
				}
				// 亮度遮罩永远叠在最上层。
				let veil = el.querySelector("[data-dsh-glass-veil]");
				if (!veil) {
					veil = document.createElement("div");
					veil.setAttribute("data-dsh-glass-veil", "");
					el.appendChild(veil);
				}
				if (veil !== el.lastElementChild) el.appendChild(veil);
			}

			ensureBlobs(el, preset) {
				const colors = (this.dark ? preset.dark.blobs : preset.light.blobs) || preset.light.blobs || [];
				for (let i = 0; i < 2; i++) {
					let blob = el.querySelector("[data-dsh-glass-blob='" + (i + 1) + "']");
					if (colors.length === 0) {
						if (blob) blob.remove();
						continue;
					}
					if (!blob) {
						blob = document.createElement("div");
						blob.setAttribute("data-dsh-glass-blob", String(i + 1));
						el.appendChild(blob);
					}
					const c = colors[i] || colors[0];
					blob.style.background = c ? "radial-gradient(circle at center, " + c + ", transparent 70%)" : "none";
				}
			}

			removeBlobs(el) {
				const blobs = el.querySelectorAll("[data-dsh-glass-blob]");
				for (const b of blobs) b.remove();
			}

			removeBackdrop() {
				if (this.backdropEl) {
					this.backdropEl.remove();
					this.backdropEl = null;
				}
			}

			applyAll() {
				this.syncTokens();
				this.syncAttributes();
				this.syncBackdrop();
			}

			/** 全量回收: 属性、CSS 变量、token 层、背景 DOM。 */
			dispose() {
				if (this.tokenDisposer) {
					this.tokenDisposer();
					this.tokenDisposer = null;
				}
				const html = typeof document !== "undefined" ? document.documentElement : null;
				if (html) {
					html.removeAttribute(ATTRIBUTE);
					html.removeAttribute(MODULES_ATTRIBUTE);
					for (const name of HTML_VARS) html.style.removeProperty(name);
				}
				if (this.storageHandler) {
					window.removeEventListener("storage", this.storageHandler);
					this.storageHandler = null;
				}
				this.removeBackdrop();
			}
		}
		//#endregion

		//#region React panel
		function Slider(props) {
			return h("div", { className: "dgu_row" },
				h("span", { className: "dgu_label" }, props.label),
				h("input", {
					type: "range",
					className: "dgu_range",
					min: props.min, max: props.max, step: props.step,
					value: props.value,
					onChange: (e) => props.onChange(Number(e.target.value)),
				}),
				h("span", { className: "dgu_value" }, props.value + (props.suffix || ""))
			);
		}

		function ToggleRow(props) {
			return h("div", { className: "dgu_row" },
				h("span", { className: "dgu_label" }, props.label),
				h("button", {
					type: "button",
					className: "dgu_seg_btn" + (props.checked ? " dgu_seg_on" : ""),
					"aria-pressed": props.checked,
					onClick: () => props.onChange(!props.checked),
				}, props.checked ? "开" : "关")
			);
		}

		/** 本地图片 → 压缩为 JPEG dataURL(最长边 2400, 质量 0.85)。 */
		function downscaleImage(dataUrl, maxEdge, quality) {
			return new Promise((resolve) => {
				const img = new Image();
				img.onload = () => {
					try {
						let w = img.naturalWidth || img.width;
						let hgt = img.naturalHeight || img.height;
						const scale = Math.min(1, maxEdge / Math.max(w, hgt, 1));
						w = Math.max(1, Math.round(w * scale));
						hgt = Math.max(1, Math.round(hgt * scale));
						const canvas = document.createElement("canvas");
						canvas.width = w;
						canvas.height = hgt;
						const g = canvas.getContext("2d");
						if (!g) { resolve(dataUrl); return; }
						g.drawImage(img, 0, 0, w, hgt);
						resolve(canvas.toDataURL("image/jpeg", quality));
					} catch (e) {
						resolve(dataUrl);
					}
				};
				img.onerror = () => resolve(dataUrl);
				img.src = dataUrl;
			});
		}

		/**
		 * 「玻璃质感」设置区块: 总开关 + 玻璃参数 + 自定义背景 + 恢复默认。
		 * layer 是唯一状态源; 每次修改写回 layer 并同步 React 状态。
		 */
		function GlassPanel(props) {
			const layer = props.layer;
			const [s, setS] = react.useState(() => layer.getSettings());
			const [err, setErr] = react.useState("");
			const fileRef = react.useRef(null);
			const update = (patch) => {
				layer.update(patch);
				setS(layer.getSettings());
				setErr("");
			};
			const onPickFile = (e) => {
				const file = e.target.files && e.target.files[0];
				e.target.value = "";
				if (!file) return;
				if (!/^image\//.test(file.type)) { setErr("请选择图片文件"); return; }
				const reader = new FileReader();
				reader.onload = () => {
					downscaleImage(String(reader.result || ""), 2400, 0.85).then((out) => {
						if (out) update({ background: "image", image: out });
					});
				};
				reader.onerror = () => setErr("读取图片失败");
				reader.readAsDataURL(file);
			};
			const enabled = s.enabled !== false;
			return h("div", { className: "dgu_root" },
				/* ---- 总开关 ---- */
				h("div", { className: "dgu_card" },
					h("div", { className: "dgu_card_head" },
						h("div", null,
							h("div", { className: "dgu_title" }, "玻璃质感 UI"),
							h("div", { className: "dgu_desc" }, "侧边栏、输入区、对话框变成磨砂玻璃；可搭配预设渐变或本地图片背景。关闭即完全还原原版界面。")
						),
						h("button", {
							type: "button",
							className: "dgu_master" + (enabled ? " dgu_master_on" : ""),
							"aria-pressed": enabled,
							onClick: () => update({ enabled: !enabled }),
						}, enabled ? "已开启" : "已关闭")
					)
				),
				enabled && h("div", { className: "dgu_card" },
					h("div", { className: "dgu_sub" }, "玻璃面板"),
					h(Slider, { label: "模糊强度", min: 0, max: 40, step: 1, value: s.blur, suffix: "px", onChange: (v) => update({ blur: v }) }),
					h(Slider, { label: "统一圆角", min: 0, max: 24, step: 1, value: s.radius, suffix: "px", onChange: (v) => update({ radius: v }) }),
					h(Slider, { label: "描边浓度", min: 0, max: 100, step: 1, value: s.edgeStrength, suffix: "%", onChange: (v) => update({ edgeStrength: v }) }),
					h(Slider, { label: "阴影强度", min: 0, max: 100, step: 1, value: s.shadowStrength, suffix: "%", onChange: (v) => update({ shadowStrength: v }) }),
					h("div", { className: "dgu_hint" }, "描边/阴影 50=默认，越高越重。")
				),
				enabled && h("div", { className: "dgu_card" },
					h("div", { className: "dgu_sub" }, "玻璃浓度"),
					h(Slider, { label: "侧栏玻璃浓度", min: 0, max: 100, step: 1, value: s.sidebarFill, suffix: "%", onChange: (v) => update({ sidebarFill: v }) }),
					h(Slider, { label: "聊天区玻璃浓度", min: 0, max: 100, step: 1, value: s.chatFill, suffix: "%", onChange: (v) => update({ chatFill: v }) }),
					h("div", { className: "dgu_hint" }, "玻璃浓度 0=全透 100=实色。")
				),
				enabled && h("div", { className: "dgu_card" },
					h("div", { className: "dgu_sub" }, "模块化布局"),
					h(ToggleRow, { label: "浮动模块", checked: !!s.modules, onChange: (v) => update({ modules: v }) }),
					h(Slider, { label: "侧栏圆角", min: 0, max: 32, step: 1, value: s.sidebarRadius, suffix: "px", onChange: (v) => update({ sidebarRadius: v }) }),
					h(Slider, { label: "聊天区圆角", min: 0, max: 32, step: 1, value: s.chatRadius, suffix: "px", onChange: (v) => update({ chatRadius: v }) }),
					h(Slider, { label: "模块外边距", min: 0, max: 32, step: 1, value: s.moduleInset, suffix: "px", onChange: (v) => update({ moduleInset: v }) }),
					h(Slider, { label: "模块间隙", min: 0, max: 24, step: 1, value: s.moduleGap, suffix: "px", onChange: (v) => update({ moduleGap: v }) }),
					h("div", { className: "dgu_hint" }, "把侧栏、聊天区、详情列独立成带边框的玻璃卡片，背景从间隙透出。")
				),
				enabled && h("div", { className: "dgu_card" },
					h("div", { className: "dgu_sub" }, "自定义背景"),
					h("div", { className: "dgu_seg" },
						h("button", { type: "button", className: "dgu_seg_btn" + (s.background === "preset" ? " dgu_seg_on" : ""), onClick: () => update({ background: "preset" }) }, "预设渐变"),
						h("button", { type: "button", className: "dgu_seg_btn" + (s.background === "image" ? " dgu_seg_on" : ""), onClick: () => update({ background: "image" }) }, "自定义图片")
					),
					s.background === "image"
						? h("div", { className: "dgu_row" },
							h("button", { type: "button", className: "dgu_btn", onClick: () => { const f = fileRef.current; if (f) f.click(); } }, "选择本地图片…"),
							s.image ? h("span", { className: "dgu_hint" }, "已使用自定义图片") : h("span", { className: "dgu_hint" }, "未选择图片(将显示纯色底)"),
							s.image ? h("button", { type: "button", className: "dgu_btn", onClick: () => update({ image: "" }) }, "移除") : null,
							h("input", { ref: fileRef, type: "file", accept: "image/*", style: { display: "none" }, onChange: onPickFile })
						)
						: h("div", { className: "dgu_swatches" },
							PRESETS.map((p) => h("button", {
								key: p.id,
								type: "button",
								title: p.name,
								className: "dgu_swatch" + (s.preset === p.id ? " dgu_swatch_on" : ""),
								style: { background: p.id === "custom" ? customBackground(s) : p.light.bg },
								onClick: () => update({ preset: p.id }),
							}, h("span", { className: "dgu_swatch_name" }, p.name)))
						),
					s.preset === "custom" && h("div", { className: "dgu_row" },
						h("span", { className: "dgu_label" }, "自定义色"),
						h("input", { type: "color", className: "dgu_color", title: "颜色 A", value: s.customColorA || "#4A7FD9", onChange: (e) => update({ customColorA: e.target.value }) }),
						h("input", { type: "color", className: "dgu_color", title: "颜色 B", value: s.customColorB || "#4A7FD9", onChange: (e) => update({ customColorB: e.target.value }) }),
						h("button", { type: "button", className: "dgu_btn", onClick: () => update({ customColorB: s.customColorB ? "" : "#B07FE8" }) }, s.customColorB ? "改为纯色" : "加渐变色"),
						h("span", { className: "dgu_hint" }, "两色=渐变，仅颜色 A=纯色")
					),
					h(Slider, { label: "背景模糊", min: 0, max: 40, step: 1, value: s.bgBlur, suffix: "px", onChange: (v) => update({ bgBlur: v }) }),
					h(Slider, { label: "背景亮度", min: 0, max: 100, step: 1, value: s.bgBrightness, suffix: "", onChange: (v) => update({ bgBrightness: v }) }),
					h("div", { className: "dgu_hint" }, "亮度 50 为原样：亮色模式下越高越亮，暗色模式下越低越暗。")
				),
				enabled && h("div", { className: "dgu_card" },
					h("div", { className: "dgu_row" },
						h("button", {
							type: "button",
							className: "dgu_btn",
							onClick: () => { layer.reset(); setS(layer.getSettings()); setErr(""); },
						}, "恢复默认设置"),
						err ? h("span", { className: "dgu_error" }, err) : null
					),
					h("div", { className: "dgu_hint" }, "设置即时生效并保存在本机浏览器；总开关关闭时所有效果都会被移除。")
				)
			);
		}
		//#endregion

		//#region plugin
		const inject = ["slots", "theme"];

		function apply(ctx) {
			// 玻璃层拥有全部生命周期; 槽位注册与 token 层都挂在插件 fiber 上。
			const layer = new GlassLayer(ctx);
			ctx.slots.inject("settings.section", () => ctx.slots.register({
				name: "settings.section",
				id: "dsh-glass-ui",
				order: 60,
				label: () => "玻璃质感",
			}, (props) => h(GlassPanel, { layer: layer })));
			layer.applyAll();
		}

		exports.apply = apply;
		exports.inject = inject;
		exports._test = { DEFAULT_SETTINGS, PRESETS, buildTokenOverrides, normalizeSettings, customBackground, GlassLayer, GlassPanel };
		return module.exports;
		//#endregion
	}
});
