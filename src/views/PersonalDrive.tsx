'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import {
  deleteDriveFile,
  downloadDriveFile,
  fetchDriveFiles,
  uploadDriveFile,
  type DriveFile,
} from '../api/drive'
import { Pagination } from '../components/Pagination'
import { useApp } from '../context/AppContext'
import { usePaged } from '../hooks/usePaged'

function formatSize(bytes = 0) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function PersonalDrive() {
  const { can, pushToast, preferences } = useApp()
  const allowed = can('drive.view')
  const canManage = can('drive.manage')
  const inputRef = useRef<HTMLInputElement>(null)
  const [configured, setConfigured] = useState(true)
  const [files, setFiles] = useState<DriveFile[]>([])
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)

  const load = async () => {
    const data = await fetchDriveFiles()
    setConfigured(data.configured)
    setFiles(data.files || [])
  }

  useEffect(() => {
    if (!allowed) {
      setLoading(false)
      return
    }
    let cancelled = false
    void load()
      .catch((error) => {
        if (!cancelled) pushToast(error instanceof Error ? error.message : 'Unable to load drive', 'error')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [allowed, pushToast])

  const filtered = useMemo(
    () => files.filter((item) => `${item.name} ${item.key}`.toLowerCase().includes(query.toLowerCase())),
    [files, query],
  )
  const paged = usePaged(filtered, preferences.itemsPerPage)

  if (!allowed) {
    return (
      <div className="drive-page">
        <h2 className="drive-title">Personal Drive</h2>
        <div className="drive-empty">You do not have permission to open Personal Drive.</div>
      </div>
    )
  }

  return (
    <div className="drive-page">
      <div className="drive-hero">
        <div>
          <h2 className="drive-title">Personal Drive</h2>
          <p className="drive-copy mb-0">Store generated files and workspace content in your private S3 folder.</p>
        </div>
        {canManage ? (
          <>
            <input
              ref={inputRef}
              type="file"
              hidden
              onChange={(event) => {
                const file = event.target.files?.[0]
                event.target.value = ''
                if (!file) return
                setUploading(true)
                void uploadDriveFile(file)
                  .then(() => load())
                  .then(() => pushToast('File uploaded'))
                  .catch((error) => pushToast(error instanceof Error ? error.message : 'Unable to upload', 'error'))
                  .finally(() => setUploading(false))
              }}
            />
            <button type="button" className="btn btn-purple" disabled={uploading || !configured} onClick={() => inputRef.current?.click()}>
              {uploading ? 'Uploading…' : '+ Upload'}
            </button>
          </>
        ) : null}
      </div>

      {!configured ? (
        <div className="drive-banner">S3 credentials are not set yet. Add AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, and S3_BUCKET in .env.</div>
      ) : null}

      <div className="drive-toolbar">
        <input
          className="form-control drive-search"
          placeholder="Search files..."
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </div>

      {loading ? (
        <div className="drive-empty">Loading drive…</div>
      ) : filtered.length === 0 ? (
        <div className="drive-empty">
          {files.length === 0
            ? configured
              ? 'No files yet. Upload a file or save one from Dev Generator.'
              : 'Drive is ready. Files will appear here after S3 credentials are added.'
            : 'No files match this search.'}
        </div>
      ) : (
        <div className="drive-list">
          <div className="drive-grid">
            {paged.rows.map((item) => (
              <article className="drive-card" key={item.key}>
                <div className="drive-card-top">
                  <span className="drive-card-icon">
                    <i className="bi bi-file-earmark" />
                  </span>
                  <div>
                    <h3 title={item.name}>{item.name}</h3>
                    <p>
                      {formatSize(item.size)}
                      {item.updatedAt ? ` · ${new Date(item.updatedAt).toLocaleString()}` : ''}
                    </p>
                  </div>
                </div>
                <div className="drive-card-actions">
                  <button
                    type="button"
                    className="btn btn-purple btn-sm"
                    onClick={() => {
                      void downloadDriveFile(item.key, item.name).catch((error) =>
                        pushToast(error instanceof Error ? error.message : 'Unable to download', 'error'),
                      )
                    }}
                  >
                    Download
                  </button>
                  {canManage ? (
                    <button
                      type="button"
                      className="icon-btn-ghost"
                      title="Delete"
                      onClick={() => {
                        void deleteDriveFile(item.key)
                          .then(() => setFiles((current) => current.filter((entry) => entry.key !== item.key)))
                          .then(() => pushToast('File deleted', 'info'))
                          .catch((error) => pushToast(error instanceof Error ? error.message : 'Unable to delete', 'error'))
                      }}
                    >
                      <i className="bi bi-trash" />
                    </button>
                  ) : null}
                </div>
              </article>
            ))}
          </div>
          <Pagination
            compact
            page={paged.page}
            totalPages={paged.totalPages}
            totalItems={paged.totalItems}
            pageSize={paged.pageSize}
            onPageChange={paged.setPage}
          />
        </div>
      )}
    </div>
  )
}
