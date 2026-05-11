# POC Window Specification
# (This is what to build for Test 2)

---

## Purpose

Prove visually that the full pipeline works:
UIAutomation reads text → RTL detector fixes it → User sees the difference.

This is the simplest possible version. No design, no product features.
White background. Two columns. That's it.

---

## What the User Sees

A window, approximately 900px wide × 700px tall.

**Header (thin, gray):**
- App name being scanned (e.g. "write your prompt to claude")
- Number of elements found
- Last updated time

**Main content — a table:**

| # | As Captured (raw) | After RTL Fix | Status |
|---|---|---|---|
| 1 | [raw text, rendered LTR] | [fixed text, rendered RTL] | 🟡 Fixed |
| 2 | [Hebrew only text] | [same text] | ✅ OK |
| 3 | [English only] | [same text] | — |

- "As Captured" column: render with dir="ltr" to show the broken version
- "After RTL Fix" column: render with dir="rtl" to show the corrected version
- Status column: "🟡 Fixed" if RTL fix was applied, "✅ OK" if pure Hebrew, "—" if English only

**Footer:**
- Button: "Copy all fixed text"
- Scan interval indicator (e.g. "Scanning every 1s")

---

## Design Details

- Background: white (#ffffff)
- Font: system font (Segoe UI on Windows)
- Table borders: light gray (#e0e0e0)
- Fixed rows: light yellow background (#fffde7) — to highlight what changed
- Raw text cell: monospace font, direction left-to-right (to show the "broken" state)
- Fixed text cell: regular font, direction right-to-left

---

## What This Proves (Test Questions Answered)

1. **Does UIAutomation read the text?** — Yes, if rows appear in the table.
2. **Does the engine receive the data?** — Yes, if the table updates in real time.
3. **Does the RTL fix work?** — Yes, if the "After RTL Fix" column looks readable.
4. **Is the fix correct?** — User judges by reading the fixed column.

---

## Test Sentences for Tsafrir to Type in Claude Desktop

Type each sentence and check that it appears in the POC window with correct fix:

```
השתמשתי ב React כדי לבנות את הממשק
```
```
הפרויקט משתמש ב TypeScript ו Node.js
```
```
ה API מחזיר JSON עם שדות של מידע
```
```
למדתי על machine learning ו deep learning
```
```
הקובץ נקרא index.html והוא בתיקיית src
```

---

## What to Check Per Sentence

For each sentence above, verify in the POC window:

1. The "As Captured" column shows the sentence in a clearly broken/scrambled order
2. The "After RTL Fix" column shows the sentence clearly readable right-to-left
3. The English term (React, TypeScript, etc.) stays in its correct position within the sentence
4. The row is highlighted yellow (status: Fixed)

---

## What Counts as PASS

Test 2 passes when:
- At least 3 of the 5 test sentences appear with correct RTL fix
- The fixed text is readable (user can understand the sentence)
- No crashes or freezes during the test

---

## How to Run the POC

```
cd C:\Users\ortsa\OneDrive\מסמכים\Claude\Projects\FixMixAI
npm install
npm run dev
```

A window opens. Open Claude Desktop. Type the test sentences.
Watch the POC window update.
