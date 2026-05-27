import type { PrismTheme } from 'prism-react-renderer'

export type SupportedLanguage =
  | 'javascript'
  | 'typescript'
  | 'python'
  | 'rust'
  | 'go'
  | 'java'
  | 'cpp'
  | 'markup'
  | 'css'
  | 'sql'
  | 'json'
  | 'bash'
  | 'ruby'
  | 'php'
  | 'swift'
  | 'kotlin'
  | 'markdown'
  | 'plain'

export interface LanguageOption {
  value: SupportedLanguage
  label: string
}

export type ThemeId =
  | 'dracula'
  | 'oneDark'
  | 'githubDark'
  | 'githubLight'
  | 'monokai'
  | 'nord'
  | 'solarizedDark'

export interface ThemeDefinition {
  id: ThemeId
  label: string
  prismTheme: PrismTheme
  bgColor: string
  isLight: boolean
}

export type BackgroundId =
  | 'sunset'
  | 'ocean'
  | 'forest'
  | 'midnight'
  | 'peach'
  | 'arctic'
  | 'candy'
  | 'none'

export interface BackgroundOption {
  id: BackgroundId
  label: string
  gradient: string
}

export type PaddingValue = 16 | 32 | 48 | 64

export type BorderRadiusValue = 0 | 8 | 16 | 24

export type FontSizeValue = 14 | 16 | 18 | 20

export interface SnapshotSettings {
  code: string
  language: SupportedLanguage
  themeId: ThemeId
  backgroundId: BackgroundId
  padding: PaddingValue
  borderRadius: BorderRadiusValue
  showWindowControls: boolean
  fontSize: FontSizeValue
  showLineNumbers: boolean
}
