import { describe, expect, test } from "bun:test"
import { countLogEntries, countUndefinedCitationWarnings, parseLatexLog } from "./latex-log-parser"

describe("parseLatexLog citation/reference warnings", () => {
  test("parses undefined citation and reference warnings", () => {
    const log = [
      "LaTeX Warning: Citation `tambon2024' on page 2 undefined on input line 69.",
      "LaTeX Warning: There were undefined references.",
      "LaTeX Warning: There were undefined citations.",
      "LaTeX Warning: Label(s) may have changed. Rerun to get cross-references right.",
    ].join("\n")

    const entries = parseLatexLog(log)
    const counts = countLogEntries(entries)

    expect(counts.errors).toBe(0)
    expect(counts.warnings).toBe(4)
    expect(countUndefinedCitationWarnings(entries)).toBe(4)
    expect(entries.some((e) => e.message.includes('Citation "tambon2024" is undefined.'))).toBe(true)
    expect(entries.some((e) => e.message.includes("undefined references"))).toBe(true)
    expect(entries.some((e) => e.message.includes("undefined citations"))).toBe(true)
  })

  test("parses tectonic-style warning with file and line", () => {
    const log = "warning: main.tex:110: Citation `liu2024' on page 3 undefined"
    const entries = parseLatexLog(log)

    expect(entries.length).toBe(1)
    expect(entries[0].type).toBe("warning")
    expect(entries[0].file).toBe("main.tex")
    expect(entries[0].line).toBe(110)
    expect(entries[0].message).toBe('Citation "liu2024" is undefined.')
    expect(countUndefinedCitationWarnings(entries)).toBe(1)
  })
})
