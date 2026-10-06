'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import { BrandLogo } from '../components/BrandLogo'
import { useApp } from '../context/AppContext'
import { DASHBOARD_ITEM, NAV_ITEMS } from '../navigation'
import { classNames } from '../utils'

export function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const { sidebarCollapsed, mobileOpen, setMobileOpen, can } = useApp()
  const [pending, setPending] = useState(pathname)

  const closeMobile = () => setMobileOpen(false)
  const items = useMemo(
    () =>
      NAV_ITEMS.filter((item) => {
        if (item.path === '/api-testing') return can('postman.use')
        if (item.path === '/invitation') return can('invitations.manage')
        if (item.path === '/dev-generator') return can('generator.use')
        if (item.path === '/personal-drive') return can('drive.view')
        if (item.path === '/terminal') return can('ssh.connect')
        return true
      }),
    [can],
  )

  useEffect(() => {
    setPending(pathname)
  }, [pathname])

  useEffect(() => {
    router.prefetch(DASHBOARD_ITEM.path)
    for (const item of items) router.prefetch(item.path)
  }, [items, router])

  const go = (path: string) => {
    setPending(path)
    closeMobile()
  }

  return (
    <>
      {mobileOpen ? <div className="mobile-overlay" onClick={closeMobile} /> : null}
      <aside
        className={classNames('sidebar', sidebarCollapsed && 'collapsed', mobileOpen && 'mobile-open')}
      >
        <div className="sidebar-brand">
          <div className="brand-logo">
            <BrandLogo size={36} />
          </div>
          <div className="brand-copy">
            <p className="brand-kicker">ESP</p>
            <p className="brand-title">DevOps Portal</p>
          </div>
        </div>

        <nav className="sidebar-nav">
          <Link
            href={DASHBOARD_ITEM.path}
            prefetch
            className={classNames('nav-link-item', pending === DASHBOARD_ITEM.path && 'active')}
            title={DASHBOARD_ITEM.label}
            onClick={() => go(DASHBOARD_ITEM.path)}
          >
            <i className={`bi ${DASHBOARD_ITEM.icon}`} />
            <span className="nav-label">{DASHBOARD_ITEM.label}</span>
          </Link>
          {items.map((item) => (
            <Link
              key={item.path}
              href={item.path}
              prefetch
              className={classNames('nav-link-item', pending === item.path && 'active')}
              title={item.label}
              onClick={() => go(item.path)}
            >
              <i className={`bi ${item.icon}`} />
              <span className="nav-label">{item.label}</span>
            </Link>
          ))}
        </nav>

        <div className="sidebar-footer">
          <span>ESP Platform · v1.0</span>
        </div>
      </aside>
    </>
  )
}
