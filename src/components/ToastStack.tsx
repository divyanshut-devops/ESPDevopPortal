'use client'

import { useApp } from '../context/AppContext'

export function ToastStack() {
  const { toasts } = useApp()

  return (
    <div className="toast-stack">
      {toasts.map((toast) => (
        <div key={toast.id} className="toast-item">
          <span className={`status-badge status-${toast.type} me-2`}>{toast.type}</span>
          {toast.message}
        </div>
      ))}
    </div>
  )
}
