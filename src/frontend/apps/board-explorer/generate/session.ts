// Browser inference for the climb generator: load the quantized ONNX model +
// bundled metadata, and expose a `runLogits` the pure decoder (decode.ts) drives.
//
// Models are described by a small registry (climb-generator/manifest.json) so a
// new/better checkpoint integrates as a data-only change — drop its `.onnx` +
// `meta.json` into public/climb-generator/ and add one manifest entry. Loaders
// are keyed by model id, so each model's bytes (and the runtime) only download
// the first time that model is actually selected.
//
// onnxruntime-web is loaded lazily from its wasm-only subpath ('/wasm') so the
// large runtime (and the WebGPU/JSEP wasm we don't use) stays out of the main
// bundle and only downloads when the Generate tab is opened.
import type { InferenceSession } from 'onnxruntime-web'
import type { GenMeta, RunLogits } from './decode'

const BASE = import.meta.env.BASE_URL
const ASSET = (f: string): string => `${BASE}climb-generator/${f}`

/** One entry in the model registry. `model` / `meta` are filenames under
 *  public/climb-generator/. `sizeBytes` (optional) drives the download hint. */
export interface ModelEntry {
  id: string
  label: string
  model: string
  meta: string
  sizeBytes?: number
  description?: string
}

export interface ModelManifest {
  /** id of the model to select by default (typically the newest / best). */
  default: string
  models: ModelEntry[]
}

// Fallback used when manifest.json is absent or malformed, so the generator keeps
// working against the single committed checkpoint with no extra files required.
const FALLBACK_MANIFEST: ModelManifest = {
  default: 'v1',
  models: [{ id: 'v1', label: 'Default model', model: 'model.q.onnx', meta: 'meta.json' }],
}

let ortPromise: Promise<typeof import('onnxruntime-web/wasm')> | null = null
const getOrt = (): Promise<typeof import('onnxruntime-web/wasm')> =>
  (ortPromise ??= import('onnxruntime-web/wasm'))

let manifestPromise: Promise<ModelManifest> | null = null
const metaCache = new Map<string, Promise<GenMeta>>()
const sessionCache = new Map<string, Promise<InferenceSession>>()

/** Load (and cache) the model registry. Tolerant: any failure falls back to the
 *  single bundled model so the Generate tab never breaks on a missing manifest. */
export function loadModelManifest(): Promise<ModelManifest> {
  return (manifestPromise ??= fetch(ASSET('manifest.json'))
    .then((r) => (r.ok ? (r.json() as Promise<ModelManifest>) : FALLBACK_MANIFEST))
    .then((m) => (m && Array.isArray(m.models) && m.models.length ? m : FALLBACK_MANIFEST))
    .catch(() => FALLBACK_MANIFEST))
}

export function loadMeta(entry: ModelEntry): Promise<GenMeta> {
  let p = metaCache.get(entry.id)
  if (!p) {
    p = fetch(ASSET(entry.meta)).then((r) => {
      if (!r.ok) throw new Error(`${entry.meta}: ${r.status}`)
      return r.json() as Promise<GenMeta>
    })
    metaCache.set(entry.id, p)
  }
  return p
}

export function loadSession(entry: ModelEntry): Promise<InferenceSession> {
  let p = sessionCache.get(entry.id)
  if (!p) {
    p = (async () => {
      const ort = await getOrt()
      // Self-hosted wasm (copied to public/climb-generator/ort by the vite plugin),
      // single-threaded so it works without cross-origin isolation (GitHub Pages
      // doesn't send COOP/COEP for SharedArrayBuffer).
      ort.env.wasm.wasmPaths = ASSET('ort/')
      ort.env.wasm.numThreads = 1
      return ort.InferenceSession.create(ASSET(entry.model), { executionProviders: ['wasm'] })
    })()
    sessionCache.set(entry.id, p)
  }
  return p
}

/** Bind a `runLogits` to a session: right-pad tokens to `block`, run, return the
 *  logit row at the last real position (trailing PAD is causally masked out). */
export function makeRunLogits(session: InferenceSession, meta: GenMeta): RunLogits {
  const vocab = meta.itos.length
  const pad = BigInt(meta.pad)
  return async (tokens: number[]): Promise<Float32Array> => {
    const ort = await getOrt()
    const data = new BigInt64Array(meta.block).fill(pad)
    for (let i = 0; i < tokens.length; i++) data[i] = BigInt(tokens[i])
    const input = new ort.Tensor('int64', data, [1, meta.block])
    const out = await session.run({ tokens: input })
    const logits = out.logits.data as Float32Array // [1, block, vocab]
    const pos = tokens.length - 1
    return logits.slice(pos * vocab, (pos + 1) * vocab)
  }
}

/** Free one model's session and drop it from the cache (e.g. after switching to
 *  a different model). Its meta stays cached — it's tiny and cheap to reuse. */
export async function disposeSession(id: string): Promise<void> {
  const p = sessionCache.get(id)
  if (!p) return
  sessionCache.delete(id)
  try {
    await (await p).release()
  } catch {
    /* already released / never finished creating */
  }
}
