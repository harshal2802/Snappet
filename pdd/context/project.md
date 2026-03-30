# Project: Snappet

**Last updated**: 2026-03-29
**Type**: Frontend / Web app

## What we're building

Snappet is a hub of lightweight single-page web apps — each one focused on doing exactly one thing well. Tools range from practical utilities (bill splitting, QR codes, JSON formatting) to productivity apps (Pomodoro timer, word counter) and developer helpers (regex tester, Base64 encoder). The experience should feel like opening a sharp, focused tool instantly with zero friction.

## Who it's for

Everyday users, students, professionals, and developers who need quick, no-install tools for small everyday problems. Users may arrive via a direct link to a specific mini-app or browse the hub for something useful.

## Stack

- **Language**: TypeScript
- **Framework**: React 18
- **Styling**: Tailwind CSS (dark mode via `dark:` classes, responsive via built-in breakpoints)
- **Routing**: React Router v6 with BrowserRouter + GitHub Pages 404 redirect trick
- **Bundler**: Vite
- **Deployment**: GitHub Pages
- **CI/CD**: GitHub Actions (auto-build and deploy on push to `main`)

## What good output looks like

- Visually appealing and professional — not a developer side project aesthetic
- Dark mode support is required for every mini-app, not optional
- Fully responsive and adaptive: works well on desktop, tablet, iPhone, and Android
- Fast to load and use — no unnecessary steps, modals, or config before a user can interact
- Each mini-app should feel self-contained: someone landing directly on `/tip-calculator` should have everything they need without navigating elsewhere
- Clean, consistent UI language across all mini-apps (shared components, consistent spacing and typography)

## Constraints (what the AI should never do or suggest)

- No backend, no server — everything runs client-side only
- No user accounts, login flows, or data persistence beyond localStorage if needed
- No heavy dependencies that bloat bundle size (avoid full UI libraries like MUI or Ant Design)
- No feature creep within a mini-app — each app does one thing, not three
- Do not suggest class components or non-TypeScript code
- Do not add analytics, tracking, or third-party scripts unless explicitly asked

## Current state

Starting from scratch. No source code written yet.

## Planned mini-apps (initial ideas)

**Utilities**: JSON Formatter, Base64 Encoder/Decoder, Regex Tester, URL Encoder/Decoder, Password Generator, UUID Generator
**Calculators**: Tip Calculator, Bill Splitter, BMI Calculator, Age Calculator, Percentage Calculator, Unit Converter
**Productivity**: Pomodoro Timer, Countdown Timer, Word Counter, Markdown Previewer
**Developer tools**: Color Picker, CSS Gradient Generator, Aspect Ratio Calculator
**Creative**: Random Name Picker, Lorem Ipsum Generator, QR Code Generator
