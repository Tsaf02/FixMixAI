# FixMixAI — Implementation Plan (Phase 1 ALPHA)

**Last updated: 2026-05-16 — after Run 3 test review, planning Run 4+**
*This is the authoritative plan. The file "implementation_plan 13.05.2026.md" is now outdated.*

---

## Product Vision

FixMixAI is a floating "Magic Mirror" window that fixes broken RTL (Hebrew/Arabic) text rendering in AI applications. It sits transparently on top of any app and displays corrected text automatically.

**Phase 1 goal:** One-way passive mirror — reads text from AI apps and displays it with perfect RTL correction. No writing back to the source app.

**Phase 2 goal (future):** Two-way interactive mirror with "magnet" feature — FixMix locks onto the source window in exact position and size, with synchronized scrolling and input.

---

## Locked Decisions (CEO / CTO — Do Not Change Without Approval)

| Decision | Value | Reason |
|---|---|---|
| **Global shortcut** | `Alt+Space` | CEO's explicit choice. Do NOT change to Ctrl+Shift+M or any other key. |
| **No clipboard polling** | Disabled | CEO & CTO rejected polling every N seconds as "intrusive and hacky." |
| **Watch Mode trigger** | Clipboard change notification | Replaces UIA as trigger. Uses `AddClipboardFormatListener` Win32 API — event-driven, zero polling, works for ALL apps. UIA disrupted typing and was Claude-only. |
| **CDP — abandoned** | Not using | CDP is blocked for Claude Desktop (Tauri + Microsoft Store = double block). Not a universal solution. |
| **Design system** | FixMix-own CSS | Do NOT try to mirror source app CSS. FixMix has its own clean, high-contrast design. |
| **Append mode** | Active | Each new capture appends BELOW previous ones (like a chat). Never replaces. |
| **Eye button default** | ON by default | With clipboard change notification, Watch Mode is passive and safe to leave always on. |
| **Window always-on-top** | Default ON | Saved in electron-store, user can toggle with Pin button. |
| **RTL detection rule** | Any RTL char → RTL | If a line contains ANY Hebrew/Arabic character, it renders RTL, regardless of first word. |

---

## How It Works (Current State — after Run 3)

1. Run FixMix: `npm start` (will become a normal app launcher in future)
2. Watch Mode (👁) is ON by default — FixMix listens passively to all clipboard changes
3. User copies text from ANY app (Ctrl+C or clicks the app's Copy button)
4. FixMix detects the clipboard change automatically and appends the corrected RTL text
5. Use **🔄 button** to re-read clipboard manually at any time
6. Use **Alt+Space** as an alternative manual trigger
7. Use **Clear ×** to reset all captured text

---

## What Has Been Built

### Backend — `src/main.js` + `src/preload.js`
| Feature | Status | Notes |
|---|---|---|
| Window creation & persistence | ✅ Done | Bounds saved in electron-store |
| Alt+Space global shortcut | ✅ Done | Triggers Ctrl+C in target app then reads clipboard |
| Pin/Unpin toggle | ✅ Done | Persisted in store, `window-toggle-pin` IPC |
| Maximize / Restore toggle | ✅ Done | `window-maximize` IPC — single toggle button |
| Fullscreen toggle | ✅ Done | `window-fullscreen` IPC (accessible via IPC, no UI button currently) |
| Restore from any state | ✅ Done | `window-restore` IPC |
| alwaysOnTop layering fix | ✅ Done | Re-enforced on `blur` event (Windows z-order quirk) |
| UIA Bridge spawner | ✅ Done | Spawns `src/native/bin/UiaBridge.exe`, listens for CAPTURE/READY signals |
| Ctrl+C focus-guard | ✅ Done | Does NOT simulate Ctrl+C if FixMix window itself is focused |
| Markdown → HTML (marked.js) | ✅ Done | Parses plain text Markdown into HTML |
| Code block BiDi isolation | ✅ Done | Wraps `<code>` in `<bdi dir="ltr">` |

### Frontend — `src/renderer/`
| Feature | Status | Notes |
|---|---|---|
| Floating frameless window | ✅ Done | Dark theme, custom title bar |
| 🔄 Recapture button (larger) | ✅ Done | Reads current clipboard on click |
| 👁 Watch Mode button (larger) | ✅ Done | Toggles UIA bridge, shows live status |
| 📌 Pin button | ✅ Done | Lights up when pinned |
| ⛶ Maximize button | ✅ Done | Single toggle (was two buttons — FIXED) |
| _ Minimize / ✕ Close | ✅ Done | Standard window controls |
| Clear × button | ✅ Done | In status bar, clears all captures (also Ctrl+Delete) |
| Append mode | ✅ Done | New captures go BELOW with timestamp separator |
| RTL detection (improved) | ✅ Done | Any Hebrew/Arabic in line → dir=rtl |
| RTL list fix | ✅ Done | If majority of list items are RTL → whole list RTL |
| RTL table fix | ✅ Done | Tables with Hebrew content → direction: rtl |
| Interactive element placeholders | ✅ Done | Buttons/inputs/canvas replaced with `[ label ]` text |
| Window bounds persistence | ✅ Done | Last size/position restored on launch |
| Custom scrollbar | ✅ Done | Thin purple, webkit-scrollbar |
| Empty state (Alt+Space hint) | ✅ Done | Shows correct shortcut |
| Keyboard: Escape = minimize | ✅ Done | |
| Keyboard: Ctrl+Delete = clear | ✅ Done | |

---

## Known Issues (Post Run 3 Tests — 2026-05-16)
*Previous Run 2 bugs (#1–7) were resolved in Run 3. Below are new findings from the Run 3 test session (test slides in `project-meta/Test Phase 1 After RUN 3/`).*

### Bug
1. **Whisper Flow / voice-dictation conflict** — If the user dictates text (e.g. using Whisper Flow) before performing a manual copy, FixMix's source lock latches onto the voice-dictation app (`WhisperFlow`) instead of the intended AI app. All subsequent copies from the real app are silently ignored. Fix: maintain a list of known voice-dictation process names to exclude from source locking.

### Medium UX Issues
2. **LTR text appears far-left in wide windows** — When a captured block has mostly RTL content but some LTR-only lines (e.g. English words in a Hebrew explanation), those LTR lines hug the left edge of a wide window, far away from the RTL text. They should appear closer to the right border — either right-aligned or center-aligned — to keep visual cohesion.
3. **No "new content" indicator when scrolled up** — When new blocks are appended and the user has scrolled up, there is no visual cue that new content arrived. A subtle badge or banner at the bottom (e.g. "↓ New capture") should appear and dismiss on scroll-down.

### Low
4. **Artifacts & Canvas re-push behavior** — When the user edits an Artifact in-place in the source app, the clipboard notification fires and the entire Artifact re-renders from the top in FixMix. This is acceptable, but copy/save will need a block-selection UI (see Run 5). Full UIA-based auto-capture of in-place edits may not be possible (clipboard event never fires for in-place changes).
5. **Title bar buttons could be larger** — Buttons were increased ~40% in Run 3 but CEO requested 1.5× to make them easier to grab with a mouse. Pending implementation.

---

## UIA Bridge — Architecture (Existing)

The bridge is a C# executable at `src/native/bin/UiaBridge.exe`.

**Communication protocol (stdin/stdout):**
- main.js spawns the exe with the process name as argument: `UiaBridge.exe claude`
- Bridge sends `READY\n` when it successfully attaches to Claude
- Bridge sends `CAPTURE\n` when it detects the AI has finished generating
- main.js listens for `CAPTURE` → calls `captureSelectedText()` (simulates Ctrl+C in target)
- Sending any input to stdin (or closing it) stops the bridge

**Known bug in UIA bridge:** The bridge fires CAPTURE events too aggressively — including while the user is typing. Fix needed in the C# code:
- Only fire CAPTURE when the RESPONSE element changes (not the INPUT box)
- Check that the user input field does NOT have focus before firing

---

## Run 3 — COMPLETED (2026-05-15)

### What was built in Run 3:
1. ✅ **Clipboard Change Notification** — Replaced UIA entirely. C# bridge uses `AddClipboardFormatListener`. No process name needed. Works for ALL apps.
2. ✅ **Source App Locking** — First copy after Watch Mode starts locks FixMix to that app (e.g. `🔒 claude`). Copies from other apps are ignored. Clear × resets the lock.
3. ✅ **Eye button ON by default** — Watch Mode auto-starts on every launch.
4. ✅ **User vs AI visual distinction** — Short plain text = user bubble (blue tint), long/structured = AI (purple left border). Toggle button was built then removed as unnecessary.
5. ✅ **Clickable links** — `https://...` URLs in captured text open in browser via `shell.openExternal()`.
6. ✅ **Code block improvements** — Language label + Copy button on each code block. highlight.js syntax highlighting added.
7. ✅ **Design system** — Blockquote styling, table zebra striping, heading hierarchy, centered text preservation.
8. ✅ **Larger buttons** — All title bar buttons ~40% larger hit area. Custom instant tooltips on every button.
9. ✅ **Clear × button** — Always visible (pink border). Clears all captures and resets source lock.
10. ✅ **Empty state updated** — Shows "👁 Watching all apps" pill. Descriptive text in Hebrew + English.
11. ✅ **Alt+Space removed from UI** — Feature disabled, not needed with Watch Mode always on.

---

## Run 4 — Quick Fixes — IN PROGRESS (2026-05-16)
*Small changes, big quality-of-life improvement. Safe to do regardless of Auto Mode outcome.*

### 1. Title Bar Button Size — 1.5×
- CEO requested buttons "at least one and a half larger" so they are easier to click
- Current: `.titlebar-btn` 38×34px → Target: ~48×42px
- Current: `.btn-primary-action` 44px wide → Target: ~54px wide
- SVG icon sizes scaled accordingly

### 2. LTR Text Alignment Fix
- Problem: LTR-only lines in an RTL block appear pinned to the far left in wide windows
- Fix: `.capture-block--ai .text-line[dir="ltr"]` → `text-align: right` (pull toward the right edge where RTL text lives)
- Alternative: `display: flex; justify-content: flex-end` so LTR text ends at same right margin as RTL text

### 3. Whisper Flow Filter
- Maintain a blocklist of voice-dictation app process names (e.g. `whisperflow`, `whisper`, `speechrecognition`, `dictation`)
- In `main.js` source lock logic: if the process name matches a blocked app, skip the capture entirely (don't lock to it, don't capture)
- ~5 lines in `startClipboardBridge()` handler

---

## Run 5 — Auto Mode Proof-of-Concept (Next after Run 4)
*The most uncertain and most important feature. Must be tested before any further UI decisions.*

### Goal
Prove whether UIA can detect AI responses without disrupting typing. This is a binary result: it works or it doesn't. No final UI design needed yet — just a working demo.

### What to build
1. **Rewrite UiaBridge.exe** with the typing bug fixed:
   - Only fire `CAPTURE` when the AI **response** element changes (not the input box)
   - Before firing, check that the user's input field does NOT have focus (`GetForegroundWindow`)
   - Target: Claude Desktop first (Win32 app, best UIA support)
2. **App selector**: small prompt when Auto Mode is enabled — user picks which process to watch
3. **Minimal toggle**: add Auto/Copy switch to title bar — functional only, design TBD
4. **Test and verify**: does it capture correctly? Does it ever fire while the user is typing?

### Decision point after Run 5
- **Auto Mode works** → Run 6 = full UI redesign per wireframe:
  - Eye button moves from title bar to status bar
  - Two mode-selector buttons in title bar: "I choose" / "Auto All" (names TBD)
  - Status bar gets two live monitors: one for UIA auto-detect, one for clipboard auto-paste
  - Empty state text changes per selected mode
  - Notifications if either monitor stops working
- **Auto Mode doesn't work** → Run 6 = content features (block reorder, copy/save) with current UI

---

## Run 6A (if Auto Mode works) — UI Redesign per Wireframe
*All details are question marks until Auto Mode is confirmed working. Design from the wireframe in `project-meta/Test Phase 1 After RUN 3/new UI if auto copy will woirk.png`.*

---

## Run 6B (if Auto Mode fails) — Content Management (~2–3 hours)
*Improves the captured-text experience: knowing new content arrived, reordering, and safe deletion.*

### 1. New Content Indicator
- When new captures are appended while the user is scrolled up, show a persistent badge at the bottom of the content area: `↓ 1 new capture`
- Clicking the badge auto-scrolls to the bottom and hides it
- Counter increments if more captures arrive while badge is visible

### 2. Block Reorder (Up ↑ / Down ↓ Arrows)
- Each captured block gets two small arrow buttons in its top-right corner
- ↑ swaps the block with the one above it; ↓ swaps with the one below it
- First block hides the ↑ arrow; last block hides the ↓ arrow
- Allows correcting capture order when the user copied them out of sequence

### 3. Clear Confirmation Dialog
- When the user clicks "Clear ×", show a small confirmation popup: "Clear all captures? This cannot be undone. [Cancel] [Clear]"
- Option B (simpler): auto-save a `.txt` snapshot to a FixMix folder before clearing, so nothing is lost
- CEO decision pending on which approach to implement

---

## Run 6 — Copy / Save Export (~2–3 hours)
*Allows the user to get the corrected RTL text out of FixMix.*

### 1. Block Selection UI
- Each block gets a subtle checkbox that appears on hover (or always visible)
- "Copy selected" and "Save selected" buttons appear in the status bar when at least one block is selected
- Select All / Deselect All helper buttons

### 2. Copy Corrected Text
- Copies the plain text of selected blocks (with correct RTL order) to clipboard
- Uses `clipboard.writeText()` — strips HTML tags, keeps content structure

### 3. Save As
- Supported formats: **Markdown** (plain `.md`), **PDF** (via Electron `printToPDF`), **plain `.txt`**
- Word/Google Docs/Excel: deferred to Phase 2 (requires native libraries or Google API)
- File picker dialog via `dialog.showSaveDialog()`

---

## Run 7 — Auto Mode (Largest Run — ~4 hours)
*The original product vision: FixMix updates automatically when AI finishes writing — no manual Copy needed.*

### Goal
Add a toggle between two Watch Mode behaviors:
- **Copy Mode** (current) — captures only when the user manually copies. Zero interference.
- **Auto Mode** — detects when the AI finishes writing and captures automatically.

### How to Implement
1. **Write a new `UiaBridge.exe`** (replace the clipboard bridge — or run in parallel)
   - The C# code watches a specific target process for UI Automation events
   - Fires `CAPTURE` only when the **AI response container** changes AND the user's input field is NOT focused
   - Key fix from Run 2 bug: filter by element role (not the input box) + check `GetForegroundWindow()` is the source app, not the input field
2. **Two-bridge architecture**: clipboard bridge stays for Copy Mode; UIA bridge runs additionally in Auto Mode
3. **Toggle button** in FixMix title bar: `⚡ Auto` (teal when active) — persisted in electron-store
4. **App selector**: Auto Mode needs to know which process to watch — show a small popup listing running AI-app processes when Auto is enabled
5. **Scope limitation**: UIA works for Claude Desktop (Win32 + Accessibility API). Does NOT work for browser-based apps (ChatGPT in Chrome, etc.) — Copy Mode remains the universal fallback.

### Research Question (from test slides)
Can Artifact/Canvas changes be auto-detected via UIA update events? Initial finding: clipboard event does NOT fire for in-place Artifact edits. UIA `TextChanged` events on Chromium-rendered content are unreliable. This may require a different approach — or may simply not be feasible in Phase 1.

---

## Accumulation Limit (Deferred — CEO Decision Pending)
- Append mode keeps adding captures indefinitely
- Options: (a) max 50 blocks, auto-clear oldest; (b) "Clear on launch" option; (c) no limit
- Waiting for CEO decision before implementing

---

## Open Questions — Resolved

1. **Alt+Space** — Removed from UI. Not needed with Watch Mode always on. Shortcut code removed.
2. **Ctrl+A before Ctrl+C** — Not needed. Clipboard notification captures whatever the user manually copies.
3. **UIA scope** — Replaced entirely by clipboard notification for Copy Mode. Will return as optional Auto Mode in Run 7.
4. **User/AI flip toggle** — Removed in Run 3. No user story requires it.

---

## Tech Stack

| Layer | Technology |
|---|---|
| App shell | Electron 33+ (vanilla JS, no TypeScript) |
| UI | HTML / CSS / JS |
| Keyboard simulation | @nut-tree-fork/nut-js |
| Clipboard | Electron `clipboard` API |
| Settings storage | electron-store (ESM, dynamic import) |
| Markdown parsing | marked.js |
| Syntax highlighting | highlight.js (to be added in Run 3) |
| Watch Mode trigger | Windows `AddClipboardFormatListener` — C# (.NET) in `src/native/bin/` |

---

## Running the Project

```bash
npm start              # run the app
npm run build-bridge   # rebuild UiaBridge.exe (only after C# code changes)
```

---

## File Map (Key Files Only)

```
src/
  main.js             ← Electron main process — IPC, shortcuts, UIA bridge spawner
  preload.js          ← Context bridge — exposes mirrorAPI to renderer
  renderer/
    index.html        ← Window UI structure + all buttons
    renderer.js       ← All UI logic, RTL processing, append mode
    styles.css        ← Design system, RTL fixes, component styles
  native/
    bin/
      UiaBridge.exe   ← Pre-built C# automation bridge
    UiaBridge/        ← C# source code for the bridge

project-meta/
  Tests Phase 1 Run 2/            ← Screenshots + test notes from 2026-05-14
  Test Phase 1 After RUN 3/       ← Presentation + screenshots from 2026-05-16 test
  rendering-engine-detection.md  ← Research: how to detect app rendering engine
```
