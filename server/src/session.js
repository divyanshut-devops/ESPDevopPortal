const SESSION_COOKIE = 'esp_session'
const PENDING_COOKIE = 'esp_pending_2fa'

export function isProduction() {
  return process.env.NODE_ENV === 'production'
}

export function assertRuntimeSecrets() {
  if (!isProduction()) return
  const missing = []
  const jwt = String(process.env.JWT_SECRET || '')
  const vault = String(process.env.SECRETS_KEY || process.env.OTP_PEPPER || '')
  if (!jwt || jwt === 'dev-only-change-me' || jwt.length < 32) missing.push('JWT_SECRET (32+ chars)')
  if (!vault || vault === 'dev-only-pepper' || vault.length < 16) missing.push('SECRETS_KEY')
  if (String(process.env.CORS_ORIGIN || '').includes('*')) missing.push('CORS_ORIGIN (must not be *)')
  if (missing.length) {
    throw new Error(`Refusing to start in production. Set ${missing.join(', ')}.`)
  }
}

export function cookieValue(req, name) {
  const raw = String(req.headers.cookie || '')
  for (const part of raw.split(';')) {
    const index = part.indexOf('=')
    if (index === -1) continue
    if (part.slice(0, index).trim() !== name) continue
    try {
      return decodeURIComponent(part.slice(index + 1).trim())
    } catch {
      return part.slice(index + 1).trim()
    }
  }
  return ''
}

function cookieBase() {
  return {
    httpOnly: true,
    sameSite: 'strict',
    secure: isProduction(),
    path: '/',
  }
}

export function setSessionCookie(res, token) {
  res.cookie(SESSION_COOKIE, token, {
    ...cookieBase(),
    maxAge: 12 * 60 * 60 * 1000,
  })
}

export function setPending2faCookie(res, token) {
  res.cookie(PENDING_COOKIE, token, {
    ...cookieBase(),
    maxAge: 10 * 60 * 1000,
  })
}

export function clearAuthCookies(res) {
  const base = cookieBase()
  res.clearCookie(SESSION_COOKIE, base)
  res.clearCookie(PENDING_COOKIE, base)
}

export function readSessionToken(req) {
  const header = String(req.headers.authorization || '')
  if (header.startsWith('Bearer ')) {
    const bearer = header.slice(7).trim()
    if (bearer) return bearer
  }
  return cookieValue(req, SESSION_COOKIE)
}

export function readPending2faToken(req) {
  return cookieValue(req, PENDING_COOKIE) || String(req.body?.pendingToken || '')
}

export function securityHeaders(req, res, next) {
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.setHeader('X-Frame-Options', 'DENY')
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin')
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()')
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin')
  res.setHeader('X-DNS-Prefetch-Control', 'off')
  res.setHeader(
    'Content-Security-Policy',
    [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob:",
      "font-src 'self' data:",
      "connect-src 'self' ws: wss:",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'none'",
      "worker-src 'self' blob:",
    ].join('; '),
  )
  if (isProduction()) {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains')
  }
  return next()
}

export { SESSION_COOKIE, PENDING_COOKIE }
