import crypto from 'node:crypto'
import { User } from './models/User.js'

function seedNotifications() {
  return [
    {
      id: crypto.randomUUID(),
      title: 'Welcome to ESP DevOps',
      message: 'Your account is ready. Notification alerts are turned on.',
      time: 'Just now',
      read: false,
      type: 'success',
      category: 'inApp',
    },
    {
      id: crypto.randomUUID(),
      title: 'Deploy completed',
      message: 'Auth Service rolled out to production.',
      time: '3 hr ago',
      read: false,
      type: 'success',
      category: 'deployments',
    },
    {
      id: crypto.randomUUID(),
      title: 'Secret change recorded',
      message: 'A production secret was updated from Settings.',
      time: 'Yesterday',
      read: true,
      type: 'info',
      category: 'secrets',
    },
    {
      id: crypto.randomUUID(),
      title: 'Infrastructure warning',
      message: 'staging.esp.io certificate expires in 12 days.',
      time: '1 hr ago',
      read: false,
      type: 'warning',
      category: 'infrastructure',
    },
  ]
}

function plain(value) {
  if (!value) return value
  if (typeof value.toObject === 'function') return value.toObject()
  return value
}

export function publicUser(doc, access) {
  const preferences = {
    compactSidebar: false,
    rememberSidebar: true,
    sessionTimeoutMin: 30,
    itemsPerPage: 8,
    compactTables: false,
    showClock: true,
    ...plain(doc.preferences),
    twoFactorEnabled: Boolean(doc.twoFactorEnabled),
  }
  return {
    email: doc.email,
    name: doc.name,
    avatarUrl: doc.avatarUrl || '',
    workspaceName: doc.workspaceName,
    role: access?.role || doc.role,
    team: access?.team || doc.team,
    timezone: doc.timezone,
    dateFormat: doc.dateFormat,
    privileges: access?.privileges || doc.privileges || [],
    theme: doc.theme === 'light' ? 'light' : 'dark',
    twoFactorEnabled: Boolean(doc.twoFactorEnabled),
    notificationPrefs: {
      inApp: true,
      email: true,
      deployments: true,
      secrets: true,
      infrastructure: true,
      ...plain(doc.notificationPrefs),
    },
    preferences,
    notifications: (doc.notifications || []).map((item) => plain(item)),
  }
}

export async function ensureUser(email, access) {
  let user = await User.findOne({ email })
  if (!user) {
    user = await User.create({
      email,
      name: access.name,
      role: access.role,
      team: access.team,
      privileges: access.privileges,
      notifications: seedNotifications(),
    })
  } else {
    user.role = access.role
    user.team = access.team
    user.privileges = access.privileges
    if (!user.name) user.name = access.name
    await user.save()
  }
  return user
}

export async function addNotification(email, item) {
  const user = await User.findOne({ email })
  if (!user) return null
  user.notifications.unshift({
    id: crypto.randomUUID(),
    time: 'Just now',
    read: false,
    type: 'info',
    category: 'inApp',
    ...item,
  })
  user.notifications = user.notifications.slice(0, 40)
  await user.save()
  return user
}
