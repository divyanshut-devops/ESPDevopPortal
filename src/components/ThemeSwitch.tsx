import type { ThemeMode } from '../types'

interface ThemeSwitchProps {
  theme: ThemeMode
  onToggle: (theme: ThemeMode) => void
}

export function ThemeSwitch({ theme, onToggle }: ThemeSwitchProps) {
  const light = theme === 'light'
  return (
    <div className="theme-switch">
      <i className={`bi bi-moon-stars ${light ? '' : 'active-theme'}`} aria-hidden="true" />
      <div className="form-check form-switch m-0">
        <input
          className="form-check-input"
          type="checkbox"
          role="switch"
          checked={light}
          onChange={() => onToggle(light ? 'dark' : 'light')}
          aria-label="Toggle light theme"
        />
      </div>
      <i className={`bi bi-sun ${light ? 'active-theme' : ''}`} aria-hidden="true" />
    </div>
  )
}
