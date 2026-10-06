import crypto from 'node:crypto'

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'

function base32Encode(buffer) {
  let bits = 0
  let value = 0
  let output = ''
  for (const byte of buffer) {
    value = (value << 8) | byte
    bits += 8
    while (bits >= 5) {
      output += ALPHABET[(value >>> (bits - 5)) & 31]
      bits -= 5
    }
  }
  if (bits > 0) output += ALPHABET[(value << (5 - bits)) & 31]
  return output
}

function base32Decode(input) {
  const clean = String(input || '')
    .toUpperCase()
    .replace(/=+$/g, '')
    .replace(/[^A-Z2-7]/g, '')
  let bits = 0
  let value = 0
  const bytes = []
  for (const char of clean) {
    const index = ALPHABET.indexOf(char)
    if (index < 0) continue
    value = (value << 5) | index
    bits += 5
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 255)
      bits -= 8
    }
  }
  return Buffer.from(bytes)
}

export function generateTotpSecret() {
  return base32Encode(crypto.randomBytes(20))
}

export function totpCode(secret, step = Math.floor(Date.now() / 30000)) {
  const key = base32Decode(secret)
  const buffer = Buffer.alloc(8)
  buffer.writeUInt32BE(Math.floor(step / 0x100000000), 0)
  buffer.writeUInt32BE(step >>> 0, 4)
  const hmac = crypto.createHmac('sha1', key).update(buffer).digest()
  const offset = hmac[hmac.length - 1] & 0x0f
  const binary =
    ((hmac[offset] & 0x7f) << 24) |
    (hmac[offset + 1] << 16) |
    (hmac[offset + 2] << 8) |
    hmac[offset + 3]
  return String(binary % 1_000_000).padStart(6, '0')
}

export function verifyTotp(secret, code) {
  const expected = String(code || '').replace(/\D/g, '').padStart(6, '0')
  if (expected.length !== 6 || !secret) return false
  const now = Math.floor(Date.now() / 30_000)
  const probe = Buffer.from(expected)
  return [now - 1, now, now + 1].some((step) => {
    const actual = Buffer.from(totpCode(secret, step))
    return actual.length === probe.length && crypto.timingSafeEqual(actual, probe)
  })
}

export function otpauthUrl(email, secret) {
  const label = encodeURIComponent(`ESP DevOps:${email}`)
  const issuer = encodeURIComponent('ESP DevOps')
  return `otpauth://totp/${label}?secret=${secret}&issuer=${issuer}&algorithm=SHA1&digits=6&period=30`
}
