import type { ReactNode } from 'react'
import { useEffect } from 'react'

interface ModalProps {
  open: boolean
  title: string
  onClose: () => void
  children: ReactNode
  footer?: ReactNode
  size?: 'sm' | 'md' | 'lg'
}

export function Modal({ open, title, onClose, children, footer, size = 'md' }: ModalProps) {
  useEffect(() => {
    if (!open) return undefined
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="modal-backdrop-custom" onClick={onClose} role="presentation">
      <div
        className={`modal-card ${size === 'md' ? '' : size}`}
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
      >
        <div className="d-flex justify-content-between align-items-center px-4 pt-4 pb-2">
          <h5 id="modal-title" className="mb-0">
            {title}
          </h5>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">
            <i className="bi bi-x-lg" />
          </button>
        </div>
        <div className="px-4 py-3">{children}</div>
        {footer ? <div className="px-4 pb-4 d-flex justify-content-end gap-2">{footer}</div> : null}
      </div>
    </div>
  )
}
