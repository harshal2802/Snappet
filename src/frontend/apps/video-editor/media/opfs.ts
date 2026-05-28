// Origin Private File System helpers.
// All paths are POSIX-style with no leading slash, e.g. 'proxies/abc.mp4'.

async function getRoot(): Promise<FileSystemDirectoryHandle> {
  return await navigator.storage.getDirectory()
}

async function resolveDir(
  parts: string[],
  create: boolean,
): Promise<FileSystemDirectoryHandle> {
  let dir = await getRoot()
  for (const part of parts) {
    if (!part) continue
    dir = await dir.getDirectoryHandle(part, { create })
  }
  return dir
}

function splitPath(path: string): { dirs: string[]; name: string } {
  const segs = path.split('/').filter(Boolean)
  const name = segs.pop()
  if (!name) throw new Error(`Invalid OPFS path: ${path}`)
  return { dirs: segs, name }
}

export async function ensureDir(path: string): Promise<void> {
  const parts = path.split('/').filter(Boolean)
  await resolveDir(parts, true)
}

export async function writeFile(
  path: string,
  data: Uint8Array | Blob | ArrayBuffer,
): Promise<void> {
  const { dirs, name } = splitPath(path)
  const dir = await resolveDir(dirs, true)
  const handle = await dir.getFileHandle(name, { create: true })
  const writable = await handle.createWritable()
  if (data instanceof Blob) {
    await writable.write(data)
  } else {
    // Cast through Blob to sidestep TS5's ArrayBufferLike/ArrayBuffer strictness.
    const blob = new Blob([data as BlobPart])
    await writable.write(blob)
  }
  await writable.close()
}

export async function readFile(path: string): Promise<Blob> {
  const { dirs, name } = splitPath(path)
  const dir = await resolveDir(dirs, false)
  const handle = await dir.getFileHandle(name, { create: false })
  return await handle.getFile()
}

export async function deleteFile(path: string): Promise<void> {
  const { dirs, name } = splitPath(path)
  try {
    const dir = await resolveDir(dirs, false)
    await dir.removeEntry(name)
  } catch (e) {
    // Treat missing files as already-deleted; surface other errors.
    if ((e as { name?: string }).name !== 'NotFoundError') throw e
  }
}

export async function listFiles(dirPath: string): Promise<string[]> {
  try {
    const dir = await resolveDir(dirPath.split('/').filter(Boolean), false)
    const out: string[] = []
    // @ts-expect-error iterating FileSystemDirectoryHandle isn't in lib.dom yet
    for await (const [name, handle] of dir.entries() as AsyncIterable<
      [string, FileSystemHandle]
    >) {
      if (handle.kind === 'file') out.push(name)
    }
    return out
  } catch (e) {
    if ((e as { name?: string }).name === 'NotFoundError') return []
    throw e
  }
}

export async function estimateQuota(): Promise<{
  used: number
  quota: number
  percentUsed: number
}> {
  if (!navigator.storage?.estimate) {
    return { used: 0, quota: 0, percentUsed: 0 }
  }
  const e = await navigator.storage.estimate()
  const used = e.usage ?? 0
  const quota = e.quota ?? 0
  const percentUsed = quota > 0 ? used / quota : 0
  return { used, quota, percentUsed }
}

export async function clearAll(): Promise<void> {
  const root = await getRoot()
  // @ts-expect-error iterating FileSystemDirectoryHandle isn't in lib.dom yet
  for await (const name of root.keys() as AsyncIterable<string>) {
    await root.removeEntry(name, { recursive: true })
  }
}
