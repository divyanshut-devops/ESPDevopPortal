import crypto from 'node:crypto'

const V3_SALT = 'esp-devops-vault-v3'
const V2_SALT = 'esp-devops-vault-v2'

function passphrase() {
  const value = String(process.env.SECRETS_KEY || '').trim()
  if (value.length < 32) {
    const error = new Error('Set SECRETS_KEY to a random string of at least 32 characters.')
    error.status = 500
    throw error
  }
  return value
}

let cachedKey

function encryptionKey() {
  if (!cachedKey) {
    cachedKey = crypto.scryptSync(passphrase(), V3_SALT, 32, {
      N: 32768,
      r: 8,
      p: 1,
      maxmem: 64 * 1024 * 1024,
    })
  }
  return cachedKey
}

function legacyKeys() {
  const values = [
    process.env.SECRETS_KEY,
    process.env.OTP_PEPPER,
    process.env.JWT_SECRET,
    'esp-devops-secrets',
  ]
    .map((item) => String(item || '').trim())
    .filter(Boolean)
  const unique = [...new Set(values)]
  return unique.flatMap((value) => [
    crypto.scryptSync(value, V2_SALT, 32),
    crypto.createHash('sha256').update(value).digest(),
  ])
}

function openPayload(key, ivHex, tagHex, dataHex, encoding) {
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(ivHex, encoding))
  decipher.setAuthTag(Buffer.from(tagHex, encoding))
  return Buffer.concat([decipher.update(Buffer.from(dataHex, encoding)), decipher.final()]).toString('utf8')
}

export function encryptSecret(plaintext) {
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv('aes-256-gcm', encryptionKey(), iv)
  const encrypted = Buffer.concat([cipher.update(String(plaintext ?? ''), 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return ['v3', iv.toString('base64url'), tag.toString('base64url'), encrypted.toString('base64url')].join(':')
}

export function decryptSecret(payload) {
  const raw = String(payload || '')
  if (!raw) return ''
  const parts = raw.split(':')
  if (parts[0] === 'v3' && parts.length === 4) {
    return openPayload(encryptionKey(), parts[1], parts[2], parts[3], 'base64url')
  }
  const versioned = parts[0] === 'v2'
  const [ivHex, tagHex, dataHex] = versioned ? parts.slice(1) : parts
  if (!ivHex || !tagHex || !dataHex) return ''
  for (const key of legacyKeys()) {
    try {
      return openPayload(key, ivHex, tagHex, dataHex, 'hex')
    } catch {
      /* try the next key */
    }
  }
  return ''
}
