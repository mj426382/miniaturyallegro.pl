import { useEffect } from 'react'

const SUFFIX = 'AllGrafika.pl'

/** Browser tab title per screen – history and tabs become readable, screen readers announce the page. */
export function usePageTitle(title: string) {
  useEffect(() => {
    const previous = document.title
    document.title = title ? `${title} – ${SUFFIX}` : SUFFIX
    return () => {
      document.title = previous
    }
  }, [title])
}
