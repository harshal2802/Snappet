// Feature detection — the explorer needs WebAssembly (sql.js), Web Workers, and
// DecompressionStream (to inflate the gzipped board snapshots).

export interface Capabilities {
  wasm: boolean
  worker: boolean
  decompression: boolean
}

let cached: Capabilities | null = null

export function detectCapabilities(): Capabilities {
  if (cached) return cached
  const w = globalThis as unknown as Record<string, unknown>
  cached = {
    wasm: typeof WebAssembly === 'object' && typeof WebAssembly.instantiate === 'function',
    worker: typeof Worker === 'function',
    decompression: typeof w.DecompressionStream === 'function',
  }
  return cached
}

export function isSupported(c: Capabilities): boolean {
  return c.wasm && c.worker && c.decompression
}
