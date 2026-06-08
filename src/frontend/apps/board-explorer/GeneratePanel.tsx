import { useEffect, useMemo, useRef, useState } from 'react'
import BoardView from './BoardView'
import {
  buildRenderHolds,
  indexPlacements,
  indexRoles,
  layoutBounds,
  type RenderHold,
} from './render'
import type { HoldPos, RoleInfo } from './types'
import { loadMeta, loadSession, makeRunLogits } from './generate/session'
import {
  generateReranked,
  prepare,
  type GenMeta,
  type Prepared,
  type RerankedClimb,
  type RunLogits,
} from './generate/decode'

type Status = 'loading' | 'ready' | 'generating' | 'error'

interface Engine {
  meta: GenMeta
  prep: Prepared
  run: RunLogits
  grid: HoldPos[]
  roles: RoleInfo[]
}

/** Round a predicted grade to the nearest bundled V-grade label. */
function gradeName(meta: GenMeta, difficulty: number): string {
  const g = Math.max(meta.grades[0], Math.min(meta.grades[meta.grades.length - 1], Math.round(difficulty)))
  return meta.gradeLabels[String(g)] ?? String(g)
}

export default function GeneratePanel() {
  const [engine, setEngine] = useState<Engine | null>(null)
  const [status, setStatus] = useState<Status>('loading')
  const [error, setError] = useState<string | null>(null)

  // Controls
  const [sizeId, setSizeId] = useState<number | null>(null)
  const [angle, setAngle] = useState(40)
  const [grade, setGrade] = useState(17)
  const [nomatch, setNomatch] = useState(false)
  const [rerank, setRerank] = useState(10)

  const [result, setResult] = useState<RerankedClimb | null>(null)
  const boardRef = useRef<HTMLDivElement>(null)

  // Load the metadata + ONNX model once when the tab opens.
  useEffect(() => {
    let cancelled = false
    Promise.all([loadMeta(), loadSession()])
      .then(([meta, session]) => {
        if (cancelled) return
        setEngine({
          meta,
          prep: prepare(meta),
          run: makeRunLogits(session, meta),
          grid: meta.placements.map((p) => ({ placementId: p.id, layoutId: 1, x: p.x, y: p.y })),
          roles: meta.roles.map((r) => ({ id: r.id, name: r.name, color: r.color })),
        })
        setSizeId(meta.defaultSize)
        setStatus('ready')
      })
      .catch((e) => !cancelled && (setError(e instanceof Error ? e.message : String(e)), setStatus('error')))
    return () => {
      cancelled = true
    }
  }, [])

  const placementById = useMemo(() => indexPlacements(engine?.grid ?? []), [engine])
  const roleById = useMemo(() => indexRoles(engine?.roles ?? []), [engine])
  const bounds = useMemo(() => (engine ? layoutBounds(engine.grid, 1) : null), [engine])
  const sizeBox = useMemo(
    () => engine?.meta.sizes.find((s) => s.id === sizeId)?.box ?? null,
    [engine, sizeId],
  )
  const holds: RenderHold[] = useMemo(
    () => (result ? buildRenderHolds(result.frames, placementById, roleById) : []),
    [result, placementById, roleById],
  )
  const counts = useMemo(() => {
    const c: Record<string, number> = {}
    for (const h of holds) c[h.roleName] = (c[h.roleName] ?? 0) + 1
    return c
  }, [holds])

  async function onGenerate(): Promise<void> {
    if (!engine || sizeId == null) return
    setStatus('generating')
    setError(null)
    try {
      const climb = await generateReranked(
        engine.meta,
        engine.prep,
        { sizeId, angle, grade, nomatch },
        engine.run,
        rerank,
      )
      setResult(climb)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setStatus('ready')
    }
  }

  async function onDownloadPng(): Promise<void> {
    const svg = boardRef.current?.querySelector('svg')
    if (!svg) return
    const { toPng } = await import('html-to-image')
    const url = await toPng(svg as unknown as HTMLElement, { backgroundColor: '#ffffff', pixelRatio: 2 })
    const a = document.createElement('a')
    a.href = url
    a.download = `generated-climb-${gradeName(engine!.meta, result!.predictedGrade).replace(/\W+/g, '')}.png`
    a.click()
  }

  if (status === 'error') {
    return (
      <div className="rounded-lg bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300 px-4 py-3 text-sm">
        Couldn't load the generator model: {error}
      </div>
    )
  }
  if (!engine || sizeId == null) {
    return <p className="text-sm text-gray-400 py-8 text-center">Loading generator model (~9&nbsp;MB, once)…</p>
  }

  const { meta } = engine
  const busy = status === 'generating'

  return (
    <div className="grid gap-6 md:grid-cols-[18rem_1fr]">
      {/* Controls */}
      <div className="space-y-4">
        <Field label="Board size">
          <select
            value={sizeId}
            onChange={(e) => setSizeId(Number(e.target.value))}
            className="w-full px-3 py-2 rounded-lg text-sm bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          >
            {meta.sizes.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </Field>

        <Field label={`Angle — ${angle}°`}>
          <select
            value={angle}
            onChange={(e) => setAngle(Number(e.target.value))}
            className="w-full px-3 py-2 rounded-lg text-sm bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          >
            {meta.angles.map((a) => (
              <option key={a} value={a}>
                {a}°
              </option>
            ))}
          </select>
        </Field>

        <Field label={`Grade — ${gradeName(meta, grade)}`}>
          <input
            type="range"
            min={meta.grades[0]}
            max={meta.grades[meta.grades.length - 1]}
            step={1}
            value={grade}
            onChange={(e) => setGrade(Number(e.target.value))}
            className="w-full accent-blue-600"
          />
        </Field>

        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-700 dark:text-gray-300">No-match (feet-follow-hands off)</span>
          <button
            role="switch"
            aria-checked={nomatch}
            onClick={() => setNomatch((v) => !v)}
            className={
              'relative inline-flex h-6 w-11 items-center rounded-full transition-colors ' +
              (nomatch ? 'bg-blue-600' : 'bg-gray-300 dark:bg-gray-600')
            }
          >
            <span className={'inline-block h-4 w-4 transform rounded-full bg-white transition ' + (nomatch ? 'translate-x-6' : 'translate-x-1')} />
          </button>
        </div>

        <Field label={`Grade-match candidates — ${rerank}`}>
          <input
            type="range"
            min={1}
            max={24}
            step={1}
            value={rerank}
            onChange={(e) => setRerank(Number(e.target.value))}
            className="w-full accent-blue-600"
          />
          <p className="text-xs text-gray-400 mt-1">
            Sample N climbs; keep the one closest to the target grade. Higher = tighter grade, slower.
          </p>
        </Field>

        <button
          onClick={onGenerate}
          disabled={busy}
          className="w-full px-4 py-2.5 rounded-lg text-sm font-medium bg-blue-600 text-white disabled:opacity-50 disabled:cursor-not-allowed hover:bg-blue-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
        >
          {busy ? 'Generating…' : result ? 'Generate another' : 'Generate climb'}
        </button>
        {error && <p className="text-xs text-red-500">{error}</p>}
      </div>

      {/* Board */}
      <div className="min-w-0">
        {result ? (
          <>
            <div ref={boardRef}>
              <BoardView
                holds={holds}
                grid={engine.grid}
                bounds={bounds!}
                sizeBox={sizeBox}
                label={`generated ${gradeName(meta, grade)} climb`}
              />
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-600 dark:text-gray-300">
              <span>
                Predicted grade <strong>{gradeName(meta, result.predictedGrade)}</strong>{' '}
                <span className="text-gray-400">(target {gradeName(meta, grade)})</span>
              </span>
              <span className="text-gray-400">·</span>
              <span>
                {holds.length} holds
                {counts.start ? ` · ${counts.start} start` : ''}
                {counts.finish ? ` · ${counts.finish} finish` : ''}
                {counts.foot ? ` · ${counts.foot} foot` : ''}
              </span>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                onClick={onDownloadPng}
                className="px-3 py-1.5 rounded-lg text-sm border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
              >
                Download PNG
              </button>
              <button
                onClick={() => navigator.clipboard?.writeText(result.frames)}
                className="px-3 py-1.5 rounded-lg text-sm border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
              >
                Copy frames
              </button>
            </div>
            <p className="mt-3 text-xs text-gray-400 dark:text-gray-500">
              Generated locally in your browser by a small transformer — the grade is a model estimate, not a
              human consensus. Valid by construction (fits the size, has a start &amp; finish); whether it's a
              good climb is up to you.
            </p>
          </>
        ) : (
          <div className="h-full min-h-[16rem] flex items-center justify-center text-center text-sm text-gray-400 border border-dashed border-gray-300 dark:border-gray-700 rounded-lg p-6">
            Pick a size, angle, and grade, then <span className="mx-1 font-medium text-gray-500">Generate climb</span> to
            design a brand-new Kilter problem.
          </div>
        )}
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">{label}</span>
      {children}
    </label>
  )
}
