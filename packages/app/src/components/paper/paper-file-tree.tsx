import { createSignal, For, Show, onCleanup, onMount, type JSX } from "solid-js"
import { Portal } from "solid-js/web"

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
  onRefresh?: () => void
  refreshing?: boolean
  onFileDelete?: (file: PaperFile) => void
  onFileRename?: (file: PaperFile, newName: string) => void
  onFileMove?: (file: PaperFile, targetParentPath: string) => void
  onImageDrop?: (data: ImageDropData, targetFolder: string) => void
  onUploadTemplate?: (files: FileList) => void
  class?: string
}

const TREE_NODE_MIME = "application/x-paper-tree-node"

type TreeDragPayload = {
  path: string
  type: "file" | "folder"
}

type TreeDropTarget = {
  path: string
  mode: "into" | "before" | "after" | "root"
}

function parentPath(path: string): string {
  const idx = path.lastIndexOf("/")
  return idx >= 0 ? path.slice(0, idx) : ""
}

function findNodeByPath(files: PaperFile[], targetPath: string): PaperFile | undefined {
  for (const file of files) {
    if (file.path === targetPath) return file
    if (file.children?.length) {
      const nested = findNodeByPath(file.children, targetPath)
      if (nested) return nested
    }
  }
  return undefined
}

export function PaperFileTree(props: PaperFileTreeProps) {
  const [contextMenu, setContextMenu] = createSignal<{
    x: number
    y: number
    file: PaperFile
  }>()
  const [dragOver, setDragOver] = createSignal(false)
  const [dropTargetFolder, setDropTargetFolder] = createSignal<string | null>(null)
  const [treeDragPath, setTreeDragPath] = createSignal<string | null>(null)
  const [treeDropTarget, setTreeDropTarget] = createSignal<TreeDropTarget | null>(null)
  const [renamingFile, setRenamingFile] = createSignal<PaperFile>()
  const [renameValue, setRenameValue] = createSignal("")

  const isImagePayload = (dt: DataTransfer | null | undefined) =>
    !!dt?.types.includes("application/x-paper-image")
  const isTreePayload = (dt: DataTransfer | null | undefined) =>
    !!dt?.types.includes(TREE_NODE_MIME)

  const readTreePayload = (dt: DataTransfer | null | undefined): TreeDragPayload | undefined => {
    const raw = dt?.getData(TREE_NODE_MIME)
    if (!raw) return undefined
    try {
      const payload = JSON.parse(raw) as TreeDragPayload
      if (!payload?.path || (payload.type !== "file" && payload.type !== "folder")) return undefined
      return payload
    } catch {
      return undefined
    }
  }

  const clearTreeDnD = () => {
    setTreeDropTarget(null)
    setTreeDragPath(null)
  }

  const resolveNodeDropMode = (e: DragEvent, node: PaperFile): TreeDropTarget["mode"] => {
    const target = e.currentTarget as HTMLElement
    const rect = target.getBoundingClientRect()
    const y = e.clientY - rect.top
    if (node.type === "folder") {
      const topBand = rect.height * 0.25
      const bottomBand = rect.height * 0.75
      if (y <= topBand) return "before"
      if (y >= bottomBand) return "after"
      return "into"
    }
    return y < rect.height / 2 ? "before" : "after"
  }

  const deriveTargetParentPath = (target: TreeDropTarget): string => {
    if (target.mode === "root") return ""
    if (target.mode === "into") return target.path
    return parentPath(target.path)
  }

  const commitRename = () => {
    const file = renamingFile()
    const newName = renameValue().trim()
    if (file && newName && newName !== file.name) {
      props.onFileRename?.(file, newName)
    }
    setRenamingFile(undefined)
  }

  const cancelRename = () => setRenamingFile(undefined)

  const handleContextMenu = (e: MouseEvent, file: PaperFile) => {
    e.preventDefault()
    const menuWidth = 160
    const menuHeight = 88
    const x = Math.max(8, Math.min(e.clientX, window.innerWidth - menuWidth - 8))
    const y = Math.max(8, Math.min(e.clientY, window.innerHeight - menuHeight - 8))
    setContextMenu({ x, y, file })
  }

  const closeContextMenu = () => setContextMenu(undefined)

  onMount(() => {
    const handleGlobalClick = () => closeContextMenu()
    const handleGlobalKeydown = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeContextMenu()
    }
    window.addEventListener("click", handleGlobalClick)
    window.addEventListener("keydown", handleGlobalKeydown)
    onCleanup(() => {
      window.removeEventListener("click", handleGlobalClick)
      window.removeEventListener("keydown", handleGlobalKeydown)
    })
  })

  const handleDragOver = (e: DragEvent) => {
    if (isImagePayload(e.dataTransfer)) {
      e.preventDefault()
      e.dataTransfer!.dropEffect = "copy"
      setDragOver(true)
      return
    }
    if (isTreePayload(e.dataTransfer)) {
      e.preventDefault()
      e.dataTransfer!.dropEffect = "move"
      setTreeDropTarget({ path: "", mode: "root" })
    }
  }

  const handleDragLeave = (e: DragEvent) => {
    // Only reset if leaving the container itself
    const related = e.relatedTarget as HTMLElement | null
    if (!related || !(e.currentTarget as HTMLElement).contains(related)) {
      setDragOver(false)
      setDropTargetFolder(null)
      setTreeDropTarget(null)
    }
  }

  const handleDrop = (e: DragEvent) => {
    e.preventDefault()
    if (isTreePayload(e.dataTransfer)) {
      const payload = readTreePayload(e.dataTransfer)
      const source = payload ? findNodeByPath(props.files, payload.path) : undefined
      if (source) {
        props.onFileMove?.(source, "")
      }
      clearTreeDnD()
      return
    }

    setDragOver(false)
    const targetFolder = dropTargetFolder() || "figures"
    setDropTargetFolder(null)
    const raw = e.dataTransfer?.getData("application/x-paper-image")
    if (!raw) return
    try {
      const data = JSON.parse(raw) as ImageDropData
      props.onImageDrop?.(data, targetFolder)
    } catch {}
  }

  const handleFolderDragOver = (e: DragEvent, folder: PaperFile) => {
    if (!isImagePayload(e.dataTransfer)) return
    e.preventDefault()
    e.stopPropagation()
    e.dataTransfer!.dropEffect = "copy"
    setDragOver(true)
    setDropTargetFolder(folder.path)
  }

  const handleFolderDragLeave = (e: DragEvent, folder: PaperFile) => {
    const related = e.relatedTarget as HTMLElement | null
    if (related && (e.currentTarget as HTMLElement).contains(related)) return
    if (dropTargetFolder() === folder.path) {
      setDropTargetFolder(null)
    }
  }

  const handleFolderDrop = (e: DragEvent, folder: PaperFile) => {
    if (!isImagePayload(e.dataTransfer)) return
    e.preventDefault()
    e.stopPropagation()
    setDragOver(false)
    setDropTargetFolder(null)
    const raw = e.dataTransfer?.getData("application/x-paper-image")
    if (!raw) return
    try {
      const data = JSON.parse(raw) as ImageDropData
      props.onImageDrop?.(data, folder.path)
    } catch {}
  }

  const handleNodeDragStart = (e: DragEvent, file: PaperFile) => {
    if (!e.dataTransfer) return
    e.dataTransfer.effectAllowed = "move"
    e.dataTransfer.setData(TREE_NODE_MIME, JSON.stringify({ path: file.path, type: file.type } satisfies TreeDragPayload))
    setTreeDragPath(file.path)
    setTreeDropTarget(null)
  }

  const handleNodeDragEnd = () => {
    clearTreeDnD()
  }

  const handleNodeDragOver = (e: DragEvent, node: PaperFile) => {
    if (!isTreePayload(e.dataTransfer)) return
    const payload = readTreePayload(e.dataTransfer)
    if (!payload) return

    const mode = resolveNodeDropMode(e, node)
    const target: TreeDropTarget = { path: node.path, mode }
    const targetParentPath = deriveTargetParentPath(target)
    const movingIntoOwnSubtree =
      payload.type === "folder" &&
      (targetParentPath === payload.path || targetParentPath.startsWith(`${payload.path}/`))
    if (movingIntoOwnSubtree) return

    e.preventDefault()
    e.stopPropagation()
    e.dataTransfer!.dropEffect = "move"
    setTreeDropTarget(target)
  }

  const handleNodeDragLeave = (e: DragEvent, node: PaperFile) => {
    if (!isTreePayload(e.dataTransfer)) return
    const related = e.relatedTarget as HTMLElement | null
    if (related && (e.currentTarget as HTMLElement).contains(related)) return
    const target = treeDropTarget()
    if (target?.path === node.path) {
      setTreeDropTarget(null)
    }
  }

  const handleNodeDrop = (e: DragEvent, node: PaperFile) => {
    if (!isTreePayload(e.dataTransfer)) return
    const payload = readTreePayload(e.dataTransfer)
    if (!payload) {
      clearTreeDnD()
      return
    }

    e.preventDefault()
    e.stopPropagation()

    const mode = resolveNodeDropMode(e, node)
    const target: TreeDropTarget = { path: node.path, mode }
    const targetParentPath = deriveTargetParentPath(target)
    const movingIntoOwnSubtree =
      payload.type === "folder" &&
      (targetParentPath === payload.path || targetParentPath.startsWith(`${payload.path}/`))
    if (movingIntoOwnSubtree) {
      clearTreeDnD()
      return
    }

    const source = findNodeByPath(props.files, payload.path)
    if (source) {
      props.onFileMove?.(source, targetParentPath)
    }
    clearTreeDnD()
  }

  return (
    <div
      class={`flex flex-col h-full overflow-hidden ${props.class ?? ""}`}
      classList={{
        "ring-2 ring-inset ring-blue-400/60": dragOver() && !dropTargetFolder(),
        "ring-2 ring-inset ring-blue-500/60": treeDropTarget()?.mode === "root",
      }}
      onClick={closeContextMenu}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <div class="flex items-center justify-between h-10 px-3 border-b border-border-weak-base bg-background-stronger shrink-0">
        <span class="text-12-medium text-text-base">Files</span>
        <div class="flex items-center gap-1">
          <button
            class="flex items-center justify-center w-6 h-6 rounded-md hover:bg-surface-base text-text-weak hover:text-text-base transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            onClick={() => props.onRefresh?.()}
            disabled={props.refreshing}
            title="Refresh files"
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
              <path
                d="M13 8a5 5 0 11-1.46-3.54M13 3v3h-3"
                stroke="currentColor"
                stroke-width="1.3"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
            </svg>
          </button>
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
              renamingPath={renamingFile()?.path}
              renameValue={renameValue()}
              onRenameChange={setRenameValue}
              onRenameCommit={commitRename}
              onRenameCancel={cancelRename}
              draggingPath={treeDragPath()}
              treeDropTarget={treeDropTarget()}
              onNodeDragStart={handleNodeDragStart}
              onNodeDragEnd={handleNodeDragEnd}
              onNodeDragOver={handleNodeDragOver}
              onNodeDragLeave={handleNodeDragLeave}
              onNodeDrop={handleNodeDrop}
              dropTargetFolder={dropTargetFolder()}
              onFolderDragOver={handleFolderDragOver}
              onFolderDragLeave={handleFolderDragLeave}
              onFolderDrop={handleFolderDrop}
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
        <Show when={treeDragPath()}>
          <div class="mx-2 my-2 px-3 py-3 text-center border border-blue-400/60 rounded-lg bg-blue-50/40 text-11-regular text-blue-700">
            Drop on a folder to move into it, or on a row edge to move to that level.
          </div>
        </Show>
      </div>

      {/* Context menu */}
      <Show when={contextMenu()}>
        {(menu) => (
          <Portal>
            <div
              class="fixed z-[260] bg-surface-raised-base/100 border border-border-strong rounded-lg shadow-2xl ring-1 ring-black/10 py-1 min-w-36"
              style={{ left: `${menu().x}px`, top: `${menu().y}px` }}
              onClick={(e) => e.stopPropagation()}
            >
              <button
                class="w-full px-3 py-1.5 text-left text-12-medium text-text-strong hover:bg-surface-base transition-colors"
                onClick={() => {
                  setRenamingFile(menu().file)
                  setRenameValue(menu().file.name)
                  closeContextMenu()
                }}
              >
                Rename
              </button>
              <button
                class="w-full px-3 py-1.5 text-left text-12-medium text-red-500 hover:bg-surface-base transition-colors"
                onClick={() => {
                  props.onFileDelete?.(menu().file)
                  closeContextMenu()
                }}
              >
                Delete
              </button>
            </div>
          </Portal>
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
  renamingPath?: string
  renameValue?: string
  onRenameChange?: (val: string) => void
  onRenameCommit?: () => void
  onRenameCancel?: () => void
  draggingPath?: string | null
  treeDropTarget?: TreeDropTarget | null
  onNodeDragStart?: (e: DragEvent, file: PaperFile) => void
  onNodeDragEnd?: () => void
  onNodeDragOver?: (e: DragEvent, file: PaperFile) => void
  onNodeDragLeave?: (e: DragEvent, file: PaperFile) => void
  onNodeDrop?: (e: DragEvent, file: PaperFile) => void
  dropTargetFolder?: string | null
  onFolderDragOver?: (e: DragEvent, folder: PaperFile) => void
  onFolderDragLeave?: (e: DragEvent, folder: PaperFile) => void
  onFolderDrop?: (e: DragEvent, folder: PaperFile) => void
}) {
  const [expanded, setExpanded] = createSignal(props.level === 0)

  const isActive = () => props.file.path === props.activeFile
  const isFolder = () => props.file.type === "folder"
  const isDropTarget = () => isFolder() && props.dropTargetFolder === props.file.path
  const dropMode = () =>
    props.treeDropTarget?.path === props.file.path ? props.treeDropTarget.mode : undefined
  const indent = () => `${props.level * 16 + 8}px`
  const isRenaming = () => props.renamingPath === props.file.path

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

  const fileLabels = () => {
    const ext = props.file.name.split(".").pop()?.toLowerCase()
    if (ext === "sty" || ext === "cls" || ext === "bst" || ext === "bbx" || ext === "cbx" || ext === "def") {
      return <span class="ml-1 text-10-regular text-purple-400 shrink-0">(template)</span>
    }
    if (ext === "docx") {
      return <span class="ml-1 text-10-regular text-blue-400 shrink-0">(Word)</span>
    }
    return null
  }

  return (
    <>
      <Show
        when={isRenaming()}
        fallback={
          <div class="relative">
            <Show when={dropMode() === "before"}>
              <div class="absolute left-2 right-2 top-0 h-0.5 rounded bg-blue-500 pointer-events-none" />
            </Show>
            <button
              class="w-full flex items-center gap-1.5 py-1 rounded-md text-12-regular transition-colors cursor-pointer"
              classList={{
                "bg-surface-base text-text-strong": isActive(),
                "bg-blue-500/12 ring-1 ring-blue-400/35 text-text-strong": (isDropTarget() || dropMode() === "into") && !isActive(),
                "text-text-base hover:bg-surface-base/50": !isActive(),
                "opacity-70": props.draggingPath === props.file.path,
              }}
              style={{ "padding-left": indent() }}
              draggable={!isRenaming()}
              onClick={() => {
                if (isFolder()) {
                  setExpanded(!expanded())
                } else {
                  props.onFileSelect?.(props.file)
                }
              }}
              onContextMenu={(e) => props.onContextMenu?.(e, props.file)}
              onDragStart={(e) => props.onNodeDragStart?.(e, props.file)}
              onDragEnd={() => props.onNodeDragEnd?.()}
              onDragOver={(e) => {
                props.onNodeDragOver?.(e, props.file)
                if (isFolder()) props.onFolderDragOver?.(e, props.file)
              }}
              onDragLeave={(e) => {
                props.onNodeDragLeave?.(e, props.file)
                if (isFolder()) props.onFolderDragLeave?.(e, props.file)
              }}
              onDrop={(e) => {
                props.onNodeDrop?.(e, props.file)
                if (isFolder()) props.onFolderDrop?.(e, props.file)
              }}
              onMouseEnter={() => {
                if ((isDropTarget() || dropMode() === "into") && isFolder() && !expanded()) setExpanded(true)
              }}
            >
              {icon()}
              <span class="truncate">{props.file.name}</span>
              {fileLabels()}
            </button>
            <Show when={dropMode() === "after"}>
              <div class="absolute left-2 right-2 bottom-0 h-0.5 rounded bg-blue-500 pointer-events-none" />
            </Show>
          </div>
        }
      >
        <div
          class="w-full flex items-center gap-1.5 py-1 rounded-md bg-surface-base"
          style={{ "padding-left": indent() }}
        >
          {icon()}
          <input
            ref={(el) => {
              setTimeout(() => {
                el.focus()
                const dotIdx = el.value.lastIndexOf(".")
                if (dotIdx > 0) el.setSelectionRange(0, dotIdx)
                else el.select()
              }, 0)
            }}
            class="flex-1 min-w-0 bg-transparent text-12-regular text-text-strong outline-none border-b border-blue-400"
            value={props.renameValue ?? ""}
            onInput={(e) => props.onRenameChange?.(e.currentTarget.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") { e.preventDefault(); props.onRenameCommit?.() }
              if (e.key === "Escape") { e.preventDefault(); props.onRenameCancel?.() }
            }}
            onBlur={() => props.onRenameCommit?.()}
          />
        </div>
      </Show>
      <Show when={isFolder() && expanded()}>
        <For each={props.file.children}>
          {(child) => (
            <FileTreeNode
              file={child}
              level={props.level + 1}
              activeFile={props.activeFile}
              onFileSelect={props.onFileSelect}
              onContextMenu={props.onContextMenu}
              renamingPath={props.renamingPath}
              renameValue={props.renameValue}
              onRenameChange={props.onRenameChange}
              onRenameCommit={props.onRenameCommit}
              onRenameCancel={props.onRenameCancel}
              draggingPath={props.draggingPath}
              treeDropTarget={props.treeDropTarget}
              onNodeDragStart={props.onNodeDragStart}
              onNodeDragEnd={props.onNodeDragEnd}
              onNodeDragOver={props.onNodeDragOver}
              onNodeDragLeave={props.onNodeDragLeave}
              onNodeDrop={props.onNodeDrop}
              dropTargetFolder={props.dropTargetFolder}
              onFolderDragOver={props.onFolderDragOver}
              onFolderDragLeave={props.onFolderDragLeave}
              onFolderDrop={props.onFolderDrop}
            />
          )}
        </For>
      </Show>
    </>
  )
}
