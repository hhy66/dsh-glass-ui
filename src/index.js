/**
 * dsh-glass-ui — host half (v0.1.0)。
 *
 * 纯客户端外观插件：宿主侧没有任何行为。空的 apply 仅为让插件
 * 出现在宿主 cordis 配置树 / Loader 中；浏览器半边通过
 * package.json 的 dsh.client 声明经 exports["./client"] 加载，
 * 全部玻璃质感与背景逻辑都在客户端执行。
 */

/** Host plugin body — no host-side behavior for this surface plugin. */
export function apply() {}
