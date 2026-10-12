'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { PasswordGenerator } from '../components/PasswordGenerator'
import { UserAvatar } from '../components/UserAvatar'
import { useApp } from '../context/AppContext'
import { getNavItem } from '../navigation'
import type { SearchResult } from '../types'

function formatHeaderStamp(now: Date, timezone: string) {
  const tz = timezone || 'UTC'
  try {
    const parts = new Intl.DateTimeFormat('en-GB', {
      weekday: 'short',
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
      timeZone: tz,
    }).formatToParts(now)
    const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value || ''
    return {
      weekday: get('weekday'),
      date: `${get('day')} ${get('month')} ${get('year')}`,
      time: `${get('hour')}:${get('minute')}:${get('second')}`,
      tz,
    }
  } catch {
    return {
      weekday: now.toLocaleDateString([], { weekday: 'short' }),
      date: now.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
      time: now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }),
      tz,
    }
  }
}

export function Header() {
  const pathname = usePathname()
  const router = useRouter()
  const {
    toggleSidebar,
    profile,
    visibleNotifications,
    markAllRead,
    markOneRead,
    projects,
    shortcuts,
    setTheme,
    theme,
    logout,
    pushToast,
    preferences,
  } = useApp()
  const current = getNavItem(pathname)
  const [query, setQuery] = useState('')
  const [showSearch, setShowSearch] = useState(false)
  const [showNotifs, setShowNotifs] = useState(false)
  const [showUser, setShowUser] = useState(false)
  const [showPwd, setShowPwd] = useState(false)
  const [now, setNow] = useState(() => new Date())
  const headerRef = useRef<HTMLElement>(null)
  const unread = visibleNotifications.filter((item) => !item.read).length
  const stamp = formatHeaderStamp(now, profile.timezone)

  const results = useMemo<SearchResult[]>(() => {
    const q = query.trim().toLowerCase()
    if (!q) return []
    const pages: SearchResult[] = [
      { id: 'p-dash', title: 'Dashboard', subtitle: 'Overview', path: '/dashboard', icon: 'bi-speedometer2' },
      { id: 'p-proj', title: 'My Projects', subtitle: 'Projects', path: '/project-inventory', icon: 'bi-folder2-open' },
      { id: 'p-git', title: 'ESP Git Username', subtitle: 'Company Git users', path: '/git-usernames', icon: 'bi-github' },
      { id: 'p-sec', title: 'Secrets', subtitle: 'Encrypted vault', path: '/secrets-env', icon: 'bi-key' },
      { id: 'p-net', title: 'Network', subtitle: 'Infrastructure', path: '/network-management', icon: 'bi-hdd-network' },
      { id: 'p-quick', title: 'Quick Access', subtitle: 'Shortcuts', path: '/quick-access', icon: 'bi-lightning-charge' },
      { id: 'p-drive', title: 'Personal Drive', subtitle: 'Private files', path: '/personal-drive', icon: 'bi-cloud-arrow-up' },
      { id: 'p-docs', title: 'Documentation', subtitle: 'Notes and runbooks', path: '/documentation', icon: 'bi-journal-text' },
      { id: 'p-set', title: 'Settings', subtitle: 'Preferences', path: '/settings', icon: 'bi-gear' },
      { id: 'p-invite', title: 'Invitation', subtitle: 'Invite users', path: '/invitation', icon: 'bi-envelope' },
    ]
    return [
      ...pages,
      ...projects.map((project) => ({
        id: project.id,
        title: project.name,
        subtitle: project.domainIp || project.env,
        path: '/project-inventory',
        icon: 'bi-folder2',
      })),
      ...shortcuts.map((shortcut) => ({
        id: shortcut.id,
        title: shortcut.name,
        subtitle: shortcut.category,
        path: '/quick-access',
        icon: shortcut.icon,
      })),
    ]
      .filter((item) => item.title.toLowerCase().includes(q) || item.subtitle.toLowerCase().includes(q))
      .slice(0, 8)
  }, [projects, query, shortcuts])

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1000)
    return () => window.clearInterval(id)
  }, [])

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (headerRef.current && !headerRef.current.contains(event.target as Node)) {
        setShowSearch(false)
        setShowNotifs(false)
        setShowUser(false)
        setShowPwd(false)
      }
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  return (
    <header className="app-header" ref={headerRef}>
      <div className="header-left">
        <button type="button" className="icon-btn-ghost" onClick={toggleSidebar} aria-label="Toggle sidebar">
          <i className="bi bi-list" />
        </button>
        <span className="header-page d-none d-md-inline">{current.label}</span>
      </div>

      <div className="header-right">
        <div className="header-search">
          <i className="bi bi-search" />
          <input
            className="form-control"
            placeholder="Search..."
            value={query}
            onChange={(event) => {
              setQuery(event.target.value)
              setShowSearch(true)
            }}
            onFocus={() => setShowSearch(true)}
          />
          {showSearch && results.length > 0 ? (
            <div className="dropdown-panel" style={{ left: 0, right: 0, width: 'auto' }}>
              {results.map((result) => (
                <button
                  key={result.id}
                  type="button"
                  className="dropdown-item-row w-100 text-start border-0 bg-transparent"
                  onClick={() => {
                    router.push(result.path)
                    setQuery('')
                    setShowSearch(false)
                  }}
                >
                  <div className="d-flex align-items-center gap-2">
                    <i className={`bi ${result.icon}`} />
                    <div>
                      <strong>{result.title}</strong>
                      <div className="small text-secondary">{result.subtitle}</div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          ) : null}
        </div>

        {preferences.showClock ? (
          <div className="header-stamp" title={stamp.tz}>
            <span>
              {stamp.weekday} · {stamp.date}
            </span>
            <strong className="stamp-time">{stamp.time}</strong>
            <strong className="stamp-tz">{stamp.tz}</strong>
          </div>
        ) : null}

        <div className="position-relative">
          <button
            type="button"
            className={`icon-btn-ghost ${showPwd ? 'active' : ''}`}
            title="Random password generator"
            aria-label="Random password generator"
            onClick={() => {
              setShowPwd((open) => !open)
              setShowNotifs(false)
              setShowUser(false)
              setShowSearch(false)
            }}
          >
            <i className="bi bi-lock" />
          </button>
          {showPwd ? (
            <PasswordGenerator onClose={() => setShowPwd(false)} onCopy={() => pushToast('Password copied')} />
          ) : null}
        </div>

        <button
          type="button"
          className="icon-btn-ghost"
          title={theme === 'dark' ? 'Switch to light' : 'Switch to dark'}
          aria-label="Toggle theme"
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
        >
          <i className={`bi ${theme === 'dark' ? 'bi-sun' : 'bi-moon-stars'}`} />
        </button>

        <div className="position-relative">
          <button
            type="button"
            className="icon-btn-ghost position-relative"
            aria-label="Notifications"
            onClick={() => {
              setShowNotifs((open) => !open)
              setShowUser(false)
              setShowPwd(false)
            }}
          >
            <i className="bi bi-bell" />
            {unread > 0 ? <span className="notif-dot" /> : null}
          </button>
          {showNotifs ? (
            <div className="dropdown-panel">
              <div className="d-flex justify-content-between align-items-center px-3 py-2">
                <strong>Notifications</strong>
                <button type="button" className="btn btn-link btn-sm" onClick={markAllRead}>
                  Mark all read
                </button>
              </div>
              {visibleNotifications.length === 0 ? (
                <div className="notif-empty">No alerts right now. Turn on in-app notifications in Settings to receive them.</div>
              ) : (
                visibleNotifications.map((item) => (
                  <button
                    type="button"
                    className="dropdown-item-row notif-item"
                    key={item.id}
                    onClick={() => markOneRead(item.id)}
                  >
                    <div className="d-flex justify-content-between">
                      <strong>{item.title}</strong>
                      {!item.read ? <span className="status-badge status-info">New</span> : null}
                    </div>
                    <div className="small text-secondary">{item.message}</div>
                    <div className="small text-secondary mt-1">{item.time}</div>
                  </button>
                ))
              )}
            </div>
          ) : null}
        </div>

        <div className="position-relative">
          <button
            type="button"
            className="icon-btn-ghost"
            aria-label="Account"
            onClick={() => {
              setShowUser((open) => !open)
              setShowNotifs(false)
              setShowPwd(false)
            }}
          >
            <UserAvatar name={profile.name} src={profile.avatarUrl} />
          </button>
          {showUser ? (
            <div className="dropdown-panel" style={{ width: 240 }}>
              <div className="dropdown-item-row">
                <strong>{profile.name}</strong>
                <div className="small text-secondary">{profile.email}</div>
                {profile.role === 'Admin' ? (
                  <span className="status-badge status-success mt-2">Admin · full access</span>
                ) : (
                  <span className="status-badge status-info mt-2">{profile.role}</span>
                )}
              </div>
              <button
                type="button"
                className="dropdown-item-row w-100 text-start border-0 bg-transparent"
                onClick={() => {
                  setShowUser(false)
                  router.push('/settings')
                }}
              >
                Profile & settings
              </button>
              <button
                type="button"
                className="dropdown-item-row w-100 text-start border-0 bg-transparent text-danger"
                onClick={() => {
                  setShowUser(false)
                  logout()
                  pushToast('Signed out', 'info')
                  router.replace('/login')
                }}
              >
                <i className="bi bi-box-arrow-right me-2" />
                Logout
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </header>
  )
}
