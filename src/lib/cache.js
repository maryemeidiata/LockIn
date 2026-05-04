// Simple in-memory cache for page data so navigating back feels instant
const store = new Map()

export function getCache(key) {
  return store.get(key) ?? null
}

export function setCache(key, data) {
  store.set(key, data)
}

export function clearCache(key) {
  if (key) store.delete(key)
  else store.clear()
}
