'use client'

import { Header } from './Header'
import { Sidebar } from './Sidebar'

export function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="app-shell">
      <Sidebar />
      <div className="main-area">
        <Header />
        <main className="content-wrap">{children}</main>
      </div>
    </div>
  )
}
