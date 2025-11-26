// Lightweight utilities safe to use in Edge runtime
export function parseJsonSafe<T = any>(input: string | null): T | null {
  if (!input) return null
  try {
    return JSON.parse(input) as T
  } catch (e) {
    return null
  }
}
