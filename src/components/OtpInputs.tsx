'use client'

import { useRef } from 'react'

interface OtpInputsProps {
  digits: string[]
  disabled?: boolean
  onChange: (digits: string[]) => void
}

export function OtpInputs({ digits, disabled, onChange }: OtpInputsProps) {
  const inputsRef = useRef<Array<HTMLInputElement | null>>([])

  const applyDigits = (next: string[]) => {
    onChange(next)
  }

  return (
    <div className="otp-inputs">
      {digits.map((digit, index) => (
        <input
          key={index}
          ref={(node) => {
            inputsRef.current[index] = node
          }}
          className="otp-box"
          inputMode="numeric"
          maxLength={1}
          value={digit}
          disabled={disabled}
          onChange={(event) => {
            const char = event.target.value.replace(/\D/g, '').slice(-1)
            const next = [...digits]
            next[index] = char
            applyDigits(next)
            if (char && index < 5) inputsRef.current[index + 1]?.focus()
          }}
          onKeyDown={(event) => {
            if (event.key === 'Backspace' && !digits[index] && index > 0) {
              inputsRef.current[index - 1]?.focus()
            }
          }}
          onPaste={(event) => {
            event.preventDefault()
            const pasted = event.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6)
            if (!pasted) return
            const next = ['', '', '', '', '', '']
            pasted.split('').forEach((char, charIndex) => {
              next[charIndex] = char
            })
            applyDigits(next)
          }}
          aria-label={`OTP digit ${index + 1}`}
        />
      ))}
    </div>
  )
}
