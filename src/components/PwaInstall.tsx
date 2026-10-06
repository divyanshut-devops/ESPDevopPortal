'use client'

import { useEffect, useState } from 'react'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export function PwaInstall({ compact = false }: { compact?: boolean }) {
  const [promptEvent, setPromptEvent] = useState<BeforeInstallPromptEvent | null>(null)
  const [installed, setInstalled] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return
    const standalone = window.matchMedia('(display-mode: standalone)').matches || (window.navigator as Navigator & { standalone?: boolean }).standalone
    if (standalone) setInstalled(true)
    const onPrompt = (event: Event) => {
      event.preventDefault()
      setPromptEvent(event as BeforeInstallPromptEvent)
    }
    const onInstalled = () => {
      setInstalled(true)
      setPromptEvent(null)
    }
    window.addEventListener('beforeinstallprompt', onPrompt)
    window.addEventListener('appinstalled', onInstalled)
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [])

  if (installed) return compact ? null : <p className="text-secondary mb-0">This portal is installed on your desktop.</p>

  const install = async () => {
    if (promptEvent) {
      await promptEvent.prompt()
      const choice = await promptEvent.userChoice
      if (choice.outcome === 'accepted') setInstalled(true)
      return
    }
    window.alert('Use your browser menu: Install app / Add to desktop. Chrome, Edge, and Safari all support it.')
  }

  if (compact) {
    return (
      <button type="button" className="icon-btn-ghost" title="Install desktop shortcut" aria-label="Install desktop shortcut" onClick={() => void install()}>
        <i className="bi bi-box-arrow-down" />
      </button>
    )
  }

  return (
    <button type="button" className="btn btn-outline-info" onClick={() => void install()}>
      Install desktop shortcut
    </button>
  )
}
