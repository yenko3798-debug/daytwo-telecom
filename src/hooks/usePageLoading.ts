import { useCallback, useEffect, useRef, useState } from 'react'

export function usePageLoading(duration = 520) {
  const [loading, setLoading] = useState(true)
  const timerRef = useRef<number | null>(null)

  const clear = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }, [])

  const begin = useCallback(
    (nextDuration?: number) => {
      clear()
      setLoading(true)
      const timeout = window.setTimeout(() => {
        setLoading(false)
        timerRef.current = null
      }, nextDuration ?? duration)
      timerRef.current = timeout
    },
    [clear, duration],
  )

  useEffect(() => {
    begin(duration)
    return clear
  }, [begin, clear, duration])

  return { loading, begin, setLoading }
}
