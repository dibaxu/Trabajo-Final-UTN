import { useCallback, useEffect, useState } from 'react'

/**
 * Carga datos de un servicio. `fetcher` debe ser una función estable (p. ej.
 * `api.products.list`) y `params` un objeto simple: se vuelve a consultar
 * cuando cambian los parámetros o se llama a `reload()`.
 */
export function useQuery(fetcher, params) {
  const key = JSON.stringify(params ?? null)
  const [state, setState] = useState({ data: null, error: null, loading: true })
  const [tick, setTick] = useState(0)

  useEffect(() => {
    let cancelled = false
    fetcher(JSON.parse(key) ?? undefined)
      .then((data) => {
        if (!cancelled) setState({ data, error: null, loading: false })
      })
      .catch((error) => {
        if (!cancelled) setState((prev) => ({ ...prev, error, loading: false }))
      })
    return () => {
      cancelled = true
    }
  }, [fetcher, key, tick])

  const reload = useCallback(() => setTick((t) => t + 1), [])
  return { ...state, reload }
}
