# FixMixAI — Work History

This file records what was tried, what worked, what failed, and why.
It exists so future chat sessions do not repeat mistakes.

---

## April 2026 — First Development Session

### What We Started With

An existing folder called FixMixRTL (later FixMixRTL2) on the user's machine at:
C:\Users\ortsa\OneDrive\מסמכים\Claude\Projects\

This folder contained code from a previous collaboration with a studio called Antigravity.
The Antigravity code had a different UI design (bubbles and toggle switches per app),
which was the wrong approach. It was NOT the design described in PLAN.md.

### Test 1 — PASSED ✅

**What was tested:**
Run UiaBridge.exe directly from terminal. Open Claude Desktop and type Hebrew.
Check that terminal output shows Hebrew text with coordinates.

**Result:**
UiaBridge.exe successfully reads Hebrew text from Claude Desktop in real time.
Output includes x, y, width, height coordinates for each text element.
The technology works at the foundation level.

**Date:** April 2026

---

### Attempt at Test 2 — FAILED (environment issue, not code)

**What we tried:**
Run the Electron side panel app to visually show the RTL fix working.

**What went wrong:**

1. **Antigravity app interference:**
   Antigravity is installed on the user's machine as a standalone production app.
   It has its own Electron window with a completely different UI (toggle switches, app list).
   Every time our Electron app started, the user saw the Antigravity window first
   and confused it with our new app.
   Antigravity is NOT in Windows startup apps (Startup tab of Task Manager).
   It was already running from before the session.
   To kill it: Task Manager → Processes → search "Antigravity" → End Task.

2. **Our new window was invisible:**
   The FixMixRTL2 Electron window opened off-screen (no fixed x,y position set).
   The electron.exe process was running and the engine was scanning, but the window
   was not visible to the user.
   Fix applied: added x:20, y:20 to BrowserWindow config. Not fully tested.

3. **Package.json had wrong app name:**
   FixMixRTL2's package.json had name: "rtl-ai-fixer" from the old Antigravity code.
   This caused UiaBridge to report App="rtl ai fixer" when scanning our own window,
   which was confusing.

4. **Project folder was not clean enough:**
   FixMixRTL2 was created by copying from FixMixRTL (old Antigravity code).
   Even though new code was written, the folder contained remnants of old config,
   package names, and build artifacts that caused confusion.

**Decision made:**
Start completely fresh with a new clean folder (FixMixAI).
Copy only the three engine files that were confirmed to work.

---

### Key Technical Confirmations from This Session

1. **UiaBridge reads Claude Desktop correctly.**
   App name reported by UIAutomation: "write your prompt to claude"
   (this is the placeholder text in Claude Desktop's input field)
   RawCount varies: 0 when nothing typed, 2–12 when content is visible.

2. **Engine controller pipeline works.**
   Logs confirm: [EngineController] started → [Engine] Scan → RawCount updates.
   The engine detects any window with Hebrew text (global:true mode).

3. **UIAutomation reads the input area of Claude Desktop.**
   The "write your prompt to claude" app name suggests UIAutomation is focused
   on the input field, not the response/chat area.
   Test 6 (distinguishing input vs response areas) is still needed.

4. **npm install warnings are harmless.**
   ERESOLVE warnings about @typescript-eslint peer dependencies are not errors.
   They are version conflicts in dev tooling only. The app runs fine.

---

### Files That Work (Do Not Rewrite)

These three files were validated in Test 1 and the engine scan logs:

- `native/UiaBridge/UiaBridge.exe` — compiled C# binary. Works.
- `src/main/engine/rtl-detector.ts` — Hebrew detection and BiDi fix logic.
- `src/main/engine/uia-bridge.ts` — Node.js bridge to the C# process.

These files are copied to FixMixAI/native/ and FixMixAI/src/main/engine/

---

### What Was NOT Tested (Still Pending)

Tests 2 through 10 from PLAN.md — none confirmed yet.

---

## Things to Watch Out For in Future Sessions

1. **Antigravity window appearing:** always check Task Manager → Processes if user
   reports seeing a panel with Hebrew toggle switches and app list (Claude Desktop,
   Cursor IDE, etc.). That is Antigravity, not FixMixAI.

2. **electron.exe not visible:** if the engine logs are running but user cannot see
   a window, the window may be off-screen. Set explicit x, y in BrowserWindow.
   Also try: alwaysOnTop: true temporarily for debugging.

3. **Two monitors:** user has two monitors. Electron windows may open on the wrong one.
   Always set explicit position. Consider using screen.getPrimaryDisplay() to get
   primary display bounds.

4. **npm run dev with port 5173:** if another Vite dev server is already running
   on port 5173 (e.g., from old FixMixRTL folder in another terminal), our app
   may load the wrong renderer. Always close other terminals before running.

5. **Terminal tier in Cowork:** Claude in Cowork cannot TYPE into Terminal windows
   (tier = "click" only). To run commands, write them to clipboard with
   mcp__computer-use__write_clipboard and ask user to paste.
