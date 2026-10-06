import crypto from 'node:crypto'

function seed() {
  return String(process.env.SECRETS_KEY || process.env.OTP_PEPPER || process.env.JWT_SECRET || 'esp-devops-secrets')
}

function keys() {
  const value = seed()
  return [crypto.scryptSync(value, 'esp-devops-vault-v2', 32), crypto.createHash('sha256').update(value).digest()]
}

export function encryptSecret(plaintext) {
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv('aes-256-gcm', keys()[0], iv)
  const encrypted = Buffer.concat([cipher.update(String(plaintext ?? ''), 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return `v2:${iv.toString('hex')}:${tag.toString('hex')}:${encrypted.toString('hex')}`
}

export function decryptSecret(payload) {
  const raw = String(payload || '')
  if (!raw) return ''
  const parts = raw.split(':')
  const versioned = parts[0] === 'v2'
  const [ivHex, tagHex, dataHex] = versioned ? parts.slice(1) : parts
  if (!ivHex || !tagHex || !dataHex) return ''
  const candidates = versioned ? [keys()[0]] : keys()
  for (const key of candidates) {
    try {
      const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(ivHex, 'hex'))
      decipher.setAuthTag(Buffer.from(tagHex, 'hex'))
      return Buffer.concat([decipher.update(Buffer.from(dataHex, 'hex')), decipher.final()]).toString('utf8')
    } catch {
      /* try next key */
    }
  }
  return ''
}
