# FixMixAI — Full Development Plan

---

## For the Coordinator Agent — Read This First

If you are an agent reading this document, you are the **Coordinator**.

Your role:
- You are Gemini. You coordinate — you do not write code or make technical decisions alone
- Your first action is to read all Skills listed in the "Skills & Rules Reference" section below
- Your second action is to have an opening conversation with Tsafrir to clarify any open questions
- Your third action is to run the AGENT_ROSTER skill to define the Sub-Agent team
- You speak with Tsafrir in Hebrew. Technical terms stay in English
- You never start Phase 1 work before the dashboard is live

---

## The Problem

AI desktop apps (Claude Desktop, Cursor, ChatGPT, Sider, and more) display
Hebrew and Arabic text with broken direction when mixed with English.

Example of broken text: "השתמשתי ב React כדי לבנות"
(the word "React" in the middle of a Hebrew sentence causes the whole line
to render left-to-right, making the Hebrew parts appear in wrong order)

No solution exists today for desktop apps — only browser extensions for Chrome.

---

## The Product

A local desktop app for windows:
1. Reads text from AI desktop(most important)+ Browser+ side bar apps using Windows UIAutomation. 
2. Detects RTL/English direction mixing in AI apps. In windows of chats+ Artifacts with text displays (such as Tables), and in the future more text displays in AI apps.
3. Displays the corrected text. - best UX/UI would be a seamless overlay window on top of the original app's window- But: keeping interactive elements areas active- overlay must not block buttons or input.
4. more features such as "To magnetize and demagnetize" the overlay display, to save and to share with RTL formatting tables and texts according to user decision, and more later.
5. Need to decide how UI works- does the Fixmix overlay will have a Window frame glows when active? How user chooses which window to active and how many windows can be activate in parallel without slowing down programs and mouth movement? Will FixMixAI will have a control panel or another way to choose wich windows to activate, Language selection, appearance selection, and more.

+The user sees the corrected version and can copy from it.
It works on any AI app (Desktop first but also Browser apps if using UIAutomation will read the same from broser apps.

**Product name:** FixMixAI
**Target users:** RTL-language AI users (Hebrew, Arabic, Persian, Urdu)

**Commercial product** — Phase 3 includes installer, code signing, distribution, Monetization.  

---

## Why UIAutomation

UIAutomation is a Windows accessibility API. It reads actual text characters
from any Windows app — Electron apps, native apps, Chrome-based apps.
It does NOT capture pixels. This means:
- It works even when the app uses custom rendering
- It captures the exact characters, so RTL fixing is precise
- It is the same API used by screen readers for blind users

Screen capture tools (AnyDesk, TeamViewer) see pixels only — they cannot
fix text direction because they do not know what the characters are.

---

## Window Types Inside an AI App

UIAutomation sees different areas within the same app window as separate elements:

| Area | What it is | Example in Claude Desktop |
|---|---|---|
| Input area | Where user types | Text box at bottom |
| Response area | Where AI answers appear | Chat conversation |
| Artifact panel | Structured output | Table, code, document on right |
| App chrome | Navigation, menus | Sidebar icons, top bar |

The most important area is the response area — where the user receives
mixed Hebrew+English text that is unreadable.

---

## Development Phases

### Pre-work Phase
Reading and understanding all project requirements by reviewing existing documents and chatting with the project owner to clarify details, roles, and expectations.

Coordinator setup steps (in order):
1. Coordinator reads this document and all Skills listed in "Skills & Rules Reference"
2. Coordinator initiates an opening conversation with Tsafrir to clarify any open questions
3. Coordinator runs AGENT_ROSTER skill — researches current model strengths, proposes team, waits for Tsafrir approval
4. Coordinator sends SUBAGENT_ONBOARDING skill to each approved Sub-Agent
5. Coordinator creates PROJECT_DASHBOARD.md using the SHARED_WORKSPACE skill
6. Only after dashboard is live — begin Phase 1

### Phase 1 — Research or Test to Validate (10 Tests)
It is possible to run tests on Tsafrir's PC, Windows 11, with Claude Desktop (chat, cowork, code), Antigravity agents, and many more browser and desktop AI apps.
Before planning, designing or building features get those answers: (following after this chapter are written as tests, but if research or testing in a sandbox or other method would provide faster and better the answers then no need to test manually).

Think, ask, and test any other element needed.
Then go to planning.
After the planning is done, start the developing.

### Phase 2 — Personal Prototype
- A personal desktop app for Tsafrir to experience.
- Features and design according to the planning. 
- Full overlay covering the response area?
- Colored border showing overlay is active?
- Copy works?
- No performance issues?

### Phase 3 — Commercial Version
- Multiple apps
- Multiple windows
- Installer for other users
- Code signing certificate (~$300/year, required for Windows distribution)
- Distribution website

---

## The 10 Tests

### Test 1 — UiaBridge reads Hebrew from Claude Desktop
**Status:** ✅ PASSED (April 2026)
**What we tested:** Run UiaBridge.exe, open Claude Desktop, type Hebrew.
Check terminal output for Hebrew text + coordinates.
**Result:** Works. Reads text in real time with x, y, width, height per element.
**Implication:** Foundation is solid. UIAutomation can see inside Claude Desktop.

---

### Test 2 — RTL fix looks correct visually
**Status:** ⬜ NOT YET TESTED

**What we test:**
Run the POC window (white background, two columns).
Type a Hebrew+English mixed sentence in Claude Desktop.
Check: does the POC show the raw text (broken) and the fixed text (correct RTL)?

**What "correct" looks like:**
- Raw: "השתמשתי ב React כדי לבנות" — rendered LTR, Hebrew words scrambled
- Fixed: same text with RLI/LRI/PDI Unicode markers applied, rendering correctly RTL
  with "React" staying in its natural position within the Hebrew sentence

**The POC window spec:** see POC_SPEC.md

**Test sentences to use:**
1. "השתמשתי ב React כדי לבנות את הממשק"
2. "הפרויקט משתמש ב TypeScript ו Node.js"
3. "ה API מחזיר JSON עם שדות של מידע"

---

### Test 3 — No mouse freeze
**Status:** ⬜ NOT YET TESTED

**What we test:**
While FixMixAI is running and scanning, type text and move mouse normally.
**Pass:** No lag, no freezing.
**Fail:** Any noticeable freeze or lag during scanning.
**Risk:** UIAutomation polling can sometimes block the UI thread on Windows.
**Fix if fails:** Move scanning to a background thread with lower priority.

---

### Test 4 — Overlay follows window when moved
**Status:** ⬜ NOT YET TESTED

**What we test:**
Move the Claude Desktop window across the screen.
Check that the overlay follows it exactly.
**Pass:** Overlay follows with less than 100ms lag.
**Risk:** WinEvent hooks update position asynchronously. Fast dragging may lag.

---

### Test 5 — User can select and copy from overlay
**Status:** ⬜ NOT YET TESTED

**What we test:**
Select text in the overlay window with mouse. Press Ctrl+C. Paste in Notepad.
**Pass:** Correct fixed Hebrew text is pasted.
**Risk:** Electron overlay may block text selection if configured incorrectly.

---

### Test 6 — UIAutomation distinguishes window areas
**Status:** ⬜ NOT YET TESTED

**What we test:**
Check if UiaBridge can tell apart: input area vs response area vs artifact panel.
**Why it matters:** We may want to fix ONLY the response area, not the input field.
**Note:** From Test 1, UIAutomation appears to focus on "write your prompt to claude"
(the input area). We need to verify it also reads the response/chat area.

---

### Test 7 — How much scrolled-back text is accessible
**Status:** ⬜ NOT YET TESTED

**What we test:**
Have a long conversation. Scroll up. Activate FixMixAI. Check how many messages back
UIAutomation can see.
**Risk:** UIAutomation typically reads only currently rendered DOM elements.
Virtualized lists (common in Electron apps) remove off-screen items from accessibility tree.
**Decision after test:** If scroll history is limited, the product shows current screen only.

---

### Test 8 — What element types can UIAutomation read
**Status:** ⬜ NOT YET TESTED

**What we test:**
Ask Claude Desktop to generate: plain text, a table, a code block with Hebrew comments.
Check what UiaBridge captures for each type.
**Why it matters:** Tables and code blocks may not be accessible as text.

---

### Test 9 — Performance: 2 windows from same app
**Status:** ⬜ NOT YET TESTED

**What we test:**
Open 2 Claude Desktop windows. Run FixMixAI on both.
Check CPU usage and whether both overlays update correctly.
**Decision after test:** If slow → one active overlay at a time (user selects which).

---

### Test 10 — Performance: 2 different apps
**Status:** ⬜ NOT YET TESTED

**What we test:**
Open Claude Desktop + Cursor simultaneously. Run FixMixAI on both.
**Decision after test:** Same as Test 9.

---

## After All Desktop Tests Pass

Run the same test sequence on a Chrome browser window.
UIAutomation can read Chromium-based content (Chrome, Edge, Electron apps all use Chromium).
This would mean FixMixAI works for web-based AI tools too — a major expansion.

---

## Known Technical Risks

1. **Scroll limit** — UIAutomation may see only visible text. Test 7.
2. **DPI scaling** — coordinates need adjustment for 150%, 200% scaling screens.
3. **App updates** — Claude Desktop may update and change its accessibility tree.
4. **Window tracking** — overlay must follow in real time. Test 4.
5. **Interactive elements** — overlay must not block buttons or input.
6. **Code signing** — ~$300/year required before distributing to other users.

---

## Technical Architecture

### How It Works
1. UiaBridge.exe (C#) — runs as child process, reads text using Windows UIAutomation API
2. uia-bridge.ts (TypeScript) — manages the C# process, parses JSON output
3. rtl-detector.ts (TypeScript) — detects Hebrew characters (U+0590–U+05FF range),
   applies Unicode BiDi markers (RLI, LRI, PDI) to fix direction
4. engine-controller.ts (TypeScript) — orchestrates the full pipeline
5. Electron renderer — displays results to user

### Unicode BiDi Fix Method
The fix inserts invisible Unicode direction markers:
- RLI (U+2067) — Right-to-Left Isolate: before Hebrew block
- LRI (U+2066) — Left-to-Right Isolate: before English block  
- PDI (U+2069) — Pop Directional Isolate: after each block

This is the correct modern approach (Unicode BiDi Algorithm).
It does NOT alter the text content — only adds invisible formatting characters.

### Files That Work (Do Not Rewrite)
- native/UiaBridge/UiaBridge.exe — compiled C# binary, tested
- src/main/engine/rtl-detector.ts — detection and fix logic
- src/main/engine/uia-bridge.ts — C# process bridge

---

## How We Work

**Coordinator:** Gemini (always)
- Communication hub between all Sub-Agents and Tsafrir
- Owns and maintains PROJECT_DASHBOARD.md
- Does not write code or make technical decisions alone
- Explains all technical decisions to Tsafrir in plain language (Hebrew)
- Triggers TECHNICAL_BRAINSTORM when work is stuck or a decision is complex

**Sub-Agents:** Defined dynamically at project start using the AGENT_ROSTER skill.
- Gemini researches current model strengths before assigning roles
- Team is confirmed with Tsafrir before work begins
- Each Sub-Agent receives SUBAGENT_ONBOARDING at session start

---

## Skills & Rules Reference

**Coordinator global rules:**
- Global Rules (GEMINI.md) — Coordinator behavior, communication style, Hebrew/English handling
-  WORKING_WITH_TSAFRIR.md — User profile, communication rules, health considerations

**Project Skills** (live in .agent/skills/):
- AGENT_ROSTER — Coordinator selects and defines the Sub-Agent team
- SUBAGENT_ONBOARDING — Sent to every Sub-Agent at the start of a session
- TECHNICAL_BRAINSTORM — Cross-agent problem solving when work is stuck
- SHARED_WORKSPACE — Dashboard structure and agent communication protocol

**Project Management:**
- PROJECT_DASHBOARD.md — Shared task board (created by Coordinator at project start)
