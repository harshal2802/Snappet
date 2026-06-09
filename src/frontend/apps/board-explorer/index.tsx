import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocalStorage } from '../../hooks/useLocalStorage'
import GuidedTour from '../../components/GuidedTour'
import { tourSteps } from './tour'
import { detectCapabilities, isSupported } from './support'
import { BoardDB, loadManifest } from './db'
import FilterPanel from './filters'
import ResultsTable from './ResultsTable'
import ClimbModal from './ClimbModal'
import GeneratePanel from './GeneratePanel'
import { toCsv, toJson } from './exportFlat'
import { downloadBlob, today } from './download'
import { upsertPreset, removePreset, type Preset } from './presets'
import { DEFAULT_FILTER } from './types'
import type { BoardMeta, ClimbRow, FilterState, ManifestEntry } from './types'

const PAGE_SIZE = 50

export default function BoardExplorer() {
  const caps = useMemo(() => detectCapabilities(), [])
  if (!isSupported(caps)) return <Unsupported />
  return <Explorer />
}

function Explorer() {
  const dbRef = useRef<BoardDB | null>(null)
  const getDb = (): BoardDB => (dbRef.current ??= new BoardDB())

  const [manifest, setManifest] = useState<ManifestEntry[] | null>(null)
  const [manifestError, setManifestError] = useState<string | null>(null)
  const [selectedBoard, setSelectedBoard] = useLocalStorage<string>('snappet:board-explorer:board', '')

  const [meta, setMeta] = useState<BoardMeta | null>(null)
  const [boardLoading, setBoardLoading] = useState(false)
  const [boardError, setBoardError] = useState<string | null>(null)

  const [filter, setFilter] = useLocalStorage<FilterState>('snappet:board-explorer:filters', DEFAULT_FILTER)
  const [page, setPage] = useState(0)
  const [rows, setRows] = useState<ClimbRow[]>([])
  const [total, setTotal] = useState(0)
  const [querying, setQuerying] = useState(false)
  const [selected, setSelected] = useState<ClimbRow | null>(null)
  // Persisted so a Generate-focused user lands back on Generate and never pays
  // for the (large) board catalogue download they don't use there.
  const [tab, setTab] = useLocalStorage<'browse' | 'generate'>('snappet:board-explorer:tab', 'browse')

  const [presets, setPresets] = useLocalStorage<Preset[]>('snappet:board-explorer:presets', [])
  const [presetName, setPresetName] = useState('')
  const [exporting, setExporting] = useState<string | null>(null)
  const [exportMsg, setExportMsg] = useState<{ ok: boolean; text: string } | null>(null)

  // Load the board list once.
  useEffect(() => {
    loadManifest()
      .then((boards) => {
        setManifest(boards)
        setSelectedBoard((prev) => (boards.some((b) => b.board === prev) ? prev : boards[0]?.board ?? ''))
      })
      .catch((e) => setManifestError(e instanceof Error ? e.message : String(e)))
  }, [setSelectedBoard])

  // Open the selected board — only while the Browse tab is active. The Generate
  // tab runs its own bundled model and never touches the SQLite snapshot, so
  // gating here means switching to / landing on Generate downloads none of the
  // (tens-of-MB) catalogue. An in-flight download is aborted if you leave Browse
  // before it finishes.
  useEffect(() => {
    if (tab !== 'browse' || !manifest || !selectedBoard) return
    const entry = manifest.find((b) => b.board === selectedBoard)
    if (!entry || meta?.board === selectedBoard) return
    let cancelled = false
    const controller = new AbortController()
    setBoardLoading(true)
    setBoardError(null)
    getDb()
      .open(entry, controller.signal)
      .then((m) => {
        if (cancelled) return
        setMeta(m)
        setPage(0)
      })
      .catch((e) => {
        if (cancelled || controller.signal.aborted) return
        setBoardError(e instanceof Error ? e.message : String(e))
      })
      .finally(() => !cancelled && setBoardLoading(false))
    return () => {
      cancelled = true
      controller.abort()
    }
  }, [manifest, selectedBoard, meta, tab])

  // Run the (debounced) query whenever the board / filter / page changes.
  useEffect(() => {
    if (!meta) return
    let cancelled = false
    const handle = setTimeout(() => {
      setQuerying(true)
      const db = getDb()
      Promise.all([db.count(filter), db.query(filter, PAGE_SIZE, page * PAGE_SIZE)])
        .then(([n, r]) => {
          if (cancelled) return
          setTotal(n)
          setRows(r)
        })
        .catch(() => !cancelled && (setTotal(0), setRows([])))
        .finally(() => !cancelled && setQuerying(false))
    }, 250)
    return () => {
      cancelled = true
      clearTimeout(handle)
    }
  }, [meta, filter, page])

  // Dispose the worker on unmount.
  useEffect(() => () => dbRef.current?.dispose(), [])

  function onFilterChange(next: FilterState): void {
    setFilter(next)
    setPage(0)
    setExportMsg(null)
  }

  function onReset(): void {
    setFilter(DEFAULT_FILTER)
    setPage(0)
    setExportMsg(null)
    setSelected(null)
  }

  async function exportFlat(format: 'csv' | 'json'): Promise<void> {
    if (!meta) return
    setExporting(format)
    setExportMsg(null)
    try {
      const all = await getDb().exportRows(filter)
      const data = format === 'csv' ? toCsv(all) : toJson(all)
      const mime = format === 'csv' ? 'text/csv' : 'application/json'
      downloadBlob(data, `${meta.board}-climbs-${today()}.${format}`, mime)
      setExportMsg({ ok: true, text: `Exported ${all.length.toLocaleString()} climbs.` })
    } catch (e) {
      setExportMsg({ ok: false, text: e instanceof Error ? e.message : String(e) })
    } finally {
      setExporting(null)
    }
  }

  async function exportDb(): Promise<void> {
    if (!meta) return
    setExporting('db')
    setExportMsg(null)
    try {
      const { buffer, validation } = await getDb().exportDb(filter, meta.importableToMobile)
      if (!validation.ok) {
        setExportMsg({ ok: false, text: `Can't export: ${validation.errors.join(' ')}` })
        return
      }
      downloadBlob(buffer, `${meta.board}-filtered-${today()}.sqlite3`, 'application/x-sqlite3')
      const kb = Math.max(1, Math.round(validation.sizeBytes / 1024))
      setExportMsg({
        ok: true,
        text:
          `Exported ${validation.listedCount.toLocaleString()} listed climbs (${kb.toLocaleString()} KB).` +
          (meta.importableToMobile ? ' Ready to import into Snappet mobile.' : ''),
      })
    } catch (e) {
      setExportMsg({ ok: false, text: e instanceof Error ? e.message : String(e) })
    } finally {
      setExporting(null)
    }
  }

  const busy = exporting !== null
  const selectedEntry = manifest?.find((b) => b.board === selectedBoard)
  const selectedSizeMb = selectedEntry ? Math.round(selectedEntry.sizeBytesGz / 1_000_000) : 0

  return (
    <div className="max-w-5xl mx-auto space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div data-tour="header">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Board Explorer</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Filter Aurora climbing-board catalogues, view a climb on the board, and download the slice you want.
          </p>
        </div>
        <div className="mt-1 flex items-center gap-2">
          <GuidedTour appId="board-explorer" steps={tourSteps} />
          <button
            onClick={onReset}
            className="px-3 py-1.5 rounded-lg text-sm text-gray-500 dark:text-gray-400 border border-gray-300 dark:border-gray-600 hover:text-red-500 dark:hover:text-red-400 hover:border-red-300 dark:hover:border-red-600 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
          >
            ↺ Reset
          </button>
        </div>
      </div>

      {/* Browse / Generate tabs */}
      <div className="flex gap-1 border-b border-gray-200 dark:border-gray-700" role="tablist">
        <TabBtn active={tab === 'browse'} onClick={() => setTab('browse')}>
          Browse
        </TabBtn>
        <TabBtn active={tab === 'generate'} onClick={() => setTab('generate')}>
          ✨ Generate
        </TabBtn>
      </div>

      {tab === 'generate' && <GeneratePanel />}

      {tab === 'browse' && (
        <div className="space-y-4">
          {manifestError && <Banner ok={false}>Couldn't load the board list: {manifestError}</Banner>}

          {/* Board picker */}
      <div data-tour="board" className="flex flex-wrap items-end gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Board</label>
          <select
            className="px-3 py-2 rounded-lg text-sm bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            value={selectedBoard}
            disabled={!manifest}
            onChange={(e) => {
              setSelectedBoard(e.target.value)
              setMeta(null)
              setExportMsg(null)
              setSelected(null)
            }}
          >
            {!manifest && <option>Loading…</option>}
            {manifest?.map((b) => (
              <option key={b.board} value={b.board}>
                {b.label}
              </option>
            ))}
          </select>
        </div>
        {meta && (
          <p className="text-xs text-gray-500 dark:text-gray-400 pb-2">
            {meta.climbCount.toLocaleString()} climbs · data as of {meta.generatedAt}
            {meta.isFixture && ' · sample data'}
            {meta.importableToMobile && (
              <span className="ml-2 inline-block px-1.5 py-0.5 rounded bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300">
                ✓ importable into Snappet mobile
              </span>
            )}
          </p>
        )}
      </div>

      {boardError && <Banner ok={false}>Couldn't load this board: {boardError}</Banner>}
      {boardLoading && (
        <p className="text-sm text-gray-400 py-8 text-center">
          Loading board data…{selectedSizeMb >= 1 && ` (downloading ~${selectedSizeMb} MB, once)`}
        </p>
      )}

      {meta && !boardLoading && (
        <>
          <FilterPanel meta={meta} filter={filter} onChange={onFilterChange} />

          {/* Presets */}
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="text"
              value={presetName}
              onChange={(e) => setPresetName(e.target.value)}
              placeholder="Preset name"
              className="px-2 py-1 rounded-lg text-sm bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            />
            <button
              disabled={!presetName.trim()}
              onClick={() => {
                setPresets((p) => upsertPreset(p, presetName.trim(), filter))
                setPresetName('')
              }}
              className="px-2.5 py-1 rounded-lg text-sm border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 disabled:opacity-40 hover:bg-gray-50 dark:hover:bg-gray-800"
            >
              Save filter
            </button>
            {presets.map((p) => (
              <span
                key={p.name}
                className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300"
              >
                <button onClick={() => onFilterChange(p.filter)} className="hover:underline">
                  {p.name}
                </button>
                <button
                  aria-label={`Delete preset ${p.name}`}
                  onClick={() => setPresets((all) => removePreset(all, p.name))}
                  className="text-blue-400 hover:text-red-500"
                >
                  ×
                </button>
              </span>
            ))}
          </div>

          <ResultsTable
            rows={rows}
            total={total}
            page={page}
            pageSize={PAGE_SIZE}
            loading={querying}
            onPage={setPage}
            onSelect={setSelected}
          />

          {/* Export bar */}
          <div data-tour="export" className="flex flex-wrap items-center gap-2 pt-1">
            <span className="text-sm text-gray-500 dark:text-gray-400 mr-1">Download filtered set:</span>
            <ExportBtn disabled={busy || total === 0} loading={exporting === 'csv'} onClick={() => exportFlat('csv')}>
              CSV
            </ExportBtn>
            <ExportBtn disabled={busy || total === 0} loading={exporting === 'json'} onClick={() => exportFlat('json')}>
              JSON
            </ExportBtn>
            <ExportBtn disabled={busy || total === 0} loading={exporting === 'db'} onClick={exportDb}>
              SQLite .db
            </ExportBtn>
          </div>
          {exportMsg && <Banner ok={exportMsg.ok}>{exportMsg.text}</Banner>}

          <p className="text-xs text-gray-400 dark:text-gray-500 pt-2 border-t border-gray-100 dark:border-gray-800">
            Climb data is downloaded with{' '}
            <a href="https://github.com/lemeryfertitta/BoardLib" className="underline" target="_blank" rel="noreferrer">
              boardlib
            </a>{' '}
            from Aurora Climbing boards and processed entirely in your browser — nothing is uploaded.
          </p>
        </>
      )}

      {selected && meta && (
        <ClimbModal
          db={getDb()}
          meta={meta}
          row={selected}
          sizeBox={meta.sizes.find((s) => s.id === filter.sizeId)?.box ?? null}
          onClose={() => setSelected(null)}
        />
      )}
        </div>
      )}
    </div>
  )
}

function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={
        'px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded-t ' +
        (active
          ? 'border-blue-600 text-blue-600 dark:text-blue-400'
          : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300')
      }
    >
      {children}
    </button>
  )
}

function ExportBtn({
  children,
  disabled,
  loading,
  onClick,
}: {
  children: React.ReactNode
  disabled: boolean
  loading: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="px-3 py-1.5 rounded-lg text-sm font-medium bg-blue-600 text-white disabled:opacity-40 disabled:cursor-not-allowed hover:bg-blue-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
    >
      {loading ? 'Working…' : children}
    </button>
  )
}

function Banner({ ok, children }: { ok: boolean; children: React.ReactNode }) {
  return (
    <div
      className={
        'text-sm rounded-lg px-3 py-2 ' +
        (ok
          ? 'bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-300'
          : 'bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300')
      }
    >
      {children}
    </div>
  )
}

function Unsupported() {
  return (
    <div className="max-w-2xl mx-auto text-center py-12 space-y-3">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Board Explorer</h1>
      <p className="text-gray-600 dark:text-gray-400">
        This tool needs a modern browser with WebAssembly, Web Workers, and the DecompressionStream API.
        Please try the latest Chrome, Edge, Firefox, or Safari 16.4+.
      </p>
    </div>
  )
}
