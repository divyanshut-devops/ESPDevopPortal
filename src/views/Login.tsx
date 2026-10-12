'use client'

import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { requestOtp, resendLogin2fa, verifyLogin2fa, verifyOtp } from '../api/auth'
import { BrandLogo } from '../components/BrandLogo'
import { OtpInputs } from '../components/OtpInputs'
import { useApp } from '../context/AppContext'
import { NAV_ITEMS } from '../navigation'

export function Login() {
  const { login, pushToast } = useApp()
  const router = useRouter()
  const [step, setStep] = useState<'email' | 'otp' | '2fa'>('email')
  const [email, setEmail] = useState('')
  const [sending, setSending] = useState(false)
  const [digits, setDigits] = useState(['', '', '', '', '', ''])
  const [error, setError] = useState('')
  const [verifying, setVerifying] = useState(false)
  const completeRef = useRef('')

  useEffect(() => {
    completeRef.current = ''
  }, [step])

  const sendCode = async (targetEmail: string) => {
    setSending(true)
    setError('')
    try {
      await requestOtp(targetEmail)
      setDigits(['', '', '', '', '', ''])
      setStep('otp')
      pushToast(`OTP sent to ${targetEmail}`, 'info')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to send OTP')
    } finally {
      setSending(false)
    }
  }

  const onSubmitEmail = (event: FormEvent) => {
    event.preventDefault()
    const nextEmail = email.trim().toLowerCase()
    if (!nextEmail) {
      setError('Enter your email address.')
      return
    }
    void sendCode(nextEmail)
  }

  const finishLogin = (user: Parameters<typeof login>[0]) => {
    login(user)
    pushToast('Signed in successfully')
    router.replace('/dashboard')
  }

  const verify = async (value: string) => {
    if (verifying || completeRef.current === value) return
    completeRef.current = value
    setVerifying(true)
    setError('')
    try {
      if (step === '2fa') {
        const result = await verifyLogin2fa(value)
        finishLogin(result.user)
        return
      }
      const result = await verifyOtp(email.trim().toLowerCase(), value)
      if (result.requires2fa) {
        setDigits(['', '', '', '', '', ''])
        completeRef.current = ''
        setStep('2fa')
        pushToast(result.message || 'Enter your 2FA code', 'info')
        setVerifying(false)
        return
      }
      if (!result.user) {
        throw new Error('Unable to verify OTP')
      }
      finishLogin(result.user)
    } catch (err) {
      completeRef.current = ''
      setError(err instanceof Error ? err.message : 'Unable to verify OTP')
      setVerifying(false)
    }
  }

  const onDigitsChange = (next: string[]) => {
    setDigits(next)
    setError('')
    if (next.every((digit) => digit !== '')) {
      void verify(next.join(''))
    }
  }

  return (
    <div className="login-shell">
      <section className="login-hero">
        <div className="d-flex align-items-center gap-3 mb-4">
          <div className="brand-logo">
            <BrandLogo size={48} />
          </div>
          <div>
            <p className="brand-kicker mb-0">ESP</p>
            <p className="brand-title mb-0">DevOps Portal</p>
          </div>
        </div>
        <h1>ESP DevOps</h1>
        <p>You can manage your inventory, projects, and secrets from one workspace.</p>
        <ul className="login-points">
          {NAV_ITEMS.filter((item) => item.path !== '/invitation').map((item) => (
            <li key={item.path}>
              <i className={`bi ${item.icon}`} /> {item.label}
            </li>
          ))}
        </ul>
      </section>

      <section className="login-panel">
        <div className="login-card">
          <div className="login-card-brand">
            <div className="brand-logo">
              <BrandLogo size={36} />
            </div>
            <div>
              <p className="brand-kicker mb-0">ESP</p>
              <p className="brand-title mb-0">DevOps Portal</p>
            </div>
          </div>
          {step === 'email' ? (
            <form onSubmit={onSubmitEmail}>
              <p className="page-kicker mb-2">SIGN IN</p>
              <h2>Welcome back</h2>
              <p className="text-secondary mb-4">
                Enter your work email. We will send a 6-digit code to that inbox.
              </p>
              <label className="form-label" htmlFor="login-email">
                Email
              </label>
              <input
                id="login-email"
                className="form-control mb-3"
                type="email"
                autoComplete="email"
                placeholder="you@company.com"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
              {error ? <p className="text-danger small">{error}</p> : null}
              <button type="submit" className="btn btn-accent w-100" disabled={sending}>
                {sending ? 'Sending OTP…' : 'Send OTP'}
              </button>
            </form>
          ) : (
            <>
              <p className="page-kicker mb-2">{step === '2fa' ? 'TWO-FACTOR' : 'VERIFY OTP'}</p>
              <h2>{step === '2fa' ? 'Confirm it is you' : 'Check your email'}</h2>
              <p className="text-secondary">
                {step === '2fa'
                  ? 'Open Google Authenticator, Authy, or 1Password and enter the current 6-digit code.'
                  : `Enter the 6-digit code sent to ${email}.`}
              </p>

              <div className="mt-4">
                <OtpInputs digits={digits} disabled={verifying} onChange={onDigitsChange} />
              </div>

              {error ? <p className="text-danger small mt-3 mb-0">{error}</p> : null}

              <button
                type="button"
                className="btn btn-accent w-100 mt-4"
                disabled={verifying || digits.some((digit) => !digit)}
                onClick={() => void verify(digits.join(''))}
              >
                {verifying ? 'Verifying…' : step === '2fa' ? 'Verify 2FA' : 'Verify and continue'}
              </button>
              <div className="d-flex justify-content-between mt-3">
                <button
                  type="button"
                  className="btn btn-link p-0"
                  onClick={() => {
                    setStep('email')
                    setError('')
                  }}
                >
                  Use a different email
                </button>
                <button
                  type="button"
                  className="btn btn-link p-0"
                  disabled={sending}
                  onClick={() => {
                    if (step === '2fa') {
                      setSending(true)
                      void resendLogin2fa()
                        .then((result) => pushToast(result.message || 'Use the newest authenticator code', 'info'))
                        .catch((err) => setError(err instanceof Error ? err.message : 'Unable to refresh 2FA help'))
                        .finally(() => setSending(false))
                      return
                    }
                    void sendCode(email.trim().toLowerCase())
                  }}
                >
                  {step === '2fa' ? 'Need help?' : 'Resend OTP'}
                </button>
              </div>
            </>
          )}
        </div>
      </section>
    </div>
  )
}
