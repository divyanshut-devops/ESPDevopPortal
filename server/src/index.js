import crypto from 'node:crypto'
import http from 'node:http'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import cors from 'cors'
import dotenv from 'dotenv'
import express from 'express'
import jwt from 'jsonwebtoken'
import mongoose from 'mongoose'
import { connectDb, isMongoConfigured } from './db.js'
import { sendInviteEmail, sendOtpEmail } from './mail.js'
import { encryptSecret, decryptSecret } from './cryptoSecrets.js'
import { publicStudio, sendStudioRequest } from './httpStudio.js'
import multer from 'multer'
import { Secret } from './models/Secret.js'
import { Invitation } from './models/Invitation.js'
import { GeneratedFile } from './models/GeneratedFile.js'
import { DocNote } from './models/DocNote.js'
import { Workbook } from './models/Workbook.js'
import { Architecture } from './models/Architecture.js'
import { Shortcut } from './models/Shortcut.js'
import { StudioRequest } from './models/StudioRequest.js'
import { User } from './models/User.js'
import { generateDevArtifact, GENERATOR_KINDS, isOpenRouterConfigured, resolveOpenRouterModel } from './openRouter.js'
import {
  deleteDriveFile,
  getDriveFile,
  isS3Configured,
  listDriveFiles,
  putDriveFile,
} from './s3Drive.js'
import { checkSsl, clientIp, fetchPublicIpv4, fetchPublicIpv6, isIpv4, lookupDns, lookupIpMeta, pingHost, reverseDns } from './networkTools.js'
import {
  assertRuntimeSecrets,
  clearAuthCookies,
  readPending2faToken,
  readSessionToken,
  securityHeaders,
  setPending2faCookie,
  setSessionCookie,
} from './session.js'
import { canSendOtp, connectRedis, isRedisReady, saveOtp, verifyStoredOtp } from './otpStore.js'
import { generateTotpSecret, otpauthUrl, verifyTotp } from './totp.js'
import QRCode from 'qrcode'
import { attachDockerTerminal, dockerTerminalStatus, startDockerTerminal } from './dockerTerminal.js'
import { accessForEmail, isAdminEmail, WORKSPACE_ROLES } from './privileges.js'
import { addNotification, ensureUser, publicUser } from './userService.js'
import { corsOptions } from './corsConfig.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: path.join(__dirname, '../../.env') })

const app = express()
if (process.env.NODE_ENV === 'production') app.set('trust proxy', 1)
const port = Number(process.env.PORT || 3000)
const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000'
const jwtSecret = process.env.JWT_SECRET || (process.env.NODE_ENV === 'production' ? '' : 'dev-only-change-me')
const otpPepper = process.env.OTP_PEPPER || process.env.SECRETS_KEY || (process.env.NODE_ENV === 'production' ? '' : 'dev-only-pepper')
const otpTtlMs = Number(process.env.OTP_TTL_MINUTES || 5) * 60 * 1000
const adminEmails = String(process.env.ADMIN_EMAILS || 'divyanshut@espsofttech.org')
  .split(',')
  .map((item) => item.trim().toLowerCase())
  .filter(Boolean)

app.use(cors(corsOptions()))
app.use(securityHeaders)
app.use(express.json({ limit: '2mb' }))
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } })

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function displayNameFromEmail(email) {
  const local = email.split('@')[0] || 'User'
  return local
    .replace(/[._-]+/g, ' ')
    .split(' ')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

function mongoReady() {
  return isMongoConfigured() && mongoose.connection.readyState === 1
}

function accessPayload(email, storedRole) {
  return {
    name: displayNameFromEmail(email),
    ...accessForEmail(email, adminEmails, storedRole),
  }
}

function signSession(email) {
  return jwt.sign({ email }, jwtSecret, { expiresIn: '12h' })
}

function fallbackUser(email) {
  const access = accessPayload(email)
  return {
    email,
    name: access.name,
    workspaceName: 'ESP DevOps',
    role: access.role,
    team: access.team,
    timezone: 'UTC',
    dateFormat: 'YYYY-MM-DD',
    privileges: access.privileges,
    theme: 'dark',
    twoFactorEnabled: false,
    notificationPrefs: {
      inApp: true,
      email: true,
      deployments: true,
      secrets: true,
      infrastructure: true,
    },
    preferences: {
      compactSidebar: false,
      rememberSidebar: true,
      sessionTimeoutMin: 30,
      itemsPerPage: 8,
      compactTables: false,
      twoFactorEnabled: false,
      showClock: true,
    },
    notifications: [],
  }
}

async function loadAccount(email) {
  const normalized = String(email || '').trim().toLowerCase()
  let storedRole
  if (mongoReady()) {
    const invitation = await Invitation.findOne({ email: normalized })
    const existing = await User.findOne({ email: normalized })
    storedRole = invitation?.role || existing?.role
    if (invitation && invitation.status !== 'accepted') {
      invitation.status = 'accepted'
      invitation.acceptedAt = new Date()
      await invitation.save()
    }
  }
  const access = accessPayload(normalized, storedRole)
  if (!mongoReady()) return fallbackUser(normalized)
  const user = await ensureUser(normalized, access)
  return publicUser(user, access)
}

async function requireAdmin(req, res, next) {
  if (isAdminEmail(req.user?.email, adminEmails)) return next()
  if (!mongoReady()) return res.status(403).json({ message: 'Admin access required.' })
  const user = await User.findOne({ email: req.user.email })
  if (user?.role === 'Admin') return next()
  return res.status(403).json({ message: 'Admin access required.' })
}

function publicInvitation(doc) {
  return {
    id: String(doc._id),
    email: doc.email,
    role: doc.role,
    status: doc.status,
    invitedBy: doc.invitedBy,
    createdAt: doc.createdAt,
    acceptedAt: doc.acceptedAt,
  }
}

function parseRole(value) {
  const role = String(value || '').trim()
  return WORKSPACE_ROLES.includes(role) ? role : ''
}

function authUser(req, res, next) {
  const token = readSessionToken(req)
  if (!token) return res.status(401).json({ message: 'Not authenticated' })
  try {
    req.user = jwt.verify(token, jwtSecret)
    if (req.user.pending2fa) {
      return res.status(401).json({ message: 'Finish two-factor authentication first.' })
    }
    return next()
  } catch {
    return res.status(401).json({ message: 'Session expired. Sign in again.' })
  }
}

function requirePrivilege(...privileges) {
  return async (req, res, next) => {
    try {
      const account = await loadAccount(req.user.email)
      req.account = account
      if (isAdminEmail(req.user.email, adminEmails)) return next()
      if (privileges.some((item) => account.privileges?.includes(item))) return next()
      return res.status(403).json({ message: 'You do not have permission for this action.' })
    } catch {
      return res.status(403).json({ message: 'You do not have permission for this action.' })
    }
  }
}

function requireDb(_req, res, next) {
  if (!isMongoConfigured()) {
    return res.status(503).json({
      message: 'MongoDB is not configured. Add MONGODB_URI in .env',
    })
  }
  if (mongoose.connection.readyState !== 1) {
    return res.status(503).json({ message: 'MongoDB is not connected yet. Check .env credentials.' })
  }
  return next()
}

async function issueOtp(email, purpose) {
    const allowed = await canSendOtp(email, purpose)
    if (!allowed.ok) {
      const error = new Error(allowed.message)
      error.status = 429
      throw error
    }
    const otp = String(crypto.randomInt(100000, 1000000))
    await sendOtpEmail(email, otp, purpose)
    await saveOtp(email, otp, otpPepper, otpTtlMs, purpose)
  }

app.get('/api/health', (_req, res) => {
  res.json({ ok: true })
})

app.get('/api/health/details', authUser, requireAdmin, (_req, res) => {
  res.json({
    ok: true,
    service: 'esp-devops-api',
    mongo: mongoReady() ? 'connected' : isMongoConfigured() ? 'connecting' : 'not-configured',
    openrouter: isOpenRouterConfigured() ? 'configured' : 'not-configured',
    s3: isS3Configured() ? 'configured' : 'not-configured',
    redis: isRedisReady() ? 'connected' : 'memory-fallback',
  })
})

app.post('/api/auth/logout', (req, res) => {
  clearAuthCookies(res)
  return res.json({ ok: true })
})

app.post('/api/auth/request-otp', async (req, res) => {
  try {
    const email = String(req.body?.email || '').trim().toLowerCase()
    if (!emailPattern.test(email)) {
      return res.status(400).json({ message: 'Enter a valid email address.' })
    }
    if (!isAdminEmail(email, adminEmails)) {
      if (!mongoReady()) {
        return res.status(503).json({ message: 'Sign-in is temporarily unavailable. Try again shortly.' })
      }
      const invited = await Invitation.findOne({ email })
      const existing = await User.findOne({ email })
      if (!invited && !existing) {
        return res.status(403).json({
          message: 'This email has not been invited. Ask an admin to send an invitation.',
        })
      }
    }
    await issueOtp(email, 'login')
    console.log(`OTP sent to ${email}`)
    return res.json({ message: `OTP sent to ${email}` })
  } catch (error) {
    const status = error.status || 500
    const message = error instanceof Error ? error.message : 'Unable to send OTP'
    return res.status(status).json({ message })
  }
})

app.post('/api/auth/verify-otp', async (req, res) => {
  try {
    const email = String(req.body?.email || '').trim().toLowerCase()
    const otp = String(req.body?.otp || '').replace(/\D/g, '')
    if (!emailPattern.test(email) || otp.length !== 6) {
      return res.status(400).json({ message: 'Email and 6-digit OTP are required.' })
    }

    const result = await verifyStoredOtp(email, otp, otpPepper, 'login')
    if (!result.ok) return res.status(400).json({ message: result.message })

    const account = await loadAccount(email)
    if (account.twoFactorEnabled) {
      const pendingToken = jwt.sign({ email, pending2fa: true }, jwtSecret, { expiresIn: '10m' })
      setPending2faCookie(res, pendingToken)
      return res.json({
        requires2fa: true,
        message: 'Open your authenticator app and enter the 6-digit code.',
      })
    }

    const token = signSession(email)
    setSessionCookie(res, token)
    return res.json({ user: account })
  } catch (error) {
    const status = error.status || 500
    const message = error instanceof Error ? error.message : 'Unable to verify OTP'
    return res.status(status).json({ message })
  }
})

app.post('/api/auth/verify-2fa', async (req, res) => {
  try {
    const pendingToken = readPending2faToken(req)
    const otp = String(req.body?.otp || '').replace(/\D/g, '')
    const payload = jwt.verify(pendingToken, jwtSecret)
    if (!payload?.pending2fa || !payload.email) {
      return res.status(400).json({ message: '2FA session expired. Sign in again.' })
    }
    if (otp.length !== 6) {
      return res.status(400).json({ message: 'Enter the 6-digit authenticator code.' })
    }
    const user = await User.findOne({ email: payload.email })
    const secret = decryptSecret(user?.totpSecret || '')
    if (!secret || !verifyTotp(secret, otp)) {
      return res.status(400).json({ message: 'Invalid authenticator code. Try the newest 6-digit code.' })
    }
    const account = await loadAccount(payload.email)
    const token = signSession(payload.email)
    clearAuthCookies(res)
    setSessionCookie(res, token)
    return res.json({ user: account })
  } catch (error) {
    const status = error.status || 401
    const message = error instanceof Error ? error.message : 'Unable to verify 2FA'
    return res.status(status === 401 ? 401 : status).json({
      message: status === 401 ? '2FA session expired. Sign in again.' : message,
    })
  }
})

app.post('/api/auth/resend-2fa', async (req, res) => {
  try {
    const pendingToken = readPending2faToken(req)
    const payload = jwt.verify(pendingToken, jwtSecret)
    if (!payload?.pending2fa || !payload.email) {
      return res.status(400).json({ message: '2FA session expired. Sign in again.' })
    }
    return res.json({ message: 'Use the current 6-digit code from Google Authenticator, Authy, or 1Password.' })
  } catch (error) {
    const status = error.status || 401
    return res.status(status).json({
      message: error instanceof Error ? error.message : 'Unable to resend 2FA code',
    })
  }
})

app.get('/api/auth/me', authUser, async (req, res) => {
  try {
    const account = await loadAccount(req.user.email)
    res.json({ user: account })
  } catch (error) {
    res.status(500).json({ message: error instanceof Error ? error.message : 'Unable to load account' })
  }
})

app.get('/api/settings', authUser, requireDb, async (req, res) => {
  try {
    const account = await loadAccount(req.user.email)
    res.json({ user: account })
  } catch (error) {
    res.status(500).json({ message: error instanceof Error ? error.message : 'Unable to load settings' })
  }
})

app.put('/api/settings', authUser, requireDb, async (req, res) => {
  try {
    const email = req.user.email
    const user = await User.findOne({ email })
    if (!user) return res.status(404).json({ message: 'Account not found' })

    const body = req.body || {}
    if (typeof body.name === 'string') user.name = body.name.trim() || user.name
    if (typeof body.workspaceName === 'string') user.workspaceName = body.workspaceName.trim() || user.workspaceName
    if (typeof body.team === 'string') user.team = body.team.trim() || user.team
    if (typeof body.timezone === 'string') user.timezone = body.timezone.trim() || user.timezone
    if (typeof body.dateFormat === 'string') user.dateFormat = body.dateFormat.trim() || user.dateFormat
    if (body.theme === 'dark' || body.theme === 'light') user.theme = body.theme
    if (body.notificationPrefs && typeof body.notificationPrefs === 'object') {
      user.notificationPrefs = { ...plainPrefs(user.notificationPrefs), ...sanitizeNotifPrefs(body.notificationPrefs) }
      user.markModified('notificationPrefs')
    }
    if (body.preferences && typeof body.preferences === 'object') {
      user.preferences = { ...plainPrefs(user.preferences), ...sanitizePreferences(body.preferences) }
      user.markModified('preferences')
    }
    await user.save()

    if (body.notify !== false) {
      await addNotification(email, {
        title: 'Settings saved',
        message: 'Your workspace settings were stored in MongoDB.',
        type: 'success',
        category: 'inApp',
      })
    }

    const account = await loadAccount(email)
    return res.json({ user: account, message: 'Settings saved' })
  } catch (error) {
    return res.status(500).json({ message: error instanceof Error ? error.message : 'Unable to save settings' })
  }
})

app.post('/api/settings/avatar', authUser, requireDb, async (req, res) => {
  try {
    if (!isAdminEmail(req.user.email)) {
      return res.status(403).json({ message: 'Only an admin can update the profile photo.' })
    }
    const avatar = String(req.body?.avatar || '')
    if (!avatar.startsWith('data:image/')) {
      return res.status(400).json({ message: 'Upload a PNG or JPEG photo.' })
    }
    if (avatar.length > 350_000) {
      return res.status(400).json({ message: 'Photo is too large. Use a smaller image.' })
    }
    const user = await User.findOne({ email: req.user.email })
    if (!user) return res.status(404).json({ message: 'Account not found' })
    user.avatarUrl = avatar
    await user.save()
    const account = await loadAccount(req.user.email)
    return res.json({ user: account, message: 'Profile photo updated' })
  } catch (error) {
    return res.status(500).json({ message: error instanceof Error ? error.message : 'Unable to save photo' })
  }
})

app.post('/api/settings/2fa/request', authUser, requireDb, async (req, res) => {
  try {
    const enable = Boolean(req.body?.enable)
    const user = await User.findOne({ email: req.user.email })
    if (!user) return res.status(404).json({ message: 'Account not found' })
    if (!enable) {
      return res.json({
        message: 'Enter the current authenticator code to turn 2FA off.',
      })
    }
    const secret = generateTotpSecret()
    user.totpPendingSecret = encryptSecret(secret)
    await user.save()
    const uri = otpauthUrl(req.user.email, secret)
    const qrDataUrl = await QRCode.toDataURL(uri, { margin: 1, width: 220, errorCorrectionLevel: 'M' })
    return res.json({
      message: 'Scan this barcode in Google Authenticator, Authy, or 1Password, then enter the 6-digit code.',
      qrDataUrl,
      secret,
    })
  } catch (error) {
    const status = error.status || 500
    return res.status(status).json({ message: error instanceof Error ? error.message : 'Unable to start 2FA setup' })
  }
})

app.post('/api/settings/2fa/confirm', authUser, requireDb, async (req, res) => {
  try {
    const enable = Boolean(req.body?.enable)
    const otp = String(req.body?.otp || '').replace(/\D/g, '')
    if (otp.length !== 6) return res.status(400).json({ message: 'Enter the 6-digit authenticator code.' })
    const user = await User.findOne({ email: req.user.email })
    if (!user) return res.status(404).json({ message: 'Account not found' })
    if (enable) {
      const secret = decryptSecret(user.totpPendingSecret || '')
      if (!secret || !verifyTotp(secret, otp)) {
        return res.status(400).json({ message: 'That code did not match. Scan the barcode again and use the newest code.' })
      }
      user.totpSecret = encryptSecret(secret)
      user.totpPendingSecret = ''
      user.twoFactorEnabled = true
    } else {
      const secret = decryptSecret(user.totpSecret || '')
      if (!secret || !verifyTotp(secret, otp)) {
        return res.status(400).json({ message: 'Invalid authenticator code.' })
      }
      user.twoFactorEnabled = false
      user.totpSecret = ''
      user.totpPendingSecret = ''
    }
    await user.save()
    await addNotification(req.user.email, {
      title: enable ? 'Authenticator 2FA enabled' : 'Authenticator 2FA disabled',
      message: enable
        ? 'Sign-in now asks for an authenticator code after email OTP.'
        : 'Sign-in will only ask for the login OTP.',
      type: enable ? 'success' : 'warning',
      category: 'inApp',
    })
    const account = await loadAccount(req.user.email)
    return res.json({
      user: account,
      message: enable ? 'Authenticator 2FA is on.' : 'Authenticator 2FA is off.',
    })
  } catch (error) {
    return res.status(500).json({ message: error instanceof Error ? error.message : 'Unable to update 2FA' })
  }
})

app.patch('/api/notifications/:id/read', authUser, requireDb, async (req, res) => {
  const user = await User.findOne({ email: req.user.email })
  if (!user) return res.status(404).json({ message: 'Account not found' })
  const item = user.notifications.find((entry) => entry.id === req.params.id)
  if (item) item.read = true
  await user.save()
  return res.json({ user: publicUser(user, accessPayload(req.user.email)) })
})

app.post('/api/notifications/read-all', authUser, requireDb, async (req, res) => {
  const user = await User.findOne({ email: req.user.email })
  if (!user) return res.status(404).json({ message: 'Account not found' })
  user.notifications.forEach((item) => {
    item.read = true
  })
  await user.save()
  return res.json({ user: publicUser(user, accessPayload(req.user.email)) })
})

app.post('/api/notifications/test', authUser, requireDb, async (req, res) => {
  const user = await addNotification(req.user.email, {
    title: 'Test notification',
    message: 'In-app alerts are working. This was saved to MongoDB.',
    type: 'info',
    category: 'inApp',
  })
  if (!user) return res.status(404).json({ message: 'Account not found' })
  return res.json({ user: publicUser(user, accessPayload(req.user.email)), message: 'Test notification sent' })
})

function publicSecret(doc) {
  return {
    id: String(doc._id),
    name: doc.name,
    value: decryptSecret(doc.valueEncrypted),
    updatedAt: doc.updatedAt,
  }
}

app.get('/api/secrets', authUser, requireDb, requirePrivilege('secrets.view'), async (req, res) => {
  try {
    const items = await Secret.find({ ownerEmail: req.user.email }).sort({ createdAt: -1 })
    return res.json({ secrets: items.map(publicSecret) })
  } catch (error) {
    return res.status(500).json({ message: error instanceof Error ? error.message : 'Unable to load secrets' })
  }
})

app.post('/api/secrets', authUser, requireDb, requirePrivilege('secrets.manage'), async (req, res) => {
  try {
    const name = String(req.body?.name || '').trim()
    const value = String(req.body?.value || '')
    if (!name) return res.status(400).json({ message: 'Name is required.' })
    if (!value) return res.status(400).json({ message: 'Value is required.' })
    const doc = await Secret.create({
      ownerEmail: req.user.email,
      name,
      valueEncrypted: encryptSecret(value),
    })
    await addNotification(req.user.email, {
      title: 'Secret saved',
      message: `${name} was encrypted and stored.`,
      type: 'info',
      category: 'secrets',
    })
    return res.status(201).json({ secret: publicSecret(doc) })
  } catch (error) {
    return res.status(500).json({ message: error instanceof Error ? error.message : 'Unable to save secret' })
  }
})

app.patch('/api/secrets/:id', authUser, requireDb, requirePrivilege('secrets.manage'), async (req, res) => {
  try {
    const doc = await Secret.findOne({ _id: req.params.id, ownerEmail: req.user.email })
    if (!doc) return res.status(404).json({ message: 'Secret not found' })
    if (typeof req.body?.name === 'string' && req.body.name.trim()) doc.name = req.body.name.trim()
    if (typeof req.body?.value === 'string' && req.body.value) doc.valueEncrypted = encryptSecret(req.body.value)
    await doc.save()
    return res.json({ secret: publicSecret(doc) })
  } catch (error) {
    return res.status(500).json({ message: error instanceof Error ? error.message : 'Unable to update secret' })
  }
})

app.get('/api/network/ip', authUser, requirePrivilege('network.view'), async (req, res) => {
  try {
    const seen = clientIp(req)
    const [lookedUp, publicIpv6] = await Promise.all([fetchPublicIpv4(), fetchPublicIpv6()])
    const ipv4 = lookedUp || (isIpv4(seen) ? seen : '')
    const [reverse, meta] = await Promise.all([ipv4 ? reverseDns(ipv4) : Promise.resolve(''), lookupIpMeta(ipv4)])
    return res.json({
      clientIp: isIpv4(seen) ? seen : ipv4,
      publicIpv4: ipv4,
      publicIpv6,
      reverseDns: reverse,
      ...meta,
    })
  } catch (error) {
    return res.status(500).json({ message: error instanceof Error ? error.message : 'Unable to read client IP' })
  }
})

app.post('/api/network/reverse', authUser, requirePrivilege('network.view'), async (req, res) => {
  try {
    const ip = String(req.body?.ip || '').trim()
    const reverse = ip ? await reverseDns(ip) : ''
    return res.json({ reverseDns: reverse })
  } catch (error) {
    return res.status(500).json({ message: error instanceof Error ? error.message : 'Reverse DNS failed' })
  }
})

app.post('/api/network/ping', authUser, requirePrivilege('network.view'), async (req, res) => {
  try {
    const result = await pingHost(req.body?.host)
    return res.json(result)
  } catch (error) {
    return res.status(400).json({ message: error instanceof Error ? error.message : 'Ping failed' })
  }
})

app.post('/api/network/dns', authUser, requirePrivilege('network.view'), async (req, res) => {
  try {
    const result = await lookupDns(req.body?.host)
    return res.json(result)
  } catch (error) {
    return res.status(400).json({ message: error instanceof Error ? error.message : 'DNS lookup failed' })
  }
})

app.post('/api/network/ssl', authUser, requirePrivilege('network.view'), async (req, res) => {
  try {
    const result = await checkSsl(req.body?.host)
    return res.json(result)
  } catch (error) {
    return res.status(400).json({ message: error instanceof Error ? error.message : 'SSL check failed' })
  }
})

const memoryStudio = new Map()

function studioPayload(body = {}, ownerEmail = '') {
  return {
    ownerEmail,
    name: String(body.name || 'My request').trim() || 'My request',
    method: String(body.method || 'GET').toUpperCase(),
    url: String(body.url || '/api/auth/me'),
    headers: Array.isArray(body.headers) ? body.headers : [],
    queryParams: Array.isArray(body.queryParams) ? body.queryParams : [],
    body: String(body.body || ''),
    useSession: body.useSession !== false,
  }
}

function memoryStudioList(email) {
  return memoryStudio.get(email) || []
}

app.get('/api/studio/requests', authUser, requirePrivilege('postman.use'), async (req, res) => {
  try {
    if (mongoReady()) {
      const items = await StudioRequest.find({ ownerEmail: req.user.email }).sort({ updatedAt: -1 })
      return res.json({ requests: items.map(publicStudio) })
    }
    return res.json({ requests: memoryStudioList(req.user.email) })
  } catch (error) {
    return res.json({ requests: memoryStudioList(req.user.email) })
  }
})

app.post('/api/studio/requests', authUser, requirePrivilege('postman.use'), async (req, res) => {
  try {
    const payload = studioPayload(req.body, req.user.email)
    if (mongoReady()) {
      const doc = await StudioRequest.create(payload)
      return res.status(201).json({ request: publicStudio(doc) })
    }
    const request = { id: crypto.randomUUID(), ...payload, updatedAt: new Date().toISOString() }
    memoryStudio.set(req.user.email, [request, ...memoryStudioList(req.user.email)])
    return res.status(201).json({ request })
  } catch (error) {
    return res.status(500).json({ message: error instanceof Error ? error.message : 'Unable to save request' })
  }
})

app.patch('/api/studio/requests/:id', authUser, requirePrivilege('postman.use'), async (req, res) => {
  try {
    const body = req.body || {}
    if (mongoReady()) {
      const doc = await StudioRequest.findOne({ _id: req.params.id, ownerEmail: req.user.email })
      if (!doc) return res.status(404).json({ message: 'Request not found' })
      if (typeof body.name === 'string') doc.name = body.name.trim() || doc.name
      if (typeof body.method === 'string') doc.method = body.method.toUpperCase()
      if (typeof body.url === 'string') doc.url = body.url
      if (Array.isArray(body.headers)) doc.headers = body.headers
      if (Array.isArray(body.queryParams)) doc.queryParams = body.queryParams
      if (typeof body.body === 'string') doc.body = body.body
      if (typeof body.useSession === 'boolean') doc.useSession = body.useSession
      await doc.save()
      return res.json({ request: publicStudio(doc) })
    }
    const list = memoryStudioList(req.user.email)
    const index = list.findIndex((item) => item.id === req.params.id)
    if (index < 0) return res.status(404).json({ message: 'Request not found' })
    const next = { ...list[index], ...studioPayload({ ...list[index], ...body }, req.user.email), id: list[index].id, updatedAt: new Date().toISOString() }
    list[index] = next
    memoryStudio.set(req.user.email, list)
    return res.json({ request: next })
  } catch (error) {
    return res.status(500).json({ message: error instanceof Error ? error.message : 'Unable to update request' })
  }
})

app.delete('/api/studio/requests/:id', authUser, requirePrivilege('postman.use'), async (req, res) => {
  try {
    if (mongoReady()) {
      const doc = await StudioRequest.findOneAndDelete({ _id: req.params.id, ownerEmail: req.user.email })
      if (!doc) return res.status(404).json({ message: 'Request not found' })
      return res.json({ ok: true })
    }
    const list = memoryStudioList(req.user.email).filter((item) => item.id !== req.params.id)
    memoryStudio.set(req.user.email, list)
    return res.json({ ok: true })
  } catch (error) {
    return res.status(500).json({ message: error instanceof Error ? error.message : 'Unable to delete request' })
  }
})

app.post('/api/studio/send', authUser, requirePrivilege('postman.use'), async (req, res) => {
  try {
    const body = req.body || {}
    const host = String(req.headers.host || `127.0.0.1:${port}`)
    const proto = host.includes('localhost') || host.startsWith('127.') ? 'http' : req.protocol || 'http'
    const result = await sendStudioRequest({
      method: body.method,
      url: body.url,
      headers: body.headers || {},
      body: body.body,
      token: body.useSession === false ? '' : req.headers.authorization?.replace(/^Bearer\s+/i, ''),
      apiOrigin: `${proto}://${host}`,
    })
    return res.json(result)
  } catch (error) {
    return res.status(400).json({ message: error instanceof Error ? error.message : 'Request failed' })
  }
})

function publicShortcut(doc) {
  return {
    id: String(doc._id),
    name: doc.name,
    description: doc.description || '',
    category: doc.category || 'Work',
    url: doc.url,
    icon: doc.icon || 'bi-link-45deg',
  }
}

function normalizeUrl(value) {
  const url = String(value || '').trim()
  if (!url) return ''
  if (/^https?:\/\//i.test(url)) return url
  return `https://${url}`
}

app.get('/api/shortcuts', authUser, requireDb, async (req, res) => {
  try {
    const items = await Shortcut.find({ ownerEmail: req.user.email }).sort({ createdAt: -1 })
    return res.json({ shortcuts: items.map(publicShortcut) })
  } catch (error) {
    return res.status(500).json({ message: error instanceof Error ? error.message : 'Unable to load shortcuts' })
  }
})

app.post('/api/shortcuts', authUser, requireDb, requirePrivilege('shortcuts.manage'), async (req, res) => {
  try {
    const name = String(req.body?.name || '').trim()
    const url = normalizeUrl(req.body?.url)
    if (!name) return res.status(400).json({ message: 'Name is required.' })
    if (!url) return res.status(400).json({ message: 'URL is required.' })
    const doc = await Shortcut.create({
      ownerEmail: req.user.email,
      name,
      description: String(req.body?.description || '').trim(),
      category: String(req.body?.category || 'Work').trim() || 'Work',
      url,
      icon: String(req.body?.icon || 'bi-link-45deg').trim() || 'bi-link-45deg',
    })
    return res.status(201).json({ shortcut: publicShortcut(doc) })
  } catch (error) {
    return res.status(500).json({ message: error instanceof Error ? error.message : 'Unable to save shortcut' })
  }
})

app.patch('/api/shortcuts/:id', authUser, requireDb, requirePrivilege('shortcuts.manage'), async (req, res) => {
  try {
    const doc = await Shortcut.findOne({ _id: req.params.id, ownerEmail: req.user.email })
    if (!doc) return res.status(404).json({ message: 'Shortcut not found' })
    if (typeof req.body?.name === 'string' && req.body.name.trim()) doc.name = req.body.name.trim()
    if (typeof req.body?.description === 'string') doc.description = req.body.description.trim()
    if (typeof req.body?.category === 'string' && req.body.category.trim()) doc.category = req.body.category.trim()
    if (typeof req.body?.url === 'string') {
      const url = normalizeUrl(req.body.url)
      if (!url) return res.status(400).json({ message: 'URL is required.' })
      doc.url = url
    }
    if (typeof req.body?.icon === 'string' && req.body.icon.trim()) doc.icon = req.body.icon.trim()
    await doc.save()
    return res.json({ shortcut: publicShortcut(doc) })
  } catch (error) {
    return res.status(500).json({ message: error instanceof Error ? error.message : 'Unable to update shortcut' })
  }
})

app.delete('/api/shortcuts/:id', authUser, requireDb, requirePrivilege('shortcuts.manage'), async (req, res) => {
  try {
    const doc = await Shortcut.findOneAndDelete({ _id: req.params.id, ownerEmail: req.user.email })
    if (!doc) return res.status(404).json({ message: 'Shortcut not found' })
    return res.json({ ok: true })
  } catch (error) {
    return res.status(500).json({ message: error instanceof Error ? error.message : 'Unable to delete shortcut' })
  }
})

app.delete('/api/secrets/:id', authUser, requireDb, requirePrivilege('secrets.manage'), async (req, res) => {
  try {
    const doc = await Secret.findOneAndDelete({ _id: req.params.id, ownerEmail: req.user.email })
    if (!doc) return res.status(404).json({ message: 'Secret not found' })
    return res.json({ ok: true })
  } catch (error) {
    return res.status(500).json({ message: error instanceof Error ? error.message : 'Unable to delete secret' })
  }
})

app.get('/api/invitations', authUser, requireDb, requireAdmin, async (_req, res) => {
  try {
    const items = await Invitation.find().sort({ createdAt: -1 })
    return res.json({ invitations: items.map(publicInvitation) })
  } catch (error) {
    return res.status(500).json({ message: error instanceof Error ? error.message : 'Unable to load invitations' })
  }
})

app.post('/api/invitations', authUser, requireDb, requireAdmin, async (req, res) => {
  try {
    const email = String(req.body?.email || '').trim().toLowerCase()
    const role = parseRole(req.body?.role)
    if (!emailPattern.test(email)) return res.status(400).json({ message: 'Enter a valid email address.' })
    if (!role) return res.status(400).json({ message: 'Choose Viewer, Developer, DevOps, or Admin.' })
    if (isAdminEmail(email, adminEmails) && role !== 'Admin') {
      return res.status(400).json({ message: 'The workspace owner must stay an Admin.' })
    }

    let doc = await Invitation.findOne({ email })
    if (doc) {
      doc.role = role
      doc.invitedBy = req.user.email
      if (doc.status !== 'accepted') doc.status = 'pending'
      await doc.save()
    } else {
      doc = await Invitation.create({
        email,
        role,
        status: 'pending',
        invitedBy: req.user.email,
      })
    }

    const existing = await User.findOne({ email })
    if (existing && !isAdminEmail(email, adminEmails)) {
      const access = accessForEmail(email, adminEmails, role)
      existing.role = access.role
      existing.team = access.team
      existing.privileges = access.privileges
      await existing.save()
    }

    await sendInviteEmail(email, role, `${frontendUrl}/login`)
    return res.status(201).json({ invitation: publicInvitation(doc) })
  } catch (error) {
    return res.status(500).json({ message: error instanceof Error ? error.message : 'Unable to send invitation' })
  }
})

app.patch('/api/invitations/:id', authUser, requireDb, requireAdmin, async (req, res) => {
  try {
    const doc = await Invitation.findById(req.params.id)
    if (!doc) return res.status(404).json({ message: 'Invitation not found' })
    const role = parseRole(req.body?.role)
    if (!role) return res.status(400).json({ message: 'Choose Viewer, Developer, DevOps, or Admin.' })
    if (isAdminEmail(doc.email, adminEmails) && role !== 'Admin') {
      return res.status(400).json({ message: 'The workspace owner must stay an Admin.' })
    }
    doc.role = role
    await doc.save()
    const existing = await User.findOne({ email: doc.email })
    if (existing && !isAdminEmail(doc.email, adminEmails)) {
      const access = accessForEmail(doc.email, adminEmails, role)
      existing.role = access.role
      existing.team = access.team
      existing.privileges = access.privileges
      await existing.save()
    }
    return res.json({ invitation: publicInvitation(doc) })
  } catch (error) {
    return res.status(500).json({ message: error instanceof Error ? error.message : 'Unable to update invitation' })
  }
})

app.post('/api/invitations/:id/resend', authUser, requireDb, requireAdmin, async (req, res) => {
  try {
    const doc = await Invitation.findById(req.params.id)
    if (!doc) return res.status(404).json({ message: 'Invitation not found' })
    await sendInviteEmail(doc.email, doc.role, `${frontendUrl}/login`)
    return res.json({ invitation: publicInvitation(doc), message: `Invitation sent to ${doc.email}` })
  } catch (error) {
    return res.status(500).json({ message: error instanceof Error ? error.message : 'Unable to resend invitation' })
  }
})

app.delete('/api/invitations/:id', authUser, requireDb, requireAdmin, async (req, res) => {
  try {
    const doc = await Invitation.findById(req.params.id)
    if (!doc) return res.status(404).json({ message: 'Invitation not found' })
    if (isAdminEmail(doc.email, adminEmails)) {
      return res.status(400).json({ message: 'The workspace owner invitation cannot be revoked.' })
    }
    await Invitation.deleteOne({ _id: doc._id })
    const existing = await User.findOne({ email: doc.email })
    if (existing) {
      const access = accessForEmail(doc.email, adminEmails, 'Viewer')
      existing.role = access.role
      existing.team = access.team
      existing.privileges = access.privileges
      await existing.save()
    }
    return res.json({ ok: true })
  } catch (error) {
    return res.status(500).json({ message: error instanceof Error ? error.message : 'Unable to revoke invitation' })
  }
})

function publicGenerated(doc) {
  return {
    id: String(doc._id),
    kind: doc.kind,
    filename: doc.filename,
    language: doc.language,
    content: doc.content,
    notes: doc.notes || '',
    prompt: doc.prompt || '',
    createdAt: doc.createdAt,
  }
}

app.get('/api/generator/status', authUser, requirePrivilege('generator.use'), (_req, res) => {
  res.json({ configured: isOpenRouterConfigured(), kinds: GENERATOR_KINDS, model: resolveOpenRouterModel(), free: true })
})

app.get('/api/generator/history', authUser, requireDb, requirePrivilege('generator.use'), async (req, res) => {
  try {
    const items = await GeneratedFile.find({ ownerEmail: req.user.email }).sort({ createdAt: -1 }).limit(40)
    return res.json({ items: items.map(publicGenerated) })
  } catch (error) {
    return res.status(500).json({ message: error instanceof Error ? error.message : 'Unable to load history' })
  }
})

app.post('/api/generator', authUser, requireDb, requirePrivilege('generator.use'), async (req, res) => {
  try {
    const prompt = String(req.body?.prompt || '').trim()
    const kind = String(req.body?.kind || 'bash')
    if (!prompt) return res.status(400).json({ message: 'Describe what you want to generate.' })
    if (!GENERATOR_KINDS[kind]) return res.status(400).json({ message: 'Choose a valid generator type.' })
    const artifact = await generateDevArtifact(kind, prompt)
    const doc = await GeneratedFile.create({
      ownerEmail: req.user.email,
      kind: artifact.kind,
      filename: artifact.filename,
      language: artifact.language,
      content: artifact.content,
      notes: artifact.notes,
      prompt,
    })
    return res.json({ item: publicGenerated(doc) })
  } catch (error) {
    return res.status(error.status || 500).json({
      message: error instanceof Error ? error.message : 'Unable to generate file',
    })
  }
})

app.delete('/api/generator/history/:id', authUser, requireDb, requirePrivilege('generator.use'), async (req, res) => {
  try {
    const doc = await GeneratedFile.findOneAndDelete({ _id: req.params.id, ownerEmail: req.user.email })
    if (!doc) return res.status(404).json({ message: 'Generated file not found' })
    return res.json({ ok: true })
  } catch (error) {
    return res.status(500).json({ message: error instanceof Error ? error.message : 'Unable to delete history item' })
  }
})

app.get('/api/drive/status', authUser, requirePrivilege('drive.view'), (_req, res) => {
  res.json({ configured: isS3Configured() })
})

app.get('/api/drive/files', authUser, requirePrivilege('drive.view'), async (req, res) => {
  try {
    if (!isS3Configured()) return res.json({ configured: false, files: [] })
    const files = await listDriveFiles(req.user.email)
    return res.json({ configured: true, files })
  } catch (error) {
    return res.status(error.status || 500).json({
      message: error instanceof Error ? error.message : 'Unable to list drive files',
    })
  }
})

app.post('/api/drive/text', authUser, requirePrivilege('drive.manage'), async (req, res) => {
  try {
    const filename = String(req.body?.filename || '').trim()
    const content = String(req.body?.content || '')
    if (!filename) return res.status(400).json({ message: 'File name is required.' })
    const saved = await putDriveFile(req.user.email, filename, content, req.body?.contentType || 'text/plain')
    return res.status(201).json({ file: saved, configured: true })
  } catch (error) {
    return res.status(error.status || 500).json({
      message: error instanceof Error ? error.message : 'Unable to save file',
    })
  }
})

app.post('/api/drive/upload', authUser, requirePrivilege('drive.manage'), upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'Choose a file to upload.' })
    const name = String(req.body?.filename || req.file.originalname || 'upload.bin')
    const saved = await putDriveFile(req.user.email, name, req.file.buffer, req.file.mimetype)
    return res.status(201).json({ file: saved, configured: true })
  } catch (error) {
    return res.status(error.status || 500).json({
      message: error instanceof Error ? error.message : 'Unable to upload file',
    })
  }
})

app.get('/api/drive/file', authUser, requirePrivilege('drive.view'), async (req, res) => {
  try {
    const key = String(req.query?.key || '')
    const file = await getDriveFile(req.user.email, key)
    res.setHeader('Content-Type', file.contentType)
    res.setHeader('Content-Disposition', `attachment; filename="${file.name}"`)
    if (file.body?.pipe) {
      file.body.pipe(res)
      return
    }
    const chunks = []
    for await (const chunk of file.body) chunks.push(chunk)
    return res.send(Buffer.concat(chunks))
  } catch (error) {
    return res.status(error.status || 500).json({
      message: error instanceof Error ? error.message : 'Unable to download file',
    })
  }
})

app.delete('/api/drive/file', authUser, requirePrivilege('drive.manage'), async (req, res) => {
  try {
    const key = String(req.query?.key || req.body?.key || '')
    await deleteDriveFile(req.user.email, key)
    return res.json({ ok: true })
  } catch (error) {
    return res.status(error.status || 500).json({
      message: error instanceof Error ? error.message : 'Unable to delete file',
    })
  }
})

function stripHtml(value) {
  return String(value || '')
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, '')
}

function previewFromHtml(html) {
  return stripHtml(html)
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 90)
}

function publicDoc(doc) {
  return {
    id: String(doc._id),
    title: doc.title || 'Untitled',
    html: doc.html || '',
    preview: doc.preview || '',
    font: doc.font || 'IBM Plex Sans',
    size: doc.size || '14',
    kind: doc.kind === 'folder' ? 'folder' : 'file',
    parentId: doc.parentId || null,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  }
}

app.get('/api/docs', authUser, requireDb, async (req, res) => {
  try {
    const items = await DocNote.find({ ownerEmail: req.user.email }).sort({ updatedAt: -1 })
    return res.json({ docs: items.map(publicDoc) })
  } catch (error) {
    return res.status(500).json({ message: error instanceof Error ? error.message : 'Unable to load documents' })
  }
})

app.post('/api/docs', authUser, requireDb, requirePrivilege('docs.manage'), async (req, res) => {
  try {
    const title = String(req.body?.title || 'Untitled').trim() || 'Untitled'
    const html = stripHtml(req.body?.html).slice(0, 200000)
    const kind = req.body?.kind === 'folder' ? 'folder' : 'file'
    const parentId = String(req.body?.parentId || '').trim() || null
    if (parentId) {
      const parent = await DocNote.findOne({ _id: parentId, ownerEmail: req.user.email, kind: 'folder' })
      if (!parent) return res.status(400).json({ message: 'Folder not found.' })
    }
    const doc = await DocNote.create({
      ownerEmail: req.user.email,
      title: kind === 'folder' ? title : title,
      html: kind === 'folder' ? '' : html,
      preview: kind === 'folder' ? 'Folder' : previewFromHtml(html),
      font: String(req.body?.font || 'IBM Plex Sans'),
      size: String(req.body?.size || '14'),
      kind,
      parentId,
    })
    return res.status(201).json({ doc: publicDoc(doc) })
  } catch (error) {
    return res.status(500).json({ message: error instanceof Error ? error.message : 'Unable to create document' })
  }
})

app.patch('/api/docs/:id', authUser, requireDb, requirePrivilege('docs.manage'), async (req, res) => {
  try {
    const doc = await DocNote.findOne({ _id: req.params.id, ownerEmail: req.user.email })
    if (!doc) return res.status(404).json({ message: 'Document not found' })
    if (typeof req.body?.title === 'string') doc.title = req.body.title.trim() || 'Untitled'
    if (typeof req.body?.html === 'string') {
      doc.html = stripHtml(req.body.html).slice(0, 200000)
      doc.preview = previewFromHtml(doc.html)
    }
    if (typeof req.body?.font === 'string' && req.body.font.trim()) doc.font = req.body.font.trim()
    if (typeof req.body?.size === 'string' && req.body.size.trim()) doc.size = req.body.size.trim()
    if (typeof req.body?.parentId === 'string' || req.body?.parentId === null) {
      const parentId = req.body.parentId ? String(req.body.parentId).trim() : null
      if (parentId) {
        const parent = await DocNote.findOne({ _id: parentId, ownerEmail: req.user.email, kind: 'folder' })
        if (!parent) return res.status(400).json({ message: 'Folder not found.' })
        if (parentId === String(doc._id)) return res.status(400).json({ message: 'A folder cannot contain itself.' })
      }
      doc.parentId = parentId
    }
    await doc.save()
    return res.json({ doc: publicDoc(doc) })
  } catch (error) {
    return res.status(500).json({ message: error instanceof Error ? error.message : 'Unable to save document' })
  }
})

app.delete('/api/docs/:id', authUser, requireDb, requirePrivilege('docs.manage'), async (req, res) => {
  try {
    const doc = await DocNote.findOne({ _id: req.params.id, ownerEmail: req.user.email })
    if (!doc) return res.status(404).json({ message: 'Document not found' })
    const removeTree = async (id) => {
      const children = await DocNote.find({ ownerEmail: req.user.email, parentId: id })
      for (const child of children) {
        await removeTree(String(child._id))
      }
      await DocNote.deleteOne({ _id: id, ownerEmail: req.user.email })
    }
    await removeTree(String(doc._id))
    return res.json({ ok: true })
  } catch (error) {
    return res.status(500).json({ message: error instanceof Error ? error.message : 'Unable to delete document' })
  }
})

function defaultWorkbookSheets() {
  const pad = (headers, extra = 40) => {
    const cols = headers.length + 4
    const header = [...headers, ...Array.from({ length: cols - headers.length }, () => '')]
    const blanks = Array.from({ length: extra }, () => Array.from({ length: cols }, () => ''))
    return [header, ...blanks]
  }
  return [
    {
      id: 'inventory',
      name: 'Inventory',
      rows: pad([
        'Project',
        'Owner',
        'Repo',
        'Branch',
        'Stack',
        'Cloud',
        'Region',
        'Cluster',
        'Namespace',
        'Domain',
        'Env',
        'Status',
        'Last deploy',
        'Notes',
      ]),
    },
    {
      id: 'servers',
      name: 'Servers',
      rows: pad(['Hostname', 'IP', 'OS', 'Role', 'Project', 'Env', 'Access', 'CPU/RAM', 'Status', 'Notes']),
    },
    {
      id: 'domains',
      name: 'Domains',
      rows: pad(['Domain', 'Project', 'Env', 'TLS expiry', 'DNS', 'CDN', 'Status', 'Notes']),
    },
    {
      id: 'releases',
      name: 'Releases',
      rows: pad(['Project', 'Version', 'Env', 'Deployed at', 'Git SHA', 'Pipeline', 'Result', 'Notes']),
    },
  ]
}

function sanitizeStyle(style) {
  if (!style || typeof style !== 'object') return null
  const next = {}
  if (style.bold === true) next.bold = true
  if (style.italic === true) next.italic = true
  if (style.underline === true) next.underline = true
  if (typeof style.font === 'string' && style.font.trim()) next.font = style.font.trim().slice(0, 80)
  const size = Number(style.size)
  if (Number.isFinite(size) && size >= 8 && size <= 72) next.size = Math.round(size)
  if (typeof style.color === 'string' && /^#([0-9a-fA-F]{6})$/.test(style.color)) next.color = style.color
  if (typeof style.bg === 'string' && /^#([0-9a-fA-F]{6})$/.test(style.bg)) next.bg = style.bg
  if (style.align === 'left' || style.align === 'center' || style.align === 'right') next.align = style.align
  return Object.keys(next).length ? next : null
}

function sanitizeStyles(input, rowCount, colCount) {
  if (!input || typeof input !== 'object') return {}
  const next = {}
  for (const [key, value] of Object.entries(input).slice(0, 8000)) {
    const match = /^(\d+):(\d+)$/.exec(key)
    if (!match) continue
    const r = Number(match[1])
    const c = Number(match[2])
    if (r < 0 || c < 0 || r >= rowCount || c >= colCount) continue
    const style = sanitizeStyle(value)
    if (style) next[`${r}:${c}`] = style
  }
  return next
}

function sanitizeWorkbook(input) {
  const source = Array.isArray(input?.sheets) ? input.sheets.slice(0, 12) : []
  const sheets = source
    .map((sheet, index) => {
      const rows = Array.isArray(sheet?.rows) ? sheet.rows.slice(0, 200) : []
      const cleaned = rows.map((row) =>
        (Array.isArray(row) ? row : []).slice(0, 40).map((cell) => String(cell ?? '').slice(0, 2000)),
      )
      const width = Math.max(8, ...cleaned.map((row) => row.length), 8)
      const normalized = cleaned.map((row) => {
        const next = row.slice()
        while (next.length < width) next.push('')
        return next
      })
      return {
        id: String(sheet?.id || `sheet-${index + 1}`).slice(0, 48),
        name: String(sheet?.name || `Sheet${index + 1}`).trim().slice(0, 40) || `Sheet${index + 1}`,
        rows: normalized,
        styles: sanitizeStyles(sheet?.styles, normalized.length, width),
      }
    })
    .filter((sheet) => sheet.rows.length)
  const list = sheets.length ? sheets : defaultWorkbookSheets()
  const activeId = list.some((sheet) => sheet.id === input?.activeId) ? String(input.activeId) : list[0].id
  return { sheets: list, activeId }
}

function publicWorkbook(doc) {
  const clean = sanitizeWorkbook(doc)
  return { ...clean, updatedAt: doc?.updatedAt }
}

function canViewProjects(account) {
  return Boolean(account?.privileges?.includes('projects.view'))
}

function canEditProjects(account) {
  return canViewProjects(account) && account.role !== 'Viewer'
}

app.get('/api/workbook', authUser, requireDb, async (req, res) => {
  try {
    const account = await loadAccount(req.user.email)
    if (!canViewProjects(account)) {
      return res.status(403).json({ message: 'Project access required.' })
    }
    let doc = await Workbook.findOne({ key: 'workspace' })
    if (!doc) {
      const seeded = sanitizeWorkbook({ sheets: defaultWorkbookSheets(), activeId: 'inventory' })
      doc = await Workbook.create({ key: 'workspace', ...seeded })
    }
    return res.json({ workbook: publicWorkbook(doc) })
  } catch (error) {
    return res.status(500).json({ message: error instanceof Error ? error.message : 'Unable to load workbook' })
  }
})

app.put('/api/workbook', authUser, requireDb, requirePrivilege('projects.manage', 'projects.view'), async (req, res) => {
  try {
    const account = await loadAccount(req.user.email)
    if (!canEditProjects(account)) {
      return res.status(403).json({ message: 'Editing the project register requires a Developer, DevOps, or Admin role.' })
    }
    const next = sanitizeWorkbook(req.body)
    const doc = await Workbook.findOneAndUpdate(
      { key: 'workspace' },
      { $set: next },
      { returnDocument: 'after', upsert: true, setDefaultsOnInsert: true },
    )
    return res.json({ workbook: publicWorkbook(doc) })
  } catch (error) {
    return res.status(500).json({ message: error instanceof Error ? error.message : 'Unable to save workbook' })
  }
})

function sanitizeArchitecture(input = {}) {
  const nodes = Array.isArray(input.nodes) ? input.nodes.slice(0, 200) : []
  const edges = Array.isArray(input.edges) ? input.edges.slice(0, 400) : []
  const strokes = Array.isArray(input.strokes) ? input.strokes.slice(0, 120) : []
  const notes = Array.isArray(input.notes) ? input.notes.slice(0, 80) : []
  return {
    title: String(input.title || 'System architecture').slice(0, 120),
    nodes: nodes.map((node) => ({
      id: String(node.id || crypto.randomUUID()),
      kind: String(node.kind || 'svc').slice(0, 24),
      label: String(node.label || 'Service').slice(0, 80),
      x: Number(node.x) || 40,
      y: Number(node.y) || 40,
      w: Math.min(Math.max(Number(node.w) || 140, 40), 720),
      h: Math.min(Math.max(Number(node.h) || 40, 40), 480),
      color: String(node.color || '#6366f1').slice(0, 20),
    })),
    edges: edges.map((edge) => ({
      id: String(edge.id || crypto.randomUUID()),
      from: String(edge.from || ''),
      to: String(edge.to || ''),
      label: String(edge.label || '').slice(0, 60),
    })),
    strokes: strokes.map((stroke) => ({
      id: String(stroke.id || crypto.randomUUID()),
      color: String(stroke.color || '#6366f1').slice(0, 20),
      points: Array.isArray(stroke.points)
        ? stroke.points.slice(0, 800).map((point) => ({ x: Number(point.x) || 0, y: Number(point.y) || 0 }))
        : [],
    })),
    notes: notes.map((note) => ({
      id: String(note.id || crypto.randomUUID()),
      text: String(note.text || 'Note').slice(0, 160),
      x: Number(note.x) || 40,
      y: Number(note.y) || 40,
    })),
  }
}

function publicArchitecture(doc) {
  return { ...sanitizeArchitecture(doc), updatedAt: doc?.updatedAt }
}

let memoryArchitecture = sanitizeArchitecture({})

app.get('/api/architecture', authUser, async (req, res) => {
  try {
    if (mongoReady()) {
      let doc = await Architecture.findOne({ key: 'workspace' })
      if (!doc) doc = await Architecture.create({ key: 'workspace', ...memoryArchitecture })
      memoryArchitecture = sanitizeArchitecture(doc)
      return res.json({ board: publicArchitecture(doc) })
    }
    return res.json({ board: { ...memoryArchitecture, updatedAt: new Date().toISOString() } })
  } catch (error) {
    return res.json({ board: { ...memoryArchitecture, updatedAt: new Date().toISOString() } })
  }
})

app.put('/api/architecture', authUser, async (req, res) => {
  try {
    const account = req.account || (await loadAccount(req.user.email))
    if (account.role === 'Viewer') {
      return res.status(403).json({ message: 'Viewers can look at the board but cannot save changes.' })
    }
    const next = sanitizeArchitecture(req.body)
    memoryArchitecture = next
    if (mongoReady()) {
      const doc = await Architecture.findOneAndUpdate(
        { key: 'workspace' },
        { $set: next },
        { returnDocument: 'after', upsert: true, setDefaultsOnInsert: true },
      )
      return res.json({ board: publicArchitecture(doc) })
    }
    return res.json({ board: { ...next, updatedAt: new Date().toISOString() } })
  } catch (error) {
    return res.json({ board: { ...memoryArchitecture, updatedAt: new Date().toISOString() } })
  }
})

function plainPrefs(value) {
  if (!value) return {}
  if (typeof value.toObject === 'function') return value.toObject()
  return { ...value }
}

function sanitizeNotifPrefs(input) {
  const keys = ['inApp', 'email', 'deployments', 'secrets', 'infrastructure']
  const next = {}
  for (const key of keys) {
    if (typeof input[key] === 'boolean') next[key] = input[key]
  }
  return next
}

function sanitizePreferences(input) {
  const next = {}
  if (typeof input.compactSidebar === 'boolean') next.compactSidebar = input.compactSidebar
  if (typeof input.rememberSidebar === 'boolean') next.rememberSidebar = input.rememberSidebar
  if (typeof input.compactTables === 'boolean') next.compactTables = input.compactTables
  if (typeof input.showClock === 'boolean') next.showClock = input.showClock
  if (Number.isFinite(Number(input.sessionTimeoutMin))) next.sessionTimeoutMin = Number(input.sessionTimeoutMin)
  if (Number.isFinite(Number(input.itemsPerPage))) next.itemsPerPage = Number(input.itemsPerPage)
  return next
}

app.get('/api/terminal/status', authUser, async (req, res) => {
  const account = await loadAccount(req.user.email)
  if (!account.privileges?.includes('ssh.connect')) {
    return res.status(403).json({ message: 'Terminal access required.' })
  }
  try {
    return res.json(await dockerTerminalStatus())
  } catch (error) {
    return res.status(500).json({
      ready: false,
      running: false,
      image: process.env.DOCKER_TERMINAL_IMAGE || 'esp-devops-linux:24.04',
      compose: 'docker-compose.yml',
      message: error instanceof Error ? error.message : 'Unable to check Docker',
    })
  }
})

app.post('/api/terminal/up', authUser, async (req, res) => {
  const account = await loadAccount(req.user.email)
  if (!account.privileges?.includes('ssh.connect')) {
    return res.status(403).json({ message: 'Terminal access required.' })
  }
  try {
    const status = await startDockerTerminal()
    return res.status(status.running ? 200 : 503).json(status)
  } catch (error) {
    return res.status(500).json({
      ready: false,
      running: false,
      compose: 'docker-compose.yml',
      message: error instanceof Error ? error.message : 'Unable to start docker compose',
    })
  }
})

app.use((error, req, res, next) => {
  console.error('API error:', error instanceof Error ? error.message : error)
  if (res.headersSent) return next(error)
  return res.status(500).json({ message: 'Something went wrong. Try again in a moment.' })
})

export { app, jwtSecret, loadAccount }

export function attachApi() {
  return attachDockerTerminal(null, {
    jwtSecret,
    resolveAccess: async (email) => loadAccount(email),
  })
}

export async function bootServices() {
  assertRuntimeSecrets()
  try {
    await connectDb()
  } catch (error) {
    console.error('MongoDB connection failed:', error instanceof Error ? error.message : error)
  }
  await connectRedis()
}

if (process.env.NEXT_EMBED !== '1') {
  const httpServer = http.createServer(app)
  const terminal = attachApi()
  httpServer.on('upgrade', (request, socket, head) => {
    terminal.handleUpgrade(request, socket, head)
  })
  httpServer.listen(port, async () => {
    console.log(`ESP DevOps API running on http://localhost:${port}`)
    await bootServices()
  })
}
