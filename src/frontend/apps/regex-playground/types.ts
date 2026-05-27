/** Regex flags the user can toggle */
export type RegexFlag = 'g' | 'i' | 'm' | 's'

/** A single match found in the test string */
export interface MatchResult {
  /** The full matched text */
  fullMatch: string
  /** Start index in the test string */
  startIndex: number
  /** End index (exclusive) in the test string */
  endIndex: number
  /** Capture groups (named or indexed) */
  groups: CaptureGroup[]
}

/** A capture group within a match */
export interface CaptureGroup {
  /** Group index (1-based) */
  index: number
  /** Named group name, if any */
  name: string | null
  /** The captured text (null if group didn't participate) */
  value: string | null
}

/** A token from the regex pattern explainer */
export interface ExplainerToken {
  /** The raw token text from the regex */
  token: string
  /** Plain-English explanation */
  description: string
}

/** A pre-built common regex pattern */
export interface CommonPattern {
  /** Display name */
  name: string
  /** The regex pattern string */
  pattern: string
  /** Suggested flags */
  flags: RegexFlag[]
  /** Example test string */
  testString: string
}
