import { useState } from 'react'
import { exerciseImageUrl } from './data'

interface ExerciseImageProps {
  path: string
  alt: string
  className?: string
}

export default function ExerciseImage({ path, alt, className }: ExerciseImageProps) {
  const [useFallback, setUseFallback] = useState(false)
  return (
    <img
      src={exerciseImageUrl(path, { fallback: useFallback })}
      alt={alt}
      loading="lazy"
      onError={() => {
        // One-shot fallback: jsdelivr → raw.githubusercontent. If both fail
        // the browser shows the broken-image icon; we don't loop.
        if (!useFallback) setUseFallback(true)
      }}
      className={className}
    />
  )
}
