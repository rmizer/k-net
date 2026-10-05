import { useState, type ReactNode } from 'react'

type Value = string | number | boolean | null | undefined

export interface Sort<K extends string> {
  key: K
  descending: boolean
  toggle: (key: K) => void
  /** Sorted copy of `rows`; blanks always go last. */
  apply: <T>(rows: T[], valueOf: (row: T, key: K) => Value) => T[]
}

export function useSort<K extends string>(initial: K, initialDescending = false): Sort<K> {
  const [key, setKey] = useState<K>(initial)
  const [descending, setDescending] = useState(initialDescending)
  return {
    key,
    descending,
    toggle: (next) => {
      if (next === key) setDescending(!descending)
      else {
        setKey(next)
        setDescending(false)
      }
    },
    apply: (rows, valueOf) =>
      [...rows].sort((a, b) => {
        const x = valueOf(a, key)
        const y = valueOf(b, key)
        if (x == null || x === '') return y == null || y === '' ? 0 : 1
        if (y == null || y === '') return -1
        const order = typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y))
        return descending ? -order : order
      }),
  }
}

/** A clickable column header that shows and switches the sort. */
export function SortHeader<K extends string>({
  sort,
  column,
  children,
  className,
}: {
  sort: Sort<K>
  column: K
  children: ReactNode
  className?: string
}) {
  const active = sort.key === column
  return (
    <th className={className} aria-sort={active ? (sort.descending ? 'descending' : 'ascending') : 'none'}>
      <button type="button" className="sort-header" onClick={() => sort.toggle(column)}>
        {children}
        <span aria-hidden="true" className={active ? 'sort-header__arrow is-active' : 'sort-header__arrow'}>
          {active && sort.descending ? '▼' : '▲'}
        </span>
      </button>
    </th>
  )
}
