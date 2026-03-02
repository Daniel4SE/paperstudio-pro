/**
 * ImagePreviewPanel — Preview + inline edit UI for image files in PaperStudio.
 *
 * Features:
 * - Full image preview with zoom controls
 * - Multi-shape annotations (rect, ellipse, arrow, point)
 * - Inline annotation direction dialog near active mark
 * - Collaborative-edit toggle
 * - Default image model selection for @image edit requests
 */
import { useDialog } from "@opencode-ai/ui/context/dialog"
import { Switch } from "@opencode-ai/ui/switch"
import { showToast } from "@opencode-ai/ui/toast"
import { For, Show, createEffect, createMemo, createSignal, onCleanup, onMount } from "solid-js"
import { DialogSettings } from "@/components/dialog-settings"
import { useProviders } from "@/hooks/use-providers"

export type AnnotationShape = "rect" | "ellipse" | "arrow" | "point"

export interface ImageEditRegion {
  x: number
  y: number
  w: number
  h: number
  xPct?: number
  yPct?: number
  wPct?: number
  hPct?: number
  imageWidth?: number
  imageHeight?: number
}

export interface ImageAnnotation {
  id: string
  shape: AnnotationShape
  region: ImageEditRegion
  instruction: string
}

export interface ImageEditRequest {
  instruction: string
  region?: ImageEditRegion
  annotations: ImageAnnotation[]
  collaborative: boolean
  model: string
}

type AnnotationDraft = {
  id: string
  shape: AnnotationShape
  x1: number
  y1: number
  x2: number
  y2: number
  instruction: string
}

const IMAGE_MODEL_STORAGE_KEY = "paperstudio.image.default-model"
const DEFAULT_IMAGE_MODEL = "gemini-3.1-flash-image-preview"
const IMAGE_MODELS = [
  "gemini-3.1-flash-image-preview",
  "gemini-3-pro-image-preview",
  "gemini-2.5-flash-image",
  "imagen-4.0-generate-001",
  "imagen-4.0-ultra-generate-001",
  "imagen-4.0-fast-generate-001",
] as const

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value))
}

function boundsFromDraft(annotation: AnnotationDraft): ImageEditRegion {
  if (annotation.shape === "point") {
    const size = 24
    return {
      x: annotation.x1 - size / 2,
      y: annotation.y1 - size / 2,
      w: size,
      h: size,
    }
  }
  return {
    x: Math.min(annotation.x1, annotation.x2),
    y: Math.min(annotation.y1, annotation.y2),
    w: Math.max(1, Math.abs(annotation.x2 - annotation.x1)),
    h: Math.max(1, Math.abs(annotation.y2 - annotation.y1)),
  }
}

function distanceToSegment(
  point: { x: number; y: number },
  start: { x: number; y: number },
  end: { x: number; y: number },
) {
  const l2 = (end.x - start.x) ** 2 + (end.y - start.y) ** 2
  if (l2 === 0) return Math.hypot(point.x - start.x, point.y - start.y)
  const t = clamp(
    ((point.x - start.x) * (end.x - start.x) + (point.y - start.y) * (end.y - start.y)) / l2,
    0,
    1,
  )
  const projX = start.x + t * (end.x - start.x)
  const projY = start.y + t * (end.y - start.y)
  return Math.hypot(point.x - projX, point.y - projY)
}

function hitTestAnnotation(annotation: AnnotationDraft, x: number, y: number) {
  if (annotation.shape === "point") {
    return Math.hypot(x - annotation.x1, y - annotation.y1) <= 10
  }
  if (annotation.shape === "arrow") {
    return (
      distanceToSegment(
        { x, y },
        { x: annotation.x1, y: annotation.y1 },
        { x: annotation.x2, y: annotation.y2 },
      ) <= 10
    )
  }
  const bounds = boundsFromDraft(annotation)
  if (annotation.shape === "ellipse") {
    const rx = bounds.w / 2
    const ry = bounds.h / 2
    if (rx <= 0 || ry <= 0) return false
    const dx = (x - (bounds.x + rx)) / rx
    const dy = (y - (bounds.y + ry)) / ry
    return dx * dx + dy * dy <= 1.08
  }
  return (
    x >= bounds.x - 6 &&
    x <= bounds.x + bounds.w + 6 &&
    y >= bounds.y - 6 &&
    y <= bounds.y + bounds.h + 6
  )
}

let annotationCounter = 0
const nextAnnotationID = () => `annotation-${Date.now()}-${annotationCounter++}`

export interface ImagePreviewPanelProps {
  filePath: string
  imageData: string // base64 data URL or empty
  onEditRequest?: (request: ImageEditRequest) => void
}

export function ImagePreviewPanel(props: ImagePreviewPanelProps) {
  const dialog = useDialog()
  const providers = useProviders()
  let canvasRef: HTMLCanvasElement | undefined
  let imageRef: HTMLImageElement | undefined

  const [editText, setEditText] = createSignal("")
  const [annotations, setAnnotations] = createSignal<AnnotationDraft[]>([])
  const [drawingAnnotationID, setDrawingAnnotationID] = createSignal<string | null>(null)
  const [activeAnnotationID, setActiveAnnotationID] = createSignal<string | null>(null)
  const [activeShape, setActiveShape] = createSignal<AnnotationShape>("rect")
  const [collaborativeEdit, setCollaborativeEdit] = createSignal(true)
  const [selectedModel, setSelectedModel] = createSignal<string>(DEFAULT_IMAGE_MODEL)
  const [zoom, setZoom] = createSignal(1)
  const [imageLoaded, setImageLoaded] = createSignal(false)

  const hasImage = () => !!props.imageData
  const hasAnnotations = createMemo(() => annotations().length > 0)
  const googleConnected = createMemo(() => providers.connected().some((provider) => provider.id === "google"))
  const canSubmit = createMemo(() => {
    if (!googleConnected()) return false
    return hasAnnotations() || editText().trim().length > 0
  })

  const activeAnnotation = createMemo(() => {
    const id = activeAnnotationID()
    if (!id) return null
    return annotations().find((annotation) => annotation.id === id) ?? null
  })
  const activeAnnotationBounds = createMemo(() => {
    const annotation = activeAnnotation()
    if (!annotation) return null
    return boundsFromDraft(annotation)
  })
  const activeDialogStyle = createMemo(() => {
    const bounds = activeAnnotationBounds()
    const image = imageRef
    if (!bounds || !image) return {}
    const width = image.getBoundingClientRect().width
    const height = image.getBoundingClientRect().height
    const dialogWidth = 260
    const dialogHeight = 104
    const left = clamp(bounds.x + bounds.w + 10, 8, Math.max(8, width - dialogWidth))
    const top = clamp(bounds.y - 4, 8, Math.max(8, height - dialogHeight))
    return {
      left: `${left}px`,
      top: `${top}px`,
    }
  })

  const loadSelectedModel = () => {
    if (typeof window === "undefined") return DEFAULT_IMAGE_MODEL
    const stored = localStorage.getItem(IMAGE_MODEL_STORAGE_KEY)
    if (stored && IMAGE_MODELS.includes(stored as (typeof IMAGE_MODELS)[number])) {
      return stored
    }
    return DEFAULT_IMAGE_MODEL
  }

  const saveSelectedModel = (value: string) => {
    if (typeof window === "undefined") return
    localStorage.setItem(IMAGE_MODEL_STORAGE_KEY, value)
  }

  const updateAnnotation = (id: string, patch: Partial<AnnotationDraft>) => {
    setAnnotations((prev) =>
      prev.map((annotation) => (annotation.id === id ? { ...annotation, ...patch } : annotation)),
    )
  }

  const clearAnnotations = () => {
    setAnnotations([])
    setActiveAnnotationID(null)
    setDrawingAnnotationID(null)
  }

  const removeActiveAnnotation = () => {
    const id = activeAnnotationID()
    if (!id) return
    setAnnotations((prev) => prev.filter((annotation) => annotation.id !== id))
    setActiveAnnotationID(null)
  }

  const drawAnnotations = () => {
    if (!canvasRef || !imageRef) return
    const ctx = canvasRef.getContext("2d")
    if (!ctx) return

    const rect = imageRef.getBoundingClientRect()
    canvasRef.width = rect.width
    canvasRef.height = rect.height
    ctx.clearRect(0, 0, canvasRef.width, canvasRef.height)

    const activeID = activeAnnotationID()
    for (const annotation of annotations()) {
      const isActive = annotation.id === activeID
      const color = isActive ? "#3b82f6" : "#f59e0b"
      const bounds = boundsFromDraft(annotation)
      ctx.lineWidth = isActive ? 2.4 : 1.7
      ctx.strokeStyle = color
      ctx.fillStyle = `${color}22`
      ctx.setLineDash(isActive ? [7, 3] : [5, 4])

      if (annotation.shape === "rect") {
        ctx.strokeRect(bounds.x, bounds.y, bounds.w, bounds.h)
      } else if (annotation.shape === "ellipse") {
        ctx.beginPath()
        ctx.ellipse(
          bounds.x + bounds.w / 2,
          bounds.y + bounds.h / 2,
          Math.max(1, bounds.w / 2),
          Math.max(1, bounds.h / 2),
          0,
          0,
          Math.PI * 2,
        )
        ctx.stroke()
      } else if (annotation.shape === "arrow") {
        const startX = annotation.x1
        const startY = annotation.y1
        const endX = annotation.x2
        const endY = annotation.y2
        const angle = Math.atan2(endY - startY, endX - startX)
        const head = 10

        ctx.beginPath()
        ctx.moveTo(startX, startY)
        ctx.lineTo(endX, endY)
        ctx.stroke()

        ctx.setLineDash([])
        ctx.beginPath()
        ctx.moveTo(endX, endY)
        ctx.lineTo(endX - head * Math.cos(angle - Math.PI / 7), endY - head * Math.sin(angle - Math.PI / 7))
        ctx.lineTo(endX - head * Math.cos(angle + Math.PI / 7), endY - head * Math.sin(angle + Math.PI / 7))
        ctx.closePath()
        ctx.fillStyle = color
        ctx.fill()
      } else {
        ctx.setLineDash([])
        ctx.beginPath()
        ctx.arc(annotation.x1, annotation.y1, 6, 0, Math.PI * 2)
        ctx.fillStyle = color
        ctx.fill()
      }

      if (isActive && annotation.shape !== "point") {
        ctx.setLineDash([])
        ctx.fillStyle = color
        const handleSize = 6
        const corners = [
          [bounds.x, bounds.y],
          [bounds.x + bounds.w, bounds.y],
          [bounds.x, bounds.y + bounds.h],
          [bounds.x + bounds.w, bounds.y + bounds.h],
        ]
        for (const [cx, cy] of corners) {
          ctx.fillRect(cx - handleSize / 2, cy - handleSize / 2, handleSize, handleSize)
        }
      }
    }
  }

  const handleMouseDown = (e: MouseEvent) => {
    if (!canvasRef) return
    const rect = canvasRef.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top

    const existing = [...annotations()].reverse().find((annotation) => hitTestAnnotation(annotation, x, y))
    if (existing) {
      setActiveAnnotationID(existing.id)
      setDrawingAnnotationID(null)
      return
    }

    const id = nextAnnotationID()
    const shape = activeShape()
    const annotation: AnnotationDraft = {
      id,
      shape,
      x1: x,
      y1: y,
      x2: x,
      y2: y,
      instruction: "",
    }
    setAnnotations((prev) => [...prev, annotation])
    setActiveAnnotationID(id)

    if (shape === "point") {
      setDrawingAnnotationID(null)
      drawAnnotations()
      return
    }
    setDrawingAnnotationID(id)
  }

  const handleMouseMove = (e: MouseEvent) => {
    const drawingID = drawingAnnotationID()
    if (!drawingID || !canvasRef) return
    const rect = canvasRef.getBoundingClientRect()
    updateAnnotation(drawingID, {
      x2: e.clientX - rect.left,
      y2: e.clientY - rect.top,
    })
    drawAnnotations()
  }

  const handleMouseUp = () => {
    const drawingID = drawingAnnotationID()
    if (!drawingID) return
    setDrawingAnnotationID(null)

    const current = annotations().find((annotation) => annotation.id === drawingID)
    if (!current) return

    if (current.shape === "arrow") {
      const length = Math.hypot(current.x2 - current.x1, current.y2 - current.y1)
      if (length < 8) {
        setAnnotations((prev) => prev.filter((annotation) => annotation.id !== drawingID))
        setActiveAnnotationID(null)
      }
      return
    }

    if (current.shape !== "point") {
      const bounds = boundsFromDraft(current)
      if (bounds.w < 6 || bounds.h < 6) {
        setAnnotations((prev) => prev.filter((annotation) => annotation.id !== drawingID))
        setActiveAnnotationID(null)
      }
    }
  }

  const openGoogleSettings = () => {
    dialog.show(() => <DialogSettings defaultTab="providers" />)
  }

  const openModelSettings = () => {
    dialog.show(() => <DialogSettings defaultTab="models" />)
  }

  const handleSendEdit = () => {
    if (!googleConnected()) {
      showToast({
        variant: "error",
        title: "Google provider not configured",
        description: "Open Settings > Providers and connect Google first.",
      })
      openGoogleSettings()
      return
    }

    const toImageSpaceRegion = (bounds: ImageEditRegion): ImageEditRegion => {
      const image = imageRef
      if (!image) return bounds

      const displayWidth = Math.max(1, image.getBoundingClientRect().width)
      const displayHeight = Math.max(1, image.getBoundingClientRect().height)
      const imageWidth = Math.max(1, image.naturalWidth || Math.round(displayWidth))
      const imageHeight = Math.max(1, image.naturalHeight || Math.round(displayHeight))
      const scaleX = imageWidth / displayWidth
      const scaleY = imageHeight / displayHeight

      const x = clamp(bounds.x * scaleX, 0, imageWidth)
      const y = clamp(bounds.y * scaleY, 0, imageHeight)
      const w = clamp(bounds.w * scaleX, 1, imageWidth)
      const h = clamp(bounds.h * scaleY, 1, imageHeight)

      return {
        x: Math.round(x),
        y: Math.round(y),
        w: Math.round(w),
        h: Math.round(h),
        xPct: Number(((x / imageWidth) * 100).toFixed(2)),
        yPct: Number(((y / imageHeight) * 100).toFixed(2)),
        wPct: Number(((w / imageWidth) * 100).toFixed(2)),
        hPct: Number(((h / imageHeight) * 100).toFixed(2)),
        imageWidth,
        imageHeight,
      }
    }

    const annotationPayload = annotations().map((annotation) => ({
      id: annotation.id,
      shape: annotation.shape,
      region: toImageSpaceRegion(boundsFromDraft(annotation)),
      instruction: annotation.instruction.trim(),
    }))
    const instruction = editText().trim()
    if (!instruction && annotationPayload.length === 0) return

    const primaryRegion = annotationPayload.length === 1 ? annotationPayload[0].region : undefined
    props.onEditRequest?.({
      instruction: instruction || "Apply edits according to the marked annotations and their local directions.",
      region: primaryRegion,
      annotations: annotationPayload,
      collaborative: collaborativeEdit(),
      model: selectedModel(),
    })

    setEditText("")
    clearAnnotations()
  }

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSendEdit()
    }
    if (e.key === "Escape") {
      if (activeAnnotationID()) {
        setActiveAnnotationID(null)
      } else {
        clearAnnotations()
      }
    }
  }

  createEffect(() => {
    imageLoaded()
    zoom()
    annotations()
    activeAnnotationID()
    queueMicrotask(() => drawAnnotations())
  })

  onMount(() => {
    setSelectedModel(loadSelectedModel())
    const onWindowResize = () => drawAnnotations()
    window.addEventListener("resize", onWindowResize)
    onCleanup(() => window.removeEventListener("resize", onWindowResize))
  })

  createEffect(() => {
    saveSelectedModel(selectedModel())
  })

  createEffect(() => {
    if (!props.imageData) {
      setImageLoaded(false)
      clearAnnotations()
      setEditText("")
    }
  })

  const activeShapeLabel = (shape: AnnotationShape) => {
    if (shape === "rect") return "Rect"
    if (shape === "ellipse") return "Ellipse"
    if (shape === "arrow") return "Arrow"
    return "Point"
  }

  const shapeButtons: { shape: AnnotationShape; label: string }[] = [
    { shape: "rect", label: "Rect" },
    { shape: "ellipse", label: "Ellipse" },
    { shape: "arrow", label: "Arrow" },
    { shape: "point", label: "Point" },
  ]

  return (
    <div class="flex flex-col h-full overflow-hidden bg-background-base">
      {/* Annotation toolbar */}
      <Show when={hasImage()}>
        <div class="shrink-0 flex items-center gap-2 px-3 py-2 border-b border-border-weak-base bg-background-stronger">
          <span class="text-11-medium text-text-weak">Mark type</span>
          <For each={shapeButtons}>
            {(item) => (
              <button
                class="px-2 py-1 rounded text-11-medium transition-colors border"
                classList={{
                  "bg-blue-500/15 border-blue-400/35 text-blue-300": activeShape() === item.shape,
                  "bg-surface-base border-border-weak-base text-text-weak hover:text-text-base":
                    activeShape() !== item.shape,
                }}
                onClick={() => setActiveShape(item.shape)}
              >
                {item.label}
              </button>
            )}
          </For>
          <div class="flex-1" />
          <Show when={hasAnnotations()}>
            <button
              class="text-11-regular text-text-weak hover:text-text-base underline"
              onClick={clearAnnotations}
            >
              Clear marks
            </button>
          </Show>
        </div>
      </Show>

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
                drawAnnotations()
              }}
            />
            <Show when={imageLoaded()}>
              <canvas
                ref={canvasRef}
                class="absolute top-0 left-0 w-full h-full z-10"
                style={{ cursor: drawingAnnotationID() ? "crosshair" : "crosshair" }}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
              />
            </Show>

            <Show when={activeAnnotation()}>
              {(annotation) => (
                <div
                  class="absolute z-20 w-[260px] rounded-lg border border-border-weak-base bg-background-base/95 backdrop-blur px-2.5 py-2 shadow-lg"
                  style={activeDialogStyle()}
                >
                  <div class="flex items-center gap-2 mb-1.5">
                    <span class="text-10-medium uppercase tracking-wide text-text-weak">{activeShapeLabel(annotation().shape)}</span>
                    <button
                      class="ml-auto text-10-regular text-text-weak hover:text-text-base underline"
                      onClick={removeActiveAnnotation}
                    >
                      Remove
                    </button>
                  </div>
                  <input
                    type="text"
                    class="w-full px-2 py-1.5 rounded border border-border-weak-base bg-surface-base text-11-regular text-text-base placeholder:text-text-weak focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30"
                    placeholder="Direction for this mark..."
                    value={annotation().instruction}
                    onInput={(e) => updateAnnotation(annotation().id, { instruction: e.currentTarget.value })}
                    onKeyDown={handleKeyDown}
                  />
                </div>
              )}
            </Show>
          </div>
        </Show>
      </div>

      <Show when={hasAnnotations()}>
        <div class="flex items-center gap-2 px-3 py-1.5 bg-blue-500/10 border-t border-blue-500/20 text-11-medium text-blue-400">
          <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5">
            <rect x="2" y="2" width="12" height="12" rx="1" />
          </svg>
          {annotations().length} mark{annotations().length > 1 ? "s" : ""} active
        </div>
      </Show>

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

      <div class="shrink-0 border-t border-border-weak-base bg-background-base p-2">
        <Show when={!googleConnected()}>
          <div class="mb-2 rounded-md border border-amber-400/30 bg-amber-500/10 px-2.5 py-2 text-11-regular text-amber-300">
            Google image provider is not connected. Connect Google first, then choose your default image model.
            <div class="flex items-center gap-2 mt-2">
              <button class="underline hover:text-amber-100" onClick={openGoogleSettings}>Open provider settings</button>
              <button class="underline hover:text-amber-100" onClick={openModelSettings}>Open model settings</button>
            </div>
          </div>
        </Show>

        <div class="flex gap-2 items-end">
          <div class="flex-1 relative">
            <input
              type="text"
              class="w-full px-3 py-2 text-12-regular bg-surface-base border border-border-weak-base rounded-lg text-text-base placeholder:text-text-weak focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30"
              placeholder={hasAnnotations() ? "Optional global direction for all marks..." : "Describe how to edit this image..."}
              value={editText()}
              onInput={(e) => setEditText(e.currentTarget.value)}
              onKeyDown={handleKeyDown}
            />
          </div>
          <button
            class="shrink-0 px-3 py-2 rounded-lg text-12-medium text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            classList={{
              "bg-blue-600 hover:bg-blue-700": !hasAnnotations(),
              "bg-emerald-500 hover:bg-emerald-600 ring-1 ring-emerald-300/40": hasAnnotations(),
            }}
            onClick={handleSendEdit}
            disabled={!canSubmit()}
          >
            Edit
          </button>
        </div>

        <div class="mt-2 grid grid-cols-[1fr_auto] gap-3 items-center">
          <label class="flex items-center gap-2 text-11-regular text-text-weak">
            <Switch checked={collaborativeEdit()} onChange={(value) => setCollaborativeEdit(value)} hideLabel>
              collaborative edit
            </Switch>
            <span>Collaborative change</span>
          </label>
          <div class="flex items-center gap-2">
            <span class="text-11-regular text-text-weak">Default image model</span>
            <select
              class="h-7 px-2 rounded border border-border-weak-base bg-surface-base text-11-regular text-text-base focus:outline-none focus:border-blue-500"
              value={selectedModel()}
              onInput={(e) => setSelectedModel(e.currentTarget.value)}
            >
              <For each={IMAGE_MODELS}>{(model) => <option value={model}>{model}</option>}</For>
            </select>
          </div>
        </div>

        <div class="mt-1.5 text-10-regular text-text-weak">
          Click and drag to add marks. Each mark gets its own nearby direction box. Default collaborative change is ON.
        </div>
      </div>
    </div>
  )
}
