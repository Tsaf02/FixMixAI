# Task 02: Electron MVP (The Magic Mirror Option 2)

## Objective
Build the MVP (v1) of the FixMixAI Magic Mirror based on the architecture finalized in `brainstorms/session-01.md`.

## Owner
Frontend/Electron Agent (Claude Opus / Sonnet)

## Tech Stack
- Electron (Latest)
- `@nut-tree/nut-js` (for keyboard automation)
- `electron-store` (for state persistence)
- Vanilla HTML/CSS/JS (or React, agent's preference) for the UI.

## Requirements

### 1. Window Architecture (The Mirror)
- Create a `BrowserWindow` with: `transparent: false`, `alwaysOnTop: true` (level: 'floating'), `frame: false` (custom title bar), `resizable: true`.
- Custom Title Bar must include: Drag Handle, "Re-capture" (🔄) button, and Close button.

### 2. Capture Workflow (The Shortcut)
- Register a global shortcut (e.g., `Ctrl+Shift+M`).
- **Workflow:** 
  1. Stash current clipboard.
  2. Use `nut.js` to simulate `Ctrl+A` -> delay(100ms) -> `Ctrl+C`.
  3. Read `clipboard.readHTML()` (fallback to `readText()`).
  4. Restore the original clipboard.
  5. Show and focus the Mirror window.

### 3. RTL Logic & Scrolling
- Parse the captured text/HTML. Wrap lines starting with RTL characters (`\u0590-\u08FF`) in appropriate RTL containers (`direction: rtl` or `<bdi>`).
- Render the text in a scrollable container with a custom, unobtrusive scrollbar.
- Attempt to preserve scroll position if the user clicks "Re-capture".

### 4. Persistence
- Use `electron-store` to remember the last X, Y, Width, and Height of the window. Restore these on launch.

## 🛑 Deliverable (Alpha Visual Milestone)
Provide the user with the exact CLI commands to install dependencies and run the app. The user expects to see the floating window and test the shortcut. Do NOT prompt the user with complex coding questions; make executive decisions where necessary.
