'use client'

import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { fetchArchitecture, saveArchitecture, type ArchEdge, type ArchNode, type ArchNote, type ArchStroke, type ArchitectureBoard } from '../api/architecture'
import { useApp } from '../context/AppContext'

const STORAGE_KEY = 'esp-architecture-board'
const KINDS = [
  { id: 'box', label: 'Box', icon: 'bi-square', color: '#6366f1' },
  { id: 'user', label: 'User', icon: 'bi-person', color: '#38bdf8' },
  { id: 'web', label: 'Web app', icon: 'bi-window', color: '#818cf8' },
  { id: 'api', label: 'API', icon: 'bi-braces', color: '#22c55e' },
  { id: 'svc', label: 'Service', icon: 'bi-cpu', color: '#6366f1' },
  { id: 'db', label: 'Database', icon: 'bi-database', color: '#f43f5e' },
  { id: 'cache', label: 'Cache', icon: 'bi-lightning-charge', color: '#a78bfa' },
  { id: 'queue', label: 'Queue', icon: 'bi-list-nested', color: '#f59e0b' },
  { id: 'lb', label: 'Load balancer', icon: 'bi-diagram-3', color: '#22c55e' },
  { id: 'cdn', label: 'CDN', icon: 'bi-globe', color: '#38bdf8' },
  { id: 'fw', label: 'Firewall', icon: 'bi-shield-lock', color: '#f43f5e' },
  { id: 'cloud', label: 'Cloud', icon: 'bi-cloud', color: '#38bdf8' },
  { id: 'k8s', label: 'Kubernetes', icon: 'bi-hexagon', color: '#818cf8' },
  { id: 'store', label: 'Storage', icon: 'bi-archive', color: '#f59e0b' },
  { id: 'monitor', label: 'Monitor', icon: 'bi-graph-up', color: '#22c55e' },
] as const

type Tool = 'select' | 'pan' | 'pencil' | 'eraser' | 'box' | 'connect' | 'text'

const TOOLS: { id: Tool; icon: string; label: string; key: string }[] = [
  { id: 'select', icon: 'bi-cursor', label: 'Select', key: 'V' },
  { id: 'pan', icon: 'bi-arrows-move', label: 'Pan', key: 'H' },
  { id: 'box', icon: 'bi-square', label: 'Box', key: 'B' },
  { id: 'pencil', icon: 'bi-pencil', label: 'Pencil', key: 'P' },
  { id: 'eraser', icon: 'bi-eraser', label: 'Eraser', key: 'E' },
  { id: 'connect', icon: 'bi-share', label: 'Connect', key: 'C' },
  { id: 'text', icon: 'bi-type', label: 'Text', key: 'T' },
]

function uid() {
  return crypto.randomUUID()
}

function kindMeta(kind: string) {
  return KINDS.find((item) => item.id === kind) || KINDS[0]
}

function emptyBoard(): ArchitectureBoard {
  return { title: 'System architecture', nodes: [], edges: [], strokes: [], notes: [] }
}

function centerOf(node: ArchNode) {
  return { x: node.x + node.w / 2, y: node.y + node.h / 2 }
}

function cloneBoard(board: ArchitectureBoard): ArchitectureBoard {
  return JSON.parse(JSON.stringify(board)) as ArchitectureBoard
}

function hitNode(node: ArchNode, x: number, y: number) {
  return x >= node.x && x <= node.x + node.w && y >= node.y && y <= node.y + node.h
}

function nearStroke(stroke: ArchStroke, x: number, y: number) {
  return stroke.points.some((point) => Math.hypot(point.x - x, point.y - y) < 18)
}

export function ArchitectureStudio() {
  const { pushToast, profile } = useApp()
  const canEdit = profile.role !== 'Viewer'
  const canEditRef = useRef(canEdit)
  canEditRef.current = canEdit
  const stageRef = useRef<HTMLDivElement>(null)
  const boardRef = useRef<ArchitectureBoard>(emptyBoard())
  const saveTimer = useRef<number>(0)
  const undo = useRef<ArchitectureBoard[]>([])
  const redo = useRef<ArchitectureBoard[]>([])
  const clipboard = useRef<ArchitectureBoard>(emptyBoard())
  const [board, setBoard] = useState<ArchitectureBoard>(emptyBoard)
  const [tool, setTool] = useState<Tool>('select')
  const [selected, setSelected] = useState<string[]>([])
  const selectedRef = useRef<string[]>([])
  const [connectFrom, setConnectFrom] = useState('')
  const [saving, setSaving] = useState('')
  const [pan, setPan] = useState({ x: 48, y: 48 })
  const [draftBox, setDraftBox] = useState<{ x: number; y: number; w: number; h: number } | null>(null)
  const drag = useRef<{
    id: string
    ox: number
    oy: number
    px: number
    py: number
    mode: 'node' | 'pan' | 'pencil' | 'eraser' | 'box'
    start?: { x: number; y: number }
  } | null>(null)

  boardRef.current = board
  selectedRef.current = selected

  const applyLive = (next: ArchitectureBoard) => {
    boardRef.current = next
    setBoard(next)
  }

  const persist = useCallback(
    (next: ArchitectureBoard) => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
      if (!canEdit) return
      window.clearTimeout(saveTimer.current)
      setSaving('Saving…')
      saveTimer.current = window.setTimeout(() => {
        void saveArchitecture(next)
          .then(() => setSaving('Saved'))
          .catch(() => setSaving('Saved locally'))
      }, 400)
    },
    [canEdit],
  )

  const commit = useCallback(
    (next: ArchitectureBoard, recordUndo = true) => {
      if (recordUndo) {
        undo.current = [...undo.current.slice(-39), cloneBoard(boardRef.current)]
        redo.current = []
      }
      boardRef.current = next
      setBoard(next)
      persist(next)
    },
    [persist],
  )

  useEffect(() => {
    let cancelled = false
    const local = localStorage.getItem(STORAGE_KEY)
    if (local) {
      try {
        const parsed = JSON.parse(local) as ArchitectureBoard
        if (parsed?.nodes) {
          boardRef.current = parsed
          setBoard(parsed)
        }
      } catch {
        /* ignore */
      }
    }
    void fetchArchitecture()
      .then((data) => {
        if (cancelled) return
        if ((data.board.nodes?.length || 0) > 0 || !local) {
          boardRef.current = data.board
          setBoard(data.board)
        }
      })
      .catch(() => {
        if (!cancelled) setSaving('Local board')
      })
    return () => {
      cancelled = true
    }
  }, [])

  const pointOnStage = (event: ReactPointerEvent | PointerEvent) => {
    const box = stageRef.current?.getBoundingClientRect()
    return { x: event.clientX - (box?.left || 0) - pan.x, y: event.clientY - (box?.top || 0) - pan.y }
  }

  const addNode = (kind: string, at?: { x: number; y: number; w?: number; h?: number }) => {
    if (!canEdit) return
    const meta = kindMeta(kind)
    const node: ArchNode = {
      id: uid(),
      kind: meta.id,
      label: meta.label,
      x: at?.x ?? 80 + (boardRef.current.nodes.length % 5) * 180,
      y: at?.y ?? 80 + Math.floor(boardRef.current.nodes.length / 5) * 110,
      w: at?.w ?? (kind === 'box' ? 180 : 150),
      h: at?.h ?? (kind === 'box' ? 110 : 76),
      color: meta.color,
    }
    commit({ ...boardRef.current, nodes: [...boardRef.current.nodes, node] })
    setSelected([node.id])
    setTool('select')
  }

  const eraseAt = (x: number, y: number, recordUndo = true) => {
    const current = boardRef.current
    const node = current.nodes.find((item) => hitNode(item, x, y))
    const stroke = current.strokes.find((item) => nearStroke(item, x, y))
    const note = current.notes.find((item) => Math.hypot(item.x - x, item.y - y) < 24)
    if (!node && !stroke && !note) return
    commit(
      {
        ...current,
        nodes: node ? current.nodes.filter((item) => item.id !== node.id) : current.nodes,
        strokes: stroke ? current.strokes.filter((item) => item.id !== stroke.id) : current.strokes,
        notes: note ? current.notes.filter((item) => item.id !== note.id) : current.notes,
        edges: node ? current.edges.filter((item) => item.from !== node.id && item.to !== node.id) : current.edges,
      },
      recordUndo,
    )
    setSelected([])
  }

  const selectedNode = board.nodes.find((item) => selected.includes(item.id))
  const selectedNote = board.notes.find((item) => selected.includes(item.id))
  const selectedEdge = board.edges.find((item) => selected.includes(item.id))

  const copySelection = () => {
    const current = boardRef.current
    const ids = new Set(selectedRef.current)
    clipboard.current = {
      title: current.title,
      nodes: current.nodes.filter((item) => ids.has(item.id)),
      edges: current.edges.filter((item) => ids.has(item.from) && ids.has(item.to)),
      strokes: current.strokes.filter((item) => ids.has(item.id)),
      notes: current.notes.filter((item) => ids.has(item.id)),
    }
    if (clipboard.current.nodes.length || clipboard.current.strokes.length || clipboard.current.notes.length) {
      pushToast('Copied')
    }
  }

  const cutSelection = () => {
    copySelection()
    deleteSelection()
  }

  const pasteSelection = () => {
    if (!canEditRef.current) return
    const clip = clipboard.current
    if (!clip.nodes.length && !clip.strokes.length && !clip.notes.length) return
    const remap = new Map<string, string>()
    const nodes = clip.nodes.map((item) => {
      const id = uid()
      remap.set(item.id, id)
      return { ...item, id, x: item.x + 28, y: item.y + 28 }
    })
    const edges = clip.edges.map((item) => ({
      ...item,
      id: uid(),
      from: remap.get(item.from) || item.from,
      to: remap.get(item.to) || item.to,
    }))
    const strokes = clip.strokes.map((item) => ({
      ...item,
      id: uid(),
      points: item.points.map((point) => ({ x: point.x + 28, y: point.y + 28 })),
    }))
    const notes = clip.notes.map((item) => ({ ...item, id: uid(), x: item.x + 28, y: item.y + 28 }))
    commit({
      ...boardRef.current,
      nodes: [...boardRef.current.nodes, ...nodes],
      edges: [...boardRef.current.edges, ...edges],
      strokes: [...boardRef.current.strokes, ...strokes],
      notes: [...boardRef.current.notes, ...notes],
    })
    setSelected([...nodes, ...strokes, ...notes].map((item) => item.id))
    pushToast('Pasted')
  }

  const deleteSelection = () => {
    if (!canEditRef.current || !selectedRef.current.length) return
    const ids = new Set(selectedRef.current)
    commit({
      ...boardRef.current,
      nodes: boardRef.current.nodes.filter((item) => !ids.has(item.id)),
      edges: boardRef.current.edges.filter((item) => !ids.has(item.id) && !ids.has(item.from) && !ids.has(item.to)),
      strokes: boardRef.current.strokes.filter((item) => !ids.has(item.id)),
      notes: boardRef.current.notes.filter((item) => !ids.has(item.id)),
    })
    setSelected([])
  }

  const undoAction = () => {
    const prev = undo.current.pop()
    if (!prev) return
    redo.current.push(cloneBoard(boardRef.current))
    boardRef.current = prev
    setBoard(prev)
    persist(prev)
  }

  const redoAction = () => {
    const next = redo.current.pop()
    if (!next) return
    undo.current.push(cloneBoard(boardRef.current))
    boardRef.current = next
    setBoard(next)
    persist(next)
  }

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement
      const typing = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA'
      const meta = event.ctrlKey || event.metaKey
      if (meta && event.key.toLowerCase() === 'c' && !typing) {
        event.preventDefault()
        copySelection()
        return
      }
      if (meta && event.key.toLowerCase() === 'x' && !typing) {
        event.preventDefault()
        cutSelection()
        return
      }
      if (meta && event.key.toLowerCase() === 'v' && !typing) {
        event.preventDefault()
        pasteSelection()
        return
      }
      if (meta && event.key.toLowerCase() === 'z') {
        event.preventDefault()
        if (event.shiftKey) redoAction()
        else undoAction()
        return
      }
      if (meta && event.key.toLowerCase() === 'y') {
        event.preventDefault()
        redoAction()
        return
      }
      if (meta && event.key.toLowerCase() === 'a' && !typing) {
        event.preventDefault()
        setSelected(boardRef.current.nodes.map((item) => item.id))
        return
      }
      if (meta && event.key.toLowerCase() === 'd' && !typing) {
        event.preventDefault()
        copySelection()
        pasteSelection()
        return
      }
      if ((event.key === 'Delete' || event.key === 'Backspace') && !typing) {
        event.preventDefault()
        deleteSelection()
        return
      }
      if (event.key === 'Escape') {
        setSelected([])
        setConnectFrom('')
        setTool('select')
        return
      }
      if (typing) return
      const map: Record<string, Tool> = { v: 'select', h: 'pan', b: 'box', p: 'pencil', e: 'eraser', c: 'connect', t: 'text' }
      if (map[event.key.toLowerCase()]) setTool(map[event.key.toLowerCase()])
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const onPointerDown = (event: ReactPointerEvent) => {
    const target = event.target as HTMLElement
    const nodeId = target.closest('[data-node]')?.getAttribute('data-node') || ''
    const point = pointOnStage(event)
    stageRef.current?.setPointerCapture(event.pointerId)

    if (tool === 'pan' || event.button === 1) {
      drag.current = { id: '', ox: pan.x, oy: pan.y, px: event.clientX, py: event.clientY, mode: 'pan' }
      return
    }
    if (tool === 'text' && canEdit) {
      const note: ArchNote = { id: uid(), text: 'Label', x: point.x, y: point.y }
      commit({ ...boardRef.current, notes: [...boardRef.current.notes, note] })
      setSelected([note.id])
      setTool('select')
      return
    }
    if (tool === 'eraser' && canEdit) {
      eraseAt(point.x, point.y)
      drag.current = { id: '', ox: 0, oy: 0, px: 0, py: 0, mode: 'eraser' }
      return
    }
    if (tool === 'box' && canEdit) {
      drag.current = { id: '', ox: 0, oy: 0, px: 0, py: 0, mode: 'box', start: point }
      setDraftBox({ x: point.x, y: point.y, w: 0, h: 0 })
      return
    }
    if (tool === 'pencil' && canEdit) {
      const stroke: ArchStroke = { id: uid(), color: '#6366f1', points: [point] }
      drag.current = { id: stroke.id, ox: 0, oy: 0, px: 0, py: 0, mode: 'pencil' }
      applyLive({ ...boardRef.current, strokes: [...boardRef.current.strokes, stroke] })
      return
    }
    if (tool === 'connect' && nodeId && canEdit) {
      if (!connectFrom) {
        setConnectFrom(nodeId)
        return
      }
      if (connectFrom !== nodeId) {
        const edge: ArchEdge = { id: uid(), from: connectFrom, to: nodeId, label: '' }
        commit({ ...boardRef.current, edges: [...boardRef.current.edges, edge] })
      }
      setConnectFrom('')
      return
    }
    if (nodeId) {
      setSelected(event.shiftKey ? Array.from(new Set([...selected, nodeId])) : [nodeId])
      const node = board.nodes.find((item) => item.id === nodeId)
      if (node && canEdit && tool === 'select') {
        drag.current = { id: nodeId, ox: node.x, oy: node.y, px: event.clientX, py: event.clientY, mode: 'node' }
      }
      return
    }
    const noteId = target.closest('[data-note]')?.getAttribute('data-note') || ''
    if (noteId) {
      setSelected([noteId])
      return
    }
    setSelected([])
  }

  const onPointerMove = (event: ReactPointerEvent) => {
    if (!drag.current) return
    if (drag.current.mode === 'pan') {
      setPan({ x: drag.current.ox + event.clientX - drag.current.px, y: drag.current.oy + event.clientY - drag.current.py })
      return
    }
    const point = pointOnStage(event)
    if (drag.current.mode === 'eraser') {
      eraseAt(point.x, point.y, false)
      return
    }
    if (drag.current.mode === 'box' && drag.current.start) {
      const start = drag.current.start
      setDraftBox({
        x: Math.min(start.x, point.x),
        y: Math.min(start.y, point.y),
        w: Math.abs(point.x - start.x),
        h: Math.abs(point.y - start.y),
      })
      return
    }
    if (drag.current.mode === 'pencil') {
      const id = drag.current.id
      applyLive({
        ...boardRef.current,
        strokes: boardRef.current.strokes.map((stroke) => (stroke.id === id ? { ...stroke, points: [...stroke.points, point] } : stroke)),
      })
      return
    }
    if (drag.current.mode === 'node') {
      const id = drag.current.id
      const x = drag.current.ox + event.clientX - drag.current.px
      const y = drag.current.oy + event.clientY - drag.current.py
      applyLive({
        ...boardRef.current,
        nodes: boardRef.current.nodes.map((node) => (node.id === id ? { ...node, x, y } : node)),
      })
    }
  }

  const onPointerUp = () => {
    if (drag.current?.mode === 'box' && draftBox && draftBox.w > 24 && draftBox.h > 24) {
      addNode('box', draftBox)
    }
    if (drag.current?.mode === 'node' || drag.current?.mode === 'pencil') persist(boardRef.current)
    setDraftBox(null)
    drag.current = null
  }

  const exportHtml = () => {
    const svg = renderExportSvg(board)
    const html = `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"/><title>${escapeHtml(board.title)}</title>
<style>body{margin:0;font-family:IBM Plex Sans,system-ui,sans-serif;background:#f1f5f9;color:#0f172a}header{padding:24px 32px 8px}h1{margin:0 0 8px}.board{margin:16px;background:#fff;border:1px solid #e2e8f0;border-radius:16px;overflow:auto}</style>
</head><body><header><p>ESP Architecture</p><h1>${escapeHtml(board.title)}</h1><p>Exported ${new Date().toLocaleString()}</p></header><div class="board">${svg}</div></body></html>`
    const blob = new Blob([html], { type: 'text/html' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `${board.title.replace(/\s+/g, '-').toLowerCase() || 'architecture'}.html`
    link.click()
    URL.revokeObjectURL(url)
    pushToast('HTML design exported')
  }

  const edges = useMemo(
    () =>
      board.edges
        .map((edge) => {
          const from = board.nodes.find((item) => item.id === edge.from)
          const to = board.nodes.find((item) => item.id === edge.to)
          if (!from || !to) return null
          return { edge, from: centerOf(from), to: centerOf(to) }
        })
        .filter(Boolean) as { edge: ArchEdge; from: { x: number; y: number }; to: { x: number; y: number } }[],
    [board.edges, board.nodes],
  )

  return (
    <div className="arch-page">
      <aside className="arch-palette">
        <p className="page-kicker">TOOLS</p>
        <h2>Architecture</h2>
        <div className="arch-tools">
          {TOOLS.map((item) => (
            <button key={item.id} type="button" className={tool === item.id ? 'active' : ''} onClick={() => setTool(item.id)}>
              <i className={`bi ${item.icon}`} /> {item.label}
              <span className="arch-key">{item.key}</span>
            </button>
          ))}
        </div>
        <p className="page-kicker mt-3">COMPONENTS</p>
        <div className="arch-kinds">
          {KINDS.filter((item) => item.id !== 'box').map((item) => (
            <button key={item.id} type="button" disabled={!canEdit} onClick={() => addNode(item.id)}>
              <i className={`bi ${item.icon}`} style={{ color: item.color }} />
              {item.label}
            </button>
          ))}
        </div>
      </aside>

      <section className="arch-main">
        <div className="arch-toolbar">
          <input className="form-control" value={board.title} disabled={!canEdit} onChange={(event) => commit({ ...board, title: event.target.value })} />
          <span className="text-secondary small">{saving}</span>
          <button type="button" className="btn btn-ghost" disabled={!canEdit} onClick={undoAction}>Undo</button>
          <button type="button" className="btn btn-ghost" disabled={!canEdit} onClick={redoAction}>Redo</button>
          <button type="button" className="btn btn-ghost" disabled={!canEdit} onClick={copySelection}>Copy</button>
          <button type="button" className="btn btn-ghost" disabled={!canEdit} onClick={cutSelection}>Cut</button>
          <button type="button" className="btn btn-ghost" disabled={!canEdit} onClick={pasteSelection}>Paste</button>
          <button type="button" className="btn btn-ghost" disabled={!selected.length || !canEdit} onClick={deleteSelection}>Delete</button>
          <button type="button" className="btn btn-accent" onClick={exportHtml}>Export HTML</button>
        </div>
        <div
          className={`arch-stage tool-${tool}`}
          ref={stageRef}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerLeave={onPointerUp}
        >
          <div className="arch-canvas" style={{ transform: `translate(${pan.x}px, ${pan.y}px)` }}>
            <svg className="arch-svg" width="2400" height="1600">
              {edges.map(({ edge, from, to }) => (
                <g key={edge.id} onClick={() => setSelected([edge.id])}>
                  <line x1={from.x} y1={from.y} x2={to.x} y2={to.y} className={selected.includes(edge.id) ? 'arch-line active' : 'arch-line'} markerEnd="url(#arch-arrow)" />
                  {edge.label ? (
                    <text className="arch-edge-label" x={(from.x + to.x) / 2} y={(from.y + to.y) / 2 - 8}>
                      {edge.label}
                    </text>
                  ) : null}
                </g>
              ))}
              {board.strokes.map((stroke) => (
                <polyline
                  key={stroke.id}
                  points={stroke.points.map((point) => `${point.x},${point.y}`).join(' ')}
                  fill="none"
                  stroke={stroke.color}
                  strokeWidth="3"
                  strokeLinecap="round"
                  onClick={() => setSelected([stroke.id])}
                />
              ))}
              {draftBox ? <rect x={draftBox.x} y={draftBox.y} width={draftBox.w} height={draftBox.h} className="arch-draft" /> : null}
              <defs>
                <marker id="arch-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
                  <path d="M 0 0 L 10 5 L 0 10 z" fill="#6366f1" />
                </marker>
              </defs>
            </svg>
            {board.nodes.map((node) => {
              const meta = kindMeta(node.kind)
              return (
                <article
                  key={node.id}
                  data-node={node.id}
                  className={`arch-node ${selected.includes(node.id) ? 'is-selected' : ''} ${connectFrom === node.id ? 'is-connect' : ''}`}
                  style={{ left: node.x, top: node.y, width: node.w, height: node.h, borderColor: node.color }}
                >
                  <i className={`bi ${meta.icon}`} style={{ color: node.color }} />
                  <strong>{node.label}</strong>
                </article>
              )
            })}
            {board.notes.map((note) => (
              <div key={note.id} data-note={note.id} className={`arch-note ${selected.includes(note.id) ? 'is-selected' : ''}`} style={{ left: note.x, top: note.y }}>
                {note.text}
              </div>
            ))}
          </div>
        </div>
        <p className="arch-shortcuts">
          V select · B box · P pencil · E eraser · C connect · T text · Ctrl+C copy · Ctrl+X cut · Ctrl+V paste · Ctrl+Z undo · Del delete
        </p>
      </section>

      <aside className="arch-inspector">
        <p className="page-kicker">INSPECTOR</p>
        {selectedNode ? (
          <>
            <label className="form-label">Label</label>
            <input
              className="form-control mb-2"
              value={selectedNode.label}
              disabled={!canEdit}
              onChange={(event) =>
                commit({
                  ...boardRef.current,
                  nodes: boardRef.current.nodes.map((item) => (item.id === selectedNode.id ? { ...item, label: event.target.value } : item)),
                })
              }
            />
            <label className="form-label">Color</label>
            <input
              type="color"
              className="form-control form-control-color mb-2"
              value={selectedNode.color}
              disabled={!canEdit}
              onChange={(event) =>
                commit({
                  ...boardRef.current,
                  nodes: boardRef.current.nodes.map((item) => (item.id === selectedNode.id ? { ...item, color: event.target.value } : item)),
                })
              }
            />
          </>
        ) : selectedNote ? (
          <>
            <label className="form-label">Text</label>
            <textarea
              className="form-control mb-2"
              rows={3}
              value={selectedNote.text}
              disabled={!canEdit}
              onChange={(event) =>
                commit({
                  ...boardRef.current,
                  notes: boardRef.current.notes.map((item) => (item.id === selectedNote.id ? { ...item, text: event.target.value } : item)),
                })
              }
            />
          </>
        ) : selectedEdge ? (
          <>
            <label className="form-label">Arrow label</label>
            <input
              className="form-control mb-2"
              value={selectedEdge.label}
              disabled={!canEdit}
              onChange={(event) =>
                commit({
                  ...boardRef.current,
                  edges: boardRef.current.edges.map((item) => (item.id === selectedEdge.id ? { ...item, label: event.target.value } : item)),
                })
              }
            />
          </>
        ) : (
          <p className="text-secondary small mb-0">
            Draw boxes, sketch with pencil, erase, copy/cut/paste, and export HTML. Keyboard: V B P E C T, Ctrl+C / X / V, Del.
          </p>
        )}
      </aside>
    </div>
  )
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char] || char)
}

function renderExportSvg(board: ArchitectureBoard) {
  const nodes = board.nodes
    .map((node) => {
      const meta = kindMeta(node.kind)
      return `<g><rect x="${node.x}" y="${node.y}" width="${node.w}" height="${node.h}" rx="12" fill="#ffffff" stroke="${node.color}" stroke-width="2"/><text x="${node.x + 16}" y="${node.y + 28}" fill="#64748b" font-size="12">${escapeHtml(meta.label)}</text><text x="${node.x + 16}" y="${node.y + 48}" fill="#0f172a" font-size="15" font-weight="600">${escapeHtml(node.label)}</text></g>`
    })
    .join('')
  const edges = board.edges
    .map((edge) => {
      const from = board.nodes.find((item) => item.id === edge.from)
      const to = board.nodes.find((item) => item.id === edge.to)
      if (!from || !to) return ''
      const a = centerOf(from)
      const b = centerOf(to)
      return `<line x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}" stroke="#6366f1" stroke-width="2" marker-end="url(#e-arrow)"/>`
    })
    .join('')
  const strokes = board.strokes
    .map((stroke) => `<polyline fill="none" stroke="${stroke.color}" stroke-width="3" stroke-linecap="round" points="${stroke.points.map((p) => `${p.x},${p.y}`).join(' ')}"/>`)
    .join('')
  const notes = board.notes.map((note) => `<text x="${note.x}" y="${note.y}" fill="#0f172a" font-size="14">${escapeHtml(note.text)}</text>`).join('')
  return `<svg xmlns="http://www.w3.org/2000/svg" width="2400" height="1600" viewBox="0 0 2400 1600"><defs><marker id="e-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="#6366f1"/></marker></defs><rect width="2400" height="1600" fill="#ffffff"/>${edges}${strokes}${nodes}${notes}</svg>`
}
