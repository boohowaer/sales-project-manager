// 轻量 stale-while-revalidate 缓存：sessionStorage 持久化页面主数据，
// 切页瞬间用旧数据渲染，后台静默刷新。

const PREFIX = 'pc:'

export function readPageCache<T>(key: string): T | undefined {
  if (typeof window === 'undefined') return undefined
  try {
    const raw = sessionStorage.getItem(PREFIX + key)
    return raw ? (JSON.parse(raw) as T) : undefined
  } catch {
    return undefined
  }
}

export function writePageCache(key: string, data: unknown): void {
  if (typeof window === 'undefined') return
  try {
    sessionStorage.setItem(PREFIX + key, JSON.stringify(data))
  } catch {
    // 配额超限或 JSON 失败：忽略，不写缓存即可
  }
}

export function clearPageCache(key: string): void {
  if (typeof window === 'undefined') return
  try {
    sessionStorage.removeItem(PREFIX + key)
  } catch {}
}
