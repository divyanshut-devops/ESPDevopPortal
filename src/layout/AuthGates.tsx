'use client'

import { usePathname, useRouter } from 'next/navigation'
import { useEffect } from 'react'
import { useApp } from '../context/AppContext'

export function ProtectedGate({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, ready } = useApp()
  const router = useRouter()

  useEffect(() => {
    if (ready && !isAuthenticated) router.replace('/login')
  }, [isAuthenticated, ready, router])

  if (!ready || !isAuthenticated) return <div className="app-boot">Loading ESP DevOps…</div>
  return <>{children}</>
}

export function GuestGate({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, ready } = useApp()
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    if (ready && isAuthenticated && pathname === '/login') router.replace('/dashboard')
  }, [isAuthenticated, pathname, ready, router])

  if (!ready) return <div className="app-boot">Loading ESP DevOps…</div>
  if (isAuthenticated) return <div className="app-boot">Opening workspace…</div>
  return <>{children}</>
}
