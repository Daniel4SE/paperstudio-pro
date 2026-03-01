/**
 * LaTeX compilation log parser.
 *
 * Parses raw LaTeX log text into structured entries with type, message,
 * optional file/line info, and multi-line context blocks.
 */

export type LogEntryType = "error" | "warning" | "info"

export interface LogEntry {
  type: LogEntryType
  message: string
  file?: string
  line?: number
  context?: string
  raw: string
}

// ── Patterns ────────────────────────────────────────────────────────────────

const ERROR_PATTERNS: Array<{ regex: RegExp; extract: (m: RegExpMatchArray, line: string) => string }> = [
  {
    regex: /^!\s+(.+)/,
    extract: (m) => m[1].trim(),
  },
  {
    regex: /LaTeX Error:\s*(.+)/,
    extract: (m) => m[1].trim(),
  },
  {
    regex: /!\s*Emergency stop/,
    extract: () => "Emergency stop",
  },
]

const WARNING_PATTERNS: Array<{ regex: RegExp; extract: (m: RegExpMatchArray, line: string) => string }> = [
  {
    regex: /LaTeX Warning:\s*(.+)/,
    extract: (m) => m[1].trim(),
  },
  {
    regex: /LaTeX Font Warning:\s*(.+)/,
    extract: (m) => m[1].trim(),
  },
  {
    regex: /Package (\w+) Warning:\s*(.+)/,
    extract: (m) => `Package ${m[1]}: ${m[2].trim()}`,
  },
  {
    regex: /Class (\w+) Warning:\s*(.+)/,
    extract: (m) => `Class ${m[1]}: ${m[2].trim()}`,
  },
  {
    regex: /(Overfull|Underfull)\s+\\[hv]box\s+(.+)/,
    extract: (m) => `${m[1]} box ${m[2].trim()}`,
  },
]

/** Lines matching these are page markers or boilerplate — skip them. */
const SKIP_PATTERNS = [
  /^\s*$/,
  /^\s*\[\d+\]\s*$/,
  /^\s*\[\d+{/,
  /^This is (pdf|Xe|Lua)?TeX/,
  /^entering extended mode/,
  /^Document Class:/,
  /^File:/,
  /^\\openout\d/,
  /^\s*\(\.\/.*\.aux\)\s*$/,
  /^ABD: EveryShipout/,
  /^Output written on/,
  /^Transcript written on/,
  /^Here is how much/,
  /^\s+\d+ [a-z]+ [a-z]+/,
  /^\s*<\S+\.(png|jpg|jpeg|pdf|eps)>/,
]

/** Extract file path from a line. */
function extractFile(line: string): string | undefined {
  // Match (./path/file.tex  or  ./path/file.tex
  const fileMatch = line.match(/\(?\.\/([^\s,)]+\.\w+)/)
  if (fileMatch) return fileMatch[1]

  // Match standalone file references like file.tex
  const standaloneMatch = line.match(/\b([a-zA-Z0-9_/.-]+\.(?:tex|sty|cls|bib|bbl|aux))\b/)
  if (standaloneMatch) return standaloneMatch[1]

  return undefined
}

/** Extract line number from a line. */
function extractLineNumber(line: string): number | undefined {
  // l.142 ...
  const lMatch = line.match(/^l\.(\d+)\s/)
  if (lMatch) return parseInt(lMatch[1], 10)

  // "line 142" or "at line 142"
  const lineMatch = line.match(/(?:at\s+)?line\s+(\d+)/i)
  if (lineMatch) return parseInt(lineMatch[1], 10)

  // "./file.tex, 142" pattern
  const commaMatch = line.match(/\.\w+,\s*(\d+)/)
  if (commaMatch) return parseInt(commaMatch[1], 10)

  return undefined
}

/** Check if a line looks like context continuation (indented or starts with l.NNN). */
function isContextLine(line: string): boolean {
  if (/^\s{2,}\S/.test(line)) return true
  if (/^l\.\d+/.test(line)) return true
  if (/^\s+\.\.\./.test(line)) return true
  return false
}

function shouldSkip(line: string): boolean {
  return SKIP_PATTERNS.some((p) => p.test(line))
}

// ── Parser ──────────────────────────────────────────────────────────────────

export function parseLatexLog(log: string): LogEntry[] {
  if (!log || !log.trim()) return []

  const lines = log.split("\n")
  const entries: LogEntry[] = []
  let i = 0

  while (i < lines.length) {
    const line = lines[i]

    if (shouldSkip(line)) {
      i++
      continue
    }

    // Try error patterns
    let matched = false
    for (const pattern of ERROR_PATTERNS) {
      const m = line.match(pattern.regex)
      if (m) {
        const entry = buildEntry("error", pattern.extract(m, line), line, lines, i)
        entries.push(entry)
        i = entry._nextIndex
        matched = true
        break
      }
    }
    if (matched) continue

    // Try warning patterns
    for (const pattern of WARNING_PATTERNS) {
      const m = line.match(pattern.regex)
      if (m) {
        const entry = buildEntry("warning", pattern.extract(m, line), line, lines, i)
        entries.push(entry)
        i = entry._nextIndex
        matched = true
        break
      }
    }
    if (matched) continue

    // Info: lines starting with * that have useful content (not just asterisks)
    if (/^\*\s+\S/.test(line)) {
      const message = line.replace(/^\*\s*/, "").trim()
      if (message.length > 2) {
        entries.push({
          type: "info",
          message,
          file: extractFile(line),
          line: extractLineNumber(line),
          raw: line,
        })
      }
    }

    i++
  }

  // Deduplicate near-identical messages that LaTeX sometimes repeats
  return deduplicateEntries(entries)
}

interface EntryWithIndex extends LogEntry {
  _nextIndex: number
}

function buildEntry(
  type: LogEntryType,
  message: string,
  currentLine: string,
  lines: string[],
  index: number,
): EntryWithIndex {
  const rawLines = [currentLine]
  const contextLines: string[] = []
  let file = extractFile(currentLine)
  let lineNum = extractLineNumber(currentLine)

  // Collect multi-line continuation for warnings that span lines
  // (LaTeX wraps long lines at ~79 chars)
  let j = index + 1
  while (j < lines.length) {
    const next = lines[j]

    // Stop at blank lines, next error/warning, or clearly unrelated output
    if (/^\s*$/.test(next)) break
    if (/^!/.test(next)) break
    if (/LaTeX (Error|Warning):/.test(next)) break
    if (/Package \w+ Warning:/.test(next)) break
    if (/Class \w+ Warning:/.test(next)) break
    if (/(Overfull|Underfull)\s+\\[hv]box/.test(next)) break

    // Context lines (indented or l.NNN)
    if (isContextLine(next)) {
      contextLines.push(next)
      rawLines.push(next)

      if (!lineNum) lineNum = extractLineNumber(next)
      if (!file) file = extractFile(next)
      j++
      continue
    }

    // Continuation of a wrapped message (starts with lowercase or spaces)
    if (/^\s{0,1}[a-z(]/.test(next) && next.length > 5) {
      message += " " + next.trim()
      rawLines.push(next)
      if (!lineNum) lineNum = extractLineNumber(next)
      if (!file) file = extractFile(next)
      j++
      continue
    }

    break
  }

  return {
    type,
    message: cleanMessage(message),
    file,
    line: lineNum,
    context: contextLines.length > 0 ? contextLines.join("\n") : undefined,
    raw: rawLines.join("\n"),
    _nextIndex: j,
  }
}

function cleanMessage(msg: string): string {
  return msg
    .replace(/\s+/g, " ")
    .replace(/^\s+|\s+$/g, "")
    .replace(/\.+$/, ".")
}

function deduplicateEntries(entries: LogEntry[]): LogEntry[] {
  const seen = new Set<string>()
  return entries.filter((entry) => {
    const key = `${entry.type}:${entry.message}:${entry.file ?? ""}:${entry.line ?? ""}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

// ── Counting ────────────────────────────────────────────────────────────────

export function countLogEntries(entries: LogEntry[]): { errors: number; warnings: number; info: number } {
  let errors = 0
  let warnings = 0
  let info = 0
  for (const entry of entries) {
    if (entry.type === "error") errors++
    else if (entry.type === "warning") warnings++
    else info++
  }
  return { errors, warnings, info }
}
