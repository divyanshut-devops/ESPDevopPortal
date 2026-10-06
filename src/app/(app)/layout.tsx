'use client'

import { AppLayout } from '../../layout/AppLayout'
import { ProtectedGate } from '../../layout/AuthGates'

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  return (
    <ProtectedGate>
      <AppLayout>{children}</AppLayout>
    </ProtectedGate>
  )
}
