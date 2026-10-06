import dns from 'node:dns'
import mongoose from 'mongoose'

dns.setServers(['8.8.8.8', '1.1.1.1'])
dns.setDefaultResultOrder('ipv4first')

function resolvedMongoUri() {
  const uri = process.env.MONGODB_URI || ''
  const user = process.env.MONGODB_USER || ''
  const pass = process.env.MONGODB_PASSWORD || ''
  return uri
    .replace('<db_username>', encodeURIComponent(user))
    .replace('<db_password>', encodeURIComponent(pass))
}

export function isMongoConfigured() {
  const raw = process.env.MONGODB_URI || ''
  const user = process.env.MONGODB_USER || ''
  const pass = process.env.MONGODB_PASSWORD || ''
  if (raw.includes('<db_username>') || raw.includes('<db_password>')) {
    return Boolean(user && pass && !user.includes('<') && !pass.includes('<'))
  }
  return Boolean(raw)
}

const connectOptions = {
  serverSelectionTimeoutMS: 8000,
  connectTimeoutMS: 8000,
  socketTimeoutMS: 45000,
  family: 4,
  maxPoolSize: 8,
}

let retryTimer = null

async function attemptConnect() {
  const uri = resolvedMongoUri()
  await mongoose.connect(uri, connectOptions)
  console.log('MongoDB connected')
  return true
}

function scheduleRetry() {
  if (retryTimer || mongoose.connection.readyState === 1) return
  retryTimer = setTimeout(() => {
    retryTimer = null
    connectDb().catch(() => undefined)
  }, 8000)
}

export async function connectDb() {
  if (!isMongoConfigured()) {
    console.warn('MongoDB is not configured yet. Update MONGODB_URI in .env')
    return false
  }
  if (mongoose.connection.readyState === 1) return true
  mongoose.set('bufferCommands', false)
  try {
    return await attemptConnect()
  } catch (error) {
    const message = error instanceof Error ? error.message : 'connection failed'
    console.warn(`MongoDB not reachable yet: ${message}`)
    scheduleRetry()
    return false
  }
}

mongoose.connection.on('disconnected', () => {
  if (mongoose.connection.readyState === 1) return
  console.warn('MongoDB disconnected, retrying…')
  scheduleRetry()
})
