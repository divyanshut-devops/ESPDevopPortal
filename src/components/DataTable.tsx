import { useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { useApp } from '../context/AppContext'
import { EmptyState } from './EmptyState'
import { Pagination } from './Pagination'

export interface Column<T> {
  key: string
  label: string
  sortable?: boolean
  accessor?: (row: T) => string | number
  render?: (row: T) => ReactNode
}

interface DataTableProps<T> {
  columns: Column<T>[]
  data: T[]
  rowKey: (row: T) => string
  pageSize?: number
  emptyTitle?: string
  emptyDescription?: string
  actions?: (row: T) => ReactNode
}

export function DataTable<T extends object>({
  columns,
  data,
  rowKey,
  pageSize,
  emptyTitle = 'No records found',
  emptyDescription = 'Try adjusting search or filters.',
  actions,
}: DataTableProps<T>) {
  const { preferences } = useApp()
  const resolvedPageSize = pageSize ?? preferences.itemsPerPage
  const [sortKey, setSortKey] = useState<string | null>(null)
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const [page, setPage] = useState(1)

  const sorted = useMemo(() => {
    if (!sortKey) return data
    const column = columns.find((item) => item.key === sortKey)
    const copy = [...data]
    copy.sort((a, b) => {
      const left = column?.accessor ? column.accessor(a) : String((a as Record<string, unknown>)[sortKey] ?? '')
      const right = column?.accessor ? column.accessor(b) : String((b as Record<string, unknown>)[sortKey] ?? '')
      if (left < right) return sortDir === 'asc' ? -1 : 1
      if (left > right) return sortDir === 'asc' ? 1 : -1
      return 0
    })
    return copy
  }, [columns, data, sortDir, sortKey])

  const totalPages = Math.max(1, Math.ceil(sorted.length / resolvedPageSize))
  const safePage = Math.min(page, totalPages)
  const pageRows = sorted.slice((safePage - 1) * resolvedPageSize, safePage * resolvedPageSize)

  const toggleSort = (key: string) => {
    if (sortKey === key) {
      setSortDir((current) => (current === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDir('asc')
    }
    setPage(1)
  }

  if (data.length === 0) {
    return <EmptyState title={emptyTitle} description={emptyDescription} />
  }

  return (
    <>
      <div className="table-wrap desktop-table">
        <table className={`table data-table align-middle ${preferences.compactTables ? 'compact' : ''}`}>
          <thead>
            <tr>
              {columns.map((column) => (
                <th
                  key={column.key}
                  className={column.sortable ? 'sortable' : ''}
                  onClick={() => column.sortable && toggleSort(column.key)}
                >
                  {column.label}
                  {sortKey === column.key ? (
                    <i className={`bi bi-caret-${sortDir === 'asc' ? 'up' : 'down'}-fill ms-1`} />
                  ) : null}
                </th>
              ))}
              {actions ? <th>Actions</th> : null}
            </tr>
          </thead>
          <tbody>
            {pageRows.map((row) => (
              <tr key={rowKey(row)}>
                {columns.map((column) => (
                  <td key={column.key}>
                    {column.render
                      ? column.render(row)
                      : String((row as Record<string, unknown>)[column.key] ?? '—')}
                  </td>
                ))}
                {actions ? <td>{actions(row)}</td> : null}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mobile-cards">
        {pageRows.map((row) => (
          <div className="card-row" key={rowKey(row)}>
            {columns.map((column) => (
              <div key={column.key} className="d-flex justify-content-between gap-3 mb-2">
                <span className="text-secondary">{column.label}</span>
                <span className="text-end">
                  {column.render
                    ? column.render(row)
                    : String((row as Record<string, unknown>)[column.key] ?? '—')}
                </span>
              </div>
            ))}
            {actions ? <div className="mt-2">{actions(row)}</div> : null}
          </div>
        ))}
      </div>

      <Pagination
        page={safePage}
        totalPages={totalPages}
        totalItems={sorted.length}
        pageSize={resolvedPageSize}
        onPageChange={setPage}
      />
    </>
  )
}
