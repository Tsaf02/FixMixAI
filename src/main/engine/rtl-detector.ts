/**
 * RTL Detector & Fixer
 *
 * Detects Hebrew text, identifies RTL/LTR mixing, and applies
 * Unicode BiDi isolation markers to produce correctly-ordered output.
 *
 * Unicode markers used:
 *   U+2067  RLI  — Right-to-Left Isolate  (start RTL block)
 *   U+2066  LRI  — Left-to-Right Isolate  (start LTR block inside RTL)
 *   U+2069  PDI  — Pop Directional Isolate (end either block)
 */

// ─── Types ─────────────────────────────────────────────────────────────────

export interface TextElement {
  text: string
  x: number
  y: number
  w: number
  h: number
}

export interface FixedElement extends TextElement {
  originalText: string
  fixedText: string
  needsFix: boolean
}

export interface DetectionResult {
  containsHebrew: boolean
  isMixed: boolean        // Hebrew + Latin in same string
  hebrewRatio: number     // 0–1, proportion of Hebrew chars
}

// ─── Unicode Ranges ────────────────────────────────────────────────────────

/** Hebrew block: U+0590–U+05FF */
const HEBREW_RE = /[\u0590-\u05FF]/

/** Latin letters (basic + extended) */
const LATIN_RE = /[A-Za-z\u00C0-\u024F]/

/** A "word" made of Latin alphanumeric chars + common punctuation */
const LATIN_WORD_RE = /([A-Za-z0-9\u00C0-\u024F][\w\u00C0-\u024F\-'.,!?]*)/g

/** Unicode BiDi markers */
const RLI = '\u2067'  // Right-to-Left Isolate
const LRI = '\u2066'  // Left-to-Right Isolate
const PDI = '\u2069'  // Pop Directional Isolate

// ─── Detection ─────────────────────────────────────────────────────────────

export function containsHebrew(text: string): boolean {
  return HEBREW_RE.test(text)
}

export function isMixed(text: string): boolean {
  return HEBREW_RE.test(text) && LATIN_RE.test(text)
}

export function analyze(text: string): DetectionResult {
  if (!text || text.trim().length === 0) {
    return { containsHebrew: false, isMixed: false, hebrewRatio: 0 }
  }

  let hebrewCount = 0
  let letterCount = 0

  for (const ch of text) {
    const isHeb = ch >= '\u0590' && ch <= '\u05FF'
    const isLat = (ch >= 'A' && ch <= 'Z') || (ch >= 'a' && ch <= 'z')
    if (isHeb) { hebrewCount++; letterCount++ }
    else if (isLat) letterCount++
  }

  const hebrewRatio = letterCount > 0 ? hebrewCount / letterCount : 0

  return {
    containsHebrew: hebrewCount > 0,
    isMixed: hebrewCount > 0 && letterCount > hebrewCount,
    hebrewRatio
  }
}

// ─── Fixer ─────────────────────────────────────────────────────────────────

/**
 * Fix a single Hebrew/mixed string using Unicode BiDi isolation.
 *
 * Strategy:
 *   - Pure Hebrew string → wrap entire string in RLI…PDI
 *   - Mixed string → wrap entire string in RLI…PDI,
 *     then wrap each Latin "word" inside LRI…PDI
 *     so numbers/English terms render left-to-right inline.
 */
export function fixRTL(text: string): string {
  const { containsHebrew: hasHebrew, isMixed: mixed } = analyze(text)

  if (!hasHebrew) return text   // nothing to fix

  if (!mixed) {
    // Pure Hebrew — just isolate the whole string as RTL
    return RLI + text + PDI
  }

  // Mixed — wrap the whole thing RTL, then isolate each Latin word as LTR
  const inner = text.replace(LATIN_WORD_RE, `${LRI}$1${PDI}`)
  return RLI + inner + PDI
}

// ─── Batch Processing ──────────────────────────────────────────────────────

/**
 * Process a list of raw elements from the UIA bridge.
 * Returns only the elements that contain Hebrew, with fixed text attached.
 */
export function analyzeElements(elements: TextElement[]): FixedElement[] {
  return elements
    .filter(el => containsHebrew(el.text))
    .map(el => {
      const { isMixed: mixed } = analyze(el.text)
      const fixedText = fixRTL(el.text)

      return {
        ...el,
        originalText: el.text,
        fixedText,
        // "needsFix" = true when the text has mixed directions AND the fix changes it
        needsFix: mixed && fixedText !== el.text
      }
    })
}

// ─── Utilities ─────────────────────────────────────────────────────────────

/** Strip BiDi markers from a string (useful for display comparison) */
export function stripBiDi(text: string): string {
  return text.replace(/[\u2066-\u2069\u200F\u200E\u202A-\u202E]/g, '')
}
