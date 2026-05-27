# Research: 5 mobile-friendly mini-app ideas for Snappet

**Date**: 2026-05-27
**Outcome**: Five candidates. All are "Build" (matches Snappet's per-app pattern). Recommended order biased toward mobile-native use cases first.

## Problem

Snappet has 14 mini-apps. The PWA install + mobile fixes shipped in PRs #22–#24 mean the app is now genuinely usable on iPhone. To take advantage of that, add features users would actually reach for on a phone — when standing in a kitchen, walking, in a coffee line — not just shrunken desktop tools.

## Criteria (filter)

A candidate qualifies as "mobile-friendly" if:

1. **Useful in-the-moment when away from a desk** — kitchen, store, gym, social, decision-making
2. **One-hand operable** — big tap targets; doesn't require typing paragraphs
3. **No backend** — fits Snappet's localStorage-only, no-server ethos
4. **Distinct from existing 14 apps** — no overlap with Tip Calculator, Pomodoro, etc.
5. **Buildable in ~1 day** with current stack (React + TS + Tailwind + Vite)

## Inventory check (no overlap)

Existing: hub, example, tip-calculator, expense-splitter, kanban-board, json-explorer, regex-playground, code-snapshot, markdown-editor, doc-viewer, age-calculator, pomodoro-timer, color-picker, password-generator.

None of the 5 candidates below overlap.

## Candidates

### 1. QR Code Generator (Utilities) — **strongest mobile fit**

**What**: Paste text / URL / WiFi creds / vCard, get a scannable QR code. Format toggle + download PNG + Web Share API.

**Mobile angle**: Phones are the destination for QR. Generate on phone A → show on screen → phone B scans. Classic "I need this right now" use case. Tap targets are trivial (one input, one big QR).

**Tech**: `qrcode` npm package (~25 KB gz) renders to canvas. Web Share API to share PNG natively from iOS.

**Effort**: Low (single dependency, one component)

**Acceptance criteria (draft)**:
- Text/URL input → QR renders live
- Format presets: Plain text, URL, WiFi network, vCard contact
- Error-correction-level toggle (L/M/Q/H)
- Big QR (≥ 256×256 px on mobile)
- Download PNG; Web Share button on iOS
- Dark mode (white QR on dark background)
- Persisted via `useLocalStorage`

### 2. Tally Counter (Utilities) — **highest one-hand usability**

**What**: Tap a giant + button to increment, smaller − to decrement. Multiple named counters (people, reps, inventory).

**Mobile angle**: The platonic example of a phone-native tool. Count things in the physical world (queue length, pull-ups, parking spaces, bird-watching). One-thumb usable.

**Tech**: Nothing. Pure React state + the existing `useLocalStorage` hook.

**Effort**: Low

**Acceptance criteria**:
- Default counter showing big number + giant + button (≥ 50% screen height)
- − button (smaller), reset, optional haptic on tap (`navigator.vibrate?.(10)`)
- Multiple saved counters with names, switchable
- Counter values persist across reloads
- Dark mode

### 3. Stopwatch + Lap Timer (Productivity) — **fills a real gap with Pomodoro**

**What**: Time things on the go. Workouts, cooking, intervals, debate-debate-rebuttal. Lap button records splits.

**Mobile angle**: Pomodoro is for focus blocks; stopwatch is for ad-hoc timing. Different mental model. Big start/stop = thumb-target.

**Tech**: `requestAnimationFrame` + `performance.now()` for drift-free timing (same pattern as Pomodoro). SW already running so backgrounding is OK.

**Effort**: Low–Medium (drift-free timer carefully; same care as Pomodoro)

**Acceptance criteria**:
- Big timer display in MM:SS.cc (centiseconds)
- Start / Stop / Reset / Lap buttons (thumb-sized)
- Lap list with split + total, best lap highlighted
- Survives page refresh mid-run via `useLocalStorage`
- Dark mode

### 4. Random Picker (Utilities) — **decision in 1 tap**

**What**: Tabs for Coin flip, Dice (1–6 or custom), Random number in range, Pick from list, Shuffle list.

**Mobile angle**: "Who pays?" / "Where do we eat?" / "Pick a card." Three taps and you have an answer. Tabs make it one app instead of five.

**Tech**: `window.crypto.getRandomValues` for unbiased randomness (same as Password Generator). Pure JS.

**Effort**: Low

**Acceptance criteria**:
- Tab switcher: Coin / Dice / Number / Pick / Shuffle
- Each tab: big result display, big "Roll/Flip/Pick" button, history of last 5 results
- Pick & Shuffle accept a textarea of items (newline-separated)
- Settings (dice count/sides, number range, items) persist
- Dark mode + haptic on action

### 5. Unit Converter (Calculators) — **classic mobile utility**

**What**: Convert between units in Length, Weight, Temperature, Volume, Speed, Time, Data. Bidirectional inputs — type in either side.

**Mobile angle**: Traveling (km↔mi), cooking (cups↔ml), groceries (oz↔g), tech (Mbps↔MB/s). Numeric keypad on phone.

**Tech**: Pure math + a small table of conversion factors per category.

**Effort**: Low

**Acceptance criteria**:
- Category dropdown
- Two unit dropdowns + two number inputs; editing either re-derives the other
- Common pairs as quick-swap buttons (km↔mi, °C↔°F)
- Last category + unit pair persists
- `inputmode="decimal"` for proper mobile keyboard
- Dark mode

## Honorable mentions (not in the top 5)

- **Habit Tracker** (Productivity) — daily checkboxes + streaks. Good mobile fit but overlaps philosophically with Kanban for "what should I do today" type users.
- **Drawing Pad** (Creative) — finger drawing on canvas, export PNG. Fun but a category we don't have yet, and harder to do well at touch-precision.
- **Voice Recorder** (Utilities) — `MediaRecorder` to a Blob. iOS Safari has historically been flaky with MediaRecorder; risk of platform-specific bugs.
- **Hash Generator / Base64 / JWT Decoder** (Developer Tools) — all valid additions but desktop-leaning, and we already have a dense Developer Tools shelf.
- **Barcode Scanner** (Utilities) — using `BarcodeDetector` API. Cool but limited browser support (Chrome/Android solid, iOS Safari only on 16.4+ with limitations); risk of an "app says scan but it doesn't work on your phone" experience.

## Recommendation

**Build all 5, smallest mobile-native first.** Order:

1. **QR Code Generator** (1 day) — most universally useful, plays into the "generate on desktop, scan on phone" PWA story
2. **Tally Counter** (½ day) — proves out the giant-tap-target pattern
3. **Random Picker** (1 day) — wide utility, low risk
4. **Stopwatch + Lap Timer** (1 day) — careful drift-free timing
5. **Unit Converter** (1 day) — most depth but no surprises

Each ships as its own branch + PDD prompt + PR, same workflow as #5–#9 earlier. Each prompt file would be ~150–250 lines following the established structure.

### Why not a single bundled PR?

Same logic as the doc-viewer mobile fixes: bundling would multiply review surface without isolating risk. Each app is independent; one breaking doesn't block the others. Per-PR matches the existing project pattern (every prior mini-app got its own PR — #1 through #20).

## Decision

Log a single entry in `decisions.md`: "Building the 5 candidates in this order." Then `/pdd-plan` + `/pdd-prompts` for #1 (QR Code Generator) to start, when the user is ready. Each subsequent app re-enters the workflow at `/pdd-plan` or `/pdd-prompts` depending on whether the plan is trivial.

## Next step

User confirms which idea(s) and order to proceed with. Then `/project:pdd-plan` for the first one.
