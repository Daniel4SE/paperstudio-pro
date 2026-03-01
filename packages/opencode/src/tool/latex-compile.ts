import z from "zod"
import { Tool } from "./tool"
import fs from "fs"
import path from "path"
import os from "os"

const DEFAULT_TIMEOUT = 120000

type LatexCompileMetadata = {
  success: boolean
  compiler?: string
  compilationTime: number
  pdfData?: string
  pdfSize?: number
  errors?: number
  error?: string
}

interface CompilationLogEntry {
  type: "error" | "warning" | "info"
  message: string
  file?: string
  line?: number
}

function parseLatexLog(logText: string): CompilationLogEntry[] {
  const entries: CompilationLogEntry[] = []
  const lines = logText.split("\n")
  const errorPattern = /^!\s*(.+)$/
  const linePattern = /^l\.(\d+)\s*(.*)$/
  const warningPattern = /Warning[:\s]+(.+)/i
  const filePattern = /\(([^()]+\.tex)/

  let currentFile: string | undefined

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]

    const fileMatch = line.match(filePattern)
    if (fileMatch) currentFile = fileMatch[1]

    const errorMatch = line.match(errorPattern)
    if (errorMatch) {
      const entry: CompilationLogEntry = {
        type: "error",
        message: errorMatch[1],
        file: currentFile,
      }
      for (let j = i + 1; j < Math.min(i + 5, lines.length); j++) {
        const lineMatch = lines[j].match(linePattern)
        if (lineMatch) {
          entry.line = parseInt(lineMatch[1], 10)
          break
        }
      }
      entries.push(entry)
    }

    const warningMatch = line.match(warningPattern)
    if (warningMatch && !line.includes("Package")) {
      entries.push({ type: "warning", message: warningMatch[1].trim(), file: currentFile })
    }

    if (line.includes("Overfull") || line.includes("Underfull")) {
      entries.push({ type: "info", message: line.trim(), file: currentFile })
    }
  }
  return entries
}

/**
 * Write project resources to a temp directory for Tectonic compilation.
 * Returns the temp dir path and the main .tex file path.
 */
function writeProjectToTempDir(
  mainFile: string,
  resources: { path: string; content: string; isBinary: boolean }[],
): { tempDir: string; mainTexPath: string } {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "paperstudio-latex-"))
  let mainTexPath = ""

  for (const resource of resources) {
    const filePath = path.join(tempDir, resource.path)
    const dir = path.dirname(filePath)
    fs.mkdirSync(dir, { recursive: true })

    if (resource.isBinary) {
      // Decode base64 to binary
      let base64Data = resource.content
      // Strip data URL prefix if present
      const match = base64Data.match(/^data:[^;]+;base64,(.+)$/)
      if (match) base64Data = match[1]
      fs.writeFileSync(filePath, Buffer.from(base64Data, "base64"))
    } else {
      fs.writeFileSync(filePath, resource.content, "utf-8")
    }

    const fileName = resource.path.split("/").pop() || resource.path
    const mainFileName = mainFile.split("/").pop() || mainFile
    if (fileName === mainFileName || resource.path === mainFile) {
      mainTexPath = filePath
    }
  }

  // Fallback: find first .tex if mainTexPath not found
  if (!mainTexPath) {
    const firstTex = resources.find((r) => r.path.endsWith(".tex"))
    if (firstTex) {
      mainTexPath = path.join(tempDir, firstTex.path)
    }
  }

  return { tempDir, mainTexPath }
}

function cleanupTempDir(tempDir: string) {
  try {
    fs.rmSync(tempDir, { recursive: true, force: true })
  } catch {}
}

export const LatexCompileTool = Tool.define("latex_compile", {
  description: `Compile a LaTeX document to PDF using Tectonic (local TeX engine, no network API needed). Supports pdflatex-compatible compilation, multi-file projects, and automatic bibliography processing. Pass all project files (main .tex, .bib, .sty, images as base64) as resources. Returns the compiled PDF as a base64 data URL, or compilation errors with log details. Falls back to YtoTech online API if Tectonic is unavailable.`,
  parameters: z.object({
    mainFile: z.string().describe("Filename of the main .tex file (e.g. 'main.tex')"),
    resources: z
      .array(
        z.object({
          path: z.string().describe("File path (e.g. 'main.tex', 'ref.bib', 'figures/fig1.png')"),
          content: z.string().describe("File content (text for .tex/.bib/.sty, base64 for images)"),
          isBinary: z.boolean().default(false).describe("True for binary files like images"),
        }),
      )
      .describe("All project files"),
    engine: z.enum(["pdflatex", "xelatex", "lualatex"]).default("pdflatex").describe("LaTeX engine (Tectonic uses XeTeX-compatible engine)"),
    bibtex: z.boolean().default(false).describe("Force enable bibliography processing (Tectonic auto-detects)"),
    timeout: z.number().default(DEFAULT_TIMEOUT).describe("Compilation timeout in ms"),
  }),
  async execute(params): Promise<{ title: string; output: string; metadata: LatexCompileMetadata }> {
    const startTime = Date.now()

    // Try Tectonic (local) first
    try {
      const { compile, isAvailable } = await import("node-latex-compiler")

      if (isAvailable()) {
        // Write all resources to temp dir
        const { tempDir, mainTexPath } = writeProjectToTempDir(params.mainFile, params.resources)

        if (!mainTexPath) {
          cleanupTempDir(tempDir)
          return {
            title: "Compilation failed",
            output: "No main .tex file found in resources.",
            metadata: { success: false, compiler: "tectonic", compilationTime: Date.now() - startTime },
          }
        }

        try {
          const result = await compile({
            texFile: mainTexPath,
            returnBuffer: true,
            onStdout: (data: string) => {},
            onStderr: (data: string) => {},
          })

          const elapsed = Date.now() - startTime

          if (result.status === "success" && result.pdfBuffer) {
            const base64 = result.pdfBuffer.toString("base64")
            const pdfDataUrl = `data:application/pdf;base64,${base64}`

            // Parse any warnings from stderr
            const logs = parseLatexLog(result.stderr || "")
            const warnings = logs.filter((l) => l.type === "warning")

            cleanupTempDir(tempDir)
            return {
              title: "Compilation successful (Tectonic)",
              output: `## Compilation Successful\n\nPDF generated in ${elapsed}ms using Tectonic (local).\nPDF size: ${(result.pdfBuffer.length / 1024).toFixed(1)}KB\n${warnings.length > 0 ? `\n### Warnings\n${warnings.map((w) => `- ${w.message}`).join("\n")}` : ""}\n\nThe PDF data is available in the metadata as \`pdfData\`.`,
              metadata: {
                success: true,
                pdfData: pdfDataUrl,
                compiler: "tectonic",
                pdfSize: result.pdfBuffer.length,
                compilationTime: elapsed,
              },
            }
          } else {
            // Compilation failed
            const logs = parseLatexLog(result.stderr || result.stdout || "")
            const errors = logs.filter((l) => l.type === "error")
            const errorDetail = result.stderr || result.stdout || result.error || "Unknown error"

            cleanupTempDir(tempDir)
            return {
              title: `Compilation failed (${errors.length} errors)`,
              output: `## Compilation Failed (Tectonic)\n\n${errors.length > 0 ? errors.map((e) => `- **Error** (${e.file || "unknown"}:${e.line || "?"}): ${e.message}`).join("\n") : "No specific errors parsed."}\n\n### Log\n\`\`\`\n${errorDetail.slice(0, 3000)}\n\`\`\``,
              metadata: {
                success: false,
                compiler: "tectonic",
                errors: errors.length,
                compilationTime: Date.now() - startTime,
              },
            }
          }
        } catch (e: any) {
          cleanupTempDir(tempDir)
          throw e // Fall through to YtoTech fallback
        }
      }
    } catch (tectonicError: any) {
      // Tectonic not available, fall back to YtoTech API
      console.warn("[latex_compile] Tectonic unavailable, falling back to YtoTech API:", tectonicError.message)
    }

    // ── Fallback: YtoTech online API ──
    const API_URL = "https://latex.ytotech.com/builds/sync"

    const resources: any[] = []
    const mainFileName = params.mainFile.split("/").pop() || params.mainFile

    for (const resource of params.resources) {
      const resourceFileName = resource.path.split("/").pop() || resource.path
      const isMain = resourceFileName === mainFileName || resource.path === params.mainFile

      if (resource.isBinary) {
        resources.push({ path: resource.path, file: resource.content })
      } else {
        const entry: any = { path: resource.path, content: resource.content }
        if (isMain) entry.main = true
        resources.push(entry)
      }
    }

    if (!resources.some((r) => r.main === true) && resources.length > 0) {
      const firstTex = resources.find((r) => r.path?.endsWith(".tex"))
      if (firstTex) firstTex.main = true
    }

    const requestBody: any = {
      compiler: params.engine || "pdflatex",
      resources,
    }

    const allTextContent = resources
      .filter((r: any) => !r.file && r.content)
      .map((r: any) => r.content)
      .join("\n")
    const hasBibFile = resources.some((r: any) => r.path?.endsWith(".bib"))
    const hasBibCommand =
      /\\bibliography\{/.test(allTextContent) ||
      /\\addbibresource\{/.test(allTextContent) ||
      /\\printbibliography/.test(allTextContent) ||
      /\\bibliographystyle\{/.test(allTextContent)

    if (params.bibtex || hasBibFile || hasBibCommand) {
      const useBiber =
        /\\usepackage.*\{biblatex\}/.test(allTextContent) || /backend\s*=\s*biber/.test(allTextContent)
      requestBody.options = {
        bibliography: { command: useBiber ? "biber" : "bibtex" },
      }
    }

    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), params.timeout || DEFAULT_TIMEOUT)

      const response = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
        signal: controller.signal,
      })

      clearTimeout(timeoutId)

      if (!response.ok) {
        const errorText = await response.text()
        const logs = parseLatexLog(errorText)
        const errors = logs.filter((l) => l.type === "error")
        return {
          title: `Compilation failed (${response.status})`,
          output: `## Compilation Failed (YtoTech)\n\n${errors.length > 0 ? errors.map((e) => `- **Error**: ${e.message}`).join("\n") : errorText.slice(0, 2000)}`,
          metadata: { success: false, compiler: "ytotech", errors: errors.length, compilationTime: Date.now() - startTime },
        }
      }

      const contentType = response.headers.get("content-type")
      if (contentType?.includes("application/pdf")) {
        const arrayBuffer = await response.arrayBuffer()
        const bytes = new Uint8Array(arrayBuffer)
        const base64 = Buffer.from(bytes).toString("base64")
        const pdfDataUrl = `data:application/pdf;base64,${base64}`

        return {
          title: "Compilation successful (YtoTech)",
          output: `## Compilation Successful\n\nPDF generated in ${Date.now() - startTime}ms using YtoTech online API.\n\nThe PDF data is available in the metadata as \`pdfData\`.`,
          metadata: {
            success: true,
            pdfData: pdfDataUrl,
            compiler: "ytotech",
            compilationTime: Date.now() - startTime,
          },
        }
      } else {
        const logText = await response.text()
        const logs = parseLatexLog(logText)
        const errors = logs.filter((l) => l.type === "error")
        return {
          title: `Compilation failed (${errors.length} errors)`,
          output: `## Compilation Failed (YtoTech)\n\n${errors.map((e) => `- **Error**: ${e.message}`).join("\n")}\n\n### Log\n\`\`\`\n${logText.slice(0, 3000)}\n\`\`\``,
          metadata: { success: false, compiler: "ytotech", errors: errors.length, compilationTime: Date.now() - startTime },
        }
      }
    } catch (error: any) {
      if (error.name === "AbortError") {
        return {
          title: "Compilation timed out",
          output: "Compilation timed out. Try simplifying the document.",
          metadata: { success: false, error: "TIMEOUT", compilationTime: Date.now() - startTime },
        }
      }
      return {
        title: "Compilation error",
        output: `Both Tectonic (local) and YtoTech (online) failed.\nError: ${error.message}`,
        metadata: { success: false, error: error.message, compilationTime: Date.now() - startTime },
      }
    }
  },
})
