import crypto from 'node:crypto'
import { createClient } from 'redis'

let redis = null
const memory = new Map()
const sendLog = new Map()

function hashOtp(otp, pepper) {
  return crypto.createHmac('sha256', String(pepper || 'otp')).update(String(otp)).digest('hex')
}

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase()
}

function keyFor(email, purpose = 'login') {
  return `${normalizeEmail(email)}:${purpose}`
}

function redisPassword() {
  return String(process.env.REDIS_PASSWORD || '').trim().replace(/^['"]|['"]$/g, '')
}

function createRedisClient() {
  const host = process.env.REDIS_HOST?.trim()
  const password = redisPassword()
  if (host) {
    return createClient({
      socket: {
        host,
        port: Number(process.env.REDIS_PORT || 6379),
        connectTimeout: 8000,
        reconnectStrategy: (retries) => (retries > 2 ? false : 400),
      },
      password: password || undefined,
    })
  }
  return createClient({
    url: process.env.REDIS_URL || 'redis://127.0.0.1:6379',
    socket: { reconnectStrategy: (retries) => (retries > 2 ? false : 400) },
  })
}

export function isRedisReady() {
  return Boolean(redis?.isReady)
}

export async function connectRedis() {
  const client = createRedisClient()
  let warned = false
  client.on('error', (error) => {
    if (warned) return
    warned = true
    console.error('Redis:', error.message)
  })
  try {
    await client.connect()
    redis = client
    console.log(process.env.REDIS_HOST ? `Redis connected (${process.env.REDIS_HOST})` : 'Redis connected')
    return true
  } catch (error) {
    redis = null
    console.warn('Redis unavailable, using in-memory OTP store')
    return false
  }
}

export async function canSendOtp(email, purpose = 'login') {
  const key = `otp-rate:${keyFor(email, purpose)}`
  const now = Date.now()
  if (redis?.isReady) {
    const last = await redis.get(`${key}:last`)
    if (last && now - Number(last) < 5_000) {
      return { ok: false, message: 'Please wait a few seconds before requesting another OTP.' }
    }
    const count = Number((await redis.get(`${key}:count`)) || 0)
    if (count >= 30) {
      return { ok: false, message: 'Too many OTP requests. Try again later.' }
    }
    return { ok: true }
  }
  const entry = sendLog.get(key)
  if (!entry) return { ok: true }
  if (now - entry.lastSent < 5_000) {
    return { ok: false, message: 'Please wait a few seconds before requesting another OTP.' }
  }
  if (now - entry.windowStart < 60 * 60 * 1000 && entry.count >= 30) {
    return { ok: false, message: 'Too many OTP requests. Try again later.' }
  }
  return { ok: true }
}

export async function saveOtp(email, otp, pepper, ttlMs, purpose = 'login') {
  const id = keyFor(email, purpose)
  const now = Date.now()
  const payload = JSON.stringify({
    hash: hashOtp(otp, pepper),
    expiresAt: now + ttlMs,
    attempts: 0,
  })
  if (redis?.isReady) {
    await redis.set(`otp:${id}`, payload, { PX: ttlMs })
    const rateKey = `otp-rate:${id}`
    await redis.set(`${rateKey}:last`, String(now), { PX: 60 * 60 * 1000 })
    const count = await redis.incr(`${rateKey}:count`)
    if (count === 1) await redis.pExpire(`${rateKey}:count`, 60 * 60 * 1000)
    return
  }
  memory.set(id, {
    hash: hashOtp(otp, pepper),
    expiresAt: now + ttlMs,
    attempts: 0,
  })
  const log = sendLog.get(`otp-rate:${id}`)
  if (!log || now - log.windowStart > 60 * 60 * 1000) {
    sendLog.set(`otp-rate:${id}`, { windowStart: now, count: 1, lastSent: now })
  } else {
    sendLog.set(`otp-rate:${id}`, { ...log, count: log.count + 1, lastSent: now })
  }
}

export async function verifyStoredOtp(email, otp, pepper, purpose = 'login') {
  const id = keyFor(email, purpose)
  let record
  if (redis?.isReady) {
    const raw = await redis.get(`otp:${id}`)
    record = raw ? JSON.parse(raw) : null
  } else {
    record = memory.get(id)
  }
  if (!record) return { ok: false, message: 'No OTP found. Request a new code.' }
  if (Date.now() > record.expiresAt) {
    if (redis?.isReady) await redis.del(`otp:${id}`)
    else memory.delete(id)
    return { ok: false, message: 'OTP expired. Request a new code.' }
  }
  if (record.attempts >= 5) {
    if (redis?.isReady) await redis.del(`otp:${id}`)
    else memory.delete(id)
    return { ok: false, message: 'Too many invalid attempts. Request a new code.' }
  }
  const incoming = hashOtp(otp, pepper)
  const left = Buffer.from(incoming)
  const right = Buffer.from(String(record.hash || ''))
  const matches = left.length === right.length && crypto.timingSafeEqual(left, right)
  if (!matches) {
    record.attempts += 1
    if (redis?.isReady) {
      const ttl = Math.max(record.expiresAt - Date.now(), 1000)
      await redis.set(`otp:${id}`, JSON.stringify(record), { PX: ttl })
    }
    return { ok: false, message: 'Invalid OTP. Check the code in your email.' }
  }
  if (redis?.isReady) await redis.del(`otp:${id}`)
  else memory.delete(id)
  return { ok: true }
}
