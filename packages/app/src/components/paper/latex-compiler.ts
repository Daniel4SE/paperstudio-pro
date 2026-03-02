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
const DEFAULT_BACKEND_BASE_URL = "http://127.0.0.1:4096"

export interface CompileResult {
  success: boolean
  pdfDataUrl?: string
  pdfSize?: number
  error?: string
  log?: string
  compilationTime: number
  compiler: "siglum-wasm" | "ytotech" | "tectonic"
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
 * Extract the first meaningful LaTeX error from a compilation log.
 * Looks for lines starting with "! " which is LaTeX's error marker.
 */
function extractLatexError(log: string): string {
  if (!log) return ""
  const lines = log.split("\n")
  const errorLines: string[] = []
  let collecting = false
  for (const line of lines) {
    if (line.startsWith("! ")) {
      collecting = true
      errorLines.push(line)
    } else if (collecting) {
      if (line.trim() === "" || errorLines.length >= 6) break
      errorLines.push(line)
    }
  }
  if (errorLines.length > 0) return errorLines.join("\n")
  // No LaTeX "! " errors — return first meaningful non-empty line as the error
  const firstMeaningful = lines.find((l) => l.trim().length > 0)
  return firstMeaningful || ""
}

/**
 * Compile via the local backend server (Tectonic) using compile-dir:
 * backend reads files directly from disk — no file upload, fastest path.
 * Falls back to compile (file upload) if directory isn't provided.
 */
async function compileWithBackend(
  mainFile: string,
  files: ProjectFile[],
  projectDirectory?: string,
  backendBaseUrl = DEFAULT_BACKEND_BASE_URL,
): Promise<CompileResult> {
  const startTime = Date.now()
  const backendCompileUrl = `${backendBaseUrl.replace(/\/+$/, "")}/latex/compile`

  // Prefer compile-dir: backend reads from disk directly, no large payload
  if (projectDirectory) {
    const response = await fetch(`${backendCompileUrl}-dir`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ directory: projectDirectory, mainFile }),
    })
    const data = await response.json() as any
    if (data.success) {
      return {
        success: true,
        pdfDataUrl: data.pdfData,
        pdfSize: data.pdfSize,
        log: data.log,
        compilationTime: data.compilationTime ?? Date.now() - startTime,
        compiler: "tectonic",
      }
    }
    // compile-dir failed — if no LaTeX "!" errors, the file likely wasn't on disk yet.
    // Fall through to upload path which sends file content directly.
    const latexErrFromDir = data.log ? extractLatexError(data.log) : ""
    const isLatexError = latexErrFromDir.startsWith("!")
    if (isLatexError) {
      // Real LaTeX syntax error — no point retrying with upload
      return {
        success: false,
        error: latexErrFromDir,
        log: data.log,
        compilationTime: data.compilationTime ?? Date.now() - startTime,
        compiler: "tectonic",
      }
    }
    // Non-LaTeX failure (file not found, etc.) — fall through to upload
  }

  // Upload path: send file content directly (works even if file not yet on disk)
  const response = await fetch(backendCompileUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ mainFile, files }),
  })
  const data = await response.json() as any
  const latexErr2 = !data.success && data.log ? extractLatexError(data.log) : ""
  return {
    success: data.success ?? false,
    pdfDataUrl: data.pdfData,
    pdfSize: data.pdfSize,
    error: latexErr2 ? latexErr2 : data.error,
    log: data.log,
    compilationTime: data.compilationTime ?? Date.now() - startTime,
    compiler: "tectonic",
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
      // YtoTech expects raw base64 — strip any data: prefix
      let b64 = f.content
      const match = b64.match(/^data:[^;]+;base64,(.+)$/)
      if (match) b64 = match[1]
      entry.file = b64
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
 * Main compile function.
 * Priority: Tectonic (local backend) → Siglum WASM → YtoTech (online)
 *
 * @param projectDirectory  Absolute path to project dir on server (enables fast compile-dir path)
 */
export async function compileLatex(
  mainFile: string,
  files: ProjectFile[],
  projectDirectory?: string,
  backendBaseUrl = DEFAULT_BACKEND_BASE_URL,
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

  // 1. Try local backend (Tectonic) — best quality, offline, full project support.
  // If backend responds, always trust and return that result (even failures), so
  // real LaTeX errors/warnings are never hidden by online fallback compilers.
  try {
    const backendResult = await compileWithBackend(mainFile, files, projectDirectory, backendBaseUrl)
    return backendResult
  } catch (e: any) {
    console.warn("[latex-compiler] Backend (Tectonic) unavailable, trying Siglum WASM:", e.message)
  }

  // 2. Siglum WASM — no bibtex support, skip if .bib present
  const hasBib = files.some((f) => f.path.endsWith(".bib") && f.content.trim().length > 0)

  if (siglumAvailable !== false && !hasBib) {
    try {
      const additionalFiles: Record<string, string | Uint8Array> = {}
      for (const f of files) {
        if (f.path === mainFile || f.path === mainEntry.path) continue
        if (f.isBinary) {
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
      console.warn("[latex-compiler] Siglum failed, falling back to YtoTech:", e.message)
    }
  }

  // 3. YtoTech online API — fallback when local compiler unavailable
  const ytoResult = await compileWithYtoTech(mainFile, files)
  if (ytoResult.success || ytoResult.pdfDataUrl) {
    return ytoResult
  }
  return ytoResult
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
