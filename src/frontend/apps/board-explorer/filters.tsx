import type { BoardMeta, FilterState, SortKey } from './types'

const INPUT =
  'w-full px-2 py-1.5 rounded-lg text-sm bg-white dark:bg-gray-800 border border-gray-300 ' +
  'dark:border-gray-600 text-gray-900 dark:text-gray-100 focus:outline-none ' +
  'focus-visible:ring-2 focus-visible:ring-blue-500'
const LABEL = 'block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1'

const SORTS: Array<[SortKey, string]> = [
  ['popularity', 'Most climbed'],
  ['quality', 'Highest rated'],
  ['grade-asc', 'Grade ↑'],
  ['grade-desc', 'Grade ↓'],
  ['name', 'Name (A–Z)'],
]

interface Props {
  meta: BoardMeta
  filter: FilterState
  onChange: (next: FilterState) => void
}

export default function FilterPanel({ meta, filter, onChange }: Props) {
  function set<K extends keyof FilterState>(key: K, value: FilterState[K]): void {
    onChange({ ...filter, [key]: value })
  }
  const num = (v: string): number | null => (v === '' ? null : Number(v))

  // Board sizes belong to a product; show those for the selected layout's product
  // (or all, when no layout is picked). Each size is a box a climb must fit within.
  const layoutProduct = meta.layouts.find((l) => l.id === filter.layoutId)?.productId
  const sizeOptions = meta.sizes.filter((s) => layoutProduct == null || s.productId === layoutProduct)

  function onLayout(value: string): void {
    const layoutId = value === '' ? null : Number(value)
    const product = meta.layouts.find((l) => l.id === layoutId)?.productId
    const sizeStillValid =
      filter.sizeId != null &&
      meta.sizes.some((s) => s.id === filter.sizeId && (product == null || s.productId === product))
    onChange({ ...filter, layoutId, sizeId: sizeStillValid ? filter.sizeId : null })
  }

  return (
    <div
      data-tour="filters"
      className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 p-4 rounded-xl bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700"
    >
      <div>
        <label className={LABEL}>Layout</label>
        <select className={INPUT} value={filter.layoutId ?? ''} onChange={(e) => onLayout(e.target.value)}>
          <option value="">All layouts</option>
          {meta.layouts.map((l) => (
            <option key={l.id} value={l.id}>
              {l.name}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className={LABEL}>Board size</label>
        <select
          className={INPUT}
          value={filter.sizeId ?? ''}
          disabled={sizeOptions.length === 0}
          onChange={(e) => set('sizeId', e.target.value === '' ? null : Number(e.target.value))}
        >
          <option value="">Any size</option>
          {sizeOptions.map((s) => (
            <option key={s.id} value={s.id}>
              {s.description ? `${s.name} (${s.description})` : s.name}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className={LABEL}>Angle</label>
        <select
          className={INPUT}
          value={filter.angle ?? ''}
          onChange={(e) => set('angle', e.target.value === '' ? null : Number(e.target.value))}
        >
          <option value="">Any angle</option>
          {meta.angles.map((a) => (
            <option key={a} value={a}>
              {a}°
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className={LABEL}>Sort by</label>
        <select className={INPUT} value={filter.sort} onChange={(e) => set('sort', e.target.value as SortKey)}>
          {SORTS.map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className={LABEL}>Min grade</label>
        <select
          className={INPUT}
          value={filter.gradeMin ?? ''}
          onChange={(e) => set('gradeMin', e.target.value === '' ? null : Number(e.target.value))}
        >
          <option value="">Any</option>
          {meta.grades.map((g) => (
            <option key={g.difficulty} value={g.difficulty}>
              {g.name}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className={LABEL}>Max grade</label>
        <select
          className={INPUT}
          value={filter.gradeMax ?? ''}
          onChange={(e) => set('gradeMax', e.target.value === '' ? null : Number(e.target.value))}
        >
          <option value="">Any</option>
          {meta.grades.map((g) => (
            <option key={g.difficulty} value={g.difficulty}>
              {g.name}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className={LABEL}>Min ascents</label>
        <input
          type="number"
          min={0}
          className={INPUT}
          value={filter.minAscents ?? ''}
          onChange={(e) => set('minAscents', num(e.target.value))}
          placeholder="0"
        />
      </div>

      <div>
        <label className={LABEL}>Min quality (★)</label>
        <input
          type="number"
          min={0}
          max={5}
          step={0.5}
          className={INPUT}
          value={filter.minQuality ?? ''}
          onChange={(e) => set('minQuality', num(e.target.value))}
          placeholder="0–5"
        />
      </div>

      <div>
        <label className={LABEL}>Name contains</label>
        <input
          type="text"
          className={INPUT}
          value={filter.name}
          onChange={(e) => set('name', e.target.value)}
          placeholder="e.g. crimp"
        />
      </div>

      <div>
        <label className={LABEL}>Setter</label>
        <input
          type="text"
          className={INPUT}
          value={filter.setter}
          onChange={(e) => set('setter', e.target.value)}
          placeholder="username"
        />
      </div>

      <div className="sm:col-span-2 lg:col-span-3 flex flex-wrap gap-x-5 gap-y-2 pt-1">
        <Toggle label="Benchmarks only" checked={filter.benchmarkOnly} onChange={(v) => set('benchmarkOnly', v)} />
        <Toggle label="Listed only" checked={filter.listedOnly} onChange={(v) => set('listedOnly', v)} />
        <Toggle
          label="Single-frame only (mobile-compatible)"
          checked={filter.singleFrameOnly}
          onChange={(v) => set('singleFrameOnly', v)}
        />
      </div>
    </div>
  )
}

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string
  checked: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <label className="inline-flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 cursor-pointer">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500"
      />
      {label}
    </label>
  )
}
