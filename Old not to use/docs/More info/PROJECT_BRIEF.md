# FixMixAI — Project Brief
# (Paste this text into the Cowork project description)

## What This Project Is

A Windows desktop app that fixes broken Hebrew/English mixed text (RTL/LTR mixing)
in AI desktop apps like Claude Desktop, Cursor, ChatGPT, and others.

The app reads text from any desktop app using Windows UIAutomation (a Windows
accessibility API), detects mixed Hebrew+English direction errors, fixes them,
and shows the corrected text in a clean overlay window.

**This is a commercial product in early validation phase.**
Target users: Hebrew and Arabic speakers who use AI desktop tools daily.

---

## Why UIAutomation (Not Screen Capture)

UIAutomation reads actual text characters from other apps — it does not capture pixels.
This means it can fix text direction accurately, regardless of which app the text is in.
It works on Electron apps, native Windows apps, and Chrome-based apps.

---

## Current Status (as of April 2026)

**What works:**
- UiaBridge.exe (C# program) reads Hebrew text from Claude Desktop with coordinates. TESTED ✅
- RTL detector (TypeScript) detects and fixes Hebrew/English mixing. WRITTEN, not yet visually tested.
- Engine controller connects UiaBridge → RTL detector → output.

**What has NOT been tested yet:**
- The visual POC window (Test 2 through Test 10)
- Chrome browser reading
- Performance

**Next immediate step:**
Build and run a simple POC window (white background, two columns:
raw text on left, corrected RTL text on right) — see POC_SPEC.md

---

## The 10 Tests

See PLAN.md for full details. Short version:

1. ✅ UiaBridge reads Hebrew from Claude Desktop
2. ⬜ RTL fix looks correct visually (POC window)
3. ⬜ No mouse freeze while engine runs
4. ⬜ Overlay window follows app window when moved
5. ⬜ User can select and copy from overlay
6. ⬜ UIAutomation distinguishes input vs response vs artifact areas
7. ⬜ How much scrolled-back text is accessible
8. ⬜ What element types can UIAutomation read (tables, code blocks)
9. ⬜ Performance with 2 windows from same app
10. ⬜ Performance with 2 different apps simultaneously

---

## Tech Stack

- Electron + React + TypeScript (electron-vite)
- C# native bridge (UiaBridge.exe) for Windows UIAutomation
- Tailwind CSS

---

## Files in This Project

- docs/ Plan, skills and more
- native/UiaBridge/ — C# executable that reads text from Windows apps
- src/main/engine/ — TypeScript RTL detection and fix engine

---

## Important Note About User Preferences

The user (Tsafrir) has detailed preferences in the Cowork Settings.
Read them before starting any work. Key points are summarized in WORKING_WITH_TSAFRIR.md.
