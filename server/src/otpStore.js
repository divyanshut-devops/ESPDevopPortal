import crypto from 'node:crypto'

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

export async function canSendOtp(email, purpose = 'login') {
  const key = `otp-rate:${keyFor(email, purpose)}`
  const now = Date.now()
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
  const record = memory.get(id)
  if (!record) return { ok: false, message: 'No OTP found. Request a new code.' }
  if (Date.now() > record.expiresAt) {
    memory.delete(id)
    return { ok: false, message: 'OTP expired. Request a new code.' }
  }
  if (record.attempts >= 5) {
    memory.delete(id)
    return { ok: false, message: 'Too many invalid attempts. Request a new code.' }
  }
  const incoming = hashOtp(otp, pepper)
  const left = Buffer.from(incoming)
  const right = Buffer.from(String(record.hash || ''))
  const matches = left.length === right.length && crypto.timingSafeEqual(left, right)
  if (!matches) {
    record.attempts += 1
    return { ok: false, message: 'Invalid OTP. Check the code in your email.' }
  }
  memory.delete(id)
  return { ok: true }
}
