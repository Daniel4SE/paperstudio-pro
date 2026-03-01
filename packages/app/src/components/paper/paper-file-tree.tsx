import { createSignal, For, Show, type JSX } from "solid-js"

export interface PaperFile {
  name: string
  path: string
  type: "file" | "folder"
  children?: PaperFile[]
  content?: string
}

export interface ImageDropData {
  src: string
  fileName: string
  prompt: string
}

export interface PaperFileTreeProps {
  files: PaperFile[]
  activeFile?: string
  onFileSelect?: (file: PaperFile) => void
  onFileCreate?: (parentPath: string, name: string) => void
  onFileDelete?: (file: PaperFile) => void
  onFileRename?: (file: PaperFile, newName: string) => void
  onImageDrop?: (data: ImageDropData, targetFolder: string) => void
  onUploadTemplate?: (files: FileList) => void
  class?: string
}

export function PaperFileTree(props: PaperFileTreeProps) {
  const [contextMenu, setContextMenu] = createSignal<{
    x: number
    y: number
    file: PaperFile
  }>()
  const [dragOver, setDragOver] = createSignal(false)

  const handleContextMenu = (e: MouseEvent, file: PaperFile) => {
    e.preventDefault()
    setContextMenu({ x: e.clientX, y: e.clientY, file })
  }

  const closeContextMenu = () => setContextMenu(undefined)

  const handleDragOver = (e: DragEvent) => {
    if (e.dataTransfer?.types.includes("application/x-paper-image")) {
      e.preventDefault()
      e.dataTransfer!.dropEffect = "copy"
      setDragOver(true)
    }
  }

  const handleDragLeave = (e: DragEvent) => {
    // Only reset if leaving the container itself
    const related = e.relatedTarget as HTMLElement | null
    if (!related || !(e.currentTarget as HTMLElement).contains(related)) {
      setDragOver(false)
    }
  }

  const handleDrop = (e: DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const raw = e.dataTransfer?.getData("application/x-paper-image")
    if (!raw) return
    try {
      const data = JSON.parse(raw) as ImageDropData
      props.onImageDrop?.(data, "figures")
    } catch {}
  }

  return (
    <div
      class={`flex flex-col h-full overflow-hidden ${props.class ?? ""}`}
      classList={{ "ring-2 ring-inset ring-blue-400/60": dragOver() }}
      onClick={closeContextMenu}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <div class="flex items-center justify-between h-10 px-3 border-b border-border-weak-base bg-background-stronger shrink-0">
        <span class="text-12-medium text-text-base">Files</span>
        <div class="flex items-center gap-1">
          <button
            class="flex items-center justify-center w-6 h-6 rounded-md hover:bg-surface-base text-text-weak hover:text-text-base transition-colors"
            onClick={() => {
              const input = document.createElement("input")
              input.type = "file"
              input.accept = ".sty,.cls,.bst,.bbx,.cbx"
              input.multiple = true
              input.onchange = () => {
                if (input.files && input.files.length > 0) {
                  props.onUploadTemplate?.(input.files)
                }
              }
              input.click()
            }}
            title="Upload template (.sty, .cls, .bst)"
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
              <path d="M8 10V3M5 5l3-3 3 3" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round" />
              <path d="M3 11v2a1 1 0 001 1h8a1 1 0 001-1v-2" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
          </button>
          <button
            class="flex items-center justify-center w-6 h-6 rounded-md hover:bg-surface-base text-text-weak hover:text-text-base transition-colors"
            onClick={() => props.onFileCreate?.("", "untitled.tex")}
            title="New file"
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
              <path d="M8 3v10M3 8h10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
            </svg>
          </button>
        </div>
      </div>
      <div class="flex-1 overflow-auto px-1 py-1">
        <For each={props.files}>
          {(file) => (
            <FileTreeNode
              file={file}
              level={0}
              activeFile={props.activeFile}
              onFileSelect={props.onFileSelect}
              onContextMenu={handleContextMenu}
            />
          )}
        </For>
        <Show when={props.files.length === 0 && !dragOver()}>
          <div class="px-3 py-8 text-center text-12-regular text-text-weak">
            No files yet. Start by creating a .tex file or use the chat to generate one.
          </div>
        </Show>
        <Show when={dragOver()}>
          <div class="mx-2 my-2 px-3 py-6 text-center border-2 border-dashed border-blue-400 rounded-lg bg-blue-50/50">
            <div class="text-12-medium text-blue-600">Drop image here</div>
            <div class="text-11-regular text-blue-400 mt-1">Save to figures/</div>
          </div>
        </Show>
      </div>

      {/* Context menu */}
      <Show when={contextMenu()}>
        {(menu) => (
          <div
            class="fixed z-50 bg-surface-raised-base border border-border-base rounded-lg shadow-lg py-1 min-w-36"
            style={{ left: `${menu().x}px`, top: `${menu().y}px` }}
          >
            <button
              class="w-full px-3 py-1.5 text-left text-12-regular text-text-base hover:bg-surface-base"
              onClick={() => {
                props.onFileRename?.(menu().file, menu().file.name)
                closeContextMenu()
              }}
            >
              Rename
            </button>
            <button
              class="w-full px-3 py-1.5 text-left text-12-regular text-text-error hover:bg-surface-base"
              onClick={() => {
                props.onFileDelete?.(menu().file)
                closeContextMenu()
              }}
            >
              Delete
            </button>
          </div>
        )}
      </Show>
    </div>
  )
}

function FileTreeNode(props: {
  file: PaperFile
  level: number
  activeFile?: string
  onFileSelect?: (file: PaperFile) => void
  onContextMenu?: (e: MouseEvent, file: PaperFile) => void
}) {
  const [expanded, setExpanded] = createSignal(props.level === 0)

  const isActive = () => props.file.path === props.activeFile
  const isFolder = () => props.file.type === "folder"
  const indent = () => `${props.level * 16 + 8}px`

  const icon = (): JSX.Element => {
    if (isFolder()) {
      return expanded() ? (
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
          <path d="M4 6l4 4 4-4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
      ) : (
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
          <path d="M6 4l4 4-4 4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
      )
    }

    const ext = props.file.name.split(".").pop()?.toLowerCase()
    const isTemplate = ext === "sty" || ext === "cls" || ext === "bst" || ext === "bbx" || ext === "cbx" || ext === "def"
    const color =
      ext === "tex"
        ? "text-green-500"
        : ext === "bib"
          ? "text-yellow-500"
          : ext === "pdf"
            ? "text-red-500"
            : ext === "docx"
              ? "text-blue-500"
              : ext === "py"
                ? "text-cyan-500"
                : isTemplate
                  ? "text-purple-500"
                  : "text-text-weak"

    return (
      <svg width="14" height="14" viewBox="0 0 16 16" fill="none" class={color}>
        <rect x="3" y="2" width="10" height="12" rx="1.5" stroke="currentColor" stroke-width="1.2" />
        <line x1="5.5" y1="5" x2="10.5" y2="5" stroke="currentColor" stroke-width="1" />
        <line x1="5.5" y1="7.5" x2="10.5" y2="7.5" stroke="currentColor" stroke-width="1" />
        <line x1="5.5" y1="10" x2="8.5" y2="10" stroke="currentColor" stroke-width="1" />
      </svg>
    )
  }

  return (
    <>
      <button
        class="w-full flex items-center gap-1.5 py-1 rounded-md text-12-regular transition-colors cursor-pointer"
        classList={{
          "bg-surface-base text-text-strong": isActive(),
          "text-text-base hover:bg-surface-base/50": !isActive(),
        }}
        style={{ "padding-left": indent() }}
        onClick={() => {
          if (isFolder()) {
            setExpanded(!expanded())
          } else {
            props.onFileSelect?.(props.file)
          }
        }}
        onContextMenu={(e) => props.onContextMenu?.(e, props.file)}
      >
        {icon()}
        <span class="truncate">{props.file.name}</span>
        {(() => {
          const ext = props.file.name.split(".").pop()?.toLowerCase()
          if (ext === "sty" || ext === "cls" || ext === "bst" || ext === "bbx" || ext === "cbx" || ext === "def") {
            return <span class="ml-1 text-10-regular text-purple-400">(template)</span>
          }
          if (ext === "docx") {
            return <span class="ml-1 text-10-regular text-blue-400">(Word)</span>
          }
          return null
        })()}
      </button>
      <Show when={isFolder() && expanded()}>
        <For each={props.file.children}>
          {(child) => (
            <FileTreeNode
              file={child}
              level={props.level + 1}
              activeFile={props.activeFile}
              onFileSelect={props.onFileSelect}
              onContextMenu={props.onContextMenu}
            />
          )}
        </For>
      </Show>
    </>
  )
}
