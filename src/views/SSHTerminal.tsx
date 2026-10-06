'use client'

import { useMemo, useState } from 'react'
import { Terminal } from '../components/Terminal'
import { StatusBadge } from '../components/StatusBadge'
import { useApp } from '../context/AppContext'

function mockOutput(command: string, serverName: string, username: string): string[] {
  const cmd = command.trim()
  if (cmd === 'help') {
    return ['Available mock commands: ls, pwd, whoami, uname -a, df -h, docker ps, kubectl get pods, clear']
  }
  if (cmd === 'ls') {
    return ['apps  configs  logs  scripts  .bashrc']
  }
  if (cmd === 'pwd') {
    return [`/home/${username}`]
  }
  if (cmd === 'whoami') {
    return [username]
  }
  if (cmd === 'uname -a') {
    return [`Linux ${serverName} 6.8.0-esp #1 SMP x86_64 GNU/Linux`]
  }
  if (cmd === 'df -h') {
    return ['Filesystem      Size  Used Avail Use%', '/dev/nvme0n1p1  80G   41G   39G  51%']
  }
  if (cmd === 'docker ps') {
    return ['CONTAINER ID   IMAGE            STATUS', 'a91c3e8        esp/api:1.8      Up 4 hours']
  }
  if (cmd === 'kubectl get pods') {
    return ['NAME                 READY   STATUS', 'auth-service-7f2     2/2     Running', 'billing-6c1          1/1     Running']
  }
  return [`esp-mock: command not found: ${cmd}`]
}

export function SSHTerminal() {
  const { servers, pushToast } = useApp()
  const [serverId, setServerId] = useState(servers[0]?.id ?? '')
  const [connected, setConnected] = useState(false)
  const [connecting, setConnecting] = useState(false)
  const [command, setCommand] = useState('')
  const [lines, setLines] = useState<string[]>([
    'ESP DevOps Portal — mock SSH console',
    'Select a server and click Connect. No real SSH session is opened.',
  ])

  const server = useMemo(
    () => servers.find((item) => item.id === serverId) ?? servers[0],
    [serverId, servers],
  )

  if (!server) return <div className="panel p-4">No servers available.</div>

  const prompt = connected ? `${server.username}@${server.name}:~$ ` : 'guest@portal:~$ '

  const connect = () => {
    if (server.status === 'offline') {
      pushToast('Server is offline', 'error')
      return
    }
    setConnecting(true)
    window.setTimeout(() => {
      setConnecting(false)
      setConnected(true)
      setLines((current) => [
        ...current,
        `Connecting to ${server.ip}:${server.port}...`,
        `Authenticated as ${server.username}`,
        `Welcome to ${server.name} (mock session)`,
      ])
      pushToast(`Connected to ${server.name}`)
    }, 700)
  }

  const disconnect = () => {
    setConnected(false)
    setLines((current) => [...current, 'Connection closed.'])
    pushToast('Disconnected', 'info')
  }

  return (
    <div className="d-flex flex-column gap-3">
      <div className="panel p-3">
        <div className="row g-3 align-items-end">
          <div className="col-12 col-md-3">
            <label className="form-label">Server</label>
            <select
              className="form-select"
              value={server.id}
              onChange={(event) => {
                setServerId(event.target.value)
                setConnected(false)
              }}
            >
              {servers.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </div>
          <div className="col-6 col-md-2">
            <label className="form-label">IP address</label>
            <div>{server.ip}</div>
          </div>
          <div className="col-6 col-md-2">
            <label className="form-label">Username</label>
            <div>{server.username}</div>
          </div>
          <div className="col-6 col-md-1">
            <label className="form-label">Port</label>
            <div>{server.port}</div>
          </div>
          <div className="col-6 col-md-2">
            <label className="form-label">Status</label>
            <div>
              <StatusBadge status={connected ? 'online' : server.status} />
            </div>
          </div>
          <div className="col-12 col-md-2 d-flex gap-2">
            <button type="button" className="btn btn-accent" disabled={connected || connecting} onClick={connect}>
              {connecting ? 'Connecting…' : 'Connect'}
            </button>
            <button type="button" className="btn btn-ghost" disabled={!connected} onClick={disconnect}>
              Disconnect
            </button>
          </div>
        </div>
      </div>

      <Terminal
        lines={lines}
        prompt={prompt}
        value={command}
        onChange={setCommand}
        disabled={!connected}
        onClear={() => setLines([])}
        onSubmit={(value) => {
          const next = [`${prompt}${value}`]
          if (value.trim() === 'clear') {
            setLines([])
            setCommand('')
            return
          }
          setLines((current) => [...current, ...next, ...mockOutput(value, server.name, server.username)])
          setCommand('')
        }}
      />
    </div>
  )
}
