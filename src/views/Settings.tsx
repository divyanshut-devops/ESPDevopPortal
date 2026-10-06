'use client'

import { useRef, useState } from 'react'
import { confirmTwoFactor, requestTwoFactor, saveAvatar } from '../api/account'
import { UserAvatar } from '../components/UserAvatar'
import { Modal } from '../components/Modal'
import { OtpInputs } from '../components/OtpInputs'
import { ThemeSwitch } from '../components/ThemeSwitch'
import { useApp } from '../context/AppContext'

const SECTIONS = ['General', 'Profile', 'Appearance', 'Notifications', 'Security', 'Preferences'] as const
type Section = (typeof SECTIONS)[number]

export function Settings() {
  const {
    profile,
    setProfile,
    theme,
    setTheme,
    notificationPrefs,
    setNotificationPrefs,
    preferences,
    setPreferences,
    sidebarCollapsed,
    setSidebarCollapsed,
    persistAccount,
    applyAccount,
    sendTestAlert,
    pushToast,
    isAdmin,
  } = useApp()
  const [section, setSection] = useState<Section>('General')
  const [saving, setSaving] = useState(false)
  const [twoFactorOpen, setTwoFactorOpen] = useState(false)
  const [twoFactorEnable, setTwoFactorEnable] = useState(false)
  const [twoFactorDigits, setTwoFactorDigits] = useState(['', '', '', '', '', ''])
  const [twoFactorError, setTwoFactorError] = useState('')
  const [twoFactorBusy, setTwoFactorBusy] = useState(false)
  const [twoFactorQr, setTwoFactorQr] = useState('')
  const [twoFactorSecret, setTwoFactorSecret] = useState('')
  const confirmingRef = useRef(false)

  const save = async (patch = {}) => {
    setSaving(true)
    try {
      await persistAccount(patch)
      pushToast('Saved to MongoDB')
    } catch (error) {
      pushToast(error instanceof Error ? error.message : 'Unable to save settings', 'error')
    } finally {
      setSaving(false)
    }
  }

  const openTwoFactor = async (enable: boolean) => {
    setTwoFactorEnable(enable)
    setTwoFactorDigits(['', '', '', '', '', ''])
    setTwoFactorQr('')
    setTwoFactorSecret('')
    setTwoFactorError('')
    setTwoFactorBusy(true)
    setTwoFactorOpen(true)
    try {
      const result = await requestTwoFactor(enable)
      setTwoFactorQr(result.qrDataUrl || '')
      setTwoFactorSecret(result.secret || '')
      pushToast(result.message || (enable ? 'Scan the authenticator barcode' : 'Enter your authenticator code'), 'info')
    } catch (error) {
      setTwoFactorError(error instanceof Error ? error.message : 'Unable to start 2FA')
    } finally {
      setTwoFactorBusy(false)
    }
  }

  const confirmTwoFactorCode = async (code: string) => {
    if (confirmingRef.current || twoFactorBusy || code.length !== 6) return
    confirmingRef.current = true
    setTwoFactorBusy(true)
    setTwoFactorError('')
    try {
      const result = await confirmTwoFactor(twoFactorEnable, code)
      applyAccount(result.user)
      setTwoFactorOpen(false)
      setTwoFactorQr('')
      setTwoFactorSecret('')
      pushToast(result.message || 'Two-factor authentication updated')
    } catch (error) {
      setTwoFactorError(error instanceof Error ? error.message : 'Unable to verify 2FA')
    } finally {
      confirmingRef.current = false
      setTwoFactorBusy(false)
    }
  }

  return (
    <div className="row g-3">
      <div className="col-12 col-lg-3">
        <div className="panel p-3 settings-nav">
          {SECTIONS.map((item) => (
            <button key={item} type="button" className={item === section ? 'active' : ''} onClick={() => setSection(item)}>
              {item}
            </button>
          ))}
        </div>
      </div>
      <div className="col-12 col-lg-9">
        <div className="panel p-4">
          {section === 'General' ? (
            <>
              <h5>General</h5>
              <p className="text-secondary">Workspace identity for the ESP DevOps Portal.</p>
              <div className="row g-3">
                <div className="col-md-6">
                  <label className="form-label">Name</label>
                  <input
                    className="form-control"
                    value={profile.name}
                    onChange={(event) => setProfile({ ...profile, name: event.target.value })}
                  />
                </div>
                <div className="col-md-6">
                  <label className="form-label">Workspace name</label>
                  <input
                    className="form-control"
                    value={profile.workspaceName}
                    onChange={(event) => setProfile({ ...profile, workspaceName: event.target.value })}
                  />
                </div>
              </div>
              <button className="btn btn-accent mt-3" type="button" disabled={saving} onClick={() => void save()}>
                {saving ? 'Saving…' : 'Save general'}
              </button>
              <p className="text-secondary small mt-3 mb-0">
                To add a desktop shortcut, use your browser menu: Install app or Add to Home Screen.
              </p>
            </>
          ) : null}

          {section === 'Profile' ? (
            <>
              <h5>Profile</h5>
              {isAdmin ? (
                <div className="profile-photo-row mb-4">
                  <UserAvatar name={profile.name} src={profile.avatarUrl} size="md" />
                  <div>
                    <p className="mb-2">Profile photo</p>
                    <p className="text-secondary small">Admin only. PNG or JPEG, cropped to a square.</p>
                    <label className="btn btn-ghost mb-0">
                      Upload photo
                      <input
                        type="file"
                        accept="image/png,image/jpeg"
                        hidden
                        onChange={(event) => {
                          const file = event.target.files?.[0]
                          event.target.value = ''
                          if (!file) return
                          const image = new Image()
                          const reader = new FileReader()
                          reader.onload = () => {
                            image.onload = () => {
                              const canvas = document.createElement('canvas')
                              canvas.width = 256
                              canvas.height = 256
                              const context = canvas.getContext('2d')
                              if (!context) return
                              const side = Math.min(image.width, image.height)
                              const sx = (image.width - side) / 2
                              const sy = (image.height - side) / 2
                              context.drawImage(image, sx, sy, side, side, 0, 0, 256, 256)
                              void saveAvatar(canvas.toDataURL('image/jpeg', 0.82))
                                .then((result) => {
                                  applyAccount(result.user)
                                  pushToast(result.message || 'Profile photo updated')
                                })
                                .catch((error) => pushToast(error instanceof Error ? error.message : 'Unable to save photo', 'error'))
                            }
                            image.src = String(reader.result || '')
                          }
                          reader.readAsDataURL(file)
                        }}
                      />
                    </label>
                  </div>
                </div>
              ) : null}
              <div className="row g-3">
                <div className="col-md-6">
                  <label className="form-label">Full name</label>
                  <input className="form-control" value={profile.name} onChange={(event) => setProfile({ ...profile, name: event.target.value })} />
                </div>
                <div className="col-md-6">
                  <label className="form-label">Email</label>
                  <input className="form-control" value={profile.email} disabled={isAdmin} onChange={(event) => setProfile({ ...profile, email: event.target.value })} />
                </div>
                <div className="col-md-6">
                  <label className="form-label">Role</label>
                  <input className="form-control" value={profile.role} disabled onChange={(event) => setProfile({ ...profile, role: event.target.value })} />
                </div>
                <div className="col-md-6">
                  <label className="form-label">Team</label>
                  <input className="form-control" value={profile.team} onChange={(event) => setProfile({ ...profile, team: event.target.value })} />
                </div>
              </div>
              <button className="btn btn-accent mt-3" type="button" disabled={saving} onClick={() => void save()}>
                {saving ? 'Saving…' : 'Save profile'}
              </button>
              {isAdmin ? (
                <div className="mt-4">
                  <h6>Admin privileges</h6>
                  <p className="text-secondary small mb-2">This account has full access across the portal.</p>
                  <div className="d-flex flex-wrap gap-2">
                    {profile.privileges.map((item) => (
                      <span key={item} className="chip active">
                        {item}
                      </span>
                    ))}
                  </div>
                </div>
              ) : null}
            </>
          ) : null}

          {section === 'Appearance' ? (
            <>
              <h5>Appearance</h5>
              <p className="text-secondary">One theme switch for the whole workspace. Off is dark, on is light.</p>
              <div className="d-flex align-items-center gap-3">
                <ThemeSwitch theme={theme} onToggle={setTheme} />
                <span className="text-secondary">{theme === 'light' ? 'Light mode' : 'Dark mode'}</span>
              </div>
              <div className="form-check form-switch mt-4">
                <input
                  className="form-check-input"
                  type="checkbox"
                  checked={sidebarCollapsed}
                  onChange={(event) => setSidebarCollapsed(event.target.checked)}
                  id="compact-sidebar"
                />
                <label className="form-check-label" htmlFor="compact-sidebar">
                  Collapse sidebar on desktop
                </label>
              </div>
            </>
          ) : null}

          {section === 'Notifications' ? (
            <>
              <h5>Notifications</h5>
              <p className="text-secondary">These filters control the bell in the top bar and are stored in MongoDB.</p>
              {(
                [
                  ['inApp', 'In-app alerts'],
                  ['email', 'Email digest'],
                  ['deployments', 'Deployment events'],
                  ['secrets', 'Secret changes'],
                  ['infrastructure', 'Infrastructure warnings'],
                ] as Array<[keyof typeof notificationPrefs, string]>
              ).map(([key, label]) => (
                <div className="form-check form-switch mb-2" key={key}>
                  <input
                    className="form-check-input"
                    type="checkbox"
                    id={key}
                    checked={notificationPrefs[key]}
                    onChange={(event) => setNotificationPrefs({ ...notificationPrefs, [key]: event.target.checked })}
                  />
                  <label className="form-check-label" htmlFor={key}>
                    {label}
                  </label>
                </div>
              ))}
              <div className="d-flex flex-wrap gap-2 mt-3">
                <button className="btn btn-accent" type="button" disabled={saving} onClick={() => void save()}>
                  {saving ? 'Saving…' : 'Save notifications'}
                </button>
                <button
                  className="btn btn-outline-info"
                  type="button"
                  onClick={() => {
                    void sendTestAlert()
                      .then(() => pushToast('Test alert sent to the bell'))
                      .catch((error) => pushToast(error instanceof Error ? error.message : 'Unable to send test alert', 'error'))
                  }}
                >
                  Send test alert
                </button>
              </div>
            </>
          ) : null}

          {section === 'Security' ? (
            <>
              <h5>Security</h5>
              <p className="text-secondary">
                Authenticator 2FA. Scan the barcode in Google Authenticator, Authy, or 1Password. Secrets stay encrypted on the server.
              </p>
              <div className="form-check form-switch mt-3">
                <input
                  className="form-check-input"
                  type="checkbox"
                  id="twofa"
                  checked={preferences.twoFactorEnabled}
                  onChange={() => void openTwoFactor(!preferences.twoFactorEnabled)}
                />
                <label className="form-check-label" htmlFor="twofa">
                  Enable authenticator 2FA
                </label>
              </div>
              <div className="mt-3" style={{ maxWidth: 240 }}>
                <label className="form-label">Session timeout (minutes)</label>
                <input
                  type="number"
                  className="form-control"
                  value={preferences.sessionTimeoutMin}
                  onChange={(event) => setPreferences({ ...preferences, sessionTimeoutMin: Number(event.target.value) })}
                />
              </div>
              <button className="btn btn-accent mt-3" type="button" disabled={saving} onClick={() => void save()}>
                {saving ? 'Saving…' : 'Save security'}
              </button>
            </>
          ) : null}

          {section === 'Preferences' ? (
            <>
              <h5>Preferences</h5>
              <div className="form-check form-switch mb-3">
                <input
                  className="form-check-input"
                  type="checkbox"
                  id="show-clock"
                  checked={preferences.showClock}
                  onChange={(event) => setPreferences({ ...preferences, showClock: event.target.checked })}
                />
                <label className="form-check-label" htmlFor="show-clock">
                  Show clock on top bar
                </label>
              </div>
              <div className="row g-3">
                <div className="col-md-6">
                  <label className="form-label">Timezone</label>
                  <input className="form-control" value={profile.timezone} onChange={(event) => setProfile({ ...profile, timezone: event.target.value })} />
                </div>
                <div className="col-md-6">
                  <label className="form-label">Date format</label>
                  <input className="form-control" value={profile.dateFormat} onChange={(event) => setProfile({ ...profile, dateFormat: event.target.value })} />
                </div>
                <div className="col-md-6">
                  <label className="form-label">Items per page</label>
                  <select
                    className="form-select"
                    value={preferences.itemsPerPage}
                    onChange={(event) => setPreferences({ ...preferences, itemsPerPage: Number(event.target.value) })}
                  >
                    <option value={8}>8</option>
                    <option value={12}>12</option>
                    <option value={20}>20</option>
                  </select>
                </div>
              </div>
              <div className="form-check form-switch mt-3">
                <input
                  className="form-check-input"
                  type="checkbox"
                  id="remember-sidebar"
                  checked={preferences.rememberSidebar}
                  onChange={(event) => setPreferences({ ...preferences, rememberSidebar: event.target.checked })}
                />
                <label className="form-check-label" htmlFor="remember-sidebar">
                  Remember sidebar collapsed state
                </label>
              </div>
              <div className="form-check form-switch">
                <input
                  className="form-check-input"
                  type="checkbox"
                  id="compact-tables"
                  checked={preferences.compactTables}
                  onChange={(event) => setPreferences({ ...preferences, compactTables: event.target.checked })}
                />
                <label className="form-check-label" htmlFor="compact-tables">
                  Compact tables
                </label>
              </div>
              <button className="btn btn-accent mt-3" type="button" disabled={saving} onClick={() => void save()}>
                {saving ? 'Saving…' : 'Save preferences'}
              </button>
            </>
          ) : null}
        </div>
      </div>

      <Modal
        open={twoFactorOpen}
        title={twoFactorEnable ? 'Scan authenticator barcode' : 'Turn off authenticator 2FA'}
        onClose={() => {
          setTwoFactorOpen(false)
          setTwoFactorQr('')
          setTwoFactorSecret('')
        }}
        footer={
          <>
            <button type="button" className="btn btn-ghost" onClick={() => setTwoFactorOpen(false)}>
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-accent"
              disabled={twoFactorBusy || twoFactorDigits.some((digit) => !digit)}
              onClick={() => void confirmTwoFactorCode(twoFactorDigits.join(''))}
            >
              {twoFactorBusy ? 'Verifying…' : 'Confirm'}
            </button>
          </>
        }
      >
        {twoFactorEnable && twoFactorQr ? (
          <div className="totp-setup">
            <img className="totp-qr" src={twoFactorQr} alt="Authenticator barcode" />
            <p className="text-secondary small mb-2">Scan this barcode, then enter the 6-digit code from the app.</p>
            {twoFactorSecret ? (
              <p className="totp-secret">
                Manual key: <code>{twoFactorSecret}</code>
              </p>
            ) : null}
          </div>
        ) : (
          <p className="text-secondary">
            {twoFactorEnable
              ? 'Preparing a secure barcode…'
              : 'Enter the current 6-digit code from your authenticator app to turn 2FA off.'}
          </p>
        )}
        <OtpInputs
          digits={twoFactorDigits}
          disabled={twoFactorBusy}
          onChange={(next) => {
            setTwoFactorDigits(next)
            setTwoFactorError('')
            if (next.every((digit) => digit !== '')) void confirmTwoFactorCode(next.join(''))
          }}
        />
        {twoFactorError ? <p className="text-danger small mt-3 mb-0">{twoFactorError}</p> : null}
      </Modal>
    </div>
  )
}
