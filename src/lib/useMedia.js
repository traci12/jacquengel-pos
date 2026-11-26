import { useEffect, useState } from 'react'

/** True when the CSS media query matches (updates on rotate/resize). */
export function useMedia(query) {
  const get = () => typeof window !== 'undefined' && window.matchMedia(query).matches
  const [matches, setMatches] = useState(get)
  useEffect(() => {
    const mq = window.matchMedia(query)
    const on = () => setMatches(mq.matches)
    on()
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [query])
  return matches
}

/** Tablets in landscape and laptops: side menu + always-open cart. */
export const WIDE = '(min-width: 1024px)'
