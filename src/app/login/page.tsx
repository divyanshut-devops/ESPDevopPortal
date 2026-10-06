'use client'

import { Login } from '../../views/Login'
import { GuestGate } from '../../layout/AuthGates'

export default function LoginPage() {
  return (
    <GuestGate>
      <Login />
    </GuestGate>
  )
}
