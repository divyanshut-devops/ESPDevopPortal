import { authFetch } from './http'
import type { AccountUser, AppPreferences, NotificationPrefs, ThemeMode } from '../types'

export interface SettingsPayload {
  name?: string
  workspaceName?: string
  team?: string
  timezone?: string
  dateFormat?: string
  theme?: ThemeMode
  notificationPrefs?: NotificationPrefs
  preferences?: Partial<AppPreferences>
  notify?: boolean
}

export async function fetchSettings() {
  return authFetch<{ user: AccountUser }>('/api/settings')
}

export async function saveSettings(payload: SettingsPayload) {
  return authFetch<{ user: AccountUser; message: string }>('/api/settings', {
    method: 'PUT',
    body: JSON.stringify(payload),
  })
}

export async function saveAvatar(avatar: string) {
  return authFetch<{ user: AccountUser; message: string }>('/api/settings/avatar', {
    method: 'POST',
    body: JSON.stringify({ avatar }),
  })
}

export async function requestTwoFactor(enable: boolean) {
  return authFetch<{ message: string; qrDataUrl?: string; secret?: string }>('/api/settings/2fa/request', {
    method: 'POST',
    body: JSON.stringify({ enable }),
  })
}

export async function confirmTwoFactor(enable: boolean, otp: string) {
  return authFetch<{ user: AccountUser; message: string }>('/api/settings/2fa/confirm', {
    method: 'POST',
    body: JSON.stringify({ enable, otp }),
  })
}

export async function markNotificationRead(id: string) {
  return authFetch<{ user: AccountUser }>(`/api/notifications/${id}/read`, {
    method: 'PATCH',
  })
}

export async function markAllNotificationsRead() {
  return authFetch<{ user: AccountUser }>('/api/notifications/read-all', {
    method: 'POST',
  })
}

export async function sendTestNotification() {
  return authFetch<{ user: AccountUser; message: string }>('/api/notifications/test', {
    method: 'POST',
  })
}
