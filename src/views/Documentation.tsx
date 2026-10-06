'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createDoc, deleteDocApi, fetchDocs, updateDocApi, type DocNote } from '../api/docs'
import { Pagination } from '../components/Pagination'
import { useApp } from '../context/AppContext'
import { usePaged } from '../hooks/usePaged'

const CHAR_LIMIT = 50000
const AUTOSAVE_KEY = 'esp-docs-autosave'
const FONTS = ['IBM Plex Sans', 'Inter', 'Georgia', 'JetBrains Mono']
const SIZES = ['12', '14', '16', '18', '20', '24']

function plainText(html: string) {
  const node = document.createElement('div')
  node.innerHTML = html
  return node.textContent || ''
}

function fileName(title: string, ext: string) {
  const base = (title || 'document').replace(/[<>:"/\\|?*]+/g, '').trim() || 'document'
  return `${base}.${ext}`
}

function formatStamp(value?: string) {
  if (!value) return ''
  return new Date(value).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  })
}

function formatListDate(value?: string) {
  if (!value) return ''
  return new Date(value).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })
}

function downloadFile(filename: string, content: string, type: string) {
  const blob = new Blob([content], { type })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

function crumbs(docs: DocNote[], folderId: string | null) {
  const path: DocNote[] = []
  let current = folderId
  const seen = new Set<string>()
  while (current && !seen.has(current)) {
    seen.add(current)
    const folder = docs.find((item) => item.id === current)
    if (!folder) break
    path.unshift(folder)
    current = folder.parentId || null
  }
  return path
}

function treeIds(docs: DocNote[], id: string) {
  const ids = new Set<string>([id])
  let grew = true
  while (grew) {
    grew = false
    for (const item of docs) {
      if (item.parentId && ids.has(item.parentId) && !ids.has(item.id)) {
        ids.add(item.id)
        grew = true
      }
    }
  }
  return ids
}

export function Documentation() {
  const { pushToast, can, preferences } = useApp()
  const canManage = can('docs.manage')
  const editorRef = useRef<HTMLDivElement>(null)
  const saveTimer = useRef(0)
  const savingLock = useRef(false)
  const [docs, setDocs] = useState<DocNote[]>([])
  const [folderId, setFolderId] = useState<string | null>(null)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [title, setTitle] = useState('')
  const [html, setHtml] = useState('')
  const [query, setQuery] = useState('')
  const [font, setFont] = useState('IBM Plex Sans')
  const [size, setSize] = useState('14')
  const [saving, setSaving] = useState(false)
  const [savedAt, setSavedAt] = useState('')
  const [dirty, setDirty] = useState(false)
  const [folderName, setFolderName] = useState('')
  const [namingFolder, setNamingFolder] = useState(false)
  const [autosave, setAutosave] = useState(() => localStorage.getItem(AUTOSAVE_KEY) !== 'off')
  const live = useRef({ title, html, activeId, font, size, autosave, canManage, folderId })
  live.current = { title, html, activeId, font, size, autosave, canManage, folderId }

  const chars = plainText(html).length
  const path = useMemo(() => crumbs(docs, folderId), [docs, folderId])
  const visible = useMemo(() => {
    const hay = query.trim().toLowerCase()
    const items = hay
      ? docs.filter((item) => `${item.title} ${item.preview}`.toLowerCase().includes(hay))
      : docs.filter((item) => (item.parentId || null) === folderId)
    return [...items].sort((left, right) => {
      if ((left.kind === 'folder') !== (right.kind === 'folder')) return left.kind === 'folder' ? -1 : 1
      return (left.title || '').localeCompare(right.title || '')
    })
  }, [docs, folderId, query])
  const paged = usePaged(visible, preferences.itemsPerPage)
  const activeFile = docs.find((item) => item.id === activeId && item.kind !== 'folder') || null

  const syncEditor = (nextHtml: string) => {
    if (editorRef.current && editorRef.current.innerHTML !== nextHtml) {
      editorRef.current.innerHTML = nextHtml || ''
    }
  }

  const loadEditor = useCallback((doc: DocNote | null) => {
    window.clearTimeout(saveTimer.current)
    if (!doc || doc.kind === 'folder') {
      setActiveId(null)
      setTitle('')
      setHtml('')
      setSavedAt('')
      setDirty(false)
      window.setTimeout(() => syncEditor(''), 0)
      return
    }
    setActiveId(doc.id)
    setTitle(doc.title || '')
    setHtml(doc.html || '')
    setFont(doc.font || 'IBM Plex Sans')
    setSize(doc.size || '14')
    setSavedAt(doc.updatedAt || '')
    setDirty(false)
    window.setTimeout(() => syncEditor(doc.html || ''), 0)
  }, [])

  useEffect(() => {
    let cancelled = false
    void fetchDocs()
      .then((data) => {
        if (cancelled) return
        setDocs(data.docs)
        const firstFile = data.docs.find((item) => item.kind !== 'folder' && !item.parentId)
        loadEditor(firstFile || null)
      })
      .catch((error) => {
        if (!cancelled) pushToast(error instanceof Error ? error.message : 'Unable to load documentation', 'error')
      })
    return () => {
      cancelled = true
      window.clearTimeout(saveTimer.current)
    }
  }, [loadEditor, pushToast])

  const persist = useCallback(async () => {
    const snap = live.current
    if (!snap.canManage || savingLock.current) return
    const nextHtml = editorRef.current?.innerHTML ?? snap.html
    const nextTitle = snap.title.trim() || 'Untitled'
    if (plainText(nextHtml).length > CHAR_LIMIT) {
      pushToast(`Keep the document under ${CHAR_LIMIT.toLocaleString()} characters`, 'warning')
      return
    }
    savingLock.current = true
    setSaving(true)
    try {
      if (!snap.activeId) {
        const data = await createDoc({
          title: nextTitle,
          html: nextHtml,
          font: snap.font,
          size: snap.size,
          kind: 'file',
          parentId: snap.folderId,
        })
        setDocs((current) => [data.doc, ...current.filter((item) => item.id !== data.doc.id)])
        setActiveId(data.doc.id)
        setSavedAt(data.doc.updatedAt || new Date().toISOString())
      } else {
        const data = await updateDocApi(snap.activeId, {
          title: nextTitle,
          html: nextHtml,
          font: snap.font,
          size: snap.size,
        })
        setDocs((current) => current.map((item) => (item.id === data.doc.id ? data.doc : item)))
        setSavedAt(data.doc.updatedAt || new Date().toISOString())
      }
      setHtml(nextHtml)
      setDirty(false)
    } catch (error) {
      pushToast(error instanceof Error ? error.message : 'Unable to save document', 'error')
    } finally {
      savingLock.current = false
      setSaving(false)
    }
  }, [pushToast])

  const markDirty = () => {
    setDirty(true)
    if (!live.current.autosave || !live.current.canManage) return
    window.clearTimeout(saveTimer.current)
    saveTimer.current = window.setTimeout(() => {
      void persist()
    }, 900)
  }

  const focusEditor = () => {
    editorRef.current?.focus()
    document.execCommand('styleWithCSS', false, 'true')
  }

  const applyCommand = (cmd: string, value?: string) => {
    focusEditor()
    document.execCommand(cmd, false, value)
    const nextHtml = editorRef.current?.innerHTML || ''
    setHtml(nextHtml)
    markDirty()
  }

  const applyFont = (next: string) => {
    setFont(next)
    applyCommand('fontName', next)
  }

  const applySize = (px: string) => {
    setSize(px)
    focusEditor()
    document.execCommand('styleWithCSS', false, 'true')
    document.execCommand('fontSize', false, '7')
    editorRef.current?.querySelectorAll('font[size="7"]').forEach((node) => {
      const span = document.createElement('span')
      span.style.fontSize = `${px}px`
      span.style.fontFamily = live.current.font
      span.innerHTML = node.innerHTML
      node.replaceWith(span)
    })
    editorRef.current?.querySelectorAll('span[style*="xxx-large"], span[style*="xx-large"]').forEach((node) => {
      ;(node as HTMLElement).style.fontSize = `${px}px`
    })
    const nextHtml = editorRef.current?.innerHTML || ''
    setHtml(nextHtml)
    markDirty()
  }

  const openFolder = (id: string | null) => {
    setFolderId(id)
    setQuery('')
    paged.setPage(1)
  }

  const createFile = async () => {
    if (!canManage) return
    window.clearTimeout(saveTimer.current)
    if (dirty && autosave) await persist()
    try {
      const data = await createDoc({
        title: 'Untitled',
        html: '',
        font,
        size,
        kind: 'file',
        parentId: folderId,
      })
      setDocs((current) => [data.doc, ...current])
      loadEditor(data.doc)
      paged.setPage(1)
    } catch (error) {
      pushToast(error instanceof Error ? error.message : 'Unable to create file', 'error')
    }
  }

  const createFolder = async () => {
    if (!canManage) return
    const name = folderName.trim()
    if (!name) {
      pushToast('Folder name is required', 'warning')
      return
    }
    try {
      const data = await createDoc({ title: name, kind: 'folder', parentId: folderId })
      setDocs((current) => [data.doc, ...current])
      setFolderName('')
      setNamingFolder(false)
      paged.setPage(1)
      pushToast('Folder created')
    } catch (error) {
      pushToast(error instanceof Error ? error.message : 'Unable to create folder', 'error')
    }
  }

  const removeDoc = async (id: string) => {
    const target = docs.find((item) => item.id === id)
    try {
      await deleteDocApi(id)
      const gone = treeIds(docs, id)
      const next = docs.filter((item) => !gone.has(item.id))
      setDocs(next)
      if (activeId && gone.has(activeId)) loadEditor(null)
      if (folderId && gone.has(folderId)) openFolder(target?.parentId || null)
      pushToast(target?.kind === 'folder' ? 'Folder deleted' : 'Document deleted', 'info')
    } catch (error) {
      pushToast(error instanceof Error ? error.message : 'Unable to delete', 'error')
    }
  }

  const currentHtml = () => editorRef.current?.innerHTML || html

  const exportWord = () => {
    const body = currentHtml()
    const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word">
      <head><meta charset="utf-8"><title>${title || 'Document'}</title></head>
      <body style="font-family:${font};font-size:${size}px"><h1>${title || 'Untitled'}</h1>${body}</body></html>`
    downloadFile(fileName(title, 'doc'), html, 'application/msword')
  }

  return (
    <div className="docs-page">
      <div className="docs-hero">
        <h2>Documentation</h2>
        <p>Create folders and files. Open a folder, then add files inside it. The list is paginated.</p>
      </div>

      <div className="docs-shell">
        <aside className="docs-side">
          <div className="docs-side-tools">
            <input
              className="docs-search"
              placeholder="Search"
              value={query}
              onChange={(event) => {
                setQuery(event.target.value)
                paged.setPage(1)
              }}
            />
          </div>
          {canManage ? (
            <div className="docs-side-actions">
              <button type="button" className="docs-new" onClick={() => void createFile()}>
                + File
              </button>
              <button type="button" className="docs-folder-btn" onClick={() => setNamingFolder(true)}>
                + Folder
              </button>
            </div>
          ) : null}
          <div className="docs-crumbs">
            <button type="button" className={!folderId ? 'active' : ''} onClick={() => openFolder(null)}>
              All
            </button>
            {path.map((item) => (
              <button
                type="button"
                key={item.id}
                className={item.id === folderId ? 'active' : ''}
                onClick={() => openFolder(item.id)}
              >
                {item.title}
              </button>
            ))}
            {canManage && folderId ? (
              <button type="button" className="docs-icon-btn" title="Delete this folder" onClick={() => void removeDoc(folderId)}>
                <i className="bi bi-trash" />
              </button>
            ) : null}
          </div>
          {namingFolder ? (
            <form
              className="docs-folder-form"
              onSubmit={(event) => {
                event.preventDefault()
                void createFolder()
              }}
            >
              <input
                autoFocus
                className="docs-search"
                placeholder="Folder name"
                value={folderName}
                onChange={(event) => setFolderName(event.target.value)}
              />
              <button type="submit" className="docs-new">
                Add
              </button>
              <button
                type="button"
                className="docs-folder-btn"
                onClick={() => {
                  setNamingFolder(false)
                  setFolderName('')
                }}
              >
                Cancel
              </button>
            </form>
          ) : null}
          <div className="docs-list">
            {paged.totalItems === 0 ? (
              <p className="docs-muted">{query ? 'No matches.' : folderId ? 'This folder is empty. Add a file or folder.' : 'No documents yet.'}</p>
            ) : (
              paged.rows.map((item) => (
                <button
                  type="button"
                  key={item.id}
                  className={`docs-item ${item.kind === 'folder' ? 'folder' : ''} ${item.id === activeId ? 'active' : ''}`}
                  onClick={() => {
                    if (item.kind === 'folder') {
                      openFolder(item.id)
                      return
                    }
                    if (item.parentId) setFolderId(item.parentId)
                    else if (!query) setFolderId(null)
                    if (dirty && autosave) void persist().then(() => loadEditor(item))
                    else loadEditor(item)
                  }}
                >
                  <strong>
                    <i className={`bi ${item.kind === 'folder' ? 'bi-folder-fill' : 'bi-file-earmark-text'}`} />
                    {item.title || 'Untitled'}
                  </strong>
                  <span>{item.kind === 'folder' ? 'Folder' : item.preview || 'Empty document'}</span>
                  <em>{formatListDate(item.updatedAt)}</em>
                </button>
              ))
            )}
          </div>
          <Pagination
            compact
            page={paged.page}
            totalPages={paged.totalPages}
            totalItems={paged.totalItems}
            pageSize={paged.pageSize}
            onPageChange={paged.setPage}
          />
        </aside>

        <section className="docs-main">
          {!activeFile ? (
            <div className="docs-empty-main">
              <i className="bi bi-folder2-open" />
              <p>Open a file, or create one in this folder.</p>
              {canManage ? (
                <button type="button" className="docs-new" onClick={() => void createFile()}>
                  + File
                </button>
              ) : null}
            </div>
          ) : (
            <>
              <div className="docs-titlebar">
                <input
                  className="docs-title"
                  placeholder="Document title"
                  value={title}
                  disabled={!canManage}
                  onChange={(event) => {
                    setTitle(event.target.value)
                    markDirty()
                  }}
                />
                <div className="docs-title-actions">
                  <label className="docs-autosave-toggle">
                    <input
                      type="checkbox"
                      checked={autosave}
                      onChange={(event) => {
                        const on = event.target.checked
                        setAutosave(on)
                        localStorage.setItem(AUTOSAVE_KEY, on ? 'on' : 'off')
                        if (on && dirty) void persist()
                      }}
                    />
                    Autosave
                  </label>
                  {canManage ? (
                    <button type="button" className="docs-save" disabled={saving} onClick={() => void persist()}>
                      {saving ? 'Saving' : dirty ? 'Save' : 'Saved'}
                    </button>
                  ) : null}
                  <button type="button" className="docs-tool-btn" onClick={exportWord}>
                    Word
                  </button>
                  {canManage && activeId ? (
                    <button type="button" className="docs-icon-btn" title="Delete" onClick={() => void removeDoc(activeId)}>
                      <i className="bi bi-trash" />
                    </button>
                  ) : null}
                  <span className="docs-autosave">
                    {saving ? 'Saving…' : savedAt ? `Autosaved ${formatStamp(savedAt)}` : ''}
                  </span>
                </div>
              </div>

              <div className="docs-toolbar">
                <div className="docs-format">
                  <button type="button" title="Bold" onClick={() => applyCommand('bold')}><b>B</b></button>
                  <button type="button" title="Italic" onClick={() => applyCommand('italic')}><i>I</i></button>
                  <button type="button" title="Underline" onClick={() => applyCommand('underline')}><u>U</u></button>
                  <button type="button" title="Bullet list" onClick={() => applyCommand('insertUnorderedList')}>
                    <i className="bi bi-list-ul" />
                  </button>
                  <button type="button" title="Numbered list" onClick={() => applyCommand('insertOrderedList')}>
                    <i className="bi bi-list-ol" />
                  </button>
                  <button type="button" title="Indent" onClick={() => applyCommand('indent')}>
                    <i className="bi bi-text-indent-left" />
                  </button>
                  <button type="button" title="Align left" onClick={() => applyCommand('justifyLeft')}>
                    <i className="bi bi-text-left" />
                  </button>
                  <button type="button" title="Align center" onClick={() => applyCommand('justifyCenter')}>
                    <i className="bi bi-text-center" />
                  </button>
                  <button type="button" title="Align right" onClick={() => applyCommand('justifyRight')}>
                    <i className="bi bi-text-right" />
                  </button>
                  <label>
                    FONT
                    <select value={font} onChange={(event) => applyFont(event.target.value)}>
                      {FONTS.map((item) => (
                        <option key={item}>{item}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    SIZE
                    <select value={size} onChange={(event) => applySize(event.target.value)}>
                      {SIZES.map((item) => (
                        <option key={item} value={item}>
                          {item} px
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <span className="docs-count">
                  {chars.toLocaleString()} / {CHAR_LIMIT.toLocaleString()}
                </span>
              </div>

              <div
                ref={editorRef}
                className="docs-editor"
                contentEditable={canManage}
                suppressContentEditableWarning
                style={{ fontFamily: font, fontSize: `${size}px` }}
                onFocus={() => document.execCommand('styleWithCSS', false, 'true')}
                onInput={() => {
                  const nextHtml = editorRef.current?.innerHTML || ''
                  setHtml(nextHtml)
                  markDirty()
                }}
              />
            </>
          )}
        </section>
      </div>
    </div>
  )
}
