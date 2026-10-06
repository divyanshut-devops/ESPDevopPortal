'use client'

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent } from 'react'
import { fetchWorkbook, saveWorkbook, type CellStyle, type WorkbookSheet } from '../api/workbook'
import { useApp } from '../context/AppContext'
import { uid } from '../utils'

const STORAGE_KEY = 'esp-devops-workbook-v2'
const MIN_ROWS = 41
const MIN_COLS = 12
const FONTS = ['Inter', 'Arial', 'Calibri', 'Georgia', 'Times New Roman', 'Verdana', 'Tahoma', 'Courier New', 'JetBrains Mono', 'IBM Plex Sans']
const SIZES = [8, 9, 10, 11, 12, 14, 16, 18, 20, 24, 28, 36]

type Pos = { r: number; c: number }

function colLetter(index: number) {
  let n = index + 1
  let label = ''
  while (n > 0) {
    const rem = (n - 1) % 26
    label = String.fromCharCode(65 + rem) + label
    n = Math.floor((n - 1) / 26)
  }
  return label
}

function styleKey(r: number, c: number) {
  return `${r}:${c}`
}

function emptyRow(cols: number) {
  return Array.from({ length: cols }, () => '')
}

function padSheet(sheet: WorkbookSheet): WorkbookSheet {
  const width = Math.max(MIN_COLS, ...(sheet.rows || []).map((row) => row.length), 8)
  const rows = (sheet.rows || []).map((row) => {
    const next = (row || []).map((cell) => String(cell ?? ''))
    while (next.length < width) next.push('')
    return next.slice(0, 40)
  })
  while (rows.length < MIN_ROWS) rows.push(emptyRow(width))
  return { id: sheet.id || uid(), name: sheet.name || 'Sheet', rows, styles: sheet.styles || {} }
}

function headerStyles(count: number): Record<string, CellStyle> {
  const styles: Record<string, CellStyle> = {}
  for (let c = 0; c < count; c += 1) styles[styleKey(0, c)] = { bold: true, color: '#f8fafc' }
  return styles
}

function templateWorkbook(): { sheets: WorkbookSheet[]; activeId: string } {
  const make = (id: string, name: string, headers: string[]): WorkbookSheet =>
    padSheet({
      id,
      name,
      rows: [headers],
      styles: headerStyles(Math.max(headers.length, MIN_COLS)),
    })
  const sheets = [
    make('inventory', 'Inventory', [
      'Project',
      'Owner',
      'Repo',
      'Branch',
      'Stack',
      'Cloud',
      'Region',
      'Cluster',
      'Namespace',
      'Domain',
      'Env',
      'Status',
      'Last deploy',
      'Notes',
    ]),
    make('servers', 'Servers', ['Hostname', 'IP', 'OS', 'Role', 'Project', 'Env', 'Access', 'CPU/RAM', 'Status', 'Notes']),
    make('domains', 'Domains', ['Domain', 'Project', 'Env', 'TLS expiry', 'DNS', 'CDN', 'Status', 'Notes']),
    make('releases', 'Releases', [
      'Project',
      'Version',
      'Env',
      'Deployed at',
      'Git SHA',
      'Pipeline',
      'Result',
      'Notes',
    ]),
  ]
  return { sheets, activeId: sheets[0].id }
}

function loadLocal(): { sheets: WorkbookSheet[]; activeId: string } | null {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null')
    if (raw?.sheets?.length) {
      return {
        sheets: raw.sheets.map(padSheet),
        activeId: raw.activeId || raw.sheets[0].id,
      }
    }
  } catch {
    /* start clean */
  }
  return null
}

function toCsv(rows: string[][]) {
  return rows
    .filter((row) => row.some((cell) => String(cell).trim()))
    .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    .join('\n')
}

function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let quoted = false
  const source = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  for (let i = 0; i < source.length; i += 1) {
    const ch = source[i]
    if (quoted) {
      if (ch === '"' && source[i + 1] === '"') {
        cell += '"'
        i += 1
      } else if (ch === '"') quoted = false
      else cell += ch
      continue
    }
    if (ch === '"') quoted = true
    else if (ch === ',') {
      row.push(cell)
      cell = ''
    } else if (ch === '\n') {
      row.push(cell)
      rows.push(row)
      row = []
      cell = ''
    } else cell += ch
  }
  if (cell.length || row.length) {
    row.push(cell)
    rows.push(row)
  }
  return rows.filter((item) => item.some((value) => value.trim()))
}

function escapeHtml(value: string) {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function inRange(pos: Pos, a: Pos, b: Pos) {
  const r1 = Math.min(a.r, b.r)
  const r2 = Math.max(a.r, b.r)
  const c1 = Math.min(a.c, b.c)
  const c2 = Math.max(a.c, b.c)
  return pos.r >= r1 && pos.r <= r2 && pos.c >= c1 && pos.c <= c2
}

function mergeStyle(current: CellStyle | undefined, patch: CellStyle) {
  const next: CellStyle = { ...current }
  for (const [key, value] of Object.entries(patch) as Array<[keyof CellStyle, CellStyle[keyof CellStyle]]>) {
    if (value === false || value === '' || value == null) delete next[key]
    else (next as Record<string, unknown>)[key] = value
  }
  return Object.keys(next).length ? next : undefined
}

function cellCss(style: CellStyle | undefined, header = false): CSSProperties {
  const size = style?.size || 13
  return {
    fontWeight: style?.bold || header ? 700 : 400,
    fontStyle: style?.italic ? 'italic' : 'normal',
    textDecoration: style?.underline ? 'underline' : 'none',
    fontFamily: style?.font || 'Inter, Arial, sans-serif',
    fontSize: `${size}px`,
    color: style?.color || (header ? '#f8fafc' : undefined),
    background: style?.bg || undefined,
    textAlign: style?.align || 'left',
    minHeight: `${Math.max(28, size + 12)}px`,
    height: `${Math.max(28, size + 12)}px`,
    lineHeight: `${Math.max(28, size + 12)}px`,
  }
}

function styleToCss(style: CellStyle | undefined, header = false) {
  const css = cellCss(style, header)
  return Object.entries(css)
    .filter(([, value]) => value != null && value !== '')
    .map(([key, value]) => `${key.replace(/[A-Z]/g, (ch) => `-${ch.toLowerCase()}`)}:${value}`)
    .join(';')
}

export function ProjectInventory() {
  const { pushToast, can, profile } = useApp()
  const canEdit = can('projects.view') && profile.role !== 'Viewer'
  const fileRef = useRef<HTMLInputElement>(null)
  const gridRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const formulaRef = useRef<HTMLInputElement>(null)
  const readyRef = useRef(false)
  const skipSave = useRef(true)
  const saveTimer = useRef(0)
  const sheetsRef = useRef<WorkbookSheet[]>([])
  const [sheets, setSheets] = useState<WorkbookSheet[]>([])
  const [activeId, setActiveId] = useState('inventory')
  const [saveState, setSaveState] = useState('Loading…')
  const [sel, setSel] = useState<Pos>({ r: 1, c: 0 })
  const [anchor, setAnchor] = useState<Pos>({ r: 1, c: 0 })
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const [renameId, setRenameId] = useState<string | null>(null)
  const draftRef = useRef('')
  const activeIdRef = useRef(activeId)

  sheetsRef.current = sheets
  activeIdRef.current = activeId
  const sheet = sheets.find((item) => item.id === activeId) || sheets[0]
  const rows = sheet?.rows || []
  const cols = rows[0]?.length || MIN_COLS
  const cellValue = rows[sel.r]?.[sel.c] || ''
  const currentStyle = sheet?.styles?.[styleKey(sel.r, sel.c)] || {}
  const address = `${colLetter(sel.c)}${sel.r + 1}`

  const usedRows = useMemo(
    () => rows.filter((row, index) => index > 0 && row.some((cell) => String(cell).trim())).length,
    [rows],
  )

  const mutateSheet = useCallback(
    (updater: (current: WorkbookSheet) => WorkbookSheet) => {
      if (!canEdit) return
      const id = activeIdRef.current
      const next = sheetsRef.current.map((item) => (item.id === id ? padSheet(updater(item)) : item))
      sheetsRef.current = next
      setSheets(next)
    },
    [canEdit],
  )

  const setCell = useCallback(
    (r: number, c: number, value: string) => {
      mutateSheet((current) => {
        const next = current.rows.map((row) => row.slice())
        while (next.length <= r) next.push(emptyRow(next[0]?.length || MIN_COLS))
        while (next[r].length <= c) next.forEach((row) => row.push(''))
        next[r][c] = value
        return { ...current, rows: next }
      })
    },
    [mutateSheet],
  )

  const applyStyle = useCallback(
    (patch: CellStyle, toggle?: keyof CellStyle) => {
      if (!canEdit) return
      mutateSheet((current) => {
        const styles = { ...(current.styles || {}) }
        const r1 = Math.min(anchor.r, sel.r)
        const r2 = Math.max(anchor.r, sel.r)
        const c1 = Math.min(anchor.c, sel.c)
        const c2 = Math.max(anchor.c, sel.c)
        let turnOn = true
        if (toggle) {
          const keys = []
          for (let r = r1; r <= r2; r += 1) {
            for (let c = c1; c <= c2; c += 1) keys.push(styleKey(r, c))
          }
          turnOn = keys.some((key) => !styles[key]?.[toggle])
        }
        for (let r = r1; r <= r2; r += 1) {
          for (let c = c1; c <= c2; c += 1) {
            const key = styleKey(r, c)
            const nextPatch = toggle ? { [toggle]: turnOn } : patch
            const merged = mergeStyle(styles[key], nextPatch as CellStyle)
            if (merged) styles[key] = merged
            else delete styles[key]
          }
        }
        return { ...current, styles }
      })
    },
    [anchor.c, anchor.r, canEdit, mutateSheet, sel.c, sel.r],
  )

  const commitEdit = useCallback(() => {
    if (!editing) return
    setCell(sel.r, sel.c, draftRef.current)
    setEditing(false)
  }, [editing, sel.c, sel.r, setCell])

  const liveCell = useCallback(
    (r = sel.r, c = sel.c) =>
      sheetsRef.current.find((item) => item.id === activeIdRef.current)?.rows[r]?.[c] || '',
    [sel.c, sel.r],
  )

  const startEdit = useCallback(
    (value?: string, fromFormula = false) => {
      if (!canEdit) return
      setDraft(value ?? liveCell())
      draftRef.current = value ?? liveCell()
      setEditing(true)
      window.requestAnimationFrame(() => {
        const target = fromFormula ? formulaRef.current : inputRef.current
        target?.focus()
        if (value == null) target?.select()
        else {
          const end = value.length
          target?.setSelectionRange(end, end)
        }
      })
    },
    [canEdit, liveCell],
  )

  const flushSave = useCallback(async () => {
    if (!readyRef.current || skipSave.current || !canEdit) return
    const payload = { sheets: sheetsRef.current, activeId }
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload))
      await saveWorkbook(payload)
      setSaveState('Saved')
    } catch (error) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload))
      setSaveState(error instanceof Error ? error.message : 'Save failed')
    }
  }, [activeId, canEdit])

  useEffect(() => {
    let alive = true
    const boot = async () => {
      try {
        const data = await fetchWorkbook()
        if (!alive) return
        const next = data.workbook.sheets.map(padSheet)
        setSheets(next)
        setActiveId(data.workbook.activeId || next[0]?.id || 'inventory')
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ sheets: next, activeId: data.workbook.activeId }))
        setSaveState('Autosave on')
      } catch {
        if (!alive) return
        const local = loadLocal() || templateWorkbook()
        setSheets(local.sheets)
        setActiveId(local.activeId)
        setSaveState('Saved locally')
      } finally {
        if (!alive) return
        readyRef.current = true
        skipSave.current = false
      }
    }
    void boot()
    return () => {
      alive = false
    }
  }, [])

  useEffect(() => {
    if (!readyRef.current || skipSave.current || !canEdit) return
    setSaveState('Saving…')
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ sheets, activeId }))
    window.clearTimeout(saveTimer.current)
    saveTimer.current = window.setTimeout(() => {
      void flushSave()
    }, 500)
    return () => window.clearTimeout(saveTimer.current)
  }, [activeId, canEdit, flushSave, sheets])

  useEffect(() => {
    const onHide = () => {
      void flushSave()
    }
    window.addEventListener('beforeunload', onHide)
    document.addEventListener('visibilitychange', onHide)
    return () => {
      window.removeEventListener('beforeunload', onHide)
      document.removeEventListener('visibilitychange', onHide)
    }
  }, [flushSave])

  const moveSel = (r: number, c: number, extend = false) => {
    if (!sheet) return
    const next = {
      r: Math.max(0, Math.min(rows.length - 1, r)),
      c: Math.max(0, Math.min(cols - 1, c)),
    }
    setSel(next)
    if (!extend) setAnchor(next)
  }

  const clearRange = () => {
    if (!canEdit || !sheet) return
    mutateSheet((current) => {
      const next = current.rows.map((row) => row.slice())
      next.forEach((row, r) => {
        row.forEach((_, c) => {
          if (inRange({ r, c }, anchor, sel)) next[r][c] = ''
        })
      })
      return { ...current, rows: next }
    })
  }

  const copyRange = async () => {
    if (!sheet) return
    const r1 = Math.min(anchor.r, sel.r)
    const r2 = Math.max(anchor.r, sel.r)
    const c1 = Math.min(anchor.c, sel.c)
    const c2 = Math.max(anchor.c, sel.c)
    const text = rows
      .slice(r1, r2 + 1)
      .map((row) => row.slice(c1, c2 + 1).join('\t'))
      .join('\n')
    await navigator.clipboard.writeText(text)
    pushToast('Copied')
  }

  const pasteAt = (text: string) => {
    if (!canEdit || !sheet) return
    const block = text.includes('\t')
      ? text.replace(/\r/g, '').split('\n').map((line) => line.split('\t'))
      : parseCsv(text)
    if (!block.length) return
    mutateSheet((current) => {
      const next = current.rows.map((row) => row.slice())
      block.forEach((line, ri) => {
        line.forEach((value, ci) => {
          const r = sel.r + ri
          const c = sel.c + ci
          while (next.length <= r) next.push(emptyRow(next[0].length))
          while (next[r].length <= c) next.forEach((row) => row.push(''))
          next[r][c] = value
        })
      })
      return { ...current, rows: next }
    })
  }

  const onGridKey = (event: KeyboardEvent) => {
    if (renameId) return
    if (event.ctrlKey || event.metaKey) {
      const key = event.key.toLowerCase()
      if (key === 'b') {
        event.preventDefault()
        applyStyle({ bold: true }, 'bold')
        return
      }
      if (key === 'i') {
        event.preventDefault()
        applyStyle({ italic: true }, 'italic')
        return
      }
      if (key === 'u') {
        event.preventDefault()
        applyStyle({ underline: true }, 'underline')
        return
      }
      if (key === 'c' && !editing) {
        event.preventDefault()
        void copyRange()
        return
      }
    }
    if (editing) {
      if (event.key === 'Enter') {
        event.preventDefault()
        commitEdit()
        moveSel(sel.r + 1, sel.c)
      } else if (event.key === 'Tab') {
        event.preventDefault()
        commitEdit()
        moveSel(sel.r, sel.c + (event.shiftKey ? -1 : 1))
      } else if (event.key === 'Escape') {
        event.preventDefault()
        setEditing(false)
        setDraft(cellValue)
        draftRef.current = cellValue
      }
      return
    }
    if (event.key === 'Enter' || event.key === 'F2') {
      event.preventDefault()
      startEdit()
      return
    }
    if (event.key === 'Tab') {
      event.preventDefault()
      moveSel(sel.r, sel.c + (event.shiftKey ? -1 : 1))
      return
    }
    if (event.key === 'Delete' || event.key === 'Backspace') {
      event.preventDefault()
      clearRange()
      return
    }
    if (event.key.startsWith('Arrow')) {
      event.preventDefault()
      const extend = event.shiftKey
      if (event.key === 'ArrowUp') moveSel(sel.r - 1, sel.c, extend)
      if (event.key === 'ArrowDown') moveSel(sel.r + 1, sel.c, extend)
      if (event.key === 'ArrowLeft') moveSel(sel.r, sel.c - 1, extend)
      if (event.key === 'ArrowRight') moveSel(sel.r, sel.c + 1, extend)
      return
    }
    if (event.key.length === 1 && !event.altKey && !event.ctrlKey && !event.metaKey) {
      event.preventDefault()
      startEdit(event.key)
    }
  }

  const exportCsv = () => {
    if (!sheet) return
    const blob = new Blob([toCsv(sheet.rows)], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `${sheet.name.toLowerCase().replace(/\s+/g, '-')}.csv`
    document.body.appendChild(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(url)
    pushToast(`${sheet.name} exported`)
  }

  const exportPdf = () => {
    const win = window.open('', '_blank')
    if (!win) {
      pushToast('Allow popups to export PDF', 'warning')
      return
    }
    const pages = sheets
      .map((item, index) => {
        const used = item.rows.filter((row) => row.some((cell) => String(cell).trim()))
        const width = Math.max(...used.map((row) => row.length), 1)
        const body = used
          .map(
            (row, r) =>
              `<tr>${Array.from({ length: width }, (_, c) => {
                const tag = r === 0 ? 'th' : 'td'
                const style = styleToCss(item.styles?.[styleKey(r, c)], r === 0)
                return `<${tag} style="${style}">${escapeHtml(row[c] || '')}</${tag}>`
              }).join('')}</tr>`,
          )
          .join('')
        return `<section class="${index ? 'break' : ''}"><h2>${escapeHtml(item.name)}</h2><table>${body}</table></section>`
      })
      .join('')
    win.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>Project workbook</title>
      <style>
        body{font-family:Inter,Arial,sans-serif;color:#111;padding:24px}
        h2{margin:0 0 12px}
        table{border-collapse:collapse;width:100%;font-size:12px}
        th,td{border:1px solid #ccc;padding:6px 8px}
        th{background:#0f3d4c;color:#fff}
        .break{page-break-before:always}
      </style></head><body>${pages}</body></html>`)
    win.document.close()
    win.focus()
    win.print()
  }

  const importCsv = async (file: File) => {
    const text = await file.text()
    const parsed = parseCsv(text)
    if (!parsed.length || !sheet) {
      pushToast('CSV is empty', 'warning')
      return
    }
    const headerMatch = parsed[0].every(
      (cell, index) => (sheet.rows[0]?.[index] || '').trim().toLowerCase() === cell.trim().toLowerCase(),
    )
    const dataRows = headerMatch ? parsed.slice(1) : parsed
    mutateSheet((current) => {
      const width = Math.max(current.rows[0].length, ...parsed.map((row) => row.length), MIN_COLS)
      const header = headerMatch ? current.rows[0].slice() : parsed[0].slice()
      while (header.length < width) header.push('')
      const nextRows = [
        header,
        ...dataRows.map((row) => {
          const line = row.slice()
          while (line.length < width) line.push('')
          return line
        }),
      ]
      return { ...current, rows: nextRows, styles: headerMatch ? current.styles : headerStyles(width) }
    })
    pushToast(`Imported ${dataRows.length} rows into ${sheet.name}`)
  }

  const addRows = () => {
    mutateSheet((current) => ({
      ...current,
      rows: [...current.rows, ...Array.from({ length: 20 }, () => emptyRow(current.rows[0].length))],
    }))
  }

  const addColumn = () => {
    mutateSheet((current) => ({
      ...current,
      rows: current.rows.map((row) => [...row, '']),
    }))
  }

  const addSheet = () => {
    if (!canEdit) return
    const next = padSheet({
      id: uid(),
      name: `Sheet${sheets.length + 1}`,
      rows: [['Name', 'Owner', 'Notes']],
      styles: headerStyles(MIN_COLS),
    })
    setSheets((current) => [...current, next])
    setActiveId(next.id)
    setSel({ r: 1, c: 0 })
    setAnchor({ r: 1, c: 0 })
  }

  const resetWorkbook = () => {
    if (!window.confirm('Clear this workbook and restore empty DevOps sheets?')) return
    const next = templateWorkbook()
    sheetsRef.current = next.sheets
    setSheets(next.sheets)
    setActiveId(next.activeId)
    setSel({ r: 1, c: 0 })
    setAnchor({ r: 1, c: 0 })
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
    pushToast('Workbook reset')
  }

  if (!sheet) {
    return (
      <div className="sheet-page">
        <p className="text-muted p-4">Loading workbook…</p>
      </div>
    )
  }

  return (
    <div className="sheet-page">
      <div className="sheet-hero">
        <div>
          <p className="page-kicker">Project register</p>
          <h2>My Projects</h2>
        </div>
        <span className="sheet-save">{saveState}</span>
      </div>
      <div className="sheet-excel">
        <div className="sheet-toolbar">
          <input
            ref={fileRef}
            type="file"
            accept=".csv,text/csv"
            hidden
            onChange={(event) => {
              const file = event.target.files?.[0]
              if (file) void importCsv(file)
              event.target.value = ''
            }}
          />
          <div className="sheet-group">
            <select
              value={currentStyle.font || 'Inter'}
              disabled={!canEdit}
              onChange={(event) => applyStyle({ font: event.target.value })}
              title="Font"
            >
              {FONTS.map((font) => (
                <option key={font} value={font} style={{ fontFamily: font }}>
                  {font}
                </option>
              ))}
            </select>
            <select
              className="sheet-size"
              value={String(currentStyle.size || 13)}
              disabled={!canEdit}
              onChange={(event) => applyStyle({ size: Number(event.target.value) })}
              title="Font size"
            >
              {!SIZES.includes(currentStyle.size || 13) ? (
                <option value={currentStyle.size || 13}>{currentStyle.size || 13}</option>
              ) : null}
              {SIZES.map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
          </div>
          <div className="sheet-group">
            <button
              type="button"
              className={`sheet-fmt ${currentStyle.bold ? 'active' : ''}`}
              disabled={!canEdit}
              onClick={() => applyStyle({ bold: true }, 'bold')}
              title="Bold (Ctrl+B)"
            >
              <b>B</b>
            </button>
            <button
              type="button"
              className={`sheet-fmt ${currentStyle.italic ? 'active' : ''}`}
              disabled={!canEdit}
              onClick={() => applyStyle({ italic: true }, 'italic')}
              title="Italic (Ctrl+I)"
            >
              <i>I</i>
            </button>
            <button
              type="button"
              className={`sheet-fmt ${currentStyle.underline ? 'active' : ''}`}
              disabled={!canEdit}
              onClick={() => applyStyle({ underline: true }, 'underline')}
              title="Underline (Ctrl+U)"
            >
              <u>U</u>
            </button>
          </div>
          <div className="sheet-group">
            <label className="sheet-color" title="Text color">
              <span>A</span>
              <em style={{ background: currentStyle.color || '#0f172a' }} />
              <input
                type="color"
                value={currentStyle.color || '#0f172a'}
                disabled={!canEdit}
                onChange={(event) => applyStyle({ color: event.target.value })}
              />
            </label>
            <label className="sheet-color" title="Fill color">
              <span>■</span>
              <em style={{ background: currentStyle.bg || '#cbd5e1' }} />
              <input
                type="color"
                value={currentStyle.bg || '#ffffff'}
                disabled={!canEdit}
                onChange={(event) => applyStyle({ bg: event.target.value })}
              />
            </label>
          </div>
          <div className="sheet-group">
            <button
              type="button"
              className={`sheet-fmt ${currentStyle.align === 'left' || !currentStyle.align ? 'active' : ''}`}
              disabled={!canEdit}
              onClick={() => applyStyle({ align: 'left' })}
              title="Align left"
            >
              L
            </button>
            <button
              type="button"
              className={`sheet-fmt ${currentStyle.align === 'center' ? 'active' : ''}`}
              disabled={!canEdit}
              onClick={() => applyStyle({ align: 'center' })}
              title="Align center"
            >
              C
            </button>
            <button
              type="button"
              className={`sheet-fmt ${currentStyle.align === 'right' ? 'active' : ''}`}
              disabled={!canEdit}
              onClick={() => applyStyle({ align: 'right' })}
              title="Align right"
            >
              R
            </button>
          </div>
          <div className="sheet-group sheet-group-actions">
            <button type="button" className="sheet-tool" onClick={() => fileRef.current?.click()} disabled={!canEdit}>
              Import
            </button>
            <button type="button" className="sheet-tool" onClick={exportCsv}>
              CSV
            </button>
            <button type="button" className="sheet-tool" onClick={exportPdf}>
              PDF
            </button>
            <button type="button" className="sheet-tool" onClick={addRows} disabled={!canEdit}>
              + Rows
            </button>
            <button type="button" className="sheet-tool" onClick={addColumn} disabled={!canEdit}>
              + Col
            </button>
            <button type="button" className="sheet-tool" onClick={resetWorkbook} disabled={!canEdit}>
              Reset
            </button>
          </div>
        </div>
        <div className="sheet-formula">
          <span>{address}</span>
          <input
            ref={formulaRef}
            value={editing ? draft : cellValue}
            readOnly={!canEdit}
            onFocus={() => {
              if (!editing) startEdit(undefined, true)
            }}
            onChange={(event) => {
              draftRef.current = event.target.value
              setDraft(event.target.value)
              if (!editing) setEditing(true)
            }}
            onBlur={commitEdit}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault()
                commitEdit()
                gridRef.current?.focus()
                moveSel(sel.r + 1, sel.c)
              }
            }}
          />
        </div>
        <div
          className="sheet-grid-wrap"
          ref={gridRef}
          tabIndex={0}
          onKeyDown={onGridKey}
          onPaste={(event) => {
            if (!canEdit || editing) return
            event.preventDefault()
            pasteAt(event.clipboardData.getData('text/plain'))
          }}
        >
          <table className="sheet-grid">
            <thead>
              <tr>
                <th className="sheet-corner" />
                {Array.from({ length: cols }, (_, c) => (
                  <th key={c}>{colLetter(c)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, r) => (
                <tr key={r} className={r === 0 ? 'sheet-head-row' : undefined}>
                  <th>{r + 1}</th>
                  {row.map((value, c) => {
                    const active = sel.r === r && sel.c === c
                    const ranged = inRange({ r, c }, anchor, sel)
                    const style = sheet.styles?.[styleKey(r, c)]
                    const css = cellCss(style, r === 0)
                    return (
                      <td
                        key={c}
                        className={`${active ? 'active' : ''} ${ranged ? 'ranged' : ''} ${r === 0 ? 'bold' : ''}`}
                        style={{ background: style?.bg || (r === 0 ? '#0f3d4c' : undefined) }}
                        onMouseDown={(event) => {
                          if (editing) commitEdit()
                          const next = { r, c }
                          setSel(next)
                          if (!event.shiftKey) setAnchor(next)
                          gridRef.current?.focus()
                        }}
                        onDoubleClick={() => startEdit()}
                      >
                        {editing && active ? (
                          <input
                            ref={inputRef}
                            value={draft}
                            style={css}
                            onChange={(event) => {
                              draftRef.current = event.target.value
                              setDraft(event.target.value)
                            }}
                            onBlur={commitEdit}
                            onKeyDown={onGridKey}
                          />
                        ) : (
                          <span style={css}>{value}</span>
                        )}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="sheet-tabs">
          {sheets.map((item) => (
            <div key={item.id} className={`sheet-tab ${item.id === activeId ? 'active' : ''}`}>
              {renameId === item.id ? (
                <input
                  autoFocus
                  defaultValue={item.name}
                  onBlur={(event) => {
                    const name = event.target.value.trim() || item.name
                    setSheets((current) => current.map((sheetItem) => (sheetItem.id === item.id ? { ...sheetItem, name } : sheetItem)))
                    setRenameId(null)
                  }}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') (event.target as HTMLInputElement).blur()
                    if (event.key === 'Escape') setRenameId(null)
                  }}
                />
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    commitEdit()
                    setActiveId(item.id)
                    setSel({ r: 1, c: 0 })
                    setAnchor({ r: 1, c: 0 })
                  }}
                  onDoubleClick={() => canEdit && setRenameId(item.id)}
                >
                  {item.name}
                </button>
              )}
              {canEdit && sheets.length > 1 ? (
                <button
                  type="button"
                  className="sheet-tab-x"
                  onClick={() => {
                    const next = sheets.filter((sheetItem) => sheetItem.id !== item.id)
                    setSheets(next)
                    if (activeId === item.id) setActiveId(next[0].id)
                  }}
                >
                  ×
                </button>
              ) : null}
            </div>
          ))}
          <button type="button" className="sheet-add" onClick={addSheet} disabled={!canEdit} title="Add sheet">
            +
          </button>
          <span className="sheet-save">{usedRows} filled rows</span>
        </div>
      </div>
    </div>
  )
}
