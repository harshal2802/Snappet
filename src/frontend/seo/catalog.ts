// Single source of truth for every mini-app's metadata AND its SEO/AEO content.
// Pure data only (NO React imports) so it can be consumed by the runtime app,
// the routes table, and the build-time prerender plugin (vite.config.ts) alike.

export type AppCategory =
  | 'Utilities'
  | 'Calculators'
  | 'Productivity'
  | 'Developer Tools'
  | 'Creative'
  | 'Health'

export interface Faq {
  q: string
  a: string
}

export interface AppMeta {
  path: string
  label: string
  description: string // short card description
  category: AppCategory
  icon: string
  // SEO/AEO extras
  tagline?: string // one-sentence definition ("X is a free browser tool that…")
  features?: string[]
  faqs?: Faq[]
  keywords?: string[]
  noindex?: boolean // exclude from sitemap + mark noindex (placeholders)
}

export const SITE = {
  name: 'Snappet',
  // Absolute origin + base path (GitHub Pages project page). No trailing slash here.
  url: 'https://harshal2802.github.io/Snappet',
  tagline: 'Fast, focused, free browser tools — no sign-up, no install.',
  description:
    'Snappet is a hub of 20+ free, privacy-friendly browser tools — calculators, developer utilities, productivity apps, a video editor and more. No sign-up, no install, works offline.',
  ogImage: 'https://harshal2802.github.io/Snappet/pwa-512x512.png',
  twitter: '',
} as const

export const catalog: AppMeta[] = [
  {
    path: '/example',
    label: 'Example',
    description: 'A placeholder mini-app — replace with a real tool.',
    category: 'Utilities',
    icon: '🔧',
    noindex: true,
  },
  {
    path: '/tip-calculator',
    label: 'Tip Calculator',
    description: 'Calculate tip and split the bill among friends.',
    category: 'Calculators',
    icon: '💰',
    tagline:
      'The Snappet Tip Calculator is a free browser tool that works out the tip and splits the bill evenly across any number of people — instantly, with no sign-up.',
    features: [
      'Custom tip percentage with quick presets',
      'Split the total across any group size',
      'Per-person amount including tip',
      'Works offline, nothing leaves your device',
    ],
    faqs: [
      {
        q: 'Is the tip calculator free?',
        a: 'Yes — it is completely free, runs entirely in your browser, and needs no sign-up or download.',
      },
      {
        q: 'How do I split a bill with tip?',
        a: 'Enter the bill total, choose a tip percentage, and set the number of people. Snappet shows the tip, grand total, and the amount each person owes.',
      },
    ],
    keywords: ['tip calculator', 'bill splitter', 'gratuity calculator'],
  },
  {
    path: '/expense-splitter',
    label: 'Expense Splitter',
    description: 'Split bills and expenses across a group with custom amounts.',
    category: 'Calculators',
    icon: '🧾',
    tagline:
      'The Snappet Expense Splitter is a free browser tool for sharing group expenses fairly — track who paid what and see exactly who owes whom.',
    features: [
      'Add people and itemized expenses',
      'Unequal / custom split amounts',
      'Automatic "who owes whom" settle-up',
      'Saved locally — your data stays on your device',
    ],
    faqs: [
      {
        q: 'Can I split expenses unequally?',
        a: 'Yes. You can assign custom amounts per person for each expense, not just an even split.',
      },
      {
        q: 'Does it store my data anywhere?',
        a: 'No. Everything is saved in your browser (localStorage); nothing is uploaded to a server.',
      },
    ],
    keywords: ['expense splitter', 'split bills', 'group expenses', 'settle up'],
  },
  {
    path: '/kanban-board',
    label: 'Kanban Board',
    description: 'Organize tasks with a drag-and-drop kanban board.',
    category: 'Productivity',
    icon: '📋',
    tagline:
      'The Snappet Kanban Board is a free, browser-based task board that organizes work into drag-and-drop columns — no account required.',
    features: [
      'Drag-and-drop cards across columns',
      'Add, edit, and delete tasks and columns',
      'Saved automatically in your browser',
      'Clean, distraction-free interface',
    ],
    faqs: [
      {
        q: 'Do I need an account to use the kanban board?',
        a: 'No. It works instantly in your browser with no sign-up; your board is saved locally.',
      },
    ],
    keywords: ['kanban board', 'task board', 'to-do board', 'project tracker'],
  },
  {
    path: '/json-explorer',
    label: 'JSON Explorer & Formatter',
    description:
      'Format, minify, validate, explore, and diff JSON — collapsible tree, char/line counts, one-click copy.',
    category: 'Developer Tools',
    icon: '🔍',
    tagline:
      'The Snappet JSON Explorer is a free online JSON formatter, validator, and viewer that pretty-prints, minifies, and lets you explore JSON as a collapsible tree.',
    features: [
      'Format (pretty-print) and minify JSON',
      'Validate with clear error messages',
      'Collapsible tree explorer',
      'Diff two JSON documents; one-click copy',
    ],
    faqs: [
      {
        q: 'Is my JSON sent to a server?',
        a: 'No. All parsing, formatting, and diffing happen locally in your browser — your data never leaves your device.',
      },
      {
        q: 'Can it validate JSON?',
        a: 'Yes. It validates as you type and highlights syntax errors with the line and position.',
      },
    ],
    keywords: ['json formatter', 'json validator', 'json viewer', 'json beautifier', 'json diff'],
  },
  {
    path: '/regex-playground',
    label: 'Regex Playground',
    description: 'Test, debug, and understand regular expressions in real time.',
    category: 'Developer Tools',
    icon: '🔤',
    tagline:
      'The Snappet Regex Playground is a free online regex tester that matches, highlights, and explains regular expressions against your text in real time.',
    features: [
      'Live match highlighting as you type',
      'Capture groups and flags (g, i, m, s, u)',
      'Replace preview',
      'Runs entirely in your browser',
    ],
    faqs: [
      {
        q: 'Which regex flavor does it use?',
        a: 'It uses the JavaScript (ECMAScript) regular-expression engine built into your browser.',
      },
    ],
    keywords: ['regex tester', 'regular expression', 'regex playground', 'regex debugger'],
  },
  {
    path: '/code-snapshot',
    label: 'Code Snapshot',
    description: 'Generate beautiful code screenshots with customizable themes.',
    category: 'Developer Tools',
    icon: '📸',
    tagline:
      'Snappet Code Snapshot is a free browser tool that turns source code into beautiful, shareable images with syntax highlighting and customizable themes.',
    features: [
      'Syntax highlighting for many languages',
      'Customizable themes, padding, and background',
      'Export a high-resolution PNG',
      'No watermark, no sign-up',
    ],
    faqs: [
      {
        q: 'Can I download the code image?',
        a: 'Yes — export a high-resolution PNG with one click, with no watermark.',
      },
    ],
    keywords: ['code screenshot', 'code to image', 'carbon alternative', 'code snippet image'],
  },
  {
    path: '/markdown-editor',
    label: 'Markdown Editor',
    description: 'Write and preview Markdown with live rendering and export.',
    category: 'Productivity',
    icon: '📝',
    tagline:
      'The Snappet Markdown Editor is a free, browser-based Markdown editor with a live side-by-side preview and export — no sign-up required.',
    features: [
      'Live side-by-side preview',
      'GitHub-flavored Markdown',
      'Export your document',
      'Autosaves locally',
    ],
    faqs: [
      {
        q: 'Does it support GitHub-flavored Markdown?',
        a: 'Yes, including tables, task lists, and fenced code blocks.',
      },
    ],
    keywords: ['markdown editor', 'markdown preview', 'online markdown', 'md editor'],
  },
  {
    path: '/doc-viewer',
    label: 'Document Viewer',
    description:
      'View PDFs and images with full-featured viewer and OCR text extraction.',
    category: 'Utilities',
    icon: '📄',
    tagline:
      'The Snappet Document Viewer is a free, private, in-browser PDF and image viewer with OCR that extracts selectable text — your files never leave your device.',
    features: [
      'View PDFs and images with zoom and paging',
      'OCR text extraction from scans and images',
      '100% client-side — files stay on your device',
      'No upload, no sign-up',
    ],
    faqs: [
      {
        q: 'Are my documents uploaded anywhere?',
        a: 'No. The viewer and OCR run entirely in your browser; your files are never sent to a server.',
      },
      {
        q: 'Can it extract text from a scanned PDF or photo?',
        a: 'Yes. Built-in OCR recognizes text in images and scanned documents so you can copy it.',
      },
    ],
    keywords: ['pdf viewer', 'image viewer', 'ocr', 'extract text from pdf', 'online document viewer'],
  },
  {
    path: '/age-calculator',
    label: 'Age Calculator',
    description: 'Calculate your exact age, days until your next birthday, and more.',
    category: 'Calculators',
    icon: '🎂',
    tagline:
      'The Snappet Age Calculator is a free browser tool that computes your exact age in years, months, and days, plus the countdown to your next birthday.',
    features: [
      'Exact age in years, months, and days',
      'Total days, weeks, and hours lived',
      'Days until your next birthday',
      'Instant, private, no sign-up',
    ],
    faqs: [
      {
        q: 'How is exact age calculated?',
        a: 'Enter your date of birth and Snappet computes the precise difference to today in years, months, and days.',
      },
    ],
    keywords: ['age calculator', 'date of birth calculator', 'how old am i', 'birthday countdown'],
  },
  {
    path: '/pomodoro-timer',
    label: 'Pomodoro Timer',
    description: 'Focus timer with 25-min work sessions and short/long breaks.',
    category: 'Productivity',
    icon: '🍅',
    tagline:
      'The Snappet Pomodoro Timer is a free, browser-based focus timer that runs 25-minute work sessions with short and long breaks to boost productivity.',
    features: [
      'Classic 25/5 Pomodoro cycle with long breaks',
      'Session count and progress',
      'Audible alert when a session ends',
      'No sign-up, works offline',
    ],
    faqs: [
      {
        q: 'What is the Pomodoro Technique?',
        a: 'It is a time-management method that breaks work into focused 25-minute intervals separated by short breaks.',
      },
    ],
    keywords: ['pomodoro timer', 'focus timer', 'productivity timer', '25 minute timer'],
  },
  {
    path: '/color-picker',
    label: 'Color Picker & Converter',
    description:
      'Convert between HEX, RGB, and HSL with a live preview and contrast checker.',
    category: 'Developer Tools',
    icon: '🎨',
    tagline:
      'The Snappet Color Picker is a free online tool that converts colors between HEX, RGB, and HSL with a live preview and a WCAG contrast checker.',
    features: [
      'Convert HEX ⇄ RGB ⇄ HSL',
      'Live color preview',
      'WCAG contrast ratio checker',
      'One-click copy of any format',
    ],
    faqs: [
      {
        q: 'Can it check color contrast for accessibility?',
        a: 'Yes. It shows the WCAG contrast ratio between two colors and whether it passes AA/AAA.',
      },
    ],
    keywords: ['color picker', 'hex to rgb', 'color converter', 'contrast checker', 'hsl'],
  },
  {
    path: '/password-generator',
    label: 'Password Generator',
    description:
      'Generate strong passwords with custom length, character sets, and a live strength meter.',
    category: 'Utilities',
    icon: '🔑',
    tagline:
      'The Snappet Password Generator is a free browser tool that creates strong, random passwords with a live strength meter — generated locally, never stored or sent.',
    features: [
      'Custom length and character sets',
      'Cryptographically random generation',
      'Live strength meter',
      'Generated on-device — never transmitted',
    ],
    faqs: [
      {
        q: 'Are the generated passwords safe?',
        a: 'Yes. Passwords are generated locally using your browser’s cryptographic randomness and are never sent or saved anywhere.',
      },
    ],
    keywords: ['password generator', 'strong password', 'random password', 'secure password'],
  },
  {
    path: '/qr-code',
    label: 'QR Code Generator',
    description: 'Generate scannable QR codes for text, URLs, WiFi, and contacts.',
    category: 'Utilities',
    icon: '📲',
    tagline:
      'The Snappet QR Code Generator is a free browser tool that turns text, URLs, WiFi credentials, and contacts into scannable QR codes you can download.',
    features: [
      'QR codes for text, URL, WiFi, and contacts',
      'Adjustable size and error correction',
      'Download as PNG',
      'Free, no watermark, no sign-up',
    ],
    faqs: [
      {
        q: 'Can I make a WiFi QR code?',
        a: 'Yes. Enter your network name and password and Snappet generates a QR code that joins the WiFi when scanned.',
      },
    ],
    keywords: ['qr code generator', 'wifi qr code', 'url to qr', 'free qr code'],
  },
  {
    path: '/tally-counter',
    label: 'Tally Counter',
    description: 'Count things on the go with a giant tap-anywhere counter.',
    category: 'Utilities',
    icon: '🔢',
    tagline:
      'The Snappet Tally Counter is a free, tap-anywhere counter for your phone or desktop — count people, reps, inventory, or laps with one big button.',
    features: [
      'Giant tap-anywhere increment',
      'Decrement and reset',
      'Keeps your count between visits',
      'Works offline',
    ],
    faqs: [
      {
        q: 'What can I use a tally counter for?',
        a: 'Counting attendance, gym reps, inventory, laps, knitting rows — anything you would use a handheld clicker for.',
      },
    ],
    keywords: ['tally counter', 'click counter', 'online counter', 'tap counter'],
  },
  {
    path: '/random-picker',
    label: 'Random Picker',
    description: 'Flip a coin, roll dice, pick from a list, or generate a random number.',
    category: 'Utilities',
    icon: '🎲',
    tagline:
      'The Snappet Random Picker is a free browser tool to flip a coin, roll dice, pick a random name from a list, or generate a random number.',
    features: [
      'Coin flip and dice roll',
      'Pick a random item from your list',
      'Random number in a custom range',
      'Fair, instant, no sign-up',
    ],
    faqs: [
      {
        q: 'Can it pick a random winner from a list?',
        a: 'Yes. Paste your list of names or items and Snappet picks one at random — great for giveaways and decisions.',
      },
    ],
    keywords: ['random picker', 'coin flip', 'dice roller', 'random name picker', 'random number generator'],
  },
  {
    path: '/stopwatch',
    label: 'Stopwatch',
    description: 'Time anything with lap splits — workouts, cooking, intervals.',
    category: 'Productivity',
    icon: '⏱️',
    tagline:
      'The Snappet Stopwatch is a free, accurate online stopwatch with lap splits for workouts, cooking, study sessions, and intervals.',
    features: [
      'Start, stop, and reset',
      'Lap / split times',
      'Accurate to hundredths of a second',
      'No sign-up, works offline',
    ],
    faqs: [
      {
        q: 'Does the stopwatch record lap times?',
        a: 'Yes. Tap Lap to record split times while the stopwatch keeps running.',
      },
    ],
    keywords: ['online stopwatch', 'lap timer', 'interval timer', 'free stopwatch'],
  },
  {
    path: '/unit-converter',
    label: 'Unit Converter',
    description:
      'Convert length, weight, temperature, volume, speed, time, and data.',
    category: 'Calculators',
    icon: '📐',
    tagline:
      'The Snappet Unit Converter is a free browser tool that converts length, weight, temperature, volume, speed, time, and data sizes instantly.',
    features: [
      'Length, weight, temperature, volume, speed, time, data',
      'Instant two-way conversion',
      'Metric and imperial units',
      'Free, private, no sign-up',
    ],
    faqs: [
      {
        q: 'Which units can I convert?',
        a: 'Length, weight/mass, temperature, volume, speed, time, and digital data sizes, across metric and imperial systems.',
      },
    ],
    keywords: ['unit converter', 'metric to imperial', 'measurement converter', 'cm to inches'],
  },
  {
    path: '/workout',
    label: 'Workout',
    description: 'Browse 800+ exercises with photos and how-to instructions.',
    category: 'Health',
    icon: '💪',
    tagline:
      'Snappet Workout is a free exercise library and workout tracker with 800+ exercises, photos, and step-by-step instructions — build routines and log sessions in your browser.',
    features: [
      '800+ exercises with photos and instructions',
      'Filter by muscle group, equipment, and sport',
      'Build custom routines and log workouts',
      'Progress dashboard — all stored on your device',
    ],
    faqs: [
      {
        q: 'How many exercises are included?',
        a: 'Over 800 exercises, each with images and how-to instructions, filterable by muscle, equipment, and sport.',
      },
      {
        q: 'Is the workout tracker free?',
        a: 'Yes. It is completely free, requires no sign-up, and stores your routines and history locally on your device.',
      },
    ],
    keywords: ['workout app', 'exercise library', 'workout tracker', 'gym log', 'exercise database'],
  },
  {
    path: '/video-editor',
    label: 'Video Editor',
    description:
      'Browser-only video editor — trim, sequence, and export. Strictly client-side.',
    category: 'Creative',
    icon: '🎬',
    tagline:
      'Snappet Video Editor is a free, 100% client-side video editor that trims, splits, sequences, adds text and filters, and exports MP4 — entirely in your browser, with no upload.',
    features: [
      'Trim, split, and sequence clips on a timeline',
      'Text overlays, filters, speed, transitions, and aspect-ratio presets',
      'Full preview player with fullscreen and audio',
      'Export MP4 via WebCodecs — your video never leaves your device',
    ],
    faqs: [
      {
        q: 'Is the video editor really free with no watermark?',
        a: 'Yes. Snappet Video Editor is free and exports without a watermark or sign-up.',
      },
      {
        q: 'Are my videos uploaded to a server?',
        a: 'No. Editing, preview, and MP4 export all run locally using WebCodecs; your footage never leaves your device.',
      },
      {
        q: 'Which browsers are supported?',
        a: 'Modern Chromium browsers (Chrome/Edge), Safari 17+, and Firefox 130+ that support the WebCodecs API.',
      },
    ],
    keywords: ['video editor', 'online video editor', 'browser video editor', 'trim video', 'free video editor no watermark'],
  },
  {
    path: '/board-explorer',
    label: 'Board Explorer',
    description:
      'Browse and filter Aurora climbing-board catalogues (Kilter, Tension, …) and download a filtered SQLite/CSV/JSON.',
    category: 'Utilities',
    icon: '🧗',
    tagline:
      'Snappet Board Explorer is a free, in-browser tool to filter the Kilter / Tension (Aurora) climbing-board catalogue by angle, grade, popularity and more, then export the slice as CSV, JSON, or a SQLite database.',
    features: [
      'Filter climbs by board, layout, angle, grade range, ascents, quality, setter, name, and benchmark',
      'Sortable, paged results — everything queried locally with in-browser SQLite (sql.js)',
      'Export the filtered set as CSV, JSON, or a SQLite .db',
      'The Kilter .db imports directly into the Snappet mobile app — your data never leaves your device',
    ],
    faqs: [
      {
        q: 'Where does the climbing-board data come from?',
        a: 'It is downloaded from Aurora Climbing boards with the open-source boardlib tool and bundled as a snapshot. The app queries that snapshot entirely in your browser; nothing is uploaded.',
      },
      {
        q: 'Can I use the downloaded database in the Snappet phone app?',
        a: 'Yes. Export the Kilter set as a SQLite .db and use "Import catalog file…" in the Snappet mobile app — the schema matches what its importer expects.',
      },
      {
        q: 'Is my data uploaded anywhere?',
        a: 'No. The board data is processed locally with WebAssembly SQLite; filtering and export all happen on your device.',
      },
    ],
    keywords: ['kilter board', 'tension board', 'climbing board database', 'boardlib', 'kilter climbs', 'aurora climbing'],
  },
]

export const catalogByPath: Record<string, AppMeta> = Object.fromEntries(
  catalog.map((m) => [m.path, m]),
)
