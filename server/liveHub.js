/** In-memory SSE hub + simple rate limit for /api/live/* */

const clients = new Set()
const recentSubmitters = []
const rateBuckets = new Map()

export function pushRecentSubmitter(name) {
  if (!name) return
  recentSubmitters.unshift(String(name))
  while (recentSubmitters.length > 12) recentSubmitters.pop()
}

export function getRecentSubmitters() {
  return [...recentSubmitters]
}

export function clearRecentSubmitters() {
  recentSubmitters.length = 0
}

export function addLiveClient(res) {
  clients.add(res)
  return () => clients.delete(res)
}

export function broadcastLive(payload) {
  const data = `data: ${JSON.stringify(payload)}\n\n`
  for (const res of clients) {
    try {
      res.write(data)
    } catch {
      clients.delete(res)
    }
  }
}

export function liveClientCount() {
  return clients.size
}

/** ~60 req/min per IP for live routes */
export function liveRateLimit(req, res, next) {
  const ip = req.headers['x-forwarded-for']?.toString().split(',')[0]?.trim() || req.ip || 'local'
  const now = Date.now()
  let bucket = rateBuckets.get(ip)
  if (!bucket || now - bucket.windowStart > 60_000) {
    bucket = { windowStart: now, count: 0 }
    rateBuckets.set(ip, bucket)
  }
  bucket.count += 1
  if (bucket.count > 60) {
    return res.status(429).json({ error: 'Too many requests. Slow down.' })
  }
  next()
}

// prune rate map occasionally
setInterval(() => {
  const now = Date.now()
  for (const [ip, b] of rateBuckets) {
    if (now - b.windowStart > 120_000) rateBuckets.delete(ip)
  }
}, 60_000).unref?.()
