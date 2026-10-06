'use client'

import { useMemo, useState } from 'react'

const NUMBERS = '0123456789'
const LOWER = 'abcdefghijklmnopqrstuvwxyz'
const UPPER = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
const SPECIAL = '!@#$%^&*()-_=+[]{};:,.<>?'
const SIMILAR = /[il1Lo0O]/g

type Sets = {
  numbers: boolean
  lower: boolean
  upper: boolean
  special: boolean
}

function randomIndex(max: number) {
  if (max <= 0) return 0
  const cap = Math.floor(0xffffffff / max) * max
  const buf = new Uint32Array(1)
  let value = 0
  do {
    crypto.getRandomValues(buf)
    value = buf[0]
  } while (value >= cap)
  return value % max
}

function poolFor(sets: Sets, excludeSimilar: boolean) {
  const parts: string[] = []
  if (sets.numbers) parts.push(excludeSimilar ? NUMBERS.replace(SIMILAR, '') : NUMBERS)
  if (sets.lower) parts.push(excludeSimilar ? LOWER.replace(SIMILAR, '') : LOWER)
  if (sets.upper) parts.push(excludeSimilar ? UPPER.replace(SIMILAR, '') : UPPER)
  if (sets.special) parts.push(SPECIAL)
  return parts.filter(Boolean)
}

export function generatePassword(length: number, sets: Sets, excludeSimilar = false) {
  const groups = poolFor(sets, excludeSimilar)
  const alphabet = groups.join('')
  if (!alphabet) return ''
  const size = Math.min(Math.max(Math.floor(length) || 1, 1), 128)
  const chars: string[] = size >= groups.length ? groups.map((group) => group[randomIndex(group.length)]) : []
  while (chars.length < size) {
    chars.push(alphabet[randomIndex(alphabet.length)])
  }
  for (let i = chars.length - 1; i > 0; i -= 1) {
    const j = randomIndex(i + 1)
    ;[chars[i], chars[j]] = [chars[j], chars[i]]
  }
  return chars.join('')
}

function entropyBits(length: number, sets: Sets, excludeSimilar: boolean) {
  const alphabet = poolFor(sets, excludeSimilar).join('').length
  if (!alphabet) return 0
  return Math.round(length * Math.log2(alphabet))
}

function strengthLabel(bits: number) {
  if (bits >= 100) return 'Strong'
  if (bits >= 80) return 'Fair'
  return 'Weak'
}

type PasswordGeneratorProps = {
  onCopy: (password: string) => void
  onClose: () => void
}

export function PasswordGenerator({ onCopy, onClose }: PasswordGeneratorProps) {
  const [sets, setSets] = useState<Sets>({ numbers: true, lower: true, upper: true, special: false })
  const [lengthText, setLengthText] = useState('')
  const [more, setMore] = useState(false)
  const [excludeSimilar, setExcludeSimilar] = useState(false)
  const [password, setPassword] = useState('')
  const [copied, setCopied] = useState(false)
  const ready = useMemo(() => Object.values(sets).some(Boolean), [sets])
  const length = Number(lengthText)
  const lengthReady = Number.isFinite(length) && length >= 1 && length <= 128
  const bits = lengthReady ? entropyBits(length, sets, excludeSimilar) : 0
  const strength = strengthLabel(bits)
  const secure = lengthReady && Object.values(sets).filter(Boolean).length >= 3 && length >= 12

  const toggle = (key: keyof Sets) => {
    setSets((current) => ({ ...current, [key]: !current[key] }))
  }

  const generate = () => {
    if (!lengthReady) return
    const next = generatePassword(length, sets, excludeSimilar)
    if (!next) return
    setPassword(next)
    setCopied(false)
  }

  const copy = async () => {
    let value = password
    if (!value) {
      if (!lengthReady) return
      value = generatePassword(length, sets, excludeSimilar)
      setPassword(value)
    }
    if (!value) return
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      onCopy(value)
    } catch {
      onCopy(value)
    }
  }

  return (
    <div className="pwd-panel" onMouseDown={(event) => event.stopPropagation()}>
      <div className="pwd-kicker">
        <span>Password tool</span>
        <button type="button" className="pwd-close" onClick={onClose}>
          Close
        </button>
      </div>
      <div className="pwd-heading">
        <strong>Random password generator</strong>
        <span className={`pwd-secure ${secure ? 'on' : ''}`}>{secure ? 'Secure' : 'Basic'}</span>
      </div>
      <div className="pwd-grid">
        <label>
          <input type="checkbox" checked={sets.numbers} onChange={() => toggle('numbers')} />
          Numbers
        </label>
        <label>
          <input type="checkbox" checked={sets.lower} onChange={() => toggle('lower')} />
          Lowercases
        </label>
        <label>
          <input type="checkbox" checked={sets.upper} onChange={() => toggle('upper')} />
          Uppercases
        </label>
        <label>
          <input type="checkbox" checked={sets.special} onChange={() => toggle('special')} />
          Special
        </label>
      </div>
      <div className="pwd-length-label">Length (manual)</div>
      <div className="pwd-row">
        <label className="pwd-length">
          <input
            type="number"
            min={1}
            max={128}
            inputMode="numeric"
            placeholder="Length"
            value={lengthText}
            onChange={(event) => setLengthText(event.target.value.replace(/[^\d]/g, '').slice(0, 3))}
          />
        </label>
        <button type="button" className="pwd-generate" disabled={!ready || !lengthReady} onClick={generate}>
          Generate
        </button>
        <button type="button" className="pwd-copy-btn" disabled={!ready || (!password && !lengthReady)} onClick={() => void copy()}>
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <div className="pwd-meta-row">
        <span>{lengthReady ? `1–128 characters · using ${length}` : 'Type a length from 1 to 128'}</span>
        <button type="button" className="pwd-more" onClick={() => setMore((open) => !open)}>
          {more ? 'Fewer options' : 'More options'}
        </button>
      </div>
      {more ? (
        <label className="pwd-extra">
          <input type="checkbox" checked={excludeSimilar} onChange={() => setExcludeSimilar((value) => !value)} />
          Exclude similar characters (i, l, 1, L, o, 0, O)
        </label>
      ) : null}
      <div className="pwd-result">
        <code>{password || 'Generate a password'}</code>
      </div>
      <div className="pwd-footer">
        <span>Entropy: {bits} bits</span>
        <span className={`pwd-strength ${strength.toLowerCase()}`}>Strength: {strength}</span>
      </div>
    </div>
  )
}
