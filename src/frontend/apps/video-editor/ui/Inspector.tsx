import { useEditorStore } from '../state/editorStore'
import { DEFAULT_FILTERS, LOOKS } from '../types/filters'
import type { ClipFilters } from '../types/filters'

export default function Inspector() {
  const selection = useEditorStore((s) => s.selection)
  const clip = useEditorStore((s) =>
    selection?.kind === 'clip' ? s.project.clips[selection.id] : null,
  )
  const asset = useEditorStore((s) => (clip ? s.assets[clip.assetId] : null))
  const updateClipFilters = useEditorStore((s) => s.updateClipFilters)
  const setClipFit = useEditorStore((s) => s.setClipFit)
  const setClipSpeed = useEditorStore((s) => s.setClipSpeed)
  const setClipTransition = useEditorStore((s) => s.setClipTransition)

  if (!clip) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-4 text-sm text-gray-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400">
        Select a clip to edit its properties.
      </div>
    )
  }

  const dur = clip.outSec - clip.inSec
  const f: ClipFilters = { ...DEFAULT_FILTERS, ...clip.filters }
  const fit = clip.fit ?? 'contain'
  const speed = clip.speed ?? 1
  const transition = clip.transitionInKind ?? 'none'
  const id = clip.id

  return (
    <div className="space-y-4 rounded-lg border border-gray-200 bg-white p-4 text-sm dark:border-gray-700 dark:bg-gray-800">
      <div>
        <div className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
          Clip
        </div>
        <div
          className="truncate font-medium text-gray-900 dark:text-gray-100"
          title={asset?.name}
        >
          {asset?.name ?? clip.assetId}
        </div>
        <div className="mt-0.5 text-[11px] text-gray-500 dark:text-gray-400">
          {dur.toFixed(2)}s
          {asset && asset.width > 0 && ` · ${asset.width}×${asset.height}`}
        </div>
      </div>

      {/* Look presets */}
      <Section title="Filter">
        <div className="grid grid-cols-4 gap-1">
          {LOOKS.map((l) => (
            <button
              key={l.id}
              onClick={() => updateClipFilters(id, { look: l.id })}
              className={
                'rounded px-1.5 py-1 text-[11px] font-medium transition ' +
                (f.look === l.id
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600')
              }
            >
              {l.label}
            </button>
          ))}
        </div>
      </Section>

      {/* Adjustments */}
      <Section title="Adjust">
        <Slider
          label="Brightness"
          value={f.brightness}
          min={0.5}
          max={1.5}
          onChange={(v) => updateClipFilters(id, { brightness: v })}
        />
        <Slider
          label="Contrast"
          value={f.contrast}
          min={0.5}
          max={1.5}
          onChange={(v) => updateClipFilters(id, { contrast: v })}
        />
        <Slider
          label="Saturation"
          value={f.saturation}
          min={0}
          max={2}
          onChange={(v) => updateClipFilters(id, { saturation: v })}
        />
        <button
          onClick={() =>
            updateClipFilters(id, {
              brightness: 1,
              contrast: 1,
              saturation: 1,
              look: 'none',
            })
          }
          className="mt-1 text-[11px] text-blue-600 hover:underline dark:text-blue-400"
        >
          Reset filter
        </button>
      </Section>

      {/* Fit */}
      <Section title="Frame">
        <div className="flex gap-1">
          {(['contain', 'cover'] as const).map((opt) => (
            <button
              key={opt}
              onClick={() => setClipFit(id, opt)}
              className={
                'flex-1 rounded px-2 py-1 text-xs font-medium capitalize transition ' +
                (fit === opt
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600')
              }
            >
              {opt === 'contain' ? 'Fit' : 'Fill'}
            </button>
          ))}
        </div>
      </Section>

      {/* Speed */}
      <Section title="Speed">
        <Slider
          label={`${speed.toFixed(2)}×`}
          value={speed}
          min={0.25}
          max={4}
          step={0.05}
          onChange={(v) => setClipSpeed(id, v)}
        />
        <div className="mt-1 flex gap-1">
          {[0.5, 1, 2].map((sp) => (
            <button
              key={sp}
              onClick={() => setClipSpeed(id, sp)}
              className="flex-1 rounded bg-gray-100 px-2 py-1 text-[11px] font-medium text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"
            >
              {sp}×
            </button>
          ))}
        </div>
      </Section>

      {/* Transition (leading edge) */}
      <Section title="Transition in">
        <div className="flex gap-1">
          {(['none', 'fade', 'black'] as const).map((t) => (
            <button
              key={t}
              onClick={() =>
                setClipTransition(id, t, clip.transitionInSec ?? 0.5)
              }
              className={
                'flex-1 rounded px-1.5 py-1 text-[11px] font-medium capitalize transition ' +
                (transition === t
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600')
              }
            >
              {t === 'black' ? 'Dip' : t}
            </button>
          ))}
        </div>
        {transition !== 'none' && (
          <Slider
            label={`${(clip.transitionInSec ?? 0.5).toFixed(1)}s`}
            value={clip.transitionInSec ?? 0.5}
            min={0.1}
            max={3}
            step={0.1}
            onChange={(v) => setClipTransition(id, transition, v)}
          />
        )}
      </Section>
    </div>
  )
}

function Section({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <div className="space-y-1.5 border-t border-gray-100 pt-3 dark:border-gray-700/60">
      <div className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
        {title}
      </div>
      {children}
    </div>
  )
}

function Slider({
  label,
  value,
  min,
  max,
  step = 0.01,
  onChange,
}: {
  label: string
  value: number
  min: number
  max: number
  step?: number
  onChange: (v: number) => void
}) {
  return (
    <label className="block">
      <div className="mb-0.5 flex items-center justify-between text-[11px] text-gray-500 dark:text-gray-400">
        <span>{label}</span>
        <span className="font-mono tabular-nums">{value.toFixed(2)}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-gray-200 accent-blue-600 dark:bg-gray-700"
      />
    </label>
  )
}
