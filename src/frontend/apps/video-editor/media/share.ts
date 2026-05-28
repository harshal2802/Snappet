export type DeliveryResult =
  | { kind: 'shared' }
  | { kind: 'saved'; path?: string }
  | { kind: 'downloaded'; filename: string }
  | { kind: 'cancelled' }

export async function deliverFile(
  blob: Blob,
  filename: string,
): Promise<DeliveryResult> {
  const file = new File([blob], filename, { type: blob.type })
  const nav = navigator as Navigator & {
    canShare?: (d: ShareData) => boolean
  }

  // 1. Web Share with files (mobile-first).
  if (
    typeof nav.share === 'function' &&
    typeof nav.canShare === 'function' &&
    nav.canShare({ files: [file] })
  ) {
    try {
      await nav.share({ files: [file], title: filename })
      return { kind: 'shared' }
    } catch (e) {
      // AbortError = user cancelled the share sheet; fall through to fallback.
      if ((e as { name?: string }).name !== 'AbortError') {
        // Some platforms throw NotAllowedError if site lacks the activation; fall through.
      }
      // Don't keep returning silently — try a fallback path so user still gets the file.
    }
  }

  // 2. File System Access showSaveFilePicker (desktop Chromium).
  const w = window as unknown as {
    showSaveFilePicker?: (opts: {
      suggestedName?: string
      types?: Array<{
        description?: string
        accept?: Record<string, string[]>
      }>
    }) => Promise<{
      createWritable: () => Promise<{
        write: (data: Blob | Uint8Array) => Promise<void>
        close: () => Promise<void>
      }>
      name: string
    }>
  }
  if (typeof w.showSaveFilePicker === 'function') {
    try {
      const handle = await w.showSaveFilePicker({
        suggestedName: filename,
        types: [
          {
            description: 'MP4 video',
            accept: { 'video/mp4': ['.mp4'] },
          },
        ],
      })
      const writable = await handle.createWritable()
      await writable.write(blob)
      await writable.close()
      return { kind: 'saved', path: handle.name }
    } catch (e) {
      if ((e as { name?: string }).name === 'AbortError') {
        return { kind: 'cancelled' }
      }
      // Fall through to download as last resort.
    }
  }

  // 3. Anchor download (universal fallback).
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.style.display = 'none'
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  // Revoke after a delay to let the browser start the download.
  setTimeout(() => URL.revokeObjectURL(url), 60_000)
  return { kind: 'downloaded', filename }
}
