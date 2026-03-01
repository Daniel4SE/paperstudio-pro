import { createSignal, createEffect, on, onCleanup, Show, For, batch, untrack, type JSX } from "solid-js"
import * as pdfjsLib from "pdfjs-dist"
import type { PDFDocumentProxy, RenderTask } from "pdfjs-dist"
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url"
import { CompilationLogPanel } from "./compilation-log-panel"

// Use locally bundled worker (avoids CDN dependency and version mismatch)
pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl

export interface PdfPreviewProps {
  /** Base64 data URL of the compiled PDF, e.g. "data:application/pdf;base64,..." */
  pdfData?: string
  /** Whether compilation is in progress */
  compiling?: boolean
  /** Compilation error message */
  error?: string
  /** Compilation time in ms */
  compilationTime?: number
  /** Callback when user clicks compile */
  onCompile?: () => void
  /** Controlled scale (0.25-3). If provided, onScaleChange must be supplied. */
  scale?: () => number
  onScaleChange?: (s: number) => void
  class?: string
  /** Raw LaTeX compilation log text */
  log?: string
  /** Callback to open the compilation logs panel */
  onShowLogs?: () => void
  /** Number of errors in the compilation log */
  logErrorCount?: number
  /** Number of warnings in the compilation log */
  logWarningCount?: number
  /** Custom label for the compile button (e.g. "Convert to PDF" for DOCX) */
  compileLabel?: string
}

export function PdfPreview(props: PdfPreviewProps) {
  const [internalScale, setInternalScale] = createSignal(1)

  const scale = () => (props.scale ? props.scale() : internalScale())
  const setScale = (updater: number | ((s: number) => number)) => {
    const next = typeof updater === "function" ? updater(scale()) : updater
    if (props.onScaleChange) props.onScaleChange(next)
    else setInternalScale(next)
  }

  // Log panel visibility
  const [showLogs, setShowLogs] = createSignal(false)

  // PDF.js document and page navigation state
  const [pdfDoc, setPdfDoc] = createSignal<PDFDocumentProxy | null>(null)
  const [totalPages, setTotalPages] = createSignal(0)
  const [currentPage, setCurrentPage] = createSignal(1)
  const [pageInput, setPageInput] = createSignal("1")

  // Scroll container ref for IntersectionObserver root
  let scrollContainerRef: HTMLDivElement | undefined
  const pageRefs: (HTMLDivElement | undefined)[] = []

  // Load PDF document when pdfData changes
  createEffect(
    on(
      () => props.pdfData,
      async (data) => {
        const prev = untrack(pdfDoc)
        if (prev) { try { prev.destroy() } catch {} }

        if (!data) {
          batch(() => { setPdfDoc(null); setTotalPages(0); setCurrentPage(1); setPageInput("1") })
          return
        }

        try {
          const base64 = data.split(",")[1] ?? ""
          const binaryStr = atob(base64)
          const bytes = new Uint8Array(binaryStr.length)
          for (let i = 0; i < binaryStr.length; i++) bytes[i] = binaryStr.charCodeAt(i)
          const doc = await pdfjsLib.getDocument({ data: bytes }).promise
          batch(() => { setPdfDoc(doc); setTotalPages(doc.numPages); setCurrentPage(1); setPageInput("1") })
        } catch (e) {
          console.error("PDF load error:", e)
          batch(() => { setPdfDoc(null); setTotalPages(0); setCurrentPage(1); setPageInput("1") })
        }
      },
      { defer: false },
    ),
  )

  // IntersectionObserver: track current page as user scrolls
  let intersectionObserver: IntersectionObserver | undefined
  createEffect(() => {
    const total = totalPages()
    intersectionObserver?.disconnect()
    if (!total || !scrollContainerRef) return

    intersectionObserver = new IntersectionObserver(
      (entries) => {
        let topPage = 0
        let topY = Infinity
        for (const entry of entries) {
          if (entry.isIntersecting) {
            const n = parseInt((entry.target as HTMLElement).dataset.page ?? "0", 10)
            const y = entry.boundingClientRect.top
            if (y < topY) { topY = y; topPage = n }
          }
        }
        if (topPage > 0) { setCurrentPage(topPage); setPageInput(String(topPage)) }
      },
      { root: scrollContainerRef, threshold: 0.1 },
    )
    for (let i = 0; i < total; i++) {
      const el = pageRefs[i]
      if (el) { el.dataset.page = String(i + 1); intersectionObserver.observe(el) }
    }
  })

  // Cleanup on unmount
  onCleanup(() => {
    intersectionObserver?.disconnect()
    const doc = pdfDoc()
    if (doc) { try { doc.destroy() } catch {} }
  })

  // Scroll to a page (used by nav buttons and page input)
  const goToPage = (p: number) => {
    const clamped = Math.max(1, Math.min(totalPages(), p))
    setCurrentPage(clamped)
    setPageInput(String(clamped))
    pageRefs[clamped - 1]?.scrollIntoView({ behavior: "smooth", block: "start" })
  }

  const goToPrev = () => { if (currentPage() > 1) goToPage(currentPage() - 1) }
  const goToNext = () => { if (currentPage() < totalPages()) goToPage(currentPage() + 1) }

  const commitPageInput = () => {
    const parsed = parseInt(pageInput(), 10)
    if (isNaN(parsed)) { setPageInput(String(currentPage())); return }
    goToPage(parsed)
  }

  const handlePageInputKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Enter") { commitPageInput(); (e.target as HTMLInputElement).blur() }
  }

  // Log badge logic
  const logBadgeInfo = (): { count: number; color: string } | null => {
    const errors = props.logErrorCount ?? 0
    const warnings = props.logWarningCount ?? 0
    if (errors > 0) return { count: errors, color: "bg-[#ef4444]" }
    if (warnings > 0) return { count: warnings, color: "bg-[#f59e0b]" }
    return null
  }

  const toolbar = (): JSX.Element => (
    <div class="flex items-center h-10 px-3 border-b border-border-weak-base bg-background-stronger shrink-0 gap-2">
      {/* 1. Compile button */}
      <button
        class="flex items-center gap-1.5 text-12-medium transition-colors shrink-0"
        classList={{
          "text-text-base hover:text-text-strong": !props.compiling,
          "text-text-weak cursor-wait": !!props.compiling,
        }}
        disabled={props.compiling}
        onClick={() => props.onCompile?.()}
        title="Recompile PDF"
      >
        <Show when={props.compiling} fallback={<RefreshIcon />}>
          <SpinnerIcon />
        </Show>
        {props.compileLabel || "Compile"}
      </button>

      {/* 2. Separator */}
      <div class="w-px h-4 bg-border-weak-base shrink-0" />

      {/* 3. Compilation time */}
      <Show when={props.compilationTime}>
        <span class="text-11-regular text-text-weak shrink-0">
          {((props.compilationTime ?? 0) / 1000).toFixed(1)}s
        </span>
      </Show>

      {/* 4. Separator */}
      <Show when={props.compilationTime}>
        <div class="w-px h-4 bg-border-weak-base shrink-0" />
      </Show>

      {/* 5. Log badge button */}
      <button
        class="relative flex items-center justify-center w-7 h-7 text-text-weak hover:text-text-base hover:bg-surface-base rounded transition-colors shrink-0"
        onClick={() => setShowLogs((v) => !v)}
        title="View compilation logs"
      >
        <LogIcon />
        <Show when={logBadgeInfo()}>
          {(badge) => (
            <span
              class={`absolute -top-0.5 -right-0.5 min-w-[14px] h-[14px] px-0.5 flex items-center justify-center rounded-full text-[9px] font-bold text-white ${badge().color}`}
            >
              {badge().count}
            </span>
          )}
        </Show>
      </button>

      {/* 6. Separator */}
      <div class="w-px h-4 bg-border-weak-base shrink-0" />

      {/* 7. Page navigation (only when pages exist) */}
      <Show when={totalPages() > 0}>
        <div class="flex items-center gap-1 shrink-0">
          {/* Prev page */}
          <button
            class="w-6 h-6 flex items-center justify-center text-text-base rounded transition-colors"
            classList={{
              "hover:bg-surface-base": currentPage() > 1,
              "text-text-weak cursor-not-allowed": currentPage() <= 1,
            }}
            disabled={currentPage() <= 1}
            onClick={goToPrev}
            title="Previous page"
          >
            <ChevronUpIcon />
          </button>

          {/* Next page */}
          <button
            class="w-6 h-6 flex items-center justify-center text-text-base rounded transition-colors"
            classList={{
              "hover:bg-surface-base": currentPage() < totalPages(),
              "text-text-weak cursor-not-allowed": currentPage() >= totalPages(),
            }}
            disabled={currentPage() >= totalPages()}
            onClick={goToNext}
            title="Next page"
          >
            <ChevronDownIcon />
          </button>

          {/* Page input */}
          <input
            type="text"
            value={pageInput()}
            onInput={(e) => setPageInput(e.currentTarget.value)}
            onBlur={commitPageInput}
            onKeyDown={handlePageInputKeyDown}
            class="w-[2.5rem] h-6 px-1 text-center text-11-regular text-text-strong bg-transparent border border-border-base rounded outline-none focus:border-accent-base transition-colors"
            title="Go to page"
          />

          <span class="text-11-regular text-text-weak">/</span>
          <span class="text-11-regular text-text-weak">{totalPages()}</span>
        </div>

        {/* 8. Separator */}
        <div class="w-px h-4 bg-border-weak-base shrink-0" />
      </Show>

      {/* Spacer */}
      <div class="flex-1" />

      {/* 9-11. Zoom controls */}
      <div class="flex items-center gap-0.5 shrink-0">
        <button
          class="w-6 h-6 flex items-center justify-center text-12-regular text-text-base hover:bg-surface-base rounded transition-colors"
          onClick={() => setScale((s) => Math.max(0.25, +(s - 0.25).toFixed(2)))}
          title="Zoom out"
        >
          -
        </button>
        <span class="text-11-regular text-text-weak min-w-[3rem] text-center">
          {Math.round(scale() * 100)}%
        </span>
        <button
          class="w-6 h-6 flex items-center justify-center text-12-regular text-text-base hover:bg-surface-base rounded transition-colors"
          onClick={() => setScale((s) => Math.min(3, +(s + 0.25).toFixed(2)))}
          title="Zoom in"
        >
          +
        </button>
      </div>

      {/* 12. Separator */}
      <div class="w-px h-4 bg-border-weak-base shrink-0" />

      {/* 13. Download */}
      <Show when={props.pdfData}>
        <a
          href={props.pdfData}
          download="compiled.pdf"
          class="w-7 h-7 flex items-center justify-center text-text-weak hover:text-text-base hover:bg-surface-base rounded transition-colors shrink-0"
          title="Download PDF"
        >
          <DownloadIcon />
        </a>
      </Show>
    </div>
  )

  return (
    <div class={`flex flex-col h-full overflow-hidden ${props.class ?? ""}`}>
      {toolbar()}
      <div ref={(el) => (scrollContainerRef = el)} class="flex-1 min-h-0 overflow-auto bg-[#525659] relative">
        <Show
          when={props.pdfData && pdfDoc()}
          fallback={
            <div class="h-full flex flex-col items-center justify-center gap-4 text-center p-8">
              <Show when={props.error}>
                <div class="max-w-md">
                  <div class="text-14-medium text-text-strong mb-2">Compilation Error</div>
                  <pre class="text-12-regular text-text-weak whitespace-pre-wrap text-left bg-surface-base rounded-lg p-4 max-h-64 overflow-auto">
                    {props.error}
                  </pre>
                </div>
              </Show>
              <Show when={!props.error && !props.compiling}>
                <div class="flex flex-col items-center gap-3">
                  <DocumentIcon />
                  <div class="text-14-regular text-text-weak max-w-56">
                    Click <strong>Compile</strong> to generate PDF preview
                  </div>
                </div>
              </Show>
              <Show when={!props.error && props.compiling}>
                <div class="flex flex-col items-center gap-3">
                  <SpinnerIcon />
                  <div class="text-14-regular text-text-weak">Compiling...</div>
                </div>
              </Show>
            </div>
          }
        >
          {/* All pages stacked vertically — continuous scroll */}
          <div class="flex flex-col items-center gap-4 py-4">
            <For each={Array.from({ length: totalPages() }, (_, i) => i)}>
              {(i) => {
                let canvas: HTMLCanvasElement | undefined
                let renderTask: RenderTask | null = null

                // Each page manages its own render — fires after canvas mounts
                createEffect(on([pdfDoc, scale] as const, async ([doc, s]) => {
                  if (renderTask) { try { renderTask.cancel() } catch {} renderTask = null }
                  if (!doc || !canvas) return
                  try {
                    const pdfPage = await doc.getPage(i + 1)
                    const dpr = window.devicePixelRatio || 1
                    const viewport = pdfPage.getViewport({ scale: s * dpr })
                    canvas.width = viewport.width
                    canvas.height = viewport.height
                    canvas.style.width = `${viewport.width / dpr}px`
                    canvas.style.height = `${viewport.height / dpr}px`
                    renderTask = pdfPage.render({ canvas, viewport })
                    await renderTask.promise
                    renderTask = null
                  } catch (e: any) {
                    if (e?.name !== "RenderingCancelledException") console.error("PDF render error:", e)
                  }
                }))

                onCleanup(() => { try { renderTask?.cancel() } catch {} })

                return (
                  <div ref={(el) => (pageRefs[i] = el)}>
                    <canvas ref={(el) => { canvas = el }} class="shadow-lg" />
                  </div>
                )
              }}
            </For>
          </div>
        </Show>

        {/* Compilation log overlay — positioned below toolbar, over canvas area only */}
        <Show when={showLogs()}>
          <div class="absolute inset-0 z-20">
            <CompilationLogPanel log={props.log} onClose={() => setShowLogs(false)} />
          </div>
        </Show>
      </div>
    </div>
  )
}

// ── Icons ────────────────────────────────────────────────────────────────────

function RefreshIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M13.5 8A5.5 5.5 0 1 1 8 2.5c1.8 0 3.4.87 4.4 2.2L14 3v4h-4l1.6-1.6A4 4 0 1 0 12 8"
        stroke="currentColor"
        stroke-width="1.4"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
    </svg>
  )
}

function SpinnerIcon() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 16 16"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      class="animate-spin"
    >
      <circle cx="8" cy="8" r="6" stroke="currentColor" stroke-width="2" stroke-dasharray="28" stroke-dashoffset="8" />
    </svg>
  )
}

function ChevronUpIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M4 10l4-4 4 4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
    </svg>
  )
}

function ChevronDownIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M4 6l4 4 4-4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
    </svg>
  )
}

function LogIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="2" y="2" width="12" height="12" rx="2" stroke="currentColor" stroke-width="1.3" />
      <path d="M5 5.5h6M5 8h6M5 10.5h4" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" />
    </svg>
  )
}

function DownloadIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M8 2v8M5 7l3 3 3-3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
      <path d="M3 12h10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
    </svg>
  )
}

function DocumentIcon() {
  return (
    <svg
      width="48"
      height="48"
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      class="opacity-20"
    >
      <rect x="10" y="6" width="28" height="36" rx="3" stroke="currentColor" stroke-width="2" />
      <line x1="16" y1="16" x2="32" y2="16" stroke="currentColor" stroke-width="2" />
      <line x1="16" y1="22" x2="32" y2="22" stroke="currentColor" stroke-width="2" />
      <line x1="16" y1="28" x2="26" y2="28" stroke="currentColor" stroke-width="2" />
    </svg>
  )
}
