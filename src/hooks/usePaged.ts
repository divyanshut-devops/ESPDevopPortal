import { useMemo, useState } from 'react'

export function usePaged<T>(items: T[], pageSize: number) {
  const [page, setPage] = useState(1)
  const totalPages = Math.max(1, Math.ceil(items.length / Math.max(pageSize, 1)))
  const safePage = Math.min(Math.max(page, 1), totalPages)
  const rows = useMemo(
    () => items.slice((safePage - 1) * pageSize, safePage * pageSize),
    [items, pageSize, safePage],
  )
  return { page: safePage, setPage, totalPages, rows, totalItems: items.length, pageSize }
}
