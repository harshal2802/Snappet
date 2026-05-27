import { themes } from 'prism-react-renderer'
import type { PrismTheme } from 'prism-react-renderer'
import type {
  ThemeId,
  ThemeDefinition,
  BackgroundOption,
  LanguageOption,
  SupportedLanguage,
} from './types'

/* ------------------------------------------------------------------ */
/*  Custom PrismTheme definitions for themes not in prism-react-renderer */
/* ------------------------------------------------------------------ */

const githubDarkTheme: PrismTheme = {
  plain: {
    color: '#c9d1d9',
    backgroundColor: '#0d1117',
  },
  styles: [
    { types: ['comment', 'prolog', 'doctype', 'cdata'], style: { color: '#8b949e' } },
    { types: ['punctuation'], style: { color: '#c9d1d9' } },
    { types: ['property', 'tag', 'boolean', 'number', 'constant', 'symbol', 'deleted'], style: { color: '#79c0ff' } },
    { types: ['selector', 'attr-name', 'string', 'char', 'builtin', 'inserted'], style: { color: '#a5d6ff' } },
    { types: ['operator', 'entity', 'url'], style: { color: '#d2a8ff' } },
    { types: ['atrule', 'attr-value', 'keyword'], style: { color: '#ff7b72' } },
    { types: ['function', 'class-name'], style: { color: '#d2a8ff' } },
    { types: ['regex', 'important', 'variable'], style: { color: '#ffa657' } },
  ],
}

const githubLightTheme: PrismTheme = {
  plain: {
    color: '#24292f',
    backgroundColor: '#ffffff',
  },
  styles: [
    { types: ['comment', 'prolog', 'doctype', 'cdata'], style: { color: '#6e7781' } },
    { types: ['punctuation'], style: { color: '#24292f' } },
    { types: ['property', 'tag', 'boolean', 'number', 'constant', 'symbol', 'deleted'], style: { color: '#0550ae' } },
    { types: ['selector', 'attr-name', 'string', 'char', 'builtin', 'inserted'], style: { color: '#0a3069' } },
    { types: ['operator', 'entity', 'url'], style: { color: '#cf222e' } },
    { types: ['atrule', 'attr-value', 'keyword'], style: { color: '#cf222e' } },
    { types: ['function', 'class-name'], style: { color: '#8250df' } },
    { types: ['regex', 'important', 'variable'], style: { color: '#953800' } },
  ],
}

const monokaiTheme: PrismTheme = {
  plain: {
    color: '#f8f8f2',
    backgroundColor: '#272822',
  },
  styles: [
    { types: ['comment', 'prolog', 'doctype', 'cdata'], style: { color: '#75715e' } },
    { types: ['punctuation'], style: { color: '#f8f8f2' } },
    { types: ['property', 'tag', 'constant', 'symbol', 'deleted'], style: { color: '#f92672' } },
    { types: ['boolean', 'number'], style: { color: '#ae81ff' } },
    { types: ['selector', 'attr-name', 'string', 'char', 'builtin', 'inserted'], style: { color: '#e6db74' } },
    { types: ['operator', 'entity', 'url'], style: { color: '#f8f8f2' } },
    { types: ['atrule', 'attr-value', 'keyword'], style: { color: '#66d9ef', fontStyle: 'italic' } },
    { types: ['function', 'class-name'], style: { color: '#a6e22e' } },
    { types: ['regex', 'important', 'variable'], style: { color: '#fd971f' } },
  ],
}

const nordTheme: PrismTheme = {
  plain: {
    color: '#d8dee9',
    backgroundColor: '#2e3440',
  },
  styles: [
    { types: ['comment', 'prolog', 'doctype', 'cdata'], style: { color: '#616e88' } },
    { types: ['punctuation'], style: { color: '#d8dee9' } },
    { types: ['property', 'tag', 'boolean', 'number', 'constant', 'symbol', 'deleted'], style: { color: '#b48ead' } },
    { types: ['selector', 'attr-name', 'string', 'char', 'builtin', 'inserted'], style: { color: '#a3be8c' } },
    { types: ['operator', 'entity', 'url'], style: { color: '#81a1c1' } },
    { types: ['atrule', 'attr-value', 'keyword'], style: { color: '#81a1c1' } },
    { types: ['function', 'class-name'], style: { color: '#88c0d0' } },
    { types: ['regex', 'important', 'variable'], style: { color: '#ebcb8b' } },
  ],
}

const solarizedDarkTheme: PrismTheme = {
  plain: {
    color: '#839496',
    backgroundColor: '#002b36',
  },
  styles: [
    { types: ['comment', 'prolog', 'doctype', 'cdata'], style: { color: '#586e75' } },
    { types: ['punctuation'], style: { color: '#839496' } },
    { types: ['property', 'tag', 'boolean', 'number', 'constant', 'symbol', 'deleted'], style: { color: '#268bd2' } },
    { types: ['selector', 'attr-name', 'string', 'char', 'builtin', 'inserted'], style: { color: '#2aa198' } },
    { types: ['operator', 'entity', 'url'], style: { color: '#859900' } },
    { types: ['atrule', 'attr-value', 'keyword'], style: { color: '#b58900' } },
    { types: ['function', 'class-name'], style: { color: '#b58900' } },
    { types: ['regex', 'important', 'variable'], style: { color: '#cb4b16' } },
  ],
}

/* ------------------------------------------------------------------ */
/*  Theme registry                                                      */
/* ------------------------------------------------------------------ */

const themeMap: Record<ThemeId, ThemeDefinition> = {
  dracula: {
    id: 'dracula',
    label: 'Dracula',
    prismTheme: themes.dracula,
    bgColor: '#282a36',
    isLight: false,
  },
  oneDark: {
    id: 'oneDark',
    label: 'One Dark',
    prismTheme: themes.oneDark,
    bgColor: '#282c34',
    isLight: false,
  },
  githubDark: {
    id: 'githubDark',
    label: 'GitHub Dark',
    prismTheme: githubDarkTheme,
    bgColor: '#0d1117',
    isLight: false,
  },
  githubLight: {
    id: 'githubLight',
    label: 'GitHub Light',
    prismTheme: githubLightTheme,
    bgColor: '#ffffff',
    isLight: true,
  },
  monokai: {
    id: 'monokai',
    label: 'Monokai',
    prismTheme: monokaiTheme,
    bgColor: '#272822',
    isLight: false,
  },
  nord: {
    id: 'nord',
    label: 'Nord',
    prismTheme: nordTheme,
    bgColor: '#2e3440',
    isLight: false,
  },
  solarizedDark: {
    id: 'solarizedDark',
    label: 'Solarized Dark',
    prismTheme: solarizedDarkTheme,
    bgColor: '#002b36',
    isLight: false,
  },
}

export const THEMES: ThemeDefinition[] = Object.values(themeMap)

export function getTheme(id: ThemeId): ThemeDefinition {
  return themeMap[id]
}

/* ------------------------------------------------------------------ */
/*  Background gradients                                                */
/* ------------------------------------------------------------------ */

export const BACKGROUNDS: BackgroundOption[] = [
  { id: 'sunset',   label: 'Sunset',   gradient: 'linear-gradient(135deg, #f093fb, #f5576c)' },
  { id: 'ocean',    label: 'Ocean',    gradient: 'linear-gradient(135deg, #667eea, #764ba2)' },
  { id: 'forest',   label: 'Forest',   gradient: 'linear-gradient(135deg, #11998e, #38ef7d)' },
  { id: 'midnight', label: 'Midnight', gradient: 'linear-gradient(135deg, #0c0c1d, #1a1a3e)' },
  { id: 'peach',    label: 'Peach',    gradient: 'linear-gradient(135deg, #ffecd2, #fcb69f)' },
  { id: 'arctic',   label: 'Arctic',   gradient: 'linear-gradient(135deg, #e0eafc, #cfdef3)' },
  { id: 'candy',    label: 'Candy',    gradient: 'linear-gradient(135deg, #a18cd1, #fbc2eb)' },
  { id: 'none',     label: 'None',     gradient: 'transparent' },
]

export function getBackground(id: string): BackgroundOption {
  return BACKGROUNDS.find((b) => b.id === id) ?? BACKGROUNDS[0]
}

/* ------------------------------------------------------------------ */
/*  Language list                                                       */
/* ------------------------------------------------------------------ */

export const LANGUAGES: LanguageOption[] = [
  { value: 'javascript', label: 'JavaScript' },
  { value: 'typescript', label: 'TypeScript' },
  { value: 'python',     label: 'Python' },
  { value: 'rust',       label: 'Rust' },
  { value: 'go',         label: 'Go' },
  { value: 'java',       label: 'Java' },
  { value: 'cpp',        label: 'C++' },
  { value: 'markup',     label: 'HTML' },
  { value: 'css',        label: 'CSS' },
  { value: 'sql',        label: 'SQL' },
  { value: 'json',       label: 'JSON' },
  { value: 'bash',       label: 'Bash' },
  { value: 'ruby',       label: 'Ruby' },
  { value: 'php',        label: 'PHP' },
  { value: 'swift',      label: 'Swift' },
  { value: 'kotlin',     label: 'Kotlin' },
  { value: 'markdown',   label: 'Markdown' },
  { value: 'plain',      label: 'Plain Text' },
]

export function getLanguageLabel(value: SupportedLanguage): string {
  return LANGUAGES.find((l) => l.value === value)?.label ?? value
}
