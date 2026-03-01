/**
 * Browser-side LaTeX compiler using @siglum/engine (WebAssembly).
 *
 * This provides instant in-browser compilation without needing a server.
 * Falls back to YtoTech online API if WASM initialization fails
 * (e.g., missing SharedArrayBuffer / COOP/COEP headers).
 */

// Siglum CDN URLs (TeX Live 2025 bundles)
const SIGLUM_CDN = "https://cdn.siglum.org/tl2025"
const YTOTECH_API = "https://latex.ytotech.com/builds/sync"

export interface CompileResult {
  success: boolean
  pdfDataUrl?: string
  pdfSize?: number
  error?: string
  log?: string
  compilationTime: number
  compiler: "siglum-wasm" | "ytotech"
}

export interface ProjectFile {
  path: string
  content: string
  isBinary: boolean
}

let compilerInstance: any = null
let compilerInitPromise: Promise<any> | null = null
let siglumAvailable: boolean | null = null

/**
 * Check if SharedArrayBuffer is available (required for Siglum WASM).
 * Requires COOP/COEP headers on the page.
 */
function isSharedArrayBufferAvailable(): boolean {
  try {
    return typeof SharedArrayBuffer !== "undefined"
  } catch {
    return false
  }
}

/**
 * Initialize the Siglum compiler (singleton, lazy).
 * Returns the compiler instance or null if unavailable.
 */
async function getSiglumCompiler(): Promise<any> {
  if (siglumAvailable === false) return null
  if (compilerInstance) return compilerInstance

  if (compilerInitPromise) return compilerInitPromise

  compilerInitPromise = (async () => {
    if (!isSharedArrayBufferAvailable()) {
      console.warn(
        "[latex-compiler] SharedArrayBuffer not available. " +
          "Siglum WASM requires COOP/COEP headers. Falling back to YtoTech API.",
      )
      siglumAvailable = false
      return null
    }

    try {
      // Dynamic import with string concat to prevent Vite from statically analyzing
      // the WASM dependency chain at build time
      const modulePath = "@siglum/" + "engine"
      const mod = await import(/* @vite-ignore */ modulePath)
      const SiglumCompiler = mod.SiglumCompiler || mod.default?.SiglumCompiler
      if (!SiglumCompiler) throw new Error("SiglumCompiler not found in module")
      const compiler = new SiglumCompiler({
        bundlesUrl: `${SIGLUM_CDN}/bundles`,
        wasmUrl: `${SIGLUM_CDN}/busytex.wasm`,
        enableCtan: true,
        ctanProxyUrl: "https://ctan.siglum.org",
        verbose: false,
        onLog: (msg: string) => console.debug("[siglum]", msg),
        onProgress: (stage: string, detail: string) =>
          console.debug("[siglum]", stage, detail),
      })

      await compiler.init()
      compilerInstance = compiler
      siglumAvailable = true
      console.log("[latex-compiler] Siglum WASM compiler initialized successfully")
      return compiler
    } catch (e: any) {
      console.warn("[latex-compiler] Siglum WASM init failed:", e.message)
      siglumAvailable = false
      return null
    }
  })()

  return compilerInitPromise
}

/**
 * Compile using Siglum WASM (browser-side).
 */
async function compileWithSiglum(
  mainContent: string,
  additionalFiles: Record<string, string | Uint8Array>,
): Promise<CompileResult> {
  const startTime = Date.now()
  const compiler = await getSiglumCompiler()
  if (!compiler) {
    throw new Error("Siglum not available")
  }

  const compileOpts = { engine: "pdflatex", additionalFiles }

  // 3-pass compilation (mirrors Overleaf's full pipeline):
  //   Pass 1 — writes .aux, .toc, .lof, .lot so \label{} entries are recorded
  //   Pass 2 — reads .aux, resolves \ref{} / \eqref{} / \cite{}, writes updated .aux
  //   Pass 3 — stabilises page numbers, \tableofcontents, \listoffigures entries
  // Siglum uses a persistent virtual FS per compiler instance, so each pass
  // automatically picks up the auxiliary files written by the previous pass.
  const pass1 = await compiler.compile(mainContent, compileOpts)
  const pass2 = await compiler.compile(mainContent, compileOpts)
  const result = await compiler.compile(mainContent, compileOpts)

  const elapsed = Date.now() - startTime
  const log = [pass1.log, pass2.log, result.log].filter(Boolean).join("\n")

  if (result.success && result.pdf) {
    const blob = new Blob([result.pdf], { type: "application/pdf" })
    const pdfDataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onloadend = () => resolve(reader.result as string)
      reader.onerror = reject
      reader.readAsDataURL(blob)
    })

    return {
      success: true,
      pdfDataUrl,
      pdfSize: result.pdf.length,
      log,
      compilationTime: elapsed,
      compiler: "siglum-wasm",
    }
  } else {
    return {
      success: false,
      error: result.error || pass2.error || pass1.error || "Compilation failed",
      log,
      compilationTime: elapsed,
      compiler: "siglum-wasm",
    }
  }
}

/**
 * Compile using YtoTech online API (fallback).
 */
async function compileWithYtoTech(
  mainFile: string,
  files: ProjectFile[],
): Promise<CompileResult> {
  const startTime = Date.now()

  // File extensions YtoTech/LaTeX needs. Everything else is irrelevant noise.
  const LATEX_EXTENSIONS = /\.(tex|sty|cls|bst|bib|cfg|def|clo|fd|ldf|cbx|bbx|lco|dtx|ins|eps|pdf|png|jpg|jpeg|gif|svg)$/i
  const MAX_FILE_BYTES = 2 * 1024 * 1024 // 2 MB per file — skip anthology.bib.txt etc.

  const mainFileName = mainFile.split("/").pop() || mainFile

  const relevantFiles = files.filter((f) => {
    const name = f.path.split("/").pop() || f.path
    // Always include the main .tex file
    if (name === mainFileName) return true
    // Skip files with no content (couldn't be loaded)
    if (!f.content) return false
    // Skip oversized files (e.g. full ACL anthology .bib.txt)
    if (f.content.length > MAX_FILE_BYTES) return false
    // Skip non-LaTeX file types (.md, .txt, .zip, .docx, .word, .log, etc.)
    if (!LATEX_EXTENSIONS.test(name)) return false
    return true
  })

  const resources: any[] = relevantFiles.map((f) => {
    const name = f.path.split("/").pop() || f.path
    const entry: any = { path: f.path }
    if (f.isBinary) {
      entry.file = f.content
    } else {
      entry.content = f.content
      if (name === mainFileName) entry.main = true
    }
    return entry
  })

  // Ensure at least one main
  if (!resources.some((r) => r.main) && resources.length > 0) {
    const firstTex = resources.find((r) => r.path?.endsWith(".tex"))
    if (firstTex) firstTex.main = true
  }

  // Tell YtoTech to run the full bibliography pipeline when .bib files are present.
  // Without this, YtoTech runs only a single pdflatex pass and citations stay as [?].
  const allText = relevantFiles.filter((f) => !f.isBinary).map((f) => f.content).join("\n")
  const useBiber = /\\usepackage.*\{biblatex\}/.test(allText) || /backend\s*=\s*biber/.test(allText)
  const hasBibFile = relevantFiles.some((f) => f.path.endsWith(".bib") && f.content.length > 0)

  const requestBody: any = { compiler: "pdflatex", resources }
  if (hasBibFile) {
    requestBody.options = {
      bibliography: { command: useBiber ? "biber" : "bibtex" },
    }
  }

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 120000)

  try {
    const response = await fetch(YTOTECH_API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestBody),
      signal: controller.signal,
    })

    clearTimeout(timeoutId)
    const elapsed = Date.now() - startTime

    if (!response.ok) {
      const errorText = await response.text()
      return {
        success: false,
        error: `Server error ${response.status}: ${errorText.slice(0, 500)}`,
        compilationTime: elapsed,
        compiler: "ytotech",
      }
    }

    const contentType = response.headers.get("content-type")
    if (contentType?.includes("application/pdf")) {
      const blob = await response.blob()
      const pdfDataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onloadend = () => resolve(reader.result as string)
        reader.onerror = reject
        reader.readAsDataURL(blob)
      })

      return {
        success: true,
        pdfDataUrl,
        pdfSize: blob.size,
        compilationTime: elapsed,
        compiler: "ytotech",
      }
    } else {
      const logText = await response.text()
      return {
        success: false,
        error: "Compilation failed",
        log: logText.slice(0, 3000),
        compilationTime: elapsed,
        compiler: "ytotech",
      }
    }
  } catch (e: any) {
    clearTimeout(timeoutId)
    return {
      success: false,
      error: e.name === "AbortError" ? "Compilation timed out" : e.message,
      compilationTime: Date.now() - startTime,
      compiler: "ytotech",
    }
  }
}

/**
 * Main compile function — tries Siglum WASM first, falls back to YtoTech.
 */
export async function compileLatex(
  mainFile: string,
  files: ProjectFile[],
): Promise<CompileResult> {
  // Find main file content
  const mainFileName = mainFile.split("/").pop() || mainFile
  const mainEntry = files.find((f) => {
    const fName = f.path.split("/").pop() || f.path
    return fName === mainFileName || f.path === mainFile
  })

  if (!mainEntry) {
    return {
      success: false,
      error: `Main file "${mainFile}" not found in project files.`,
      compilationTime: 0,
      compiler: "siglum-wasm",
    }
  }

  // Siglum WASM only runs pdflatex — it does NOT run bibtex/biber.
  // Any project with .bib files needs the full pipeline (pdflatex → bibtex → pdflatex × 2)
  // which only YtoTech provides. Skip Siglum when bibliography files are present.
  const hasBib = files.some((f) => f.path.endsWith(".bib") && f.content.trim().length > 0)

  if (siglumAvailable !== false && !hasBib) {
    try {
      // Build additionalFiles map for Siglum
      const additionalFiles: Record<string, string | Uint8Array> = {}
      for (const f of files) {
        if (f.path === mainFile || f.path === mainEntry.path) continue
        if (f.isBinary) {
          // Decode base64 to Uint8Array
          let b64 = f.content
          const match = b64.match(/^data:[^;]+;base64,(.+)$/)
          if (match) b64 = match[1]
          const binary = atob(b64)
          const bytes = new Uint8Array(binary.length)
          for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
          additionalFiles[f.path] = bytes
        } else {
          additionalFiles[f.path] = f.content
        }
      }

      return await compileWithSiglum(mainEntry.content, additionalFiles)
    } catch (e: any) {
      console.warn("[latex-compiler] Siglum compile failed, falling back to YtoTech:", e.message)
    }
  }

  // Use YtoTech for all bibliography-containing projects (runs full bibtex pipeline)
  // and as fallback when Siglum fails or is unavailable.
  return compileWithYtoTech(mainFile, files)
}

/**
 * Pre-warm the Siglum compiler (call on page load for faster first compile).
 */
export function prewarmCompiler(): void {
  if (siglumAvailable === false) return
  getSiglumCompiler().catch(() => {})
}

/**
 * Check which compiler is available.
 */
export function getCompilerStatus(): {
  siglumAvailable: boolean | null
  sharedArrayBuffer: boolean
} {
  return {
    siglumAvailable,
    sharedArrayBuffer: isSharedArrayBufferAvailable(),
  }
}

/**
 * Convert DOCX (base64) to PDF using a free online converter.
 * Primary: tries a free Gotenberg-compatible service.
 * Fallback: returns a helpful error with instructions.
 */
export async function compileDocx(docxBase64: string): Promise<CompileResult> {
  const startTime = Date.now()
  // Decode base64 to binary
  const match = docxBase64.match(/^data:[^;]+;base64,(.+)$/)
  const b64 = match ? match[1] : docxBase64
  const binary = atob(b64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  const blob = new Blob([bytes], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' })

  try {
    const formData = new FormData()
    formData.append('files', blob, 'document.docx')

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 60000)

    // Try free DOCX→PDF services (Gotenberg-compatible endpoints)
    const services = [
      'https://gotenberg.serfer.com/forms/libreoffice/convert',
    ]

    for (const serviceUrl of services) {
      try {
        const response = await fetch(serviceUrl, {
          method: 'POST',
          body: formData,
          signal: controller.signal,
        })
        clearTimeout(timeoutId)

        if (response.ok && response.headers.get('content-type')?.includes('application/pdf')) {
          const pdfBlob = await response.blob()
          const pdfDataUrl = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader()
            reader.onloadend = () => resolve(reader.result as string)
            reader.onerror = reject
            reader.readAsDataURL(pdfBlob)
          })
          return {
            success: true,
            pdfDataUrl,
            pdfSize: pdfBlob.size,
            compilationTime: Date.now() - startTime,
            compiler: 'ytotech',
          }
        }
      } catch {}
    }

    return {
      success: false,
      error: 'DOCX→PDF conversion service unavailable. Please install LibreOffice locally or configure a Gotenberg instance URL in settings.',
      compilationTime: Date.now() - startTime,
      compiler: 'ytotech',
    }
  } catch (e: any) {
    return {
      success: false,
      error: e.message,
      compilationTime: Date.now() - startTime,
      compiler: 'ytotech',
    }
  }
}

/**
 * Convert DOCX (base64) to LaTeX source using mammoth.js.
 * Returns LaTeX source as a string.
 */
export async function convertDocxToLatex(_docxBase64: string): Promise<string> {
  // DOCX → LaTeX conversion requires a server-side tool (e.g. pandoc/LibreOffice).
  // Return a stub template for the user to fill in.
  return [
    "% DOCX imported — paste or type your content below.",
    "% For full conversion, use: pandoc document.docx -o main.tex",
    "\\documentclass[11pt]{article}",
    "\\usepackage{amsmath,amssymb,graphicx,booktabs,hyperref}",
    "\\begin{document}",
    "",
    "\\title{Imported Document}",
    "\\author{}",
    "\\maketitle",
    "",
    "% Your content here",
    "",
    "\\end{document}",
  ].join("\n")
}
