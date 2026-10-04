import { useCallback, useEffect, useState } from 'react'
import { api } from '../api'

interface FetchState<T> {
  data?: T
  error?: Error
  loading: boolean
}

/** Loads an API path. `reload()` refetches while keeping the current data on screen. */
export function useFetch<T>(path: string) {
  const [state, setState] = useState<FetchState<T>>({ loading: true })
  const [version, setVersion] = useState(0)

  useEffect(() => {
    let cancelled = false
    api<T>(path)
      .then((data) => !cancelled && setState({ data, loading: false }))
      .catch((error: Error) => !cancelled && setState((prev) => ({ ...prev, error, loading: false })))
    return () => {
      cancelled = true
    }
  }, [path, version])

  const reload = useCallback(() => setVersion((value) => value + 1), [])

  return { ...state, reload }
}
