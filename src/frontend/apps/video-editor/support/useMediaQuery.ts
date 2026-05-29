import { useEffect, useState } from 'react'

export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() =>
    typeof window !== 'undefined' && 'matchMedia' in window
      ? window.matchMedia(query).matches
      : false,
  )
  useEffect(() => {
    if (!('matchMedia' in window)) return
    const mql = window.matchMedia(query)
    const onChange = (): void => setMatches(mql.matches)
    onChange()
    mql.addEventListener('change', onChange)
    return () => mql.removeEventListener('change', onChange)
  }, [query])
  return matches
}

// Phone-sized viewport (below Tailwind's md breakpoint).
export function useIsMobile(): boolean {
  return useMediaQuery('(max-width: 767px)')
}
