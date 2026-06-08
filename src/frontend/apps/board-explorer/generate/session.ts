// Browser inference for the climb generator: load the quantized ONNX model +
// bundled metadata, and expose a `runLogits` the pure decoder (decode.ts) drives.
//
// onnxruntime-web is loaded lazily from its wasm-only subpath ('/wasm') so the
// large runtime (and the WebGPU/JSEP wasm we don't use) stays out of the main
// bundle and only downloads when the Generate tab is opened.
import type { InferenceSession } from 'onnxruntime-web'
import type { GenMeta, RunLogits } from './decode'

const BASE = import.meta.env.BASE_URL
const ASSET = (f: string): string => `${BASE}climb-generator/${f}`

let ortPromise: Promise<typeof import('onnxruntime-web/wasm')> | null = null
const getOrt = (): Promise<typeof import('onnxruntime-web/wasm')> =>
  (ortPromise ??= import('onnxruntime-web/wasm'))

let metaPromise: Promise<GenMeta> | null = null
let sessionPromise: Promise<InferenceSession> | null = null

export function loadMeta(): Promise<GenMeta> {
  return (metaPromise ??= fetch(ASSET('meta.json')).then((r) => {
    if (!r.ok) throw new Error(`meta.json: ${r.status}`)
    return r.json() as Promise<GenMeta>
  }))
}

export function loadSession(): Promise<InferenceSession> {
  return (sessionPromise ??= (async () => {
    const ort = await getOrt()
    // Self-hosted wasm (copied to public/climb-generator/ort by the vite plugin),
    // single-threaded so it works without cross-origin isolation (GitHub Pages
    // doesn't send COOP/COEP for SharedArrayBuffer).
    ort.env.wasm.wasmPaths = ASSET('ort/')
    ort.env.wasm.numThreads = 1
    return ort.InferenceSession.create(ASSET('model.q.onnx'), { executionProviders: ['wasm'] })
  })())
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

/** Free the session (e.g. when leaving the Generate tab). */
export async function disposeSession(): Promise<void> {
  const p = sessionPromise
  sessionPromise = null
  if (p) await (await p).release()
}
