import { useState, useEffect } from 'react'

/**
 * Drop-in replacement for useState that persists the value to localStorage.
 * Falls back to initialValue if the key is missing or unparseable.
 */
export function useLocalStorage<T>(
  key: string,
  initialValue: T
): [T, React.Dispatch<React.SetStateAction<T>>] {
  const [value, setValue] = useState<T>(() => {
    try {
      const stored = localStorage.getItem(key)
      return stored !== null ? (JSON.parse(stored) as T) : initialValue
    } catch {
      return initialValue
    }
  })

  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(value))
    } catch {
      // localStorage unavailable (private browsing, storage quota exceeded)
    }
  }, [key, value])

  return [value, setValue]
}
