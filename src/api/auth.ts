import { apiFetch, authFetch } from './http'
import type { AccountUser } from '../types'

export async function requestOtp(email: string) {
  return apiFetch<{ message: string }>('/api/auth/request-otp', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  })
}

export async function verifyOtp(email: string, otp: string) {
  return apiFetch<{
    user?: AccountUser
    requires2fa?: boolean
    message?: string
  }>('/api/auth/verify-otp', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, otp }),
  })
}

export async function verifyLogin2fa(otp: string) {
  return apiFetch<{ user: AccountUser }>('/api/auth/verify-2fa', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ otp }),
  })
}

export async function resendLogin2fa() {
  return apiFetch<{ message: string }>('/api/auth/resend-2fa', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  })
}

export async function logoutSession() {
  return apiFetch<{ ok: boolean }>('/api/auth/logout', { method: 'POST' }).catch(() => ({ ok: true }))
}

export async function fetchMe() {
  return authFetch<{ user: AccountUser }>('/api/auth/me')
}
