> ⚠️ OUTDATED — superseded by `implementation_plan.md` (updated 2026-05-14).
> Contains errors: Alt+Space is NOT deprecated (CEO confirmed it stays). UIA Watch Mode has bugs found in Run 2.

# FixMixAI — Implementation Plan (Phase 1 ALPHA)

Last updated: 2026-05-13
This a copy with last update after the run in morning of 13.05.02026
---

## Product Vision

FixMixAI is a floating "Magic Mirror" window that fixes broken RTL (Hebrew/Arabic) text rendering in AI applications. It sits on top of any app and displays the corrected text automatically.

**Phase 1 goal:** One-way passive mirror — displays and fixes text from AI apps. No interaction with the source app.

**Phase 2 goal (future):** Two-way interactive mirror with "magnet" feature — FixMix locks onto the source window in exact position and size.

---

## How It Works Today

1. Open Claude Desktop (or any supported app)
2. Run FixMix: `npm start` in the project folder terminal
3. Copy text from Claude (Ctrl+C)
4. Press **Alt+Space** — OR — just activate **Watch Mode (👁 button)**
5. FixMix displays the corrected RTL text

---

## Current Status — What Was Built

### Window Controls (all working)
- **Pin/Unpin button** — toggles "always on top." State is saved between sessions.
- **Maximize button** — toggle maximize/restore
- **Fullscreen button** — toggle fullscreen
- **Minimize / Close** — standard controls
- **Window layering fix** — FixMix no longer disappears behind other windows when clicked

### Capture Methods
| Method | Status | Notes |
|---|---|---|
| 🔄 Recapture button | ✅ Working | Main manual trigger. User copies text, clicks this button. |
| Alt+Space shortcut | ❌ Deprecated | Conflicts with Windows system shortcut. Removed from plan. |
| 👁 Watch Mode | ✅ Working | Automatic. See section below. |

### Watch Mode (Auto-Update)
- Built using **Windows UIAutomation** (C# bridge: `src/native/UiaBridge.exe`)
- Attaches to Claude Desktop process and listens for text changes
- When Claude stops generating for **1.2 seconds** → FixMix updates automatically
- **Tested and confirmed working on:**
  - Claude Desktop Chat ✅
  - Claude Desktop Artifacts ✅
- **Limitation:** Currently monitors Claude Desktop only (process name "claude")

### RTL Improvements
- Fixed RTL detection logic — now scans for the first real letter (not just first character), so lines starting with `**`, `-`, numbers are detected correctly
- RTL lists and tables now align right
- Shortcut hint on empty screen corrected to show **Alt + Space**

---

## Known Issues

- **Alt+Space** does not work on Windows (system conflict). Deprecated — not needed.
- **Watch Mode** is limited to Claude Desktop. Other apps require future work.
- **Bold, colors, highlighting** from source not yet preserved in FixMix display.
- **User vs AI message distinction** — not yet implemented (both look the same).
- **Browser Artifacts** (side panels, ChatGPT Canvas) — not yet supported.

---

## Next Development Priorities

### High Priority
1. **Make 🔄 Recapture button larger** — easier to click, more prominent in the UI. This is the main user action.
2. **Window Picker** — let the user click on any window on screen to set it as the source. This replaces the current "process name" approach and makes Watch Mode work with any app automatically. Technical approach: `WindowFromPoint` Windows API.

### Medium Priority
3. **Support more apps in Watch Mode** — ChatGPT, Cursor, Sider, browser-based tools. Requires Window Picker first.
4. **Advanced RTL detection** — percentage-based (if >30% of line is RTL characters → RTL direction), not just first letter.
5. **Preserve formatting** — Bold, colors, highlights, centered headings from the source.
6. **Tables and Lists** — better rendering and RTL alignment.
7. **User vs AI distinction** — display user messages differently from AI responses.

### Lower Priority
8. **Browser Artifacts support** — side panels and Canvas windows in browsers. Hard because browser accessibility tree targets the whole browser, not a specific tab.
9. **Copy / Save buttons** — export to Word, PDF, Markdown with RTL formatting preserved.
10. **Wider resize handles** — easier to grab and resize the window.

---

## Tech Stack

| Layer | Technology |
|---|---|
| App shell | Electron 33+ |
| UI | Vanilla HTML / CSS / JS |
| Keyboard simulation | @nut-tree-fork/nut-js |
| Clipboard | Electron clipboard API |
| Settings storage | electron-store |
| Auto-update detection | Windows UIAutomation via C# (UiaBridge.exe) |
| Markdown parsing | marked.js |

---

## Running the Project

```
npm start          — run the app
npm run build-bridge  — rebuild UiaBridge.exe (only needed after C# code changes)
```

The `UiaBridge.exe` is already built and included at `src/native/bin/`.

---

## Future Vision (Phase 2+)

- **Window Picker + Magnet** — user clicks to select source window, FixMix locks to its exact position and size
- **Two-way interaction** — scrolling and notes in FixMix sync to source window
- **Commercial release** — installer, payment, free trial
