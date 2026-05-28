// Minimal local type shim for mp4box.js (no upstream types shipped).
// Covers only the surface we use: createFile, MP4File events, sample APIs.
declare module 'mp4box' {
  export interface MP4VideoTrackInfo {
    id: number
    type: 'video'
    codec: string
    timescale: number
    duration: number
    nb_samples: number
    video: { width: number; height: number }
  }

  export interface MP4AudioTrackInfo {
    id: number
    type: 'audio'
    codec: string
    timescale: number
    duration: number
    nb_samples: number
    audio: { channel_count: number; sample_rate: number; sample_size: number }
  }

  export type MP4TrackInfo = MP4VideoTrackInfo | MP4AudioTrackInfo

  export interface MP4Info {
    duration: number
    timescale: number
    isFragmented: boolean
    fragment_duration?: number
    isProgressive: boolean
    hasIOD: boolean
    brands: string[]
    created: Date
    modified: Date
    tracks: MP4TrackInfo[]
    videoTracks: MP4VideoTrackInfo[]
    audioTracks: MP4AudioTrackInfo[]
  }

  export interface MP4Sample {
    track_id: number
    description: { avcC?: unknown; hvcC?: unknown }
    is_sync: boolean
    timescale: number
    dts: number
    cts: number
    duration: number
    size: number
    data: Uint8Array
  }

  export interface MP4ArrayBuffer extends ArrayBuffer {
    fileStart: number
  }

  export interface MP4File {
    onReady: ((info: MP4Info) => void) | null
    onError: ((err: string) => void) | null
    onSamples:
      | ((id: number, user: unknown, samples: MP4Sample[]) => void)
      | null
    appendBuffer(data: MP4ArrayBuffer): number
    start(): void
    stop(): void
    flush(): void
    setExtractionOptions(
      trackId: number,
      user?: unknown,
      opts?: { nbSamples?: number; rapAlignment?: boolean },
    ): void
    getTrackById(id: number): { codec: string; nb_samples: number } | null
    // The decoder description (avcC/hvcC box bytes) for a given track.
    getTrackSampleDescription?: (trackId: number) => unknown
  }

  export function createFile(keepMdatData?: boolean): MP4File
}
