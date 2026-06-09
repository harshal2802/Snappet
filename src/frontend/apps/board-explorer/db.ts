// Main-thread wrapper around the sql.js Web Worker (mirrors the video-editor's
// media/proxy.ts pattern). Owns one worker, correlates requests by id, and exposes
// a small promise API. Also loads the board manifest and decompresses snapshots.

import type { BoardMeta, ClimbDetail, ClimbRow, FilterState, ManifestEntry, ValidationResult } from './types'
import type { WorkerRequest, WorkerResponse } from './workerMessages'

const wasmUrl = `${import.meta.env.BASE_URL}sql-wasm.wasm`

let manifestPromise: Promise<ManifestEntry[]> | null = null

export function loadManifest(): Promise<ManifestEntry[]> {
  if (manifestPromise) return manifestPromise
  const url = `${import.meta.env.BASE_URL}board-data/manifest.json`
  manifestPromise = fetch(url)
    .then((r) => {
      if (!r.ok) throw new Error(`Could not load board list (${r.status})`)
      return r.json()
    })
    .then((j) => (j.boards ?? []) as ManifestEntry[])
    .catch((e) => {
      manifestPromise = null
      throw e
    })
  return manifestPromise
}

function entryUrl(entry: ManifestEntry): string {
  return entry.url ?? `${import.meta.env.BASE_URL}board-data/${entry.file}`
}

async function fetchAndDecompress(entry: ManifestEntry, signal?: AbortSignal): Promise<ArrayBuffer> {
  const res = await fetch(entryUrl(entry), { signal })
  if (!res.ok || !res.body) throw new Error(`Could not download ${entry.label} (${res.status})`)
  const stream = res.body.pipeThrough(new DecompressionStream('gzip'))
  return new Response(stream).arrayBuffer()
}

interface Pending {
  resolve: (value: WorkerResponse) => void
  reject: (err: Error) => void
}

// Omit that distributes over the discriminated union (plain Omit collapses it to
// just the shared `type` key), so each request variant keeps its own fields.
type DistributiveOmit<T, K extends keyof never> = T extends unknown ? Omit<T, K> : never

export class BoardDB {
  private worker: Worker | null = null
  private pending = new Map<number, Pending>()
  private nextId = 1

  private getWorker(): Worker {
    if (this.worker) return this.worker
    const worker = new Worker(new URL('./workers/sql.worker.ts', import.meta.url), {
      type: 'module',
    })
    worker.onmessage = (ev: MessageEvent<WorkerResponse>) => {
      const msg = ev.data
      const p = this.pending.get(msg.id)
      if (!p) return
      this.pending.delete(msg.id)
      if (msg.type === 'error') p.reject(new Error(msg.message))
      else p.resolve(msg)
    }
    worker.onerror = (e) => {
      const err = new Error(e.message || 'Board worker crashed')
      for (const p of this.pending.values()) p.reject(err)
      this.pending.clear()
    }
    this.worker = worker
    return worker
  }

  private send(req: DistributiveOmit<WorkerRequest, 'id'>, transfer?: Transferable[]): Promise<WorkerResponse> {
    const id = this.nextId++
    const worker = this.getWorker()
    return new Promise<WorkerResponse>((resolve, reject) => {
      this.pending.set(id, { resolve, reject })
      const message = { ...req, id } as WorkerRequest
      if (transfer) worker.postMessage(message, transfer)
      else worker.postMessage(message)
    })
  }

  async open(entry: ManifestEntry, signal?: AbortSignal): Promise<BoardMeta> {
    const bytes = await fetchAndDecompress(entry, signal)
    const res = await this.send({ type: 'open', bytes, wasmUrl }, [bytes])
    if (res.type !== 'opened') throw new Error('Unexpected open response')
    return {
      board: entry.board,
      label: entry.label,
      generatedAt: entry.generatedAt,
      isFixture: entry.isFixture,
      importableToMobile: entry.importableToMobile,
      ...res.meta,
    }
  }

  async query(filter: FilterState, limit: number, offset: number): Promise<ClimbRow[]> {
    const res = await this.send({ type: 'query', filter, limit, offset })
    return res.type === 'rows' ? res.rows : []
  }

  async count(filter: FilterState): Promise<number> {
    const res = await this.send({ type: 'count', filter })
    return res.type === 'count' ? res.n : 0
  }

  async getClimb(uuid: string): Promise<ClimbDetail | null> {
    const res = await this.send({ type: 'climb', uuid })
    return res.type === 'climb' ? res.climb : null
  }

  async exportRows(filter: FilterState, cap = 100_000): Promise<ClimbRow[]> {
    const res = await this.send({ type: 'exportRows', filter, cap })
    return res.type === 'rowsAll' ? res.rows : []
  }

  async exportDb(
    filter: FilterState,
    mobileCompatible: boolean,
  ): Promise<{ buffer: ArrayBuffer; validation: ValidationResult }> {
    const res = await this.send({ type: 'exportDb', filter, mobileCompatible })
    if (res.type !== 'exportDb') throw new Error('Unexpected export response')
    return { buffer: res.bytes, validation: res.validation }
  }

  dispose(): void {
    this.worker?.terminate()
    this.worker = null
    this.pending.clear()
  }
}
