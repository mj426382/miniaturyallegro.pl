import { useCallback, useEffect, useState } from 'react'
import { userStylesApi, type UserStyle } from '../services/api'

/** Spec 27: the user's saved styles; `reload` after a change. A failed load leaves an empty list (styles are optional). */
export function useUserStyles() {
  const [styles, setStyles] = useState<UserStyle[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(false)

  const reload = useCallback(async () => {
    try {
      const { data } = await userStylesApi.list()
      setStyles(data)
      setError(false)
    } catch {
      setError(true)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    reload()
  }, [reload])

  return { styles, setStyles, isLoading, error, reload }
}
