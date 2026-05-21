import { Redis } from '@upstash/redis'
let redis: Redis | null = null
export function getRedis(): Redis | null {
  if (redis) return redis
  const url = process.env.UPSTASH_REDIS_REST_URL, token = process.env.UPSTASH_REDIS_REST_TOKEN
  if (!url || !token) return null
  redis = new Redis({ url, token }); return redis
}
export async function redisGet<T>(key: string): Promise<T | null> {
  const r = getRedis(); if (!r) return null; try { return await r.get<T>(key) } catch { return null }
}
export async function redisSet(key: string, value: unknown, exSeconds?: number): Promise<void> {
  const r = getRedis(); if (!r) return; try { if (exSeconds) await r.set(key, JSON.stringify(value), { ex: exSeconds }); else await r.set(key, JSON.stringify(value)) } catch {}
}
export async function redisPush(key: string, value: unknown, maxLen = 50): Promise<void> {
  const r = getRedis(); if (!r) return; try { await r.lpush(key, JSON.stringify(value)); await r.ltrim(key, 0, maxLen - 1) } catch {}
}
export async function redisList<T>(key: string, count = 10): Promise<T[]> {
  const r = getRedis(); if (!r) return []; try { const items = await r.lrange(key, 0, count - 1); return items.map(i => typeof i === 'string' ? JSON.parse(i) : i) as T[] } catch { return [] }
}
