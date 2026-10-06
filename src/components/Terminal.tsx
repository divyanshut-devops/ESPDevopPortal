import { useEffect, useRef } from 'react'

interface TerminalProps {
  lines: string[]
  prompt: string
  value: string
  onChange: (value: string) => void
  onSubmit: (command: string) => void
  onClear: () => void
  disabled?: boolean
}

export function Terminal({
  lines,
  prompt,
  value,
  onChange,
  onSubmit,
  onClear,
  disabled = false,
}: TerminalProps) {
  const bodyRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (bodyRef.current) {
      bodyRef.current.scrollTop = bodyRef.current.scrollHeight
    }
  }, [lines])

  return (
    <div className="terminal-shell">
      <div className="d-flex justify-content-between align-items-center px-3 py-2 border-bottom border-secondary-subtle">
        <span className="text-secondary small">esp-terminal</span>
        <button type="button" className="btn btn-sm btn-ghost" onClick={onClear}>
          Clear
        </button>
      </div>
      <div className="terminal-body" ref={bodyRef}>
        {lines.map((line, index) => (
          <div key={`${index}-${line.slice(0, 12)}`}>{line}</div>
        ))}
      </div>
      <form
        className="terminal-input-row"
        onSubmit={(event) => {
          event.preventDefault()
          if (!disabled && value.trim()) onSubmit(value)
        }}
      >
        <span>{prompt}</span>
        <input
          value={value}
          disabled={disabled}
          onChange={(event) => onChange(event.target.value)}
          placeholder={disabled ? 'Connect to a server to begin' : 'Enter command'}
          autoComplete="off"
        />
      </form>
    </div>
  )
}
