import mongoose from 'mongoose'

const notificationSchema = new mongoose.Schema(
  {
    id: { type: String, required: true },
    title: { type: String, required: true },
    message: { type: String, required: true },
    time: { type: String, required: true },
    read: { type: Boolean, default: false },
    type: { type: String, default: 'info' },
    category: { type: String, default: 'inApp' },
  },
  { _id: false },
)

const userSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true },
    name: { type: String, default: '' },
    workspaceName: { type: String, default: 'ESP DevOps' },
    role: { type: String, default: 'DevOps Member' },
    team: { type: String, default: 'Platform Engineering' },
    timezone: { type: String, default: 'Asia/Kolkata' },
    dateFormat: { type: String, default: 'YYYY-MM-DD' },
    avatarUrl: { type: String, default: '' },
    theme: { type: String, default: 'dark' },
    twoFactorEnabled: { type: Boolean, default: false },
    totpSecret: { type: String, default: '' },
    totpPendingSecret: { type: String, default: '' },
    privileges: { type: [String], default: [] },
    notificationPrefs: {
      inApp: { type: Boolean, default: true },
      email: { type: Boolean, default: true },
      deployments: { type: Boolean, default: true },
      secrets: { type: Boolean, default: true },
      infrastructure: { type: Boolean, default: true },
    },
    preferences: {
      compactSidebar: { type: Boolean, default: false },
      rememberSidebar: { type: Boolean, default: true },
      sessionTimeoutMin: { type: Number, default: 30 },
      itemsPerPage: { type: Number, default: 8 },
      compactTables: { type: Boolean, default: false },
      showClock: { type: Boolean, default: true },
    },
    notifications: { type: [notificationSchema], default: [] },
  },
  { timestamps: true },
)

export const User = mongoose.models.User || mongoose.model('User', userSchema)
