'use client'

import { useEffect } from 'react'
import { AppProvider } from '../context/AppContext'
import { ToastStack } from '../components/ToastStack'

function registerServiceWorker() {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return
  void navigator.serviceWorker.register('/sw.js').catch(() => undefined)
}

export function Providers({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    registerServiceWorker()
  }, [])
  return (
    <AppProvider>
      {children}
      <ToastStack />
    </AppProvider>
  )
}
