import { useEffect, useRef } from 'react'
import { Renderer } from './Renderer'
import { useEditorStore } from '../state/editorStore'
import TextOverlayLayer from './TextOverlayLayer'

export default function PreviewCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const project = useEditorStore((s) => s.project)
  const playhead = useEditorStore((s) => s.playhead)
  const rendererRef = useRef<Renderer | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const gl = canvas.getContext('webgl2', {
      alpha: false,
      preserveDrawingBuffer: false,
      premultipliedAlpha: false,
    })
    if (!gl) return
    const r = new Renderer(gl, canvas, useEditorStore)
    rendererRef.current = r
    r.start()
    return () => {
      r.dispose()
      rendererRef.current = null
    }
  }, [])

  // Trigger a one-shot render when playhead changes while paused.
  useEffect(() => {
    rendererRef.current?.renderOnce()
  }, [playhead])

  return (
    <div className="relative mx-auto w-fit max-w-full overflow-hidden rounded-lg bg-black shadow-md">
      <canvas
        ref={canvasRef}
        width={project.width}
        height={project.height}
        className="block h-auto max-h-[58dvh] w-auto max-w-full md:max-h-[68vh]"
        style={{ aspectRatio: `${project.width} / ${project.height}` }}
      />
      <TextOverlayLayer />
    </div>
  )
}
