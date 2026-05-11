# TECHNICAL BRAINSTORM: Session 01 - The Magic Mirror (Option 2)

## Problem Statement
We are building a "Magic Mirror" overlay for fixing mixed RTL/LTR text over desktop apps (like Claude Desktop). 
Based on User UX feedback, we abandoned complex UIAutomation/pixel-perfect tracking. The new approach is a simple, resizable, floating Electron window (the "Mirror") that grabs the clipboard text (`Ctrl+C`), formats it to RTL, and displays it. The user will manually drag this Mirror over the original app. Since the Mirror is placed near the original broken text, the human brain naturally bridges the physical gap—we do not need 1:1 word physical alignment.

## Context & Limitations
Because we are relying purely on the system Clipboard ("The Copy Technique"), the data in the Mirror is a **static snapshot**. The clipboard does not auto-update when the underlying original app updates. 

## Prompt for Sub-Agents (Frontend/Electron Agent)
We need you to brainstorm the UI/UX and architectural solutions for the following 4 dynamic scenarios, assuming we are building this in Electron:

1. **Maximum Text Copy:** How do we grab the *entire* chat history of the window so the user can scroll inside the Mirror? Do we simulate a hidden `Ctrl+A` -> `Ctrl+C` via robotjs/nut.js when the activation shortcut is pressed?
2. **Scrolling:** If we successfully grab the entire document, does the Electron Mirror just need a custom native scrollbar? How do we make the scrolling feel natural while the window is floating over another app?
3. **Live Updates (AI Generating Text):** When the AI is actively typing in the original app, the clipboard snapshot is outdated. Do we implement a "Wait" notification? How does the Mirror know the AI is done typing? Or does the user simply hit the shortcut again?
4. **Window Resizing:** If the user resizes the original app, the text reflows. Do we attempt to auto-resize the Mirror, or just let the user manually resize the Mirror so its internal text reflows to match the background?

## Sub-Agent Instructions
Please append your perspective below. Focus on Electron UI capabilities, clipboard management, and lightweight UX solutions. Do not delete other agents' entries. Mark your status on the dashboard when done.

---
### Frontend/Electron Agent Perspective
**Agent:** Frontend/Electron Sub-Agent (Antigravity – Claude Opus 4.6)
**Date:** 2026-05-11

---

#### 1. Maximum Text Copy — Full-Document Capture Strategy

**Recommended approach: User-triggered `Ctrl+A → Ctrl+C` simulation via `nut.js`**

- When the user presses the FixMix activation shortcut (e.g. `Ctrl+Shift+M`), the Electron app will:
  1. Stash the current clipboard contents (so the user doesn't lose what they had copied).
  2. Bring the **target app** to the foreground using `BrowserWindow.blur()` + Win32 focus tricks (or simply instruct the user to keep the target focused).
  3. Dispatch `Ctrl+A` → small delay (50–100 ms) → `Ctrl+C` via **nut.js** (`@nut-tree/nut-js`). This is the successor to robotjs and is actively maintained, supports Windows well, and works with Electron's Node integration.
  4. Read the clipboard via Electron's `clipboard.readText()`.
  5. Restore the original clipboard contents from step 1.
  6. Re-focus the Mirror window and render the captured text.

**Why nut.js over robotjs?**
- robotjs is effectively unmaintained and has Node version compatibility issues.
- nut.js has a cleaner API, TypeScript support, and active releases.

**Fallback / Alternative:**
- If `Ctrl+A` selects too much (e.g. sidebar + chat), we can offer an alternative mode: the user manually selects the text region they want, then presses the shortcut (which only does `Ctrl+C`). This is less magical but more predictable.
- We should support **both modes** and let the user toggle in settings:
  - **Full Capture Mode** — `Ctrl+A → Ctrl+C` (default)
  - **Selection Capture Mode** — captures only the current selection

**Clipboard format consideration:**
- `clipboard.readText()` gives plain text; `clipboard.readHTML()` can give us rich formatting.
- Claude Desktop renders Markdown with code blocks — if we read HTML, we can preserve headings, bold, code blocks, and lists in the Mirror. **Strongly recommend reading HTML first, falling back to plain text.**

---

#### 2. Scrolling — Natural Scroll UX Inside a Floating Overlay

**Architecture:**
- The Mirror's `BrowserWindow` should be created with:
  - `transparent: false` (solid background for readability)
  - `alwaysOnTop: true`
  - `frame: false` (custom title bar for drag)
  - `resizable: true`
- The captured text is rendered inside a scrollable `<div>` with `overflow-y: auto`.

**Making scrolling feel native:**
- Use CSS `scroll-behavior: smooth` and `-webkit-overflow-scrolling: touch`.
- Implement a **custom scrollbar** styled to match the Mirror's dark/light theme using CSS `::-webkit-scrollbar` pseudo-elements. Electron's Chromium engine fully supports these.
- The scrollbar should be semi-transparent and unobtrusive — think VS Code or Slack-style thin scrollbars.

**Scroll position persistence:**
- When the user re-captures text (presses the shortcut again), we should try to preserve the scroll position if the content structure is similar (compare text length / hash). This prevents the user from losing their place during re-captures.

**Mouse passthrough consideration:**
- The Mirror window will intercept mouse events (scrolling, clicking). This is correct and expected — the user is interacting with the Mirror to read the fixed text. We do NOT want `setIgnoreMouseEvents(true)` here.

---

#### 3. Live Updates — Handling AI-Generated Streaming Text

This is the trickiest scenario. Here are three approaches, ranked from simplest to most complex:

**Option A: Manual Re-Capture (Recommended for v1)**
- The user simply presses the activation shortcut again when they want a fresh snapshot.
- The Mirror shows a subtle timestamp at the bottom: `"Captured 30 seconds ago"` — this gently nudges the user when content might be stale.
- **Pros:** Zero complexity, zero false positives, user is in full control.
- **Cons:** Requires user action.

**Option B: Auto-Polling with Smart Detection (v2 Enhancement)**
- After an initial capture, the Mirror enters a "watch mode":
  1. Every N seconds (configurable, e.g. 3–5 sec), it performs a silent `Ctrl+A → Ctrl+C` in the background.
  2. Compares the new clipboard text to the stored snapshot.
  3. If the text has changed → re-render the Mirror with a smooth diff animation (highlight new lines).
  4. If text is identical for 2 consecutive polls → stop polling (AI is done).
- **Key UX safeguard:** Show a small pulsing indicator (🔴 "Live") when polling is active. Let the user click it to stop.
- **Risk:** This silently hijacks the clipboard repeatedly. We MUST stash and restore. Some apps may react to `Ctrl+A` visually (flash of selection). We can mitigate by using a very short delay and immediately sending `Escape` after copy to deselect.

**Option C: Window Pixel Change Detection (v3 / Experimental)**
- Use `desktopCapturer` (Electron API) to take periodic screenshots of a specific screen region and compare pixel hashes.
- If pixels change → trigger re-capture.
- **Pros:** Doesn't touch clipboard at all.
- **Cons:** CPU-intensive, doesn't give us text content directly — still need clipboard capture afterward.

**Recommendation:** Ship with **Option A** for v1. Build **Option B** as an opt-in "Live Mode" for v2. Skip Option C unless users demand it.

**"AI is typing" indicator idea:**
- We can't reliably detect if the AI is mid-generation from outside the app. But we CAN detect it indirectly: if two successive captures show text growing at the end → display a "⏳ AI may still be generating..." hint.

---

#### 4. Window Resizing — Mirror vs. Target App Sync

**Recommended approach: Independent manual resizing (decoupled)**

- The Mirror window is fully resizable by the user via standard window handles.
- The text inside the Mirror reflows automatically (CSS handles this — `word-wrap: break-word`, `white-space: pre-wrap` for code blocks).
- We do **NOT** attempt to auto-sync the Mirror's size to the target app's window. Reasons:
  - Tracking another app's window geometry requires Win32 API calls (SetWinEventHook) — this adds complexity we explicitly chose to avoid in Option 2.
  - The user explicitly chose Option 2 for its simplicity. Manual resize is intuitive and expected.

**UX Enhancements for Resizing:**
- **Snap presets:** Offer quick-resize buttons in the Mirror's custom title bar:
  - "Half Screen Right" (fills right 50% of the screen)
  - "Half Screen Left"
  - "Quarter" (bottom-right quadrant)
- These presets can be triggered via keyboard shortcuts too (e.g. `Ctrl+Shift+Arrow`).
- **Remember geometry:** Persist the last window position and size in `electron-store` or a simple JSON config. On next launch, restore the same layout.
- **Magnetic edges:** Implement a simple snap-to-edge behavior when dragging (snap within 20px of screen edges). This makes placement faster.

---

#### 5. Additional Architecture Recommendations

**Tech Stack Proposal:**
| Layer | Technology | Rationale |
|-------|-----------|-----------|
| Shell | Electron 33+ | Latest stable, good security defaults |
| Input Simulation | `@nut-tree/nut-js` | Modern robotjs replacement |
| Clipboard | Electron `clipboard` API | Built-in, no extra deps |
| RTL Rendering | Custom CSS + `direction: rtl` | Pure CSS, no library needed |
| Text Parsing | Regex-based BiDi segmenter | Detect Hebrew/Arabic runs and wrap them |
| Settings Storage | `electron-store` | Simple JSON persistence |
| Build/Package | `electron-builder` | Mature, supports Windows well |

**RTL Rendering Strategy:**
- Parse the captured text line-by-line.
- For each line, detect if it starts with an RTL character (Unicode range `\u0590-\u08FF`).
- If yes → wrap in a `<div dir="rtl">`.
- If no → wrap in a `<div dir="ltr">`.
- Mixed lines: use `<bdi>` elements to isolate directional runs.
- This handles the core "FixMix" problem — mixed Hebrew/English text that renders incorrectly in LTR-default apps.

**Window Layering & Focus:**
- The Mirror should use `alwaysOnTop: true` with `level: 'floating'` (not `'screen-saver'`) so it stays above normal windows but below system dialogs.
- When the user clicks on the target app behind the Mirror, the Mirror should remain visible. This is default behavior with `alwaysOnTop`.
- Custom title bar should include: drag handle, minimize, close, a "Re-capture" button (🔄), and a settings gear icon.

**Performance Notes:**
- The Mirror is extremely lightweight — it's just rendering text in a webview. No heavy processing.
- Even with 100K+ characters of chat history, rendering in a scrollable div is well within Chromium's capabilities.
- If we detect very large documents (>500KB text), we can virtualize the list using a simple virtual scroller, but this is unlikely to be needed for chat text.

---

#### Summary & Recommended MVP Scope (v1)

| Feature | v1 (MVP) | v2 | v3 |
|---------|----------|----|----|
| Manual shortcut capture | ✅ | ✅ | ✅ |
| Full doc `Ctrl+A` + selection mode | ✅ | ✅ | ✅ |
| HTML clipboard parsing | ✅ | ✅ | ✅ |
| Custom scrollable Mirror | ✅ | ✅ | ✅ |
| RTL/LTR auto-detection | ✅ | ✅ | ✅ |
| Manual re-capture for updates | ✅ | ✅ | ✅ |
| Auto-poll "Live Mode" | ❌ | ✅ | ✅ |
| Snap-to-edge presets | ❌ | ✅ | ✅ |
| Pixel change detection | ❌ | ❌ | ✅ |
| Geometry persistence | ✅ | ✅ | ✅ |

**Estimated dev time for v1 MVP:** 2–3 focused sessions.

---
*End of Frontend/Electron Agent Perspective*
