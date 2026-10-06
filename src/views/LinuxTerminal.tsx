'use client'

import { FitAddon } from '@xterm/addon-fit'
import { Terminal } from '@xterm/xterm'
import '@xterm/xterm/css/xterm.css'
import { useCallback, useEffect, useRef, useState } from 'react'
import { fetchTerminalStatus, terminalSocketUrl, type TerminalStatus } from '../api/terminal'
import { useApp } from '../context/AppContext'

export function LinuxTerminal() {
  const { can, pushToast } = useApp()
  const allowed = can('ssh.connect')
  const hostRef = useRef<HTMLDivElement>(null)
  const termRef = useRef<Terminal | null>(null)
  const fitRef = useRef<FitAddon | null>(null)
  const socketRef = useRef<WebSocket | null>(null)
  const connectingRef = useRef(false)
  const toastRef = useRef(pushToast)
  const [status, setStatus] = useState<TerminalStatus | null>(null)
  const [connected, setConnected] = useState(false)

  toastRef.current = pushToast

  const disconnect = useCallback(() => {
    connectingRef.current = false
    const socket = socketRef.current
    socketRef.current = null
    if (socket && socket.readyState < WebSocket.CLOSING) socket.close()
    setConnected(false)
  }, [])

  const connect = useCallback(() => {
    if (!allowed || !termRef.current) return
    if (connectingRef.current) return
    const open = socketRef.current
    if (open && (open.readyState === WebSocket.OPEN || open.readyState === WebSocket.CONNECTING)) return
    connectingRef.current = true
    const term = termRef.current
    term.reset()
    term.write('Opening bash…\r\n')
    const socket = new WebSocket(terminalSocketUrl())
    socket.binaryType = 'arraybuffer'
    socketRef.current = socket
    socket.onopen = () => {
      connectingRef.current = false
      setConnected(true)
      fitRef.current?.fit()
      socket.send(JSON.stringify({ type: 'resize', cols: term.cols || 80, rows: term.rows || 24 }))
      term.focus()
    }
    socket.onmessage = (event) => {
      const payload =
        typeof event.data === 'string'
          ? event.data
          : new TextDecoder().decode(event.data as ArrayBuffer)
      termRef.current?.write(payload)
    }
    socket.onerror = () => {
      connectingRef.current = false
      termRef.current?.writeln('\r\nUnable to reach the terminal.')
      toastRef.current('Terminal connection failed', 'error')
    }
    socket.onclose = () => {
      connectingRef.current = false
      if (socketRef.current === socket) socketRef.current = null
      setConnected(false)
    }
  }, [allowed])

  const connectRef = useRef(connect)
  connectRef.current = connect
  const disconnectRef = useRef(disconnect)
  disconnectRef.current = disconnect

  useEffect(() => {
    if (!allowed) return undefined
    let cancelled = false
    void fetchTerminalStatus()
      .then((data) => {
        if (!cancelled) setStatus(data)
      })
      .catch((error: Error) => {
        if (!cancelled) {
          setStatus({
            ready: false,
            image: 'ubuntu:22.04',
            message: error.message,
          })
        }
      })
    return () => {
      cancelled = true
    }
  }, [allowed])

  useEffect(() => {
    if (!allowed || !hostRef.current) return undefined
    const term = new Terminal({
      cursorBlink: true,
      convertEol: true,
      disableStdin: false,
      scrollback: 4000,
      fontFamily: 'JetBrains Mono, ui-monospace, Consolas, monospace',
      fontSize: 14,
      theme: {
        background: '#070b14',
        foreground: '#d1fae5',
        cursor: '#22d3ee',
        selectionBackground: 'rgba(34, 211, 238, 0.28)',
      },
    })
    const addon = new FitAddon()
    term.loadAddon(addon)
    term.open(hostRef.current)
    termRef.current = term
    fitRef.current = addon
    addon.fit()
    const encoder = new TextEncoder()
    const dataSub = term.onData((value) => {
      const socket = socketRef.current
      if (socket?.readyState !== WebSocket.OPEN) return
      socket.send(encoder.encode(value))
    })
    const resizeSub = term.onResize(({ cols, rows }) => {
      const socket = socketRef.current
      if (socket?.readyState !== WebSocket.OPEN) return
      socket.send(JSON.stringify({ type: 'resize', cols, rows }))
    })
    const observer = new ResizeObserver(() => addon.fit())
    observer.observe(hostRef.current)
    const boot = window.setTimeout(() => connectRef.current(), 80)
    return () => {
      window.clearTimeout(boot)
      observer.disconnect()
      dataSub.dispose()
      resizeSub.dispose()
      disconnectRef.current()
      term.dispose()
      termRef.current = null
      fitRef.current = null
    }
  }, [allowed])

  if (!allowed) {
    return (
      <div className="term-page">
        <div className="panel p-4">
          <h2 className="page-title mb-1">Terminal</h2>
          <p className="mb-0">You do not have permission to use the Linux terminal.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="term-page">
      <div className="term-hero">
        <div>
          <h2>Terminal</h2>
          <p>{status?.message || 'Ubuntu 22.04 bash'}</p>
        </div>
        <div className="term-actions">
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => {
              disconnect()
              connectingRef.current = false
              window.setTimeout(() => connectRef.current(), 50)
            }}
          >
            {connected ? 'Reconnect' : 'Connect'}
          </button>
        </div>
      </div>
      <div className="term-board">
        <div className="term-board-bar">
          <span>bash · ubuntu 22.04</span>
          <span>{connected ? 'live' : 'connecting'}</span>
        </div>
        <div className="term-xterm" ref={hostRef} onClick={() => termRef.current?.focus()} />
      </div>
    </div>
  )
}
