# FixMixAI — Implementation Plan (Phase 1 ALPHA)

**Last updated: 2026-05-15 — after Run 3 completed + tested**
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

## Known Issues (Post Run 2 Tests — 2026-05-14)

### Critical
1. **UIA Watch Mode disrupts typing** — When the eye icon is active, the UIA bridge fires automation events while the user types in Claude, causing text to disappear, cursor to jump, etc. Root cause: the C# bridge's UIAutomation hooks are not filtered to exclude the user's input field focus state. **This must be fixed before Watch Mode is usable.**

### Medium
2. **Watch Mode requires manual Copy to trigger** — The UIA bridge detects Claude finishing a reply, but the automatic Ctrl+C simulation (which should copy the response) also fires at wrong times. Current workaround: user clicks Claude's "Copy" button manually — which does trigger an update. Full automation not yet working.
3. **Centered headings not preserved** — Titles that are centered in the source app appear right-aligned in FixMix. CSS rule needed to detect and preserve centering.
4. **Bold, colors, highlights** from source not preserved in all cases — depends on clipboard format.

### Low
5. **Browser Artifacts / Side Panels** — Canvas, ChatGPT Canvas, Sider sidebar etc. are not auto-captured. Work when user manually copies.
6. **User vs AI message distinction** — both appear the same. User messages should be styled differently.
7. **Copy / Save buttons** not yet implemented (export to Word/PDF/MD).

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

## Run 4 — Next Tasks (Priority Order)

### 1. Auto Mode — Fully Automatic Capture (Critical — Backend)
**Goal:** Add a toggle so the user can choose between two Watch Mode behaviors:
- **Copy Mode** (current default) — FixMix captures only when the user manually copies text. Safe, no interference.
- **Auto Mode** — FixMix detects when the AI finishes writing and captures automatically, with no manual copy needed.

**How to implement Auto Mode:**
- Re-enable UIA bridge in parallel with clipboard listener
- Fix the UIA typing-disruption bug: only fire `CAPTURE` when the **AI response element** changes, NOT when the user's input field has focus
- C# fix: ~10 lines — check `GetForegroundWindow()` focus state before firing
- Add a toggle button in the FixMix title bar (or settings): `Auto / Copy`
- Persist the user's choice in electron-store

**Why this matters:** The original vision was that FixMix updates automatically as the AI writes, with zero user action. Copy Mode requires the user to click Copy each time.

### 2. Design Polish (Frontend)
Areas identified during Run 3 testing that need improvement:
- **General design review** — spacing, font sizes, visual hierarchy. CEO wants a design pass after testing.
- **User vs AI bubble refinement** — The auto-detection works but the visual difference could be more pronounced
- **Status bar** — Consider showing more context (e.g. number of captures, which app is locked)
- **Window minimum size** — Test at small window sizes, ensure nothing breaks

### 3. Accumulation Limit (Future)
- Append mode keeps adding captures indefinitely
- Consider: maximum capture count (e.g. 50) or "Clear on launch" option
- Waiting for CEO decision on preferred behavior

---

## Open Questions — Resolved

1. **Alt+Space** — Removed from UI. Not needed with Watch Mode always on. Shortcut code removed.
2. **Ctrl+A before Ctrl+C** — Not needed. Clipboard notification captures whatever the user manually copies.
3. **UIA scope** — Replaced entirely by clipboard notification for Copy Mode. Will return as optional Auto Mode in Run 4.

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
  Tests Phase 1 Run 2/   ← Screenshots + test notes from 2026-05-14
  rendering-engine-detection.md  ← Research: how to detect app rendering engine
```
