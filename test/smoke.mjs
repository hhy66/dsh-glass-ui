// dsh-glass-ui 冒烟测试:
// 1) 语法检查: 用 vm 执行 client.js / src/index.js 源码, 语法错误直接抛出。
// 2) 客户端行为: 假 cordis 上下文捕获槽位注册与主题 token 覆盖,
//    断言 玻璃属性/变量/token 层的应用与回收(总开关关闭即全量还原)。
// 3) 渲染冒烟: 用全局 dsh 树里的真实 React renderToString 渲染设置面板。
import { createRequire } from 'node:module'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'

const requireG = createRequire('file:///C:/Program Files/nodejs/node_modules/@deepseek-ai/dsh/package.json')
const React = requireG('react')
const { renderToString } = requireG('react-dom/server')

const assert = (cond, msg) => { if (!cond) throw new Error('断言失败: ' + msg) }

// ---------- 宿主端检查: 原生 ESM 导入(语法错误会在此抛出) ----------
const host = await import(new URL('../src/index.js', import.meta.url).href)
assert(typeof host.apply === 'function', '宿主端缺少 apply 导出')
console.log('  src/index.js 语法 OK')

// ---------- 浏览器环境 mock ----------
function makeEl(tag) {
	return {
		tagName: tag,
		dataset: {},
		attributes: {},
		children: [],
		lastElementChild: null,
		removed: false,
		style: { props: {}, setProperty(k, v) { this.props[k] = String(v) }, removeProperty(k) { delete this.props[k] }, cssText: '' },
		setAttribute(k, v) { this.attributes[k] = String(v) },
		getAttribute(k) { return this.attributes[k] ?? null },
		removeAttribute(k) { delete this.attributes[k] },
		appendChild(c) { this.children.push(c); this.lastElementChild = c; return c },
		querySelector() { return null },
		querySelectorAll() { return [] },
		remove() { this.removed = true },
	}
}
let capturedDef = null
const created = []
const windowListeners = {}
globalThis.window = {
	__ModuleLoader__: { load: (def) => { capturedDef = def } },
	addEventListener: (type, fn) => { windowListeners[type] = fn },
	removeEventListener: (type) => { delete windowListeners[type] },
}
globalThis.document = {
	documentElement: makeEl('html'),
	body: makeEl('body'),
	head: makeEl('head'),
	createElement: (t) => { const e = makeEl(t); created.push(e); return e },
	querySelector: () => null,
}
globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} }
// 模拟现代内核: 支持 backdrop-filter(降级分支由 buildTokenOverrides(true) 单独断言)
globalThis.CSS = { supports: () => true }

// 执行仓库内受信任的本地模块源码(模拟浏览器模块加载器加载 client.js)。
vm.runInThisContext(readFileSync(new URL('../client/client.js', import.meta.url), 'utf8'))
assert(capturedDef !== null, 'client.js 未向 __ModuleLoader__ 注册')

const requireMap = (id) => {
	if (id === 'react') return React
	throw new Error('未知模块: ' + id)
}
const mod = capturedDef.factory(requireMap)
assert(typeof mod.apply === 'function', 'client 模块缺少 apply')
assert(Array.isArray(mod.inject) && mod.inject.includes('slots') && mod.inject.includes('theme'), 'inject 应声明 slots + theme')

// ---------- 假 cordis 客户端上下文 ----------
function makeCtx() {
	const env = {
		registrations: [],
		tokenCalls: [],
		disposerCalls: 0,
		themeHandlers: [],
		fiberDisposers: [],
		dark: false,
	}
	const ctx = {
		slots: {
			inject: (name, fn) => { env.registrations.push({ slot: name, ...fn() }) },
			register: (desc, Comp) => ({ desc, Comp }),
		},
		theme: {
			overrideTokens: (src, tokens) => { env.tokenCalls.push({ src, tokens }); return () => { env.disposerCalls += 1 } },
			getTheme: () => ({ active: { colorScheme: env.dark ? 'dark' : 'light' } }),
		},
		on: (evt, handler) => { if (evt === 'theme/change') env.themeHandlers.push(handler); return () => {} },
		effect: (fn) => { const d = fn(); if (typeof d === 'function') env.fiberDisposers.push(d) },
	}
	return { ctx, env }
}

// ---------- 第一次应用: 注册 + 默认玻璃层 ----------
const { ctx: ctx1, env: env1 } = makeCtx()
mod.apply(ctx1)

const html = document.documentElement
const reg = env1.registrations.find((r) => r.slot === 'settings.section')
assert(reg, 'settings.section 未注册')
assert(reg.desc.id === 'dsh-glass-ui', '槽位 id 应为 dsh-glass-ui')
assert(reg.desc.label() === '玻璃质感', '槽位标题应为「玻璃质感」')
assert(html.attributes['data-dsh-glass'] === '', '总开关默认开启: html 应带 data-dsh-glass')
assert(html.attributes['data-dsh-glass-modules'] === '', '默认开启浮动模块布局')
assert(html.style.props['--dsh-glass-blur'] === '16px', '默认模糊 16px')
assert(html.style.props['--dsh-glass-radius'] === '14px', '默认圆角 14px')
assert(html.style.props['--dsh-glass-sidebar-radius'] === '16px', '默认侧栏圆角 16px')
assert(html.style.props['--dsh-glass-chat-radius'] === '16px', '默认聊天区圆角 16px')
// 玻璃材质可调项默认值
assert(html.style.props['--dsh-glass-sidebar-fill-alpha'] === '0.5', '默认侧栏玻璃浓度 50')
assert(html.style.props['--dsh-glass-chat-fill-alpha'] === '0.3', '默认聊天区玻璃浓度 30')
assert(html.style.props['--dsh-glass-edge-strength'] === '1', '默认描边浓度 1x')
assert(html.style.props['--dsh-glass-shadow-strength'] === '1', '默认阴影强度 1x')
assert(html.style.props['--dsh-glass-module-inset'] === '12px', '默认模块外边距 12px')
assert(html.style.props['--dsh-glass-module-gap'] === '10px', '默认模块间隙 10px')
assert(env1.tokenCalls.length === 1, '启用时应推入一层主题 token 覆盖')
const tokens = env1.tokenCalls[0].tokens
for (const [name, modes] of Object.entries(tokens)) {
	assert(name.startsWith('--dsw-'), 'token 名应以 --dsw- 开头: ' + name)
	assert(typeof modes === 'object' && modes !== null, 'token 值必须是对象: ' + name)
	assert(typeof modes.light === 'string' && modes.light.includes('color-mix'), 'light 必须是 color-mix 字符串: ' + name)
	assert(typeof modes.dark === 'string' && modes.dark.includes('color-mix'), 'dark 必须是 color-mix 字符串: ' + name)
	// 固定 alpha(含可读底线): color-mix(in srgb, var(--dsw-static-*) N%, transparent)
	assert(/color-mix\(in srgb, var\(--dsw-static-[a-z0-9-]+\) \d+%, transparent\)/.test(modes.light), 'light 必须是固定 alpha: ' + name)
	assert(/color-mix\(in srgb, var\(--dsw-static-[a-z0-9-]+\) \d+%, transparent\)/.test(modes.dark), 'dark 必须是固定 alpha: ' + name)
}
assert(tokens['--dsw-specific-sidebar-fill'].light.includes('--dsw-static'), '颜色应引用静态色板')
assert(tokens['--dsw-specific-sidebar-fill'].light.includes('45%, transparent'), '侧栏亮色底色 45%(含可读底线)')
assert(tokens['--dsw-specific-sidebar-fill'].dark.includes('33%, transparent'), '暗色侧栏更透(33%)')
assert(tokens['--dsw-specific-bubble'].light.includes('58%, transparent'), '气泡底色 58%')
assert(tokens['--dsw-specific-input-major'].light.includes('56%, transparent'), '输入框底色 56%')
assert(tokens['--dsw-specific-bubble'], '气泡 token 必须覆盖')
assert(tokens['--dsw-specific-input-major'], '输入区 token 必须覆盖')
// backdrop-filter 降级兜底: 不支持时 alpha +20
const fb = mod._test.buildTokenOverrides(true)
assert(fb['--dsw-specific-sidebar-fill'].light.includes('65%, transparent'), '降级模式侧栏 alpha 应提升到 65%')
assert(fb['--dsw-specific-bubble'].light.includes('78%, transparent'), '降级模式气泡 alpha 应提升到 78%')
assert(fb['--dsw-specific-input-major'].light.includes('76%, transparent'), '降级模式输入框 alpha 应提升到 76%')
console.log('  主题 token 覆盖层 OK (' + Object.keys(tokens).length + ' 个 token, 固定 alpha + 降级兜底)')

// ---------- 布局回归守卫: 结构容器非侵入式 ----------
// 原则: _sidebarCol/_centerCol/_detailsCol 不改盒模型(margin/padding)、不加 backdrop-filter;
// 玻璃卡片一律由 ::before 在容器内部画(伪元素无真实后代, 不劫持其他插件定位)。
const styleTag = created.find((e) => e.tagName === 'style')
assert(styleTag, '应注入样式表')
const injectedCss = styleTag.textContent || ''
// 侧栏: 模糊必须在 sidebarCol::before 上(伪元素不劫持浮层 fixed 定位), 列本体/SidebarRoot 不得有 backdrop-filter
assert(injectedCss.includes("_sidebarCol']:not(:has([class*='_collapsed'])):not(:has([role='dialog']))::before{content:'';position:absolute;inset:"), '侧栏展开态玻璃卡片应走 sidebarCol::before(含 dialog 守卫)')
assert(injectedCss.includes("_sidebarCol']:not(:has([class*='_collapsed'])):has([role='dialog'])::before{backdrop-filter:none"), '浮层打开期间应停用 ::before 模糊')
assert(injectedCss.includes("[class*='_sidebarCol'] > [data-slot='sidebar'][class*='_collapsed']:not(:has([role='dialog'])){backdrop-filter"), '侧栏收起态模糊应在 SidebarRoot 上(带 dialog 守卫)')
assert(!/\[class\*='_sidebarCol'\]\{[^}]*backdrop-filter/.test(injectedCss), '侧栏列本体不应加 backdrop-filter')
assert(!/\[class\*='_detailsCol'\]\{[^}]*backdrop-filter/.test(injectedCss), '详情列不应加 backdrop-filter')
// 玻璃层必须在内容之下(z-index:-1), 内容(Logo/按钮/文字)绝不落入 blur 范围
assert(injectedCss.includes('pointer-events:none;z-index:-1}'), '玻璃 ::before 必须在内容之下(z-index:-1)')
assert(injectedCss.includes('background:transparent!important;overflow:visible;border-right:none;backdrop-filter:none!important'), '侧栏本体必须背景透明且无 blur')
assert(injectedCss.includes("data-dsh-glass-modules] [class*='_frame']{isolation:isolate"), 'frame 必须隔离层叠(否则 ::before 掉到 frame 背景之下, 模块化失效)')
assert(!/\[class\*='_sidebarCol'\][^\{]*\{[^}]*isolation:isolate/.test(injectedCss), '侧栏不得用 isolation(会把设置浮层困在 auto 层, 导致点不到)')
assert(injectedCss.includes("[data-slot='sidebar']{background:transparent!important"), 'SidebarRoot 背景必须透明(让玻璃透出)')
assert(injectedCss.includes('--dsh-glass-sidebar-fill'), '应定义侧栏玻璃底色变量')
assert(injectedCss.includes('saturate(115%)'), '玻璃模糊应带 saturate(115%)')
// 结构容器不得有 margin(非侵入): 视觉卡片由 ::before inset 制造间隙
assert(!/\[class\*='_sidebarCol'\]\{[^}]*margin:/.test(injectedCss), '侧栏列本体不应有 margin')
assert(!/\[class\*='_centerCol'\]\{[^}]*margin:/.test(injectedCss), '聊天区列本体不应有 margin')
assert(!/\[class\*='_detailsCol'\]\{[^}]*margin:/.test(injectedCss), '详情列本体不应有 margin')
// SidebarRoot 不得被改盒模型(展开态无 margin 规则); 收起态 ::before 画卡片(不碰 root padding)
assert(!/\[data-slot='sidebar'\]\:not\(\[class\*='_collapsed'\]\)\{[^}]*margin:/.test(injectedCss), 'SidebarRoot 展开态不应有 margin(不重新排版侧栏内容)')
assert(injectedCss.includes("> [data-slot='sidebar'][class*='_collapsed']::before"), '侧栏收起态卡片应走 ::before(不碰 root padding)')
assert(!/\[data-slot='sidebar'\][^\{]*_collapsed[^\{]*\{[^}]*padding:0/.test(injectedCss), '收起态不得清零 root padding')
// 聊天区/详情列: ::before 画玻璃卡片, 列本体无 margin/背景/模糊
assert(injectedCss.includes("data-dsh-glass-modules] [class*='_centerCol']::before{content:'';position:absolute;inset:"), '聊天区卡片应走 ::before(inset 制造间隙)')
assert(injectedCss.includes("_centerCol']::before{content:'';position:absolute;inset:var(--dsh-glass-module-inset) var(--dsh-glass-module-gap);border-radius:var(--dsh-glass-chat-radius,16px);background:var(--dsh-glass-chat-fill);backdrop-filter:blur"), '聊天区 ::before 应带淡底 + 模糊')
assert(injectedCss.includes("data-dsh-glass-modules] [class*='_detailsCol']::before{content:'';position:absolute;inset:"), '详情列卡片应走 ::before')
assert(!/data-dsh-glass-modules\][^\{]*_centerCol'\]\{[^}]*background:/.test(injectedCss), '聊天区列本体不应加背景')
assert(!/data-dsh-glass-modules\][^\{]*_centerCol'\]\{[^}]*backdrop-filter/.test(injectedCss), '聊天区列本体不应加 backdrop-filter')
// 输入区: seat 不 blur(只去背景), 玻璃由输入卡片(card)承担
assert(injectedCss.includes("_composerSeat']{background:none!important;backdrop-filter:none!important"), '输入区 seat 不应 blur')
assert(injectedCss.includes("_centerCol'] [class$='_card']{background:var(--dsw-specific-input-major);backdrop-filter:blur"), '输入卡片应自身承担 backdrop-filter')
// 模块间距变量化(未来可调, 暂不暴露 UI)
assert(injectedCss.includes('--dsh-glass-module-inset:12px'), '模块间距应变量化(inset)')
assert(injectedCss.includes('--dsh-glass-module-gap:10px'), '模块间隙应变量化(gap=10px, 加宽缝)')
assert(injectedCss.includes("margin-right:calc(-1 * var(--dsh-glass-module-squeeze))"), '侧栏会话区预留应引用 squeeze 变量')
// 输入框玻璃化(24px 圆角 + 描边 + 高光) + 发光边 + 阴影配方
assert(injectedCss.includes("_centerCol'] [class$='_card']{background:var(--dsw-specific-input-major);backdrop-filter:blur(var(--dsh-glass-blur,14px));-webkit-backdrop-filter:blur(var(--dsh-glass-blur,14px));border-radius:24px;box-shadow"), '输入框卡片应 24px 圆角 + 玻璃描边')
assert(injectedCss.includes('--dsh-glass-sidebar-glow'), '应定义侧栏发光边变量')
assert(injectedCss.includes('--dsh-glass-module-edge:rgba(19,45,83,calc(var(--dsh-glass-edge-strength,1) * .26))'), '模块描边应对齐 Aqua 且可调(light .26 × 强度)')
assert(injectedCss.includes('--dsh-glass-module-shadow:0 10px 34px rgba(19,45,83,calc(var(--dsh-glass-shadow-strength,1) * .16))'), '模块阴影应单层蓝调且可调(light)')
assert(injectedCss.includes('--dsh-glass-highlight:rgba(255,255,255,.5)'), '内高光应对齐 Aqua(light .5)')
console.log('  布局回归守卫 OK (结构容器非侵入: 列无 margin/无模糊; 卡片全部由 ::before/card 承担)')

// ---------- 渲染设置面板(真实 React, 与浏览器首帧一致) ----------
const panelHtml = renderToString(React.createElement(reg.Comp, {}))
for (const probe of ['玻璃质感', '模糊强度', '玻璃浓度', '侧栏玻璃浓度', '聊天区玻璃浓度', '描边浓度', '阴影强度', '模块化布局', '侧栏圆角', '聊天区圆角', '模块外边距', '模块间隙', '浮动模块', '自定义背景', '极光', '自定义', '恢复默认设置']) {
	assert(panelHtml.includes(probe), '设置面板渲染缺少文案: ' + probe)
}
console.log('  settings.section 渲染 OK, html 长度', panelHtml.length)

// ---------- 玻璃层生命周期: 开关切换 / 材质变量 / 明暗 ----------
const { ctx: ctx2, env: env2 } = makeCtx()
const layer = new mod._test.GlassLayer(ctx2)
layer.applyAll()
assert(env2.tokenCalls.length === 1, 'applyAll 应推入一层 token 覆盖')
const backdropEl = created.filter((e) => e.attributes['data-dsh-glass-backdrop'] === '').at(-1)
assert(backdropEl, '应创建背景层元素')

layer.update({ sidebarFill: 80 })
assert(env2.tokenCalls.length === 1, '材质浓度变化不应重推 token 层(走 CSS 变量)')
assert(html.style.props['--dsh-glass-sidebar-fill-alpha'] === '0.8', '侧栏浓度变量应实时更新')

layer.update({ enabled: false })
assert(env2.disposerCalls === 1, '关闭总开关应释放 token 层')
assert(!('data-dsh-glass' in html.attributes), '关闭后 html 属性应移除')
assert(!('data-dsh-glass-modules' in html.attributes), '关闭后 modules 属性应移除')
assert(backdropEl.removed === true, '关闭后背景层应移除')

layer.update({ sidebarFill: 30 })
assert(env2.tokenCalls.length === 1, '关闭状态下不应推 token 层')

layer.update({ enabled: true })
assert(env2.tokenCalls.length === 2, '重新开启应再推一层 token 覆盖')
assert(html.style.props['--dsh-glass-sidebar-fill-alpha'] === '0.3', '重新开启后侧栏浓度恢复')

// 明暗切换: 亮度遮罩变量翻转 + 背景切换暗色预设
env2.dark = true
env2.themeHandlers.forEach((fn) => fn())
assert(html.style.props['--dsh-glass-brightness-black'] === '0', '暗色且亮度 50 时黑色遮罩应为 0')
const backdropEl2 = created.filter((e) => e.attributes['data-dsh-glass-backdrop'] === '' && e.removed === false).at(-1)
assert(backdropEl2 && backdropEl2.style.background.includes('#0d1220'), '暗色模式应切换为暗色预设背景')

// 多标签页同步: 其他标签页写入 localStorage 时本页跟随刷新
assert(typeof windowListeners.storage === 'function', '应监听 storage 事件')
windowListeners.storage({ key: 'dsh.ui-glass.v1', newValue: JSON.stringify({ ...mod._test.DEFAULT_SETTINGS, chatFill: 88 }) })
assert(layer.getSettings().chatFill === 88, 'storage 事件应同步设置')
assert(html.style.props['--dsh-glass-chat-fill-alpha'] === '0.88', '同步后应重推玻璃变量')
windowListeners.storage({ key: 'other.key', newValue: '{}' })
windowListeners.storage({ key: 'dsh.ui-glass.v1', newValue: null })
assert(layer.getSettings().chatFill === 88, '无关 key / 空值不应触发同步')

layer.dispose()
assert(env2.disposerCalls === 2, 'dispose 应释放 token 层')
assert(!('data-dsh-glass' in html.attributes), 'dispose 后 html 属性应移除')
assert(backdropEl2.removed === true, 'dispose 后背景层应移除')
assert(typeof windowListeners.storage === 'undefined', 'dispose 应移除 storage 监听')
console.log('  玻璃层生命周期 OK (开关/材质变量/明暗/storage 同步/dispose)')

// ---------- 工具函数 ----------
const ns = mod._test.normalizeSettings({ enabled: true, blur: 99, radius: '12', sidebarRadius: 99, chatRadius: -3, modules: 'yes', sidebarFill: 200, chatFill: -1, edgeStrength: 'x', shadowStrength: 77, moduleInset: 99, moduleGap: -5, preset: '不存在', background: 'xxx', image: 42 })
assert(ns.blur === 40 && ns.radius === 12, '数值钳制')
assert(ns.sidebarRadius === 32 && ns.chatRadius === 0, '模块圆角钳制 0-32')
assert(ns.sidebarFill === 100 && ns.chatFill === 0 && ns.edgeStrength === 0, '玻璃浓度钳制 0-100')
assert(ns.shadowStrength === 77, '阴影强度保留合法值')
assert(ns.moduleInset === 32 && ns.moduleGap === 0, '模块间距钳制')
assert(ns.modules === true, 'modules 非 false 一律为 true')
assert(ns.preset === 'aurora' && ns.background === 'preset' && ns.image === '', '非法枚举回退默认')
// 脏数据兜底: 非数字字符串/对象/布尔杂项都不得炸
const dirty = mod._test.normalizeSettings({ blur: 'abc', sidebarRadius: 'x', bgBrightness: undefined, preset: 123, background: ['image'], modules: 0 })
assert(dirty.blur === 0 && dirty.sidebarRadius === 0 && dirty.bgBrightness === 0, '脏数字兜底为 0')
assert(dirty.preset === 'aurora' && dirty.background === 'preset', '脏枚举回退默认')
assert(dirty.modules === true, 'modules 非 false 一律为 true')
// 自定义背景颜色: 纯色 / 双色渐变 / 非法回退
const cb = mod._test.customBackground
assert(cb({ customColorA: '#112233', customColorB: '' }) === '#112233', '自定义纯色')
assert(cb({ customColorA: '#112233', customColorB: '#445566' }) === 'linear-gradient(160deg, #112233 0%, #445566 100%)', '自定义双色渐变')
assert(cb({ customColorA: 'red', customColorB: 123 }) === '#4A7FD9', '非法颜色回退默认蓝')
assert(cb({}) === '#4A7FD9', '缺省回退默认蓝')
const cn = mod._test.normalizeSettings({ customColorA: 'red', customColorB: '#AABBCC' })
assert(cn.customColorA === '#4A7FD9' && cn.customColorB === '#AABBCC', '颜色校验: 非法回退/合法保留')
assert(mod._test.normalizeSettings({ customColorB: '' }).customColorB === '', '颜色 B 清空 = 纯色')
console.log('  工具函数 OK')

console.log('✅ dsh-glass-ui 冒烟测试全部通过')
