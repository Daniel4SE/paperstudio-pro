/**
 * ImagePreviewPanel — Preview + inline edit UI for image files in PaperStudio.
 *
 * Features:
 * - Full image preview with zoom controls
 * - Region selection (click-drag to select area for targeted edits)
 * - Edit instruction input + send button
 * - History of edits
 */
import { createSignal, Show, onMount, onCleanup } from "solid-js"

export interface ImagePreviewPanelProps {
  filePath: string
  imageData: string // base64 data URL or empty
  onEditRequest?: (instruction: string, region?: { x: number; y: number; w: number; h: number }) => void
}

export function ImagePreviewPanel(props: ImagePreviewPanelProps) {
  const [editText, setEditText] = createSignal("")
  const [selecting, setSelecting] = createSignal(false)
  const [selectionStart, setSelectionStart] = createSignal<{ x: number; y: number } | null>(null)
  const [selection, setSelection] = createSignal<{ x: number; y: number; w: number; h: number } | null>(null)
  const [zoom, setZoom] = createSignal(1)
  const [imageLoaded, setImageLoaded] = createSignal(false)

  let containerRef: HTMLDivElement | undefined
  let canvasRef: HTMLCanvasElement | undefined
  let imageRef: HTMLImageElement | undefined

  const hasImage = () => !!props.imageData

  // Draw selection overlay on canvas
  const drawSelection = () => {
    if (!canvasRef || !imageRef) return
    const ctx = canvasRef.getContext("2d")
    if (!ctx) return

    const rect = imageRef.getBoundingClientRect()
    canvasRef.width = rect.width
    canvasRef.height = rect.height
    ctx.clearRect(0, 0, canvasRef.width, canvasRef.height)

    const sel = selection()
    if (sel) {
      // Semi-transparent overlay outside selection
      ctx.fillStyle = "rgba(0, 0, 0, 0.35)"
      ctx.fillRect(0, 0, canvasRef.width, canvasRef.height)

      // Clear the selection area
      ctx.clearRect(sel.x, sel.y, sel.w, sel.h)

      // Selection border
      ctx.strokeStyle = "#3b82f6"
      ctx.lineWidth = 2
      ctx.setLineDash([6, 3])
      ctx.strokeRect(sel.x, sel.y, sel.w, sel.h)

      // Corner handles
      ctx.setLineDash([])
      ctx.fillStyle = "#3b82f6"
      const handleSize = 6
      const corners = [
        [sel.x, sel.y],
        [sel.x + sel.w, sel.y],
        [sel.x, sel.y + sel.h],
        [sel.x + sel.w, sel.y + sel.h],
      ]
      for (const [cx, cy] of corners) {
        ctx.fillRect(cx - handleSize / 2, cy - handleSize / 2, handleSize, handleSize)
      }
    }
  }

  const handleMouseDown = (e: MouseEvent) => {
    if (!canvasRef) return
    const rect = canvasRef.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    setSelecting(true)
    setSelectionStart({ x, y })
    setSelection(null)
  }

  const handleMouseMove = (e: MouseEvent) => {
    if (!selecting() || !canvasRef) return
    const start = selectionStart()
    if (!start) return
    const rect = canvasRef.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    const sel = {
      x: Math.min(start.x, x),
      y: Math.min(start.y, y),
      w: Math.abs(x - start.x),
      h: Math.abs(y - start.y),
    }
    setSelection(sel)
    drawSelection()
  }

  const handleMouseUp = () => {
    setSelecting(false)
    const sel = selection()
    if (sel && sel.w < 5 && sel.h < 5) {
      // Too small, clear selection
      setSelection(null)
      drawSelection()
    }
  }

  const clearSelection = () => {
    setSelection(null)
    if (canvasRef) {
      const ctx = canvasRef.getContext("2d")
      if (ctx) ctx.clearRect(0, 0, canvasRef.width, canvasRef.height)
    }
  }

  const handleSendEdit = () => {
    const text = editText().trim()
    if (!text) return
    props.onEditRequest?.(text, selection() ?? undefined)
    setEditText("")
    clearSelection()
  }

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSendEdit()
    }
    if (e.key === "Escape") {
      clearSelection()
    }
  }

  return (
    <div class="flex flex-col h-full overflow-hidden bg-background-base" ref={containerRef}>
      {/* Image preview area */}
      <div class="flex-1 min-h-0 overflow-auto relative flex items-center justify-center p-4 bg-[#1a1a1a]">
        <Show
          when={hasImage()}
          fallback={
            <div class="flex flex-col items-center justify-center text-text-weak gap-2">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <circle cx="8.5" cy="8.5" r="1.5" />
                <path d="M21 15l-5-5L5 21" />
              </svg>
              <span class="text-12-regular">No preview available</span>
              <span class="text-11-regular text-text-weak">Drag an image from chat or generate one with @image</span>
            </div>
          }
        >
          <div class="relative inline-block" style={{ transform: `scale(${zoom()})`, "transform-origin": "center" }}>
            <img
              ref={imageRef}
              src={props.imageData}
              alt={props.filePath}
              class="max-w-full max-h-full object-contain rounded"
              style={{ display: "block" }}
              onLoad={() => {
                setImageLoaded(true)
                drawSelection()
              }}
            />
            {/* Selection overlay canvas */}
            <Show when={imageLoaded()}>
              <canvas
                ref={canvasRef}
                class="absolute top-0 left-0 w-full h-full"
                style={{ cursor: selecting() ? "crosshair" : "crosshair" }}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
              />
            </Show>
          </div>
        </Show>
      </div>

      {/* Selection indicator */}
      <Show when={selection()}>
        <div class="flex items-center gap-2 px-3 py-1.5 bg-blue-500/10 border-t border-blue-500/20 text-11-medium text-blue-400">
          <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5">
            <rect x="2" y="2" width="12" height="12" rx="1" stroke-dasharray="3 2" />
          </svg>
          Region selected — describe your edit below
          <button
            class="ml-auto text-blue-300 hover:text-blue-100 text-11-regular underline"
            onClick={clearSelection}
          >
            Clear
          </button>
        </div>
      </Show>

      {/* Zoom controls + status bar */}
      <Show when={hasImage()}>
        <div class="flex items-center gap-2 px-3 py-1.5 border-t border-border-weak-base bg-background-stronger text-11-regular text-text-weak">
          <button class="hover:text-text-base" onClick={() => setZoom(Math.max(0.25, zoom() - 0.25))}>-</button>
          <span>{Math.round(zoom() * 100)}%</span>
          <button class="hover:text-text-base" onClick={() => setZoom(Math.min(4, zoom() + 0.25))}>+</button>
          <button class="hover:text-text-base ml-1" onClick={() => setZoom(1)}>Reset</button>
          <div class="flex-1" />
          <span class="text-text-weak">{props.filePath}</span>
        </div>
      </Show>

      {/* Edit input */}
      <div class="shrink-0 border-t border-border-weak-base bg-background-base p-2">
        <div class="flex gap-2 items-end">
          <div class="flex-1 relative">
            <input
              type="text"
              class="w-full px-3 py-2 text-12-regular bg-surface-base border border-border-weak-base rounded-lg text-text-base placeholder:text-text-weak focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30"
              placeholder={selection() ? "Describe how to edit the selected region..." : "Describe how to edit this image..."}
              value={editText()}
              onInput={(e) => setEditText(e.currentTarget.value)}
              onKeyDown={handleKeyDown}
            />
          </div>
          <button
            class="shrink-0 px-3 py-2 rounded-lg text-12-medium bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            onClick={handleSendEdit}
            disabled={!editText().trim()}
          >
            Edit
          </button>
        </div>
        <div class="mt-1.5 text-10-regular text-text-weak">
          Click and drag on the image to select a region for targeted edits. Press Esc to clear selection.
        </div>
      </div>
    </div>
  )
}
