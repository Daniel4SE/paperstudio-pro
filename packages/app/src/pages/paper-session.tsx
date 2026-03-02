/**
 * Paper Session — Overleaf-style layout for academic paper writing.
 *
 * Layout:
 * ┌──────┬──────────────┬──────────────┬──────────────┐
 * │ File │  CodeMirror   │  PDF Preview │    Chat      │
 * │ Tree │  LaTeX Editor │              │   Panel      │
 * │  ↔   │      ↔        │     ↔        │     ↔        │
 * ├──────┴──────────────┴──────────────┴──────────────┤
 * │                  Terminal (optional)                │
 * └────────────────────────────────────────────────────┘
 */
import { createEffect, createMemo, createSignal, on, onCleanup, onMount, Show, For } from "solid-js"
import { Portal } from "solid-js/web"
import { createStore } from "solid-js/store"
import { useParams, useNavigate } from "@solidjs/router"
import { createMediaQuery } from "@solid-primitives/media"

import { useSync } from "@/context/sync"
import { useGlobalSync } from "@/context/global-sync"
import { sortedRootSessions } from "@/pages/layout/helpers"
import { useLayout } from "@/context/layout"
import { useSDK } from "@/context/sdk"
import { useFile } from "@/context/file"
import { usePrompt } from "@/context/prompt"
import { useComments } from "@/context/comments"
import { useCommand } from "@/context/command"
import { useServer } from "@/context/server"
import { usePlatform } from "@/context/platform"

import { LatexEditor } from "@/components/paper/latex-editor"
import { ImagePreviewPanel, type ImageEditRequest } from "@/components/paper/image-preview-panel"
import { PdfPreview } from "@/components/paper/pdf-preview"
import {
  parseLatexLog,
  countLogEntries,
  countUndefinedCitationWarnings,
  type LogEntry,
} from "@/components/paper/latex-log-parser"
import { PaperFileTree, type PaperFile, type ImageDropData } from "@/components/paper/paper-file-tree"
import { TerminalPanel } from "@/pages/session/terminal-panel"
import { MessageTimeline } from "@/pages/session/message-timeline"
import { SessionComposerRegion, createSessionComposerState } from "@/pages/session/composer"
import { createAutoScroll } from "@opencode-ai/ui/hooks"
import { useLanguage } from "@/context/language"
import type { UserMessage } from "@opencode-ai/sdk/v2"
import { same } from "@/utils/same"
import { buildZip, dataUrlToBytes, downloadBlob } from "@/utils/zip"
import { compileLatex, compileDocx, convertDocxToLatex, prewarmCompiler, type ProjectFile } from "@/components/paper/latex-compiler"
import { StatusPopover } from "@/components/status-popover"
import { DialogSettings } from "@/components/dialog-settings"
import { useDialog } from "@opencode-ai/ui/context/dialog"
import { useProviders } from "@/hooks/use-providers"
import { decode64 } from "@/utils/base64"
import { Button } from "@opencode-ai/ui/button"
import { Icon } from "@opencode-ai/ui/icon"
import { showToast } from "@opencode-ai/ui/toast"
import { TooltipKeybind } from "@opencode-ai/ui/tooltip"
import { MenuBar, type ViewMode } from "@/components/paper/menu-bar"
import { DropdownMenu } from "@opencode-ai/ui/dropdown-menu"
import type { EditorView } from "@codemirror/view"

// Register paper tool custom renderers
import { registerPaperToolRenderers } from "@/components/paper/paper-tool-renderers"
registerPaperToolRenderers()

// ─── Image file detection ──────────────────────────────────────────────
const IMAGE_EXTENSIONS = new Set(["png", "jpg", "jpeg", "gif", "webp", "svg", "bmp", "ico", "eps"])
function isImageFile(path: string): boolean {
  const ext = path.split(".").pop()?.toLowerCase() || ""
  return IMAGE_EXTENSIONS.has(ext)
}
function isPdfFile(path: string): boolean {
  return path.split(".").pop()?.toLowerCase() === "pdf"
}

function mapSubtreePaths(node: PaperFile, oldBase: string, newBase: string, renamedRootName: string): PaperFile {
  const suffix = node.path === oldBase ? "" : node.path.slice(oldBase.length)
  const nextPath = `${newBase}${suffix}`
  const nextName = node.path === oldBase ? renamedRootName : node.name
  return {
    ...node,
    name: nextName,
    path: nextPath,
    children: node.children?.map((child) => mapSubtreePaths(child, oldBase, newBase, renamedRootName)),
  }
}

function renameInTree(files: PaperFile[], oldPath: string, newPath: string, newName: string): PaperFile[] {
  return files.map((node) => {
    if (node.path === oldPath) {
      return mapSubtreePaths(node, oldPath, newPath, newName)
    }
    if (node.children?.length) {
      return { ...node, children: renameInTree(node.children, oldPath, newPath, newName) }
    }
    return node
  })
}

function removeFromTree(files: PaperFile[], targetPath: string): PaperFile[] {
  const prefix = `${targetPath}/`
  return files
    .filter((node) => node.path !== targetPath && !node.path.startsWith(prefix))
    .map((node) => {
      if (node.children?.length) {
        return { ...node, children: removeFromTree(node.children, targetPath) }
      }
      return node
    })
}

function flattenTreeFiles(files: PaperFile[]): PaperFile[] {
  const out: PaperFile[] = []
  const walk = (list: PaperFile[]) => {
    for (const f of list) {
      if (f.type === "file") out.push(f)
      if (f.children?.length) walk(f.children)
    }
  }
  walk(files)
  return out
}

// Panel width persistence keys
const PANEL_WIDTHS_KEY = "paper-session-panel-widths"
const CHAT_SCROLL_KEY_PREFIX = "paper-session-chat-scroll-v1"

interface PanelWidths {
  fileTree: number
  editor: number
  preview: number
  chat: number
}

const DEFAULT_WIDTHS: PanelWidths = {
  fileTree: 200,
  editor: 400,
  preview: 400,
  chat: 380,
}

// Hide noisy generated/temporary files in the paper file tree.
// These files can still exist on disk, but they are rarely useful to edit directly.
const HIDDEN_PAPER_FILE_EXACT = new Set([".DS_Store"])
const HIDDEN_PAPER_FILE_SUFFIX = [
  ".aux",
  ".bbl",
  ".bcf",
  ".blg",
  ".fdb_latexmk",
  ".fls",
  ".idx",
  ".ilg",
  ".ind",
  ".lof",
  ".log",
  ".lot",
  ".out",
  ".run.xml",
  ".synctex.gz",
  ".toc",
  ".tmp",
  ".temp",
  ".bak",
  ".orig",
  ".rej",
  ".swp",
  ".swo",
  "~",
]

function shouldHidePaperTreeNode(name: string): boolean {
  const lower = name.toLowerCase()
  if (HIDDEN_PAPER_FILE_EXACT.has(name)) return true
  if (lower.startsWith("._")) return true // macOS metadata files
  return HIDDEN_PAPER_FILE_SUFFIX.some((suffix) => lower.endsWith(suffix))
}

function loadWidths(): PanelWidths {
  try {
    const stored = localStorage.getItem(PANEL_WIDTHS_KEY)
    if (stored) return { ...DEFAULT_WIDTHS, ...JSON.parse(stored) }
  } catch {}
  return DEFAULT_WIDTHS
}

function saveWidths(widths: PanelWidths) {
  try {
    localStorage.setItem(PANEL_WIDTHS_KEY, JSON.stringify(widths))
  } catch {}
}

// ─── Drag Handle Component ──────────────────────────────────────────────
// A simple standalone drag handle that doesn't use position:absolute
// This avoids the "black block" rendering issue from the UI library's ResizeHandle
function DragHandle(props: {
  direction: "horizontal" | "vertical"
  onDrag: (delta: number) => void
}) {
  const isHorizontal = () => props.direction === "horizontal"

  const handleMouseDown = (e: MouseEvent) => {
    e.preventDefault()
    const start = isHorizontal() ? e.clientX : e.clientY

    document.body.style.userSelect = "none"
    document.body.style.cursor = isHorizontal() ? "col-resize" : "row-resize"

    const onMouseMove = (moveEvent: MouseEvent) => {
      const pos = isHorizontal() ? moveEvent.clientX : moveEvent.clientY
      props.onDrag(pos - start)
    }

    const onMouseUp = () => {
      document.body.style.userSelect = ""
      document.body.style.cursor = ""
      document.removeEventListener("mousemove", onMouseMove)
      document.removeEventListener("mouseup", onMouseUp)
    }

    document.addEventListener("mousemove", onMouseMove)
    document.addEventListener("mouseup", onMouseUp)
  }

  return (
    <div
      onMouseDown={handleMouseDown}
      style={{
        [isHorizontal() ? "width" : "height"]: "5px",
        [isHorizontal() ? "min-width" : "min-height"]: "5px",
        cursor: isHorizontal() ? "col-resize" : "row-resize",
        background: "transparent",
        position: "relative",
        "flex-shrink": "0",
        "z-index": "10",
      }}
    >
      {/* Visible line on hover */}
      <div
        style={{
          position: "absolute",
          [isHorizontal() ? "width" : "height"]: "2px",
          [isHorizontal() ? "top" : "left"]: "0",
          [isHorizontal() ? "bottom" : "right"]: "0",
          [isHorizontal() ? "left" : "top"]: "50%",
          transform: isHorizontal() ? "translateX(-50%)" : "translateY(-50%)",
          "background-color": "var(--border-weak-base, #e0e0e0)",
          transition: "background-color 0.15s",
        }}
        class="drag-line"
      />
      <style>{`
        div:hover > .drag-line,
        div:active > .drag-line {
          background-color: var(--icon-brand-base, #4a90d9) !important;
        }
      `}</style>
    </div>
  )
}

export default function PaperSession() {
  const params = useParams()
  const navigate = useNavigate()
  const layout = useLayout()
  const sync = useSync()
  const sdk = useSDK()
  const file = useFile()
  const prompt = usePrompt()
  const comments = useComments()
  const language = useLanguage()
  const isDesktop = createMediaQuery("(min-width: 768px)")
  const command = useCommand()
  const server = useServer()
  const platform = usePlatform()
  const dialog = useDialog()
  const providers = useProviders()
  const globalSync = useGlobalSync()

  // Utility: project directory from route params
  const projectDirectory = createMemo(() => decode64(params.dir) ?? "")
  const projectName = createMemo(() => {
    const dir = projectDirectory()
    if (!dir) return "Paper"
    return dir.split("/").filter(Boolean).pop() || "Paper"
  })
  const sessionKey = createMemo(() => `${params.dir}${params.id ? "/" + params.id : ""}`)
  const view = createMemo(() => layout.view(sessionKey))

  // All sessions for this project (for the session switcher in the chat header)
  const [projectStore] = globalSync.child(projectDirectory(), { bootstrap: false })
  const projectSessions = createMemo(() => sortedRootSessions(projectStore, Date.now()))
  const currentSessionTitle = createMemo(() => {
    const s = projectSessions().find((s) => s.id === params.id)
    return s?.title || "New session"
  })

  // Menu bar state
  const [viewMode, setViewMode] = createSignal<ViewMode>("split")
  const [pdfScale, setPdfScale] = createSignal(1)
  let editorViewRef: EditorView | undefined

  // Project action dialogs
  const [showSubmitDialog, setShowSubmitDialog] = createSignal(false)
  const [showRenameDialog, setShowRenameDialog] = createSignal(false)
  const [renameValue, setRenameValue] = createSignal("")
  const [showCopyDialog, setShowCopyDialog] = createSignal(false)
  const [copyName, setCopyName] = createSignal("")
  const [projectActionBusy, setProjectActionBusy] = createSignal(false)
  const [fileTreeRefreshing, setFileTreeRefreshing] = createSignal(false)
  let fileTreeRefreshTimer: number | undefined
  let fileTreeRefreshInFlight = false
  let fileTreeRefreshQueued = false

  // Helpers
  const serverBaseUrl = createMemo(() => {
    const current = server.current?.http?.url?.trim()
    return (current ? current.replace(/\/+$/, "") : "http://127.0.0.1:4096")
  })

  const writeUrl = () =>
    `${serverBaseUrl()}/file?directory=${encodeURIComponent((sdk as any).directory || projectDirectory())}`

  /** Collect all flat text+binary files from the loaded tree */
  const collectAllFiles = () => {
    const results: { path: string; content: string; isBinary: boolean }[] = []
    const walk = (files: typeof state.files) => {
      for (const f of files) {
        if (f.type === "file") {
          results.push({ path: f.path, content: f.content || "", isBinary: /\.(png|jpg|jpeg|gif|eps|pdf|docx|tiff)$/i.test(f.path) })
        } else if (f.children) {
          walk(f.children)
        }
      }
    }
    walk(state.files)
    return results
  }

  /** Build and download a .zip of all project files */
  const handleDownloadSource = async () => {
    const files = collectAllFiles()
    const entries = files.map((f) => ({
      name: f.path,
      data: f.isBinary && f.content.startsWith("data:")
        ? dataUrlToBytes(f.content)
        : new TextEncoder().encode(f.content),
    }))
    const blob = buildZip(entries)
    downloadBlob(blob, projectName() + ".zip")
  }

  /** Copy project to a new directory */
  const handleMakeCopy = async (newName: string) => {
    if (!newName.trim()) return
    setProjectActionBusy(true)
    try {
      const dir = projectDirectory()
      const parentDir = dir.split("/").slice(0, -1).join("/")
      const destDir = `${parentDir}/${newName.trim()}`
      const files = collectAllFiles()
      // Write all files to the new path
      for (const f of files) {
        const newPath = f.path.replace(dir, destDir)
        const body: Record<string, string> = { path: newPath, content: f.content }
        if (f.isBinary) body.encoding = "base64"
        await fetch(writeUrl(), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        })
      }
      showToast({ variant: "success", title: "Project copied", description: `Copied to ${destDir}` })
      setShowCopyDialog(false)
    } catch (e: any) {
      showToast({ variant: "error", title: "Copy failed", description: e.message })
    } finally {
      setProjectActionBusy(false)
    }
  }

  /** Rename project directory (uses backend shell via session) */
  const handleRename = async (newName: string) => {
    if (!newName.trim() || newName.trim() === projectName()) return
    setProjectActionBusy(true)
    try {
      const dir = projectDirectory()
      const parentDir = dir.split("/").slice(0, -1).join("/")
      const destDir = `${parentDir}/${newName.trim()}`
      // Execute mv via the session shell endpoint
      const res = await fetch(`${serverBaseUrl()}/session/${params.id}/run`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ command: `mv "${dir}" "${destDir}"` }),
      })
      if (res.ok) {
        showToast({ variant: "success", title: "Renamed", description: `Project renamed to ${newName.trim()}` })
        // Navigate to the new path
        const newDirEncoded = btoa(destDir)
        navigate(`/${newDirEncoded}/session/${params.id ?? ""}`)
      } else {
        throw new Error(`Server returned ${res.status}`)
      }
      setShowRenameDialog(false)
    } catch (e: any) {
      showToast({ variant: "error", title: "Rename failed", description: e.message })
    } finally {
      setProjectActionBusy(false)
    }
  }

  const copyPath = () => {
    const directory = projectDirectory()
    if (!directory) return
    navigator.clipboard
      .writeText(directory)
      .then(() => {
        showToast({
          variant: "success",
          icon: "circle-check",
          title: language.t("session.share.copy.copied"),
          description: directory,
        })
      })
      .catch((err: unknown) => {
        showToast({
          variant: "error",
          title: "Copy failed",
          description: err instanceof Error ? err.message : String(err),
        })
      })
  }

  // Panel widths
  const [widths, setWidths] = createStore<PanelWidths>(loadWidths())
  createEffect(() => saveWidths({ ...widths }))

  // Collapsed state (below auto-collapse threshold)
  const [fileTreeCollapsed, setFileTreeCollapsed] = createSignal(false)
  const [editorCollapsed, setEditorCollapsed] = createSignal(false)
  const [pdfCollapsed, setPdfCollapsed] = createSignal(false)

  // Saved widths for restore after collapse
  let savedFileTreeWidth = widths.fileTree
  let savedEditorWidth = widths.editor
  let savedChatWidth = widths.chat

  // Direct DOM refs — manipulated during drag to avoid reactive overhead
  let fileTreePanelRef: HTMLDivElement | undefined
  let editorPanelRef: HTMLDivElement | undefined
  let previewPanelRef: HTMLDivElement | undefined
  let chatPanelRef: HTMLDivElement | undefined

  // Auto-collapse thresholds (px)
  const FILETREE_SNAP = 80
  const EDITOR_SNAP = 130
  const CHAT_SNAP = 160
  const PDF_SNAP = 80

  // Paper state
  const [state, setState] = createStore({
    activeFile: "",
    editorContent: "",
    pdfData: undefined as string | undefined,
    pdfSourceType: undefined as "compiled" | "file" | undefined,
    pdfSourcePath: undefined as string | undefined,
    compiling: false,
    compilationError: undefined as string | undefined,
    compilationTime: undefined as number | undefined,
    compilationLog: undefined as string | undefined,
    chatCollapsed: false,
    files: [] as PaperFile[],
    filesLoaded: false,
  })

  // Helper: get image data URL for the currently active image file
  const activeImageData = createMemo(() => {
    if (!isImageFile(state.activeFile)) return ""
    // Search in flat files
    const flat = state.files.find((f) => f.path === state.activeFile)
    if (flat?.content?.startsWith("data:")) return flat.content
    // Search in folder children
    for (const f of state.files) {
      if (f.type === "folder" && f.children) {
        const child = f.children.find((c) => c.path === state.activeFile)
        if (child?.content?.startsWith("data:")) return child.content
      }
    }
    return state.editorContent?.startsWith("data:") ? state.editorContent : ""
  })

  // Chat state
  const composer = createSessionComposerState()


  const messages = createMemo(() => (params.id ? (sync.data.message[params.id] ?? []) : []))
  const messagesReady = createMemo(() => {
    const id = params.id
    if (!id) return true
    return sync.data.message[id] !== undefined
  })

  const emptyUserMessages: UserMessage[] = []
  const userMessages = createMemo(
    () => messages().filter((m) => m.role === "user") as UserMessage[],
    emptyUserMessages,
    { equals: same },
  )
  const lastUserMessage = createMemo(() => userMessages().at(-1))
  const renderedUserMessages = createMemo(() => userMessages(), emptyUserMessages, { equals: same })

  // Auto-scroll for chat
  const autoScroll = createAutoScroll({
    working: () => true,
    overflowAnchor: "dynamic",
  })
  const chatScrollStorageKey = createMemo(() => {
    const id = params.id
    if (!id) return undefined
    return `${CHAT_SCROLL_KEY_PREFIX}:${projectDirectory()}:${id}`
  })

  const [chatScroller, setChatScroller] = createSignal<HTMLDivElement | undefined>()
  let chatContent: HTMLDivElement | undefined
  let inputRef!: HTMLDivElement
  let promptDock: HTMLDivElement | undefined
  let restoredChatScrollKey: string | undefined
  let restoredChatScrollTarget: HTMLDivElement | undefined
  let persistChatScrollRaf: number | undefined
  let restoreChatScrollRaf: number | undefined
  let restoreChatScrollToken = 0

  const parseStoredScroll = (raw: string | null): number | undefined => {
    if (raw === null) return undefined
    const value = Number(raw)
    if (!Number.isFinite(value)) return undefined
    return Math.max(0, value)
  }

  const readStoredChatScroll = (key: string): number | undefined => {
    try {
      const sessionValue = parseStoredScroll(sessionStorage.getItem(key))
      if (sessionValue !== undefined) return sessionValue
    } catch {}
    try {
      return parseStoredScroll(localStorage.getItem(key))
    } catch {}
    return undefined
  }

  const persistChatScroll = () => {
    const key = chatScrollStorageKey()
    const scroller = chatScroller()
    if (!key || !scroller) return
    const value = String(Math.max(0, scroller.scrollTop))
    try {
      sessionStorage.setItem(key, value)
    } catch {}
    try {
      localStorage.setItem(key, value)
    } catch {}
  }

  const schedulePersistChatScroll = () => {
    if (persistChatScrollRaf !== undefined) cancelAnimationFrame(persistChatScrollRaf)
    persistChatScrollRaf = requestAnimationFrame(() => {
      persistChatScrollRaf = undefined
      persistChatScroll()
    })
  }

  const setChatScrollRef = (el: HTMLDivElement | undefined) => {
    setChatScroller(el)
    autoScroll.scrollRef(el)
  }

  createEffect(() => {
    const key = chatScrollStorageKey()
    const ready = messagesReady()
    const scroller = chatScroller()
    if (!key || !ready || !scroller) return
    if (restoredChatScrollKey === key && restoredChatScrollTarget === scroller) return
    if (restoreChatScrollRaf !== undefined) cancelAnimationFrame(restoreChatScrollRaf)
    const token = ++restoreChatScrollToken
    const targetScroll = readStoredChatScroll(key)

    const attemptRestore = (remaining: number) => {
      restoreChatScrollRaf = requestAnimationFrame(() => {
        if (token !== restoreChatScrollToken) return
        const activeScroller = chatScroller()
        if (!activeScroller) return

        if (targetScroll !== undefined) {
          const maxY = Math.max(0, activeScroller.scrollHeight - activeScroller.clientHeight)
          const next = Math.min(targetScroll, maxY)
          if (Math.abs(activeScroller.scrollTop - next) > 0.5) {
            activeScroller.scrollTop = next
            autoScroll.handleScroll()
          }

          const reached = targetScroll <= maxY + 1 || Math.abs(activeScroller.scrollTop - targetScroll) <= 1
          if (!reached && remaining > 0) {
            attemptRestore(remaining - 1)
            return
          }
        }

        restoredChatScrollKey = key
        restoredChatScrollTarget = activeScroller
      })
    }

    attemptRestore(30)
  })

  const anchor = (id: string) => `message-${id}`

  // Sync session
  createEffect(() => {
    sdk.directory
    const id = params.id
    if (!id) return
    void sync.session.sync(id)
  })

  // Pre-warm the Siglum WASM compiler on mount
  onMount(() => {
    prewarmCompiler()
    // Collapse the sidebar panel — not needed in paper mode (session switcher is in chat header)
    layout.sidebar.close()

    // Global keyboard shortcuts for view mode (⌃⌘← ⌃⌘→ ⌃⌘↓)
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.metaKey) {
        if (e.key === "ArrowLeft")  { e.preventDefault(); setViewMode("editor") }
        if (e.key === "ArrowRight") { e.preventDefault(); setViewMode("pdf") }
        if (e.key === "ArrowDown")  { e.preventDefault(); setViewMode("split") }
      }
      // ⌘B / ⌘I — forward to editor via Format menu logic
      if (e.metaKey && !e.shiftKey && !e.ctrlKey) {
        const ev = editorViewRef
        if (!ev) return
        if (e.key === "b") { e.preventDefault(); const {from,to}=ev.state.selection.main; const sel=ev.state.sliceDoc(from,to)||"text"; ev.dispatch({changes:{from,to,insert:`\\textbf{${sel}}`},selection:{anchor:from+8,head:from+8+sel.length}}); ev.focus() }
        if (e.key === "i") { e.preventDefault(); const {from,to}=ev.state.selection.main; const sel=ev.state.sliceDoc(from,to)||"text"; ev.dispatch({changes:{from,to,insert:`\\textit{${sel}}`},selection:{anchor:from+8,head:from+8+sel.length}}); ev.focus() }
      }
    }
    window.addEventListener("keydown", handleKeyDown)
    const handleBeforeUnload = () => {
      persistChatScroll()
    }
    window.addEventListener("beforeunload", handleBeforeUnload)
    onCleanup(() => {
      persistChatScroll()
      window.removeEventListener("keydown", handleKeyDown)
      window.removeEventListener("beforeunload", handleBeforeUnload)
      if (persistChatScrollRaf !== undefined) cancelAnimationFrame(persistChatScrollRaf)
      if (restoreChatScrollRaf !== undefined) cancelAnimationFrame(restoreChatScrollRaf)
      restoreChatScrollToken++
    })
  })

  // ─── Load real project files from SDK ──────────────────────────────────
  const loadProjectFiles = async (dirPath: string) => {
    try {
      const result = await sdk.client.file.list({ path: dirPath })
      const nodes = result.data ?? []
      const paperFiles: PaperFile[] = []

      for (const node of nodes) {
        if (node.ignored) continue
        if (node.type === "file" && shouldHidePaperTreeNode(node.name)) continue
        if (node.type === "directory") {
          paperFiles.push({
            name: node.name,
            path: node.path,
            type: "folder" as const,
            children: [],
          })
        } else {
          paperFiles.push({
            name: node.name,
            path: node.path,
            type: "file" as const,
            content: "",
          })
        }
      }
      return paperFiles
    } catch (e) {
      console.error("Failed to list project files:", e)
      return []
    }
  }

  // Load directory children for expanding folders
  const loadDirChildren = async (dirPath: string): Promise<PaperFile[]> => {
    const files = await loadProjectFiles(dirPath)
    return files
  }

  // Recursive file loading: load top-level, then expand directories one level
  const loadFilesRecursive = async (options?: { preserveSelection?: boolean }) => {
    const preserveSelection = options?.preserveSelection ?? false
    if (fileTreeRefreshInFlight) {
      fileTreeRefreshQueued = true
      return
    }
    fileTreeRefreshInFlight = true
    setFileTreeRefreshing(true)
    try {
      const topLevel = await loadProjectFiles("")
      if (topLevel.length === 0) {
        setState("files", [])
        setState("filesLoaded", true)
        return
      }

      // Recursively load ALL directory levels (supports figs/, doc/figs/, etc.)
      const loadAllChildren = async (files: PaperFile[], depth = 0): Promise<void> => {
        if (depth > 5) return // Safety: max 5 levels deep
        for (const f of files) {
          if (f.type === "folder") {
            f.children = await loadDirChildren(f.path)
            if (f.children.length > 0) {
              await loadAllChildren(f.children, depth + 1)
            }
          }
        }
      }
      await loadAllChildren(topLevel)

      setState("files", topLevel)
      setState("filesLoaded", true)

      const flatFiles = flattenTreeFiles(topLevel)
      const activeInTree = state.activeFile ? flatFiles.find((f) => f.path === state.activeFile) : undefined
      const firstTex = flatFiles.find((f) => f.path.endsWith(".tex"))
      const fallback = firstTex ?? flatFiles[0]
      const nextActiveFile = preserveSelection && activeInTree ? activeInTree.path : fallback?.path

      if (nextActiveFile && nextActiveFile !== state.activeFile) {
        setState("activeFile", nextActiveFile)
        try {
          const res = await sdk.client.file.read({ path: nextActiveFile })
          if (res.data?.content) {
            let content = res.data.content
            if (isImageFile(nextActiveFile) && (res.data as any).encoding === "base64") {
              const mimeType = (res.data as any).mimeType || `image/${nextActiveFile.split(".").pop()?.toLowerCase() || "png"}`
              content = `data:${mimeType};base64,${res.data.content}`
            }
            setState("editorContent", content)
          }
        } catch {}
      }
    } finally {
      fileTreeRefreshInFlight = false
      if (fileTreeRefreshQueued) {
        fileTreeRefreshQueued = false
        void loadFilesRecursive({ preserveSelection: true })
      } else {
        setFileTreeRefreshing(false)
      }
    }
  }

  const queueFileTreeRefresh = (delayMs = 220) => {
    if (fileTreeRefreshTimer !== undefined) window.clearTimeout(fileTreeRefreshTimer)
    fileTreeRefreshTimer = window.setTimeout(() => {
      void loadFilesRecursive({ preserveSelection: true })
    }, delayMs)
  }

  const handleRefreshFiles = () => {
    void loadFilesRecursive({ preserveSelection: true })
  }

  createEffect(
    on(
      () => sdk.directory,
      (next, prev) => {
        if (!next || !prev || next === prev) return
        setState("files", [])
        setState("filesLoaded", false)
      },
    ),
  )

  // Trigger file loading when SDK directory is available
  createEffect(() => {
    const dir = sdk.directory
    if (!dir) return
    if (state.filesLoaded) return
    void loadFilesRecursive()
  })

  onMount(() => {
    const stopWatcher = sdk.event.listen((event) => {
      const details = (event as any).details as { type?: string; properties?: unknown } | undefined
      if (!details || details.type !== "file.watcher.updated") return
      const props =
        details.properties && typeof details.properties === "object"
          ? (details.properties as Record<string, unknown>)
          : undefined
      const kind = typeof props?.event === "string" ? props.event : undefined
      if (kind === "add" || kind === "unlink" || kind === "change") {
        queueFileTreeRefresh(180)
      }
    })
    onCleanup(stopWatcher)
    onCleanup(() => {
      if (fileTreeRefreshTimer !== undefined) window.clearTimeout(fileTreeRefreshTimer)
    })
  })

  // ─── Chat → Editor/Preview sync ──────────────────────────────────────
  // Track which tool call IDs we've already synced to avoid duplicates
  const syncedToolCalls = new Set<string>()

  // Helper: add or update a file in the paper file tree, optionally open in editor
  const syncFileToTree = (relativePath: string, content: string) => {
    const fileName = relativePath.split("/").pop() || relativePath
    const existingIdx = state.files.findIndex((f) => f.path === relativePath || f.name === fileName)
    if (existingIdx >= 0) {
      setState("files", existingIdx, "content", content)
      // Only update path if the new relativePath is shorter (more relative) — don't overwrite short relative with full absolute
      if (relativePath.length <= (state.files[existingIdx]?.path?.length ?? Infinity)) {
        setState("files", existingIdx, "path", relativePath)
      }
    } else {
      setState("files", (files) => [
        ...files,
        { name: fileName, path: relativePath, type: "file" as const, content },
      ])
    }
    // Auto-open .tex files in editor
    if (relativePath.endsWith(".tex")) {
      setState("activeFile", relativePath)
      setState("editorContent", content)
    }
  }

  // Helper: fetch file content from disk via SDK read endpoint
  const fetchFileContent = async (filePath: string): Promise<string | null> => {
    try {
      const res = await fetch(`/api/file/read?path=${encodeURIComponent(filePath)}`)
      if (res.ok) {
        const data = await res.json()
        return data.content || null
      }
    } catch {}
    return null
  }

  // Reactive watcher: scan all parts of the current session for completed write/compile/image tools
  createEffect(() => {
    const sessionId = params.id
    if (!sessionId) return
    const allMessages = sync.data.message[sessionId] ?? []

    for (const msg of allMessages) {
      if (msg.role !== "assistant") continue
      const parts = sync.data.part[msg.id] ?? []

      for (const part of parts) {
        if (part.type !== "tool") continue
        const toolPart = part as any
        const toolState = toolPart.state
        if (!toolState || toolState.status !== "completed") continue
        if (syncedToolCalls.has(toolPart.callID || toolPart.id)) continue

        const toolName = toolPart.tool as string
        const input = toolState.input as Record<string, unknown>
        const metadata = (toolState.metadata || {}) as Record<string, unknown>

        // ── Write tool: update file tree + editor ──
        if (toolName === "write" || toolName === "edit") {
          const filePath = String(input.filePath || input.file_path || metadata.filepath || "")
          const rawPath = toolState.title || filePath

          // Normalize to a relative path by stripping sdk.directory prefix
          const dir = sdk.directory || ""
          let relativePath = rawPath
          if (dir && relativePath.startsWith(dir)) {
            relativePath = relativePath.slice(dir.length).replace(/^\/+/, "")
          }
          // Also handle paths missing the leading slash (e.g. "Users/me/project/main.tex")
          const dirNoLeadingSlash = dir.replace(/^\//, "")
          if (dirNoLeadingSlash && relativePath.startsWith(dirNoLeadingSlash)) {
            relativePath = relativePath.slice(dirNoLeadingSlash.length).replace(/^\/+/, "")
          }
          // If still absolute or empty, fall back to basename only
          if (!relativePath || relativePath.startsWith("/")) {
            relativePath = filePath.split("/").pop() || filePath
          }

          const content = input.content != null ? String(input.content) : null

          if (relativePath) {
            syncedToolCalls.add(toolPart.callID || toolPart.id)
            if (content) {
              syncFileToTree(relativePath, content)
            } else {
              // Content not in event (truncated) — fetch from disk
              void (async () => {
                const diskContent = await fetchFileContent(filePath)
                if (diskContent) {
                  syncFileToTree(relativePath, diskContent)
                } else {
                  // File exists on disk but content unavailable — add to tree without placeholder
                  const fileName = relativePath.split("/").pop() || relativePath
                  const existingIdx = state.files.findIndex((f) => f.path === relativePath || f.name === fileName)
                  if (existingIdx < 0) {
                    setState("files", (files) => [
                      ...files,
                      { name: fileName, path: relativePath, type: "file" as const, content: "" },
                    ])
                  }
                  if (relativePath.endsWith(".tex")) {
                    setState("activeFile", relativePath)
                  }
                }
              })()
            }
          }
        }

        // ── latex_compile tool: update PDF preview ──
        if (toolName === "latex_compile") {
          syncedToolCalls.add(toolPart.callID || toolPart.id)
          const pdfData = metadata.pdfData as string | undefined
          const compilationTime = metadata.compilationTime as number | undefined
          const success = metadata.success as boolean | undefined
          const log = metadata.log as string | undefined

          if (pdfData) {
            setState("pdfData", pdfData)
            setState("pdfSourceType", "compiled")
            setState("pdfSourcePath", String(metadata.mainFile || state.activeFile || ""))
            setState("compilationError", undefined)
          } else if (success === false) {
            setState("compilationError", toolState.output || "Compilation failed")
          }
          if (compilationTime) {
            setState("compilationTime", compilationTime)
          }
          if (log) {
            setState("compilationLog", log)
          }
        }

        // ── image_generate tool: add image to file tree ──
        if (toolName === "image_generate") {
          syncedToolCalls.add(toolPart.callID || toolPart.id)
          const imagePath = metadata.imagePath as string | undefined
          if (imagePath) {
            const fileName = imagePath.split("/").pop() || "generated-image.png"
            const existingIdx = state.files.findIndex((f) => f.name === fileName)
            if (existingIdx < 0) {
              setState("files", (files) => [
                ...files,
                { name: fileName, path: `figures/${fileName}`, type: "file" as const, content: "" },
              ])
            }
          }
        }
      }
    }
  })

  // Helper: detect if active file is a DOCX
  const isActiveDocx = () => state.activeFile.endsWith(".docx")

  // Handle DOCX → LaTeX conversion
  const handleConvertToLatex = async () => {
    const docxFile = state.files.find((f) => f.path === state.activeFile)
    if (!docxFile?.content) {
      showToast({ variant: "error", title: "No DOCX content", description: "Load the file first" })
      return
    }
    setState("compiling", true)
    try {
      const base64 = docxFile.content.startsWith("data:")
        ? docxFile.content.replace(/^data:[^;]+;base64,/, "")
        : docxFile.content
      const latex = await convertDocxToLatex(base64)
      const texName = state.activeFile.replace(/\.docx$/i, ".tex")
      syncFileToTree(texName, latex)
      setState("activeFile", texName)
      setState("editorContent", latex)
      showToast({ variant: "success", title: "Converted to LaTeX", description: texName })
    } catch (e: any) {
      showToast({ variant: "error", title: "Conversion failed", description: e.message || "Unknown error" })
    } finally {
      setState("compiling", false)
    }
  }

  // ─── Auto-fix common LaTeX errors ────────────────────────────────────────
  // Returns { fixed: string; message: string } if a fix was applied, else null.
  const tryAutoFix = (errorMsg: string, content: string): { fixed: string; message: string } | null => {
    // Fix: "Option clash for package hyperref"
    // Cause: document class already loads hyperref with one option set,
    //        then \usepackage[...]{hyperref} tries to load it again with different options.
    // Fix:   Replace all \usepackage[...]{hyperref} with \hypersetup{...},
    //        and remove bare \usepackage{hyperref}.
    if (/option clash for package hyperref/i.test(errorMsg)) {
      const lines = content.split("\n")
      let firstHyperref = false // track whether the class already loads it (always true for CAS templates)
      let changed = false
      const result = lines.map((line) => {
        const trimmed = line.trim()
        const indent = line.match(/^(\s*)/)?.[1] ?? ""
        // Match \usepackage[opts]{hyperref} or \usepackage{hyperref}
        const withOpts = trimmed.match(/^\\usepackage\[([^\]]+)\]\{hyperref\}/)
        const bare = /^\\usepackage\{hyperref\}/.test(trimmed)
        if (withOpts) {
          changed = true
          firstHyperref = true
          // Convert to \hypersetup so it works after the class has loaded hyperref
          return `${indent}\\hypersetup{${withOpts[1]}} % auto-fixed: option clash`
        }
        if (bare && firstHyperref) {
          changed = true
          return `${indent}% \\usepackage{hyperref} % auto-fixed: duplicate removed`
        }
        if (bare) {
          firstHyperref = true
        }
        return line
      })
      if (changed) {
        return {
          fixed: result.join("\n"),
          message: "Auto-fixed: replaced duplicate \\usepackage{hyperref} with \\hypersetup",
        }
      }
    }

    // Fix: acmart/newtxmath already defines \Bbbk, explicit amssymb can conflict.
    if (/command\s+[`'"]?\\Bbbk[`'"]?\s+already defined/i.test(errorMsg)) {
      const lines = content.split("\n")
      let changed = false
      const result = lines.map((line) => {
        const trimmed = line.trim()
        const indent = line.match(/^(\s*)/)?.[1] ?? ""

        if (/^\\usepackage\{amsmath,amssymb\}\s*$/i.test(trimmed)) {
          changed = true
          return `${indent}\\usepackage{amsmath} % auto-fixed: remove amssymb conflict with acmart`
        }
        if (/^\\usepackage(?:\[[^\]]*\])?\{amssymb\}\s*$/i.test(trimmed)) {
          changed = true
          return `${indent}% ${trimmed} % auto-fixed: removed due to acmart conflict`
        }
        return line
      })
      if (changed) {
        return {
          fixed: result.join("\n"),
          message: "Auto-fixed: removed amssymb conflict (\\Bbbk already defined)",
        }
      }
    }

    // Fix: \xspace used in custom commands but package missing.
    if (/undefined control sequence/i.test(errorMsg) && /\\xspace/.test(errorMsg) && !/\\usepackage(?:\[[^\]]*\])?\{xspace\}/i.test(content)) {
      const insertion = "\\usepackage{xspace} % auto-fixed: required by \\xspace commands\n\n\\begin{document}"
      const fixed = content.replace(/\\begin\{document\}/, insertion)
      if (fixed !== content) {
        return {
          fixed,
          message: "Auto-fixed: added \\usepackage{xspace}",
        }
      }
    }

    return null
  }

  // Write patched content to disk so compile-dir picks it up
  const writePatchedFile = async (filePath: string, content: string): Promise<void> => {
    try {
      const res = await fetch(writeUrl(), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: filePath, content }),
      })
      if (res.ok) queueFileTreeRefresh(80)
    } catch {}
  }

  // Handle compile
  const handleCompile = async () => {
    setState("compiling", true)
    setState("compilationError", undefined)
    setState("compilationTime", undefined)

    try {
      // DOCX compile path
      if (isActiveDocx()) {
        const docxFile = state.files.find((f) => f.path === state.activeFile)
        if (docxFile?.content) {
          const base64 = docxFile.content.startsWith("data:")
            ? docxFile.content.replace(/^data:[^;]+;base64,/, "")
            : docxFile.content
          const result = await compileDocx(base64)
          setState("compilationTime", result.compilationTime)
          setState("compilationLog", result.log ?? "")
          if (result.pdfDataUrl) {
            setState("pdfData", result.pdfDataUrl)
            setState("pdfSourceType", "compiled")
            setState("pdfSourcePath", state.activeFile)
          }
          if (result.success) {
            setState("compilationError", undefined)
          } else if (!result.pdfDataUrl) {
            setState("compilationError", result.error || "DOCX compilation failed")
          } else {
            setState("compilationError", result.error || "DOCX conversion has issues, showing generated PDF.")
          }
        } else {
          setState("compilationError", "No DOCX content loaded")
        }
        return
      }

      // Determine the main .tex file to compile.
      // Priority: (1) selected/active .tex file, (2) main.tex, (3) any .tex
      const findMainTex = (): string => {
        if (state.activeFile.endsWith(".tex")) return state.activeFile
        const allTex: string[] = []
        const walkTex = (files: typeof state.files) => {
          for (const f of files) {
            if (f.type === "file" && f.name.endsWith(".tex")) allTex.push(f.path)
            else if (f.children) walkTex(f.children)
          }
        }
        walkTex(state.files)
        return allTex.find((p) => p.split("/").pop() === "main.tex") ?? allTex[0] ?? state.activeFile
      }
      const mainTexFile = findMainTex()

      // Guard: must have a valid .tex file to compile
      if (!mainTexFile || !mainTexFile.endsWith(".tex")) {
        setState("compilationError", "No .tex file found. Create a LaTeX file first.")
        return
      }

      // Recursively collect ALL file nodes (path + cached content) from the tree
      const dir = projectDirectory()
      const dirPrefix = dir.endsWith("/") ? dir : dir + "/"
      const dirPrefixNoSlash = dirPrefix.replace(/^\//, "")   // e.g. "Users/danieltang/.../pst1/"

      // Normalize a stored path (which may be absolute or pseudo-absolute) to a relative path
      const toRelPath = (p: string): string => {
        if (p.startsWith(dirPrefix)) return p.slice(dirPrefix.length)
        if (p.startsWith(dirPrefixNoSlash)) return p.slice(dirPrefixNoSlash.length)
        return p
      }

      type FileNode = { path: string; content: string | undefined }
      const fileNodes: FileNode[] = []
      const walkNodes = (files: typeof state.files) => {
        for (const f of files) {
          if (f.type === "file") {
            fileNodes.push({ path: toRelPath(f.path), content: f.content || undefined })
          } else if (f.children) {
            walkNodes(f.children)
          }
        }
      }
      walkNodes(state.files)

      // Eagerly load content for any file not yet opened in the editor.
      // Files not clicked in the file tree have content: "" — we must read them
      // from the backend so that .sty, .bst, .bib etc. are actually sent to the compiler.
      await Promise.all(
        fileNodes
          .filter((node) => !node.content)
          .map(async (node) => {
            try {
              const res = await sdk.client.file.read({ path: node.path })
              if (res.data?.content) {
                let content = res.data.content
                if (isImageFile(node.path) && (res.data as any).encoding === "base64") {
                  const mime =
                    (res.data as any).mimeType ||
                    `image/${node.path.split(".").pop()?.toLowerCase() || "png"}`
                  content = `data:${mime};base64,${content}`
                }
                node.content = content
              }
            } catch {}
          }),
      )

      // Build ProjectFile array with relative paths for the compiler
      // Exclude binary PDF files from the upload payload — they aren't needed by LaTeX
      const allFiles: ProjectFile[] = fileNodes
        .filter((node) => !isPdfFile(node.path))
        .map((node) => ({
          path: node.path,
          content: node.content || "",
          isBinary: /\.(png|jpg|jpeg|gif|eps|docx|tiff)$/i.test(node.path),
        }))

      // Compute relative path of the main tex file to compile
      const mainRel = toRelPath(mainTexFile)

      // If preview currently points to another file (or to a manually opened PDF file),
      // clear it so compile failures never show an unrelated document.
      const currentPdfSourceRel = state.pdfSourcePath ? toRelPath(state.pdfSourcePath) : ""
      if (
        state.pdfSourceType === "file" ||
        (state.pdfSourceType === "compiled" && currentPdfSourceRel && currentPdfSourceRel !== mainRel)
      ) {
        setState("pdfData", undefined)
        setState("pdfSourceType", undefined)
        setState("pdfSourcePath", undefined)
      }

      // If active file is a .tex, write current editor content to disk first
      if (state.activeFile.endsWith(".tex") && state.editorContent) {
        await writePatchedFile(toRelPath(state.activeFile), state.editorContent)
        // Inject into allFiles for the upload fallback (inject into the active file slot)
        const activeRelPath = toRelPath(state.activeFile)
        const activeIdx = allFiles.findIndex((f) => f.path === activeRelPath)
        if (activeIdx >= 0) allFiles[activeIdx].content = state.editorContent
        else allFiles.push({ path: activeRelPath, content: state.editorContent, isBinary: false })
      }

      // Pass project directory so backend can read files directly (no upload needed)
      const result = await compileLatex(mainRel, allFiles, dir, serverBaseUrl())
      setState("compilationTime", result.compilationTime)
      setState("compilationLog", result.log ?? "")

      if (result.pdfDataUrl) {
        setState("pdfData", result.pdfDataUrl)
        setState("pdfSourceType", "compiled")
        setState("pdfSourcePath", mainRel)
      }

      if (result.success) {
        setState("compilationError", undefined)
      } else if (result.pdfDataUrl) {
        setState("compilationError", result.error || "Compilation has errors, showing generated PDF.")
      } else {
        // Try auto-fix for known fixable errors, then retry once
        const errorMsg = result.error || result.log || ""
        const fix = tryAutoFix(errorMsg, state.editorContent)
        if (fix) {
          // Apply fix to editor and disk, then recompile
          setState("editorContent", fix.fixed)
          syncFileToTree(mainRel, fix.fixed)
          await writePatchedFile(mainRel, fix.fixed)

          // Update allFiles with fixed content so fallback upload path also works
          const retryIdx = allFiles.findIndex((f) => f.path === mainRel)
          if (retryIdx >= 0) allFiles[retryIdx].content = fix.fixed
          else allFiles.push({ path: mainRel, content: fix.fixed, isBinary: false })

          const retryResult = await compileLatex(mainRel, allFiles, dir, serverBaseUrl())
          setState("compilationTime", retryResult.compilationTime)
          setState("compilationLog", retryResult.log ?? "")

          if (retryResult.pdfDataUrl) {
            setState("pdfData", retryResult.pdfDataUrl)
            setState("pdfSourceType", "compiled")
            setState("pdfSourcePath", mainRel)
          }

          if (retryResult.success) {
            setState("compilationError", undefined)
            if (retryResult.pdfDataUrl) {
              showToast({ variant: "success", icon: "circle-check", title: fix.message })
            }
          } else if (retryResult.pdfDataUrl) {
            setState("compilationError", retryResult.error || "Compilation has errors, showing generated PDF.")
          } else {
            // Try one more pass for chained common errors
            const secondFix = tryAutoFix(retryResult.error || retryResult.log || "", fix.fixed)
            if (secondFix) {
              setState("editorContent", secondFix.fixed)
              syncFileToTree(mainRel, secondFix.fixed)
              await writePatchedFile(mainRel, secondFix.fixed)

              const finalIdx = allFiles.findIndex((f) => f.path === mainRel)
              if (finalIdx >= 0) allFiles[finalIdx].content = secondFix.fixed
              else allFiles.push({ path: mainRel, content: secondFix.fixed, isBinary: false })

              const finalResult = await compileLatex(mainRel, allFiles, dir, serverBaseUrl())
              setState("compilationTime", finalResult.compilationTime)
              setState("compilationLog", finalResult.log ?? "")

              if (finalResult.pdfDataUrl) {
                setState("pdfData", finalResult.pdfDataUrl)
                setState("pdfSourceType", "compiled")
                setState("pdfSourcePath", mainRel)
              }

              if (finalResult.success) {
                setState("compilationError", undefined)
                if (finalResult.pdfDataUrl) {
                  showToast({ variant: "success", icon: "circle-check", title: secondFix.message })
                }
              } else if (finalResult.pdfDataUrl) {
                setState("compilationError", finalResult.error || "Compilation has errors, showing generated PDF.")
              } else {
                setState("compilationError", finalResult.error || "Compilation failed")
              }
            } else {
              setState("compilationError", retryResult.error || "Compilation failed")
            }
          }
        } else {
          setState("compilationError", result.error || "Compilation failed")
        }
      }
    } catch (e: any) {
      setState("compilationError", e.message || "Compilation failed")
    } finally {
      setState("compiling", false)
    }
  }

  // Fix LaTeX error with AI: fill chat with error context and auto-submit
  const handleFixError = (entry: LogEntry) => {
    const lines: string[] = ["Fix this LaTeX compilation error in my paper:"]
    lines.push("")
    lines.push(`**Error:** ${entry.message}`)
    if (entry.file) lines.push(`**File:** ${entry.file}${entry.line ? `, line ${entry.line}` : ""}`)
    if (entry.context) {
      lines.push("")
      lines.push("**Context:**")
      lines.push("```")
      lines.push(entry.context.trim())
      lines.push("```")
    }
    lines.push("")
    lines.push("Please fix the .tex file so it compiles successfully.")
    const text = lines.join("\n")
    prompt.set([{ type: "text", content: text, start: 0, end: text.length }])
    // Auto-submit after reactive update settles
    setTimeout(() => {
      document.querySelector<HTMLButtonElement>('[data-action="prompt-submit"]')?.click()
    }, 80)
  }

  // Log counts for badge display in PDF toolbar
  const parsedLogEntries = createMemo(() => parseLatexLog(state.compilationLog ?? ""))
  const logCounts = createMemo(() => countLogEntries(parsedLogEntries()))
  const undefinedCitationCount = createMemo(() => countUndefinedCitationWarnings(parsedLogEntries()))

  // Auto-compile once — wait until files AND editor content are both ready
  const [autoCompiled, setAutoCompiled] = createSignal(false)
  createEffect(() => {
    if (
      !autoCompiled() &&
      state.files.length > 0 &&
      state.activeFile &&
      state.editorContent.length > 10 && // content actually loaded
      !state.compiling
    ) {
      setAutoCompiled(true)
      void handleCompile()
    }
  })

  // Handle file selection — loads content from SDK if not yet loaded
  const handleFileSelect = async (f: PaperFile) => {
    if (f.type === "folder") {
      // Toggle folder expansion by loading children if needed
      const idx = state.files.findIndex((fl) => fl.path === f.path)
      if (idx >= 0 && (!f.children || f.children.length === 0)) {
        const children = await loadDirChildren(f.path)
        setState("files", idx, "children", children)
      }
      return
    }

    setState("activeFile", f.path)

    // Avoid stale preview mismatch:
    // - when switching away from an opened .pdf file, clear that preview
    // - when switching between different .tex files, clear preview from another source file
    if (!isPdfFile(f.path)) {
      if (state.pdfSourceType === "file") {
        setState("pdfData", undefined)
        setState("pdfSourceType", undefined)
        setState("pdfSourcePath", undefined)
      } else if (
        f.path.endsWith(".tex") &&
        state.pdfSourceType === "compiled" &&
        state.pdfSourcePath &&
        state.pdfSourcePath !== f.path
      ) {
        setState("pdfData", undefined)
        setState("pdfSourceType", undefined)
        setState("pdfSourcePath", undefined)
      }
    }

    // PDF files: load into the PDF viewer, not the text editor
    if (isPdfFile(f.path)) {
      setState("editorContent", "")
      // Use cached content if available
      const cached = f.content || state.files.find((fl) => fl.path === f.path)?.content
      if (cached && cached.startsWith("data:")) {
        setState("pdfData", cached)
        setState("pdfSourceType", "file")
        setState("pdfSourcePath", f.path)
        return
      }
      try {
        const res = await sdk.client.file.read({ path: f.path })
        if (res.data?.content) {
          const dataUrl = `data:application/pdf;base64,${res.data.content}`
          setState("pdfData", dataUrl)
          setState("pdfSourceType", "file")
          setState("pdfSourcePath", f.path)
          const idx = state.files.findIndex((fl) => fl.path === f.path)
          if (idx >= 0) setState("files", idx, "content", dataUrl)
        }
      } catch {}
      return
    }

    // If content is already loaded, use it
    if (f.content) {
      setState("editorContent", f.content)
      return
    }

    // Load content from SDK
    try {
      const res = await sdk.client.file.read({ path: f.path })
      if (res.data?.content) {
        let fileContent = res.data.content

        // Handle binary image files: backend returns base64-encoded content with encoding: "base64"
        if (isImageFile(f.path) && (res.data as any).encoding === "base64") {
          const mimeType = (res.data as any).mimeType || `image/${f.path.split(".").pop()?.toLowerCase() || "png"}`
          fileContent = `data:${mimeType};base64,${res.data.content}`
        }

        setState("editorContent", fileContent)
        // Cache content in files array
        const idx = state.files.findIndex((fl) => fl.path === f.path)
        if (idx >= 0) {
          setState("files", idx, "content", fileContent)
        }
      } else {
        setState("editorContent", `% Could not load content for ${f.path}`)
      }
    } catch (e: any) {
      setState("editorContent", `% Error loading ${f.path}: ${e.message || "unknown error"}`)
    }
  }

  // Handle editor content change
  const handleEditorChange = (content: string) => {
    setState("editorContent", content)
    const idx = state.files.findIndex((f) => f.path === state.activeFile)
    if (idx >= 0) {
      setState("files", idx, "content", content)
    }
  }

  // Create a new file in the project and refresh the tree.
  const handleFileCreate = async (parentPath: string, name: string) => {
    const trimmed = name.trim() || "untitled.tex"
    const fileName = trimmed.split("/").filter(Boolean).pop() || "untitled.tex"
    const targetPath = parentPath ? `${parentPath.replace(/\/+$/, "")}/${fileName}` : fileName
    const initialContent = fileName.endsWith(".tex") ? "% New LaTeX file\n" : ""

    try {
      const res = await fetch(writeUrl(), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: targetPath, content: initialContent }),
      })
      if (!res.ok) {
        showToast({ variant: "error", title: "Create failed", description: `Could not create ${targetPath}` })
        return
      }

      if (fileName.endsWith(".tex")) {
        setState("activeFile", targetPath)
        setState("editorContent", initialContent)
      }

      queueFileTreeRefresh(40)
      showToast({ variant: "success", icon: "circle-check", title: "File created", description: targetPath })
    } catch (e: any) {
      showToast({ variant: "error", title: "Create failed", description: e?.message || `Could not create ${targetPath}` })
    }
  }

  // ─── Handle image drop from chat to file tree ──────────────────────────
  const handleImageDrop = async (data: ImageDropData, targetFolder: string) => {
    const { src, fileName } = data

    // Extract base64 data from data URL
    const match = src.match(/^data:([^;]+);base64,(.+)$/)
    if (!match) {
      showToast({ variant: "error", title: "Invalid image data", description: "Could not parse the image data URL." })
      return
    }

    const filePath = targetFolder ? `${targetFolder}/${fileName}` : fileName

    try {
      // Write binary file via backend API
      const res = await fetch(`${serverBaseUrl()}/file?directory=${encodeURIComponent(sdk.directory || "")}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          path: filePath,
          content: match[2], // base64 data without prefix
          encoding: "base64",
        }),
      })

      if (!res.ok) {
        // Fallback: try writing via the standard file write
        // For binary files, we'll create a blob and use the Fetch API
        const byteString = atob(match[2])
        const ab = new ArrayBuffer(byteString.length)
        const ia = new Uint8Array(ab)
        for (let i = 0; i < byteString.length; i++) {
          ia[i] = byteString.charCodeAt(i)
        }
        const blob = new Blob([ab], { type: match[1] })

        // Save using download as last resort
        const a = document.createElement("a")
        a.href = URL.createObjectURL(blob)
        a.download = fileName
        a.click()
        URL.revokeObjectURL(a.href)

        showToast({
          variant: "success",
          icon: "circle-check",
          title: "Image downloaded",
          description: `Saved as ${fileName} (downloaded to your Downloads folder)`,
        })
      }
    } catch {
      // Ignore write errors — we'll add to file tree anyway
    }

    // Add to the file tree in the UI
    const existingIdx = state.files.findIndex((f) => f.path === filePath || f.name === fileName)
    if (existingIdx < 0) {
      // Check if target folder exists, create if needed
      const folderIdx = state.files.findIndex((f) => f.path === targetFolder && f.type === "folder")
      if (targetFolder && folderIdx >= 0) {
        // Add as child of folder
        const children = state.files[folderIdx].children || []
        setState("files", folderIdx, "children", [
          ...children,
          { name: fileName, path: filePath, type: "file" as const, content: src },
        ])
      } else if (targetFolder && folderIdx < 0) {
        // Create the folder and add file
        setState("files", (files) => [
          ...files,
          {
            name: targetFolder,
            path: targetFolder,
            type: "folder" as const,
            children: [{ name: fileName, path: filePath, type: "file" as const, content: src }],
          },
        ])
      } else {
        // Add at root
        setState("files", (files) => [
          ...files,
          { name: fileName, path: filePath, type: "file" as const, content: src },
        ])
      }
    }

    showToast({
      variant: "success",
      icon: "circle-check",
      title: "Image saved",
      description: `${filePath}`,
    })
    queueFileTreeRefresh(60)
  }

  // ─── File delete / rename handlers ──────────────────────────────────
  const handleFileDelete = async (file: PaperFile) => {
    try {
      const res = await fetch(`${serverBaseUrl()}/file?directory=${encodeURIComponent((sdk as any).directory || "")}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: file.path }),
      })
      if (!res.ok && res.status !== 404) {
        showToast({ variant: "error", title: "Delete failed", description: `Could not delete ${file.name}` })
        return
      }
    } catch {
      showToast({ variant: "error", title: "Delete failed", description: `Could not delete ${file.name}` })
      return
    }

    const nextFiles = removeFromTree(state.files, file.path)
    setState("files", nextFiles)

    const removedPrefix = `${file.path}/`
    const activeWasRemoved = state.activeFile === file.path || state.activeFile.startsWith(removedPrefix)
    if (activeWasRemoved) {
      const remaining = flattenTreeFiles(nextFiles)
      const nextActive = remaining.find((f) => f.path.endsWith(".tex"))?.path ?? remaining[0]?.path ?? ""
      setState("activeFile", nextActive)
      if (!nextActive) {
        setState("editorContent", "")
      }
    }

    if (state.pdfSourcePath === file.path || state.pdfSourcePath?.startsWith(removedPrefix)) {
      setState("pdfData", undefined)
      setState("pdfSourceType", undefined)
      setState("pdfSourcePath", undefined)
    }

    showToast({ variant: "success", icon: "circle-check", title: "Deleted", description: file.name })
    queueFileTreeRefresh(60)
  }

  const handleFileRename = async (file: PaperFile, newName: string) => {
    const trimmed = newName.trim()
    if (!trimmed || trimmed === file.name) return

    // Build new path by replacing the last segment.
    const lastSlash = file.path.lastIndexOf("/")
    const newPath = lastSlash >= 0 ? `${file.path.slice(0, lastSlash + 1)}${trimmed}` : trimmed

    try {
      const res = await fetch(`${serverBaseUrl()}/file?directory=${encodeURIComponent((sdk as any).directory || "")}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: file.path, newPath }),
      })
      if (!res.ok) {
        showToast({ variant: "error", title: "Rename failed", description: `Could not rename ${file.name}` })
        return
      }
    } catch {
      showToast({ variant: "error", title: "Rename failed", description: `Could not rename ${file.name}` })
      return
    }

    setState("files", (files) => renameInTree(files, file.path, newPath, trimmed))

    if (state.activeFile === file.path || state.activeFile.startsWith(`${file.path}/`)) {
      setState("activeFile", `${newPath}${state.activeFile.slice(file.path.length)}`)
    }

    if (state.pdfSourcePath === file.path || state.pdfSourcePath?.startsWith(`${file.path}/`)) {
      setState("pdfSourcePath", `${newPath}${(state.pdfSourcePath || "").slice(file.path.length)}`)
    }

    showToast({ variant: "success", icon: "circle-check", title: "Renamed", description: `${file.name} → ${trimmed}` })
    queueFileTreeRefresh(60)
  }

  const handleFileMove = async (file: PaperFile, targetParentPath: string) => {
    const normalizedParent = targetParentPath.replace(/^\/+|\/+$/g, "")
    const newPath = normalizedParent ? `${normalizedParent}/${file.name}` : file.name
    if (newPath === file.path) return

    if (file.type === "folder" && (normalizedParent === file.path || normalizedParent.startsWith(`${file.path}/`))) {
      showToast({ variant: "error", title: "Move failed", description: "Cannot move a folder into itself." })
      return
    }

    let destinationExists = false
    const ownPrefix = `${file.path}/`
    const walk = (nodes: PaperFile[]) => {
      for (const node of nodes) {
        const isMovingNode = node.path === file.path || node.path.startsWith(ownPrefix)
        if (!isMovingNode && node.path === newPath) {
          destinationExists = true
          return
        }
        if (node.children?.length) {
          walk(node.children)
          if (destinationExists) return
        }
      }
    }
    walk(state.files)
    if (destinationExists) {
      showToast({
        variant: "error",
        title: "Move failed",
        description: `${newPath} already exists`,
      })
      return
    }

    try {
      const res = await fetch(`${serverBaseUrl()}/file?directory=${encodeURIComponent((sdk as any).directory || "")}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: file.path, newPath }),
      })
      if (!res.ok) {
        showToast({ variant: "error", title: "Move failed", description: `Could not move ${file.name}` })
        return
      }
    } catch {
      showToast({ variant: "error", title: "Move failed", description: `Could not move ${file.name}` })
      return
    }

    setState("files", (files) => renameInTree(files, file.path, newPath, file.name))

    if (state.activeFile === file.path || state.activeFile.startsWith(`${file.path}/`)) {
      setState("activeFile", `${newPath}${state.activeFile.slice(file.path.length)}`)
    }

    if (state.pdfSourcePath === file.path || state.pdfSourcePath?.startsWith(`${file.path}/`)) {
      setState("pdfSourcePath", `${newPath}${(state.pdfSourcePath || "").slice(file.path.length)}`)
    }

    showToast({ variant: "success", icon: "circle-check", title: "Moved", description: `${file.name} → ${newPath}` })
    queueFileTreeRefresh(60)
  }

  // ─── File upload handler (from MenuBar) ─────────────────────────────
  const TEXT_TEMPLATE_EXTENSIONS = new Set(["tex", "bib", "sty", "cls", "bst", "bbx", "cbx", "def", "txt", "md", "py"])

  const handleUploadFile = async (files: FileList) => {
    for (const file of Array.from(files)) {
      const ext = file.name.split(".").pop()?.toLowerCase() || ""
      const isText = TEXT_TEMPLATE_EXTENSIONS.has(ext)
      const isTemplateFile = ["sty", "cls", "bst", "bbx", "cbx", "def"].includes(ext)

      try {
        if (isText) {
          // Read as text
          const content = await file.text()
          syncFileToTree(file.name, content)

          // Write to backend
          try {
            await fetch(writeUrl(), {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ path: file.name, content }),
            })
          } catch {}

          if (isTemplateFile) {
            showToast({
              variant: "success",
              icon: "circle-check",
              title: `Template ${file.name} added`,
              description: "LaTeX compilation will use this template.",
            })
          } else {
            showToast({ variant: "success", icon: "circle-check", title: "File uploaded", description: file.name })
          }
          queueFileTreeRefresh(80)
        } else {
          // Read as base64 for binary files (images, pdf, etc.)
          const reader = new FileReader()
          const dataUrl = await new Promise<string>((resolve, reject) => {
            reader.onload = () => resolve(reader.result as string)
            reader.onerror = () => reject(reader.error)
            reader.readAsDataURL(file)
          })

          // Add to file tree with data URL content
          syncFileToTree(file.name, dataUrl)

          // Write binary to backend
          const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/)
          if (match) {
            try {
              await fetch(writeUrl(), {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ path: file.name, content: match[2], encoding: "base64" }),
              })
            } catch {}
          }

          showToast({ variant: "success", icon: "circle-check", title: "File uploaded", description: file.name })
          queueFileTreeRefresh(80)
        }
      } catch (err) {
        showToast({ variant: "error", title: "Upload failed", description: `Could not upload ${file.name}` })
      }
    }
  }

  // ─── Drag-based resize handlers ──────────────────────────────────────
  // Each handler captures startSize at drag start and applies delta
  let dragStartFileTree = 0
  let dragStartEditor = 0
  let dragStartChat = 0

  const handleFileTreeDragStart = () => {
    dragStartFileTree = widths.fileTree
  }
  const handleEditorDragStart = () => {
    dragStartEditor = widths.editor
  }
  const handleChatDragStart = () => {
    dragStartChat = widths.chat
  }

  // Toggle chat panel
  const toggleChat = () => setState("chatCollapsed", !state.chatCollapsed)

  // Navigate back to regular session
  const switchToChat = () => {
    navigate(`/${params.dir}/session/${params.id ?? ""}`)
  }

  // Helper for creating drag handlers that track start position
  function createDragHandler(
    getStart: () => number,
    setStart: (v: number) => void,
    apply: (newSize: number) => void,
    min: number,
    max: number,
    invert?: boolean,
  ) {
    return (e: MouseEvent) => {
      e.preventDefault()
      const startX = e.clientX
      setStart(0) // we track delta from mousedown

      document.body.style.userSelect = "none"
      document.body.style.cursor = "col-resize"

      const startSize = getStart()

      const onMove = (moveEvent: MouseEvent) => {
        const delta = invert ? startX - moveEvent.clientX : moveEvent.clientX - startX
        apply(Math.max(min, Math.min(max, startSize + delta)))
      }

      const onUp = () => {
        document.body.style.userSelect = ""
        document.body.style.cursor = ""
        document.removeEventListener("mousemove", onMove)
        document.removeEventListener("mouseup", onUp)
      }

      document.addEventListener("mousemove", onMove)
      document.addEventListener("mouseup", onUp)
    }
  }

  // ── Smooth drag helpers ──────────────────────────────────────────────
  // Direct DOM manipulation during drag (no reactive updates = no lag).
  // Reactive state is committed only on mouseup.

  function startDrag(opts: {
    e: MouseEvent
    getStart: () => number
    getRef: () => HTMLDivElement | undefined
    max: () => number
    invert?: boolean
    onCommit: (finalSize: number) => void
  }) {
    opts.e.preventDefault()
    const startX = opts.e.clientX
    const startSize = opts.getStart()
    document.body.style.userSelect = "none"
    document.body.style.cursor = "col-resize"

    let rafId: number | undefined
    let lastClientX = startX  // always tracks latest mouse X, even between rAF frames

    const calcSize = (clientX: number) => {
      const delta = opts.invert ? startX - clientX : clientX - startX
      return Math.max(0, Math.min(opts.max(), startSize + delta))
    }

    const cleanup = (commitClientX?: number) => {
      if (rafId !== undefined) { cancelAnimationFrame(rafId); rafId = undefined }
      document.body.style.userSelect = ""
      document.body.style.cursor = ""
      document.removeEventListener("mousemove", onMove)
      document.removeEventListener("mouseup", onUp)
      if (commitClientX !== undefined) {
        // Commit using the exact clientX at release — no lag, no snap-back
        const finalSize = calcSize(commitClientX)
        opts.onCommit(finalSize)
        // DO NOT clear ref.style.width here — the reactive binding from setWidths
        // will override it synchronously, keeping the visual position stable.
      }
    }

    const onMove = (me: MouseEvent) => {
      // If mouse button was released outside the window, clean up defensively
      if (!(me.buttons & 1)) { cleanup(); return }

      lastClientX = me.clientX
      if (rafId !== undefined) return  // already a frame in flight — skip
      rafId = requestAnimationFrame(() => {
        const ref = opts.getRef()
        if (ref) ref.style.width = `${calcSize(lastClientX)}px`
        rafId = undefined
      })
    }

    const onUp = (me: MouseEvent) => {
      cleanup(me.clientX)
    }

    document.addEventListener("mousemove", onMove)
    document.addEventListener("mouseup", onUp)
  }

  // ── Drag handlers ────────────────────────────────────────────────────

  const onFileTreeHandleDown = (e: MouseEvent) => {
    // Allow button clicks to pass through (expand button)
    if ((e.target as Element).closest("button")) return
    // Start from 0 if collapsed so dragging outward expands it
    const startWidth = fileTreeCollapsed() ? 0 : widths.fileTree
    startDrag({
      e,
      getStart: () => startWidth,
      getRef: () => fileTreePanelRef,
      max: () => 500,
      onCommit: (size) => {
        if (size < FILETREE_SNAP) {
          if (!fileTreeCollapsed()) savedFileTreeWidth = widths.fileTree
          setFileTreeCollapsed(true)
        } else {
          setFileTreeCollapsed(false)
          setWidths("fileTree", size)
        }
      },
    })
  }

  // Helper: compute expected PDF width after a panel changes to newSize
  const calcExpectedPdfW = (newEditorW: number, newChatW: number) => {
    const containerW = previewPanelRef?.parentElement?.offsetWidth ?? window.innerWidth
    const ftW = fileTreeCollapsed() ? 0 : widths.fileTree
    // 3 visible dividers (4 panels → 3 handles, each DIVIDER_W wide)
    return Math.max(0, containerW - ftW - newEditorW - newChatW - 3 * DIVIDER_W)
  }

  const onEditorHandleDown = (e: MouseEvent) => {
    if ((e.target as Element).closest("button")) return
    const startWidth = editorCollapsed() ? 0 : widths.editor
    startDrag({
      e,
      getStart: () => startWidth,
      getRef: () => editorPanelRef,
      max: () => window.innerWidth * 0.65,
      onCommit: (size) => {
        if (size < EDITOR_SNAP) {
          if (!editorCollapsed()) savedEditorWidth = widths.editor
          setEditorCollapsed(true)
        } else {
          setEditorCollapsed(false)
          setWidths("editor", size)
        }
        // Detect PDF collapse
        const chatW = state.chatCollapsed ? 0 : widths.chat
        const pdfW = calcExpectedPdfW(size < EDITOR_SNAP ? 0 : size, chatW)
        setPdfCollapsed(pdfW < PDF_SNAP)
      },
    })
  }

  const onChatHandleDown = (e: MouseEvent) => {
    if ((e.target as Element).closest("button")) return
    const startWidth = state.chatCollapsed ? 0 : widths.chat
    startDrag({
      e,
      getStart: () => startWidth,
      getRef: () => chatPanelRef,
      max: () => 700,
      invert: true,          // chat grows to the left
      onCommit: (size) => {
        if (size < CHAT_SNAP) {
          if (!state.chatCollapsed) savedChatWidth = widths.chat
          setState("chatCollapsed", true)
        } else {
          setState("chatCollapsed", false)
          setWidths("chat", size)
        }
        // Detect PDF collapse
        const editorW = editorCollapsed() ? 0 : widths.editor
        const pdfW = calcExpectedPdfW(editorW, size < CHAT_SNAP ? 0 : size)
        setPdfCollapsed(pdfW < PDF_SNAP)
      },
    })
  }

  // Restore collapsed panels
  const expandFileTree = () => {
    setFileTreeCollapsed(false)
    setWidths("fileTree", savedFileTreeWidth || DEFAULT_WIDTHS.fileTree)
  }
  const expandEditor = () => {
    setEditorCollapsed(false)
    setWidths("editor", savedEditorWidth || DEFAULT_WIDTHS.editor)
  }
  const expandChat = () => {
    setState("chatCollapsed", false)
    setWidths("chat", savedChatWidth || DEFAULT_WIDTHS.chat)
  }
  const expandPdf = () => {
    setPdfCollapsed(false)
    // Restore adjacent panels to default widths to free up PDF space
    if (widths.editor > DEFAULT_WIDTHS.editor) setWidths("editor", DEFAULT_WIDTHS.editor)
    if (widths.chat > DEFAULT_WIDTHS.chat) setWidths("chat", DEFAULT_WIDTHS.chat)
  }

  // ── Divider helpers ──────────────────────────────────────────────────
  const DIVIDER_W = 5   // px — width of the drag handle zone

  // A divider that shows an expand button when the LEFT panel is collapsed
  const ExpandLeft = (props: { onExpand: () => void; title: string }) => (
    <button
      class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-5 h-8 rounded-sm
             bg-surface-raised-base border border-border-base
             flex items-center justify-center
             text-text-weak hover:text-text-base hover:border-border-strong
             transition-colors z-20"
      onClick={props.onExpand}
      title={props.title}
    >
      <svg width="8" height="10" viewBox="0 0 8 10" fill="none">
        <path d="M2 1l4 4-4 4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
      </svg>
    </button>
  )

  // A divider that shows an expand button when the RIGHT panel is collapsed
  const ExpandRight = (props: { onExpand: () => void; title: string }) => (
    <button
      class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-5 h-8 rounded-sm
             bg-surface-raised-base border border-border-base
             flex items-center justify-center
             text-text-weak hover:text-text-base hover:border-border-strong
             transition-colors z-20"
      onClick={props.onExpand}
      title={props.title}
    >
      <svg width="8" height="10" viewBox="0 0 8 10" fill="none">
        <path d="M6 1l-4 4 4 4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
      </svg>
    </button>
  )

  // Inline drag handle style
  // When collapsed, widen the handle to 24px so the expand button (w-5 = 20px)
  // is fully contained and not clipped by the parent overflow:hidden flex row.
  // cursor is always col-resize — dragging outward from collapsed state also works.
  const handleStyle = (collapsed = false) => ({
    width: `${collapsed ? 24 : DIVIDER_W}px`,
    "min-width": `${collapsed ? 24 : DIVIDER_W}px`,
    cursor: "col-resize",
    background: "transparent",
    position: "relative" as const,
    "flex-shrink": "0",
    "z-index": "10",
  })

  return (
    <div class="relative bg-background-base size-full overflow-hidden flex flex-col">

      {/* ── Submit Dialog ──────────────────────────────────────────────── */}
      <Portal>
      <Show when={showSubmitDialog()}>
        <div class="fixed inset-0 z-[200] flex items-center justify-center bg-black/40" onClick={() => setShowSubmitDialog(false)}>
          <div class="bg-surface-raised-base border border-border-base rounded-xl shadow-xl w-[480px] overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div class="px-6 pt-6 pb-4">
              <div class="text-16-medium text-text-strong mb-1">Submit your paper</div>
              <div class="text-13-regular text-text-weak">Choose a submission destination</div>
            </div>
            <div class="px-4 pb-4 flex flex-col gap-2">
              {([
                { icon: "📄", name: "arXiv", desc: "Submit to arXiv preprint server", url: "https://arxiv.org/submit" },
                { icon: "📚", name: "ACM Digital Library", desc: "Submit to ACM publications", url: "https://dl.acm.org" },
                { icon: "🔬", name: "IEEE Xplore", desc: "Submit to IEEE conferences/journals", url: "https://ieeeauthorcenter.ieee.org" },
                { icon: "📖", name: "Springer", desc: "Submit to Springer journals", url: "https://www.springer.com/authors" },
              ]).map((dest) => (
                <button
                  class="flex items-center gap-3 px-4 py-3 rounded-lg border border-border-base hover:bg-surface-base hover:border-border-strong transition-colors text-left"
                  onClick={() => { window.open(dest.url, "_blank"); setShowSubmitDialog(false) }}
                >
                  <span class="text-20">{dest.icon}</span>
                  <div>
                    <div class="text-13-medium text-text-strong">{dest.name}</div>
                    <div class="text-12-regular text-text-weak">{dest.desc}</div>
                  </div>
                  <svg class="ml-auto text-text-muted shrink-0" width="14" height="14" viewBox="0 0 16 16" fill="none">
                    <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                  </svg>
                </button>
              ))}
            </div>
            <div class="px-6 py-4 border-t border-border-base flex justify-end">
              <button class="px-4 py-1.5 rounded-md text-13-medium text-text-base hover:bg-surface-base transition-colors" onClick={() => setShowSubmitDialog(false)}>Cancel</button>
            </div>
          </div>
        </div>
      </Show>
      </Portal>

      {/* ── Rename Dialog ─────────────────────────────────────────────── */}
      <Portal>
      <Show when={showRenameDialog()}>
        <div class="fixed inset-0 z-[200] flex items-center justify-center bg-black/40" onClick={() => setShowRenameDialog(false)}>
          <div class="bg-surface-raised-base border border-border-base rounded-xl shadow-xl w-96 p-6" onClick={(e) => e.stopPropagation()}>
            <div class="text-15-medium text-text-strong mb-4">Rename project</div>
            <input
              type="text"
              class="w-full px-3 py-2 rounded-lg border border-border-base bg-surface-base text-13-regular text-text-strong focus:outline-none focus:ring-2 focus:ring-accent-base"
              value={renameValue()}
              onInput={(e) => setRenameValue(e.currentTarget.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleRename(renameValue()); if (e.key === "Escape") setShowRenameDialog(false) }}
              autofocus
            />
            <div class="flex gap-2 mt-4 justify-end">
              <button class="px-4 py-1.5 rounded-md text-13-medium text-text-base hover:bg-surface-base transition-colors" onClick={() => setShowRenameDialog(false)}>Cancel</button>
              <button
                class="px-4 py-1.5 rounded-md text-13-medium bg-accent-base text-white hover:bg-accent-strong transition-colors disabled:opacity-50"
                disabled={projectActionBusy() || !renameValue().trim()}
                onClick={() => handleRename(renameValue())}
              >
                {projectActionBusy() ? "Renaming…" : "Rename"}
              </button>
            </div>
          </div>
        </div>
      </Show>
      </Portal>

      {/* ── Make a Copy Dialog ────────────────────────────────────────── */}
      <Portal>
      <Show when={showCopyDialog()}>
        <div class="fixed inset-0 z-[200] flex items-center justify-center bg-black/40" onClick={() => setShowCopyDialog(false)}>
          <div class="bg-surface-raised-base border border-border-base rounded-xl shadow-xl w-96 p-6" onClick={(e) => e.stopPropagation()}>
            <div class="text-15-medium text-text-strong mb-1">Make a copy</div>
            <div class="text-12-regular text-text-weak mb-4">New project folder name</div>
            <input
              type="text"
              class="w-full px-3 py-2 rounded-lg border border-border-base bg-surface-base text-13-regular text-text-strong focus:outline-none focus:ring-2 focus:ring-accent-base"
              value={copyName()}
              onInput={(e) => setCopyName(e.currentTarget.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleMakeCopy(copyName()); if (e.key === "Escape") setShowCopyDialog(false) }}
              autofocus
            />
            <div class="flex gap-2 mt-4 justify-end">
              <button class="px-4 py-1.5 rounded-md text-13-medium text-text-base hover:bg-surface-base transition-colors" onClick={() => setShowCopyDialog(false)}>Cancel</button>
              <button
                class="px-4 py-1.5 rounded-md text-13-medium bg-accent-base text-white hover:bg-accent-strong transition-colors disabled:opacity-50"
                disabled={projectActionBusy() || !copyName().trim()}
                onClick={() => handleMakeCopy(copyName())}
              >
                {projectActionBusy() ? "Copying…" : "Copy project"}
              </button>
            </div>
          </div>
        </div>
      </Show>
      </Portal>

      {/* Header — Overleaf-style: logo | menus | title | actions */}
      <div class="flex items-center h-10 pl-2 pr-3 border-b border-border-weak-base bg-background-stronger shrink-0">

        {/* Separator */}
        <div class="w-px h-4 bg-border-weak-base shrink-0 mr-2" />

        {/* Menu items: File Edit Insert View Format Help */}
        <div class="flex items-center gap-0 shrink-0">
          <MenuBar
            editorView={() => editorViewRef}
            pdfData={() => state.pdfData}
            editorContent={() => state.editorContent}
            viewMode={viewMode}
            onViewModeChange={setViewMode}
            onPdfZoomIn={() => setPdfScale((s) => Math.min(3, s + 0.25))}
            onPdfZoomOut={() => setPdfScale((s) => Math.max(0.25, s - 0.25))}
            onPdfFitWidth={() => setPdfScale(1)}
            onNewFile={() => showToast({ title: "New file", description: "Use the file tree to create files" })}
            onNewFolder={() => showToast({ title: "New folder", description: "Use the file tree to create folders" })}
            onDownloadPdf={() => {
              if (!state.pdfData) { showToast({ variant: "error", title: "No PDF", description: "Compile first" }); return }
              const a = document.createElement("a")
              a.href = state.pdfData
              a.download = (state.activeFile.replace(".tex", "") || "paper") + ".pdf"
              a.click()
            }}
            onDownloadSource={() => handleDownloadSource()}
            onUploadFile={handleUploadFile}
          />
        </div>

        {/* Separator */}
        <div class="w-px h-4 bg-border-weak-base shrink-0 mx-3" />

        {/* Paper / Chat mode tabs */}
        <div class="flex items-center gap-1 shrink-0">
          <button
            class="flex items-center gap-1 px-2 py-1 rounded text-12-medium bg-surface-base text-text-strong ring-1 ring-border-base transition-colors"
            title="Paper Mode (active)"
          >
            <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
              <rect x="2" y="2" width="12" height="12" rx="2" stroke="currentColor" stroke-width="1.5" />
              <line x1="6" y1="2" x2="6" y2="14" stroke="currentColor" stroke-width="1" />
              <line x1="10" y1="2" x2="10" y2="14" stroke="currentColor" stroke-width="1" />
            </svg>
            Paper
          </button>
          <button
            class="flex items-center gap-1 px-2 py-1 rounded text-12-medium text-text-weak hover:bg-surface-base transition-colors"
            onClick={switchToChat}
            title="Switch to Chat mode"
          >
            <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
              <path d="M2 4a2 2 0 012-2h8a2 2 0 012 2v6a2 2 0 01-2 2H6l-3 2V4z" stroke="currentColor" stroke-width="1.5" />
            </svg>
            Chat
          </button>
        </div>

        {/* Center: project title dropdown */}
        <div class="flex-1 flex items-center justify-center min-w-0">
          <DropdownMenu gutter={4} placement="bottom">
            <DropdownMenu.Trigger class="flex items-center gap-1 px-2 py-1 rounded hover:bg-surface-base data-[expanded]:bg-surface-base transition-colors max-w-xs">
              <span class="text-13-medium text-text-strong truncate">{projectName()}</span>
              <svg width="12" height="12" viewBox="0 0 16 16" fill="none" class="shrink-0 text-text-weak">
                <path d="M4 6l4 4 4-4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
              </svg>
            </DropdownMenu.Trigger>
            <DropdownMenu.Portal>
              <DropdownMenu.Content>
                <DropdownMenu.Item onSelect={() => setShowSubmitDialog(true)}>
                  <DropdownMenu.ItemLabel>Submit</DropdownMenu.ItemLabel>
                </DropdownMenu.Item>
                <DropdownMenu.Separator />
                <DropdownMenu.Item
                  onSelect={() => {
                    if (!state.pdfData) { showToast({ variant: "error", title: "No PDF", description: "Compile first to generate a PDF" }); return }
                    const a = document.createElement("a")
                    a.href = state.pdfData
                    a.download = (state.activeFile.replace(".tex", "") || "paper") + ".pdf"
                    a.click()
                  }}
                >
                  <DropdownMenu.ItemLabel>Download as PDF</DropdownMenu.ItemLabel>
                </DropdownMenu.Item>
                <DropdownMenu.Item onSelect={() => handleDownloadSource()}>
                  <DropdownMenu.ItemLabel>Download as source (.zip)</DropdownMenu.ItemLabel>
                </DropdownMenu.Item>
                <DropdownMenu.Separator />
                <DropdownMenu.Item
                  onSelect={() => {
                    setCopyName(projectName() + "-copy")
                    setShowCopyDialog(true)
                  }}
                >
                  <DropdownMenu.ItemLabel>Make a copy</DropdownMenu.ItemLabel>
                </DropdownMenu.Item>
                <DropdownMenu.Item
                  onSelect={() => {
                    setRenameValue(projectName())
                    setShowRenameDialog(true)
                  }}
                >
                  <DropdownMenu.ItemLabel>Rename</DropdownMenu.ItemLabel>
                </DropdownMenu.Item>
              </DropdownMenu.Content>
            </DropdownMenu.Portal>
          </DropdownMenu>
        </div>

        {/* Right: status + active file + toggles + share + hide chat */}
        <div class="flex items-center gap-1.5 shrink-0">

          {/* Provider status indicators + Settings */}
          <div class="flex items-center gap-1">
            {/* Connected provider dots */}
            <div
              class="flex items-center gap-0.5 px-1 py-0.5 rounded cursor-pointer hover:bg-surface-base transition-colors"
              onClick={() => dialog.show(() => <DialogSettings />)}
              title={`Connected: ${providers.connected().map((p) => p.name).join(", ") || "None"} — Click to manage`}
            >
              {(() => {
                const PROVIDER_COLORS: Record<string, string> = {
                  google: "#4285f4",
                  anthropic: "#d97706",
                  openai: "#10a37f",
                  opencode: "#6366f1",
                }
                const connected = providers.connected()
                const mainProviders = connected.filter((p) =>
                  ["google", "anthropic", "openai", "opencode"].includes(p.id),
                )
                return (
                  <>
                    {mainProviders.map((p) => (
                      <div
                        style={{
                          width: "7px",
                          height: "7px",
                          "border-radius": "50%",
                          background: PROVIDER_COLORS[p.id] || "#888",
                          "flex-shrink": "0",
                        }}
                        title={`${p.name}: Connected`}
                      />
                    ))}
                    {connected.length > mainProviders.length && (
                      <span class="text-10-regular text-text-weak ml-0.5">
                        +{connected.length - mainProviders.length}
                      </span>
                    )}
                  </>
                )
              })()}
            </div>

            {/* Settings gear */}
            <Button
              variant="ghost"
              class="titlebar-icon w-7 h-7 p-0 box-border"
              onClick={() => dialog.show(() => <DialogSettings />)}
              aria-label="Settings"
              title="Settings — Manage providers, API keys, models"
            >
              <div class="relative flex items-center justify-center size-4">
                <Icon size="small" name="sliders" />
              </div>
            </Button>
          </div>

          {/* StatusPopover */}
          <StatusPopover />

          {/* Active file */}
          <span class="text-11-regular text-text-weak hidden lg:inline max-w-[120px] truncate">{state.activeFile}</span>

          {/* Separator */}
          <div class="w-px h-4 bg-border-weak-base mx-0.5" />

          {/* Separator */}
          <div class="w-px h-4 bg-border-weak-base mx-0.5" />

          {/* Share button */}
          <Show when={projectDirectory()}>
            <button
              class="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-12-medium bg-surface-base hover:bg-surface-raised-base text-text-base ring-1 ring-border-base transition-colors shrink-0"
              onClick={copyPath}
              title="Copy project path"
            >
              <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
                <circle cx="13" cy="3" r="2" stroke="currentColor" stroke-width="1.3" />
                <circle cx="13" cy="13" r="2" stroke="currentColor" stroke-width="1.3" />
                <circle cx="3" cy="8" r="2" stroke="currentColor" stroke-width="1.3" />
                <line x1="4.8" y1="7" x2="11.2" y2="4" stroke="currentColor" stroke-width="1.3" />
                <line x1="4.8" y1="9" x2="11.2" y2="12" stroke="currentColor" stroke-width="1.3" />
              </svg>
              Share
            </button>
          </Show>

          {/* Hide/Show Chat */}
          <button
            class="flex items-center gap-1 px-2 py-1 rounded text-11-medium text-text-weak hover:text-text-base hover:bg-surface-base transition-colors"
            onClick={toggleChat}
          >
            {state.chatCollapsed ? "Show Chat" : "Hide Chat"}
          </button>
        </div>
      </div>

      {/* Main content area — all panels in a single flex row with drag handles between them */}
      <div class="flex-1 min-h-0 flex overflow-hidden">
        {/* ── File Tree Panel ─────────────────────────────────────────── */}
        <div
          ref={(el) => { fileTreePanelRef = el }}
          class="shrink-0 h-full overflow-hidden bg-background-base"
          style={{ width: fileTreeCollapsed() ? "0" : `${widths.fileTree}px` }}
        >
          <PaperFileTree
            files={state.files}
            activeFile={state.activeFile}
            onFileSelect={handleFileSelect}
            onFileCreate={handleFileCreate}
            onRefresh={handleRefreshFiles}
            refreshing={fileTreeRefreshing()}
            onImageDrop={handleImageDrop}
            onUploadTemplate={handleUploadFile}
            onFileDelete={handleFileDelete}
            onFileRename={handleFileRename}
            onFileMove={handleFileMove}
          />
        </div>

        {/* ── Drag Handle: File Tree | Editor ─────────────────────────── */}
        <div
          onMouseDown={onFileTreeHandleDown}
          style={handleStyle(fileTreeCollapsed())}
          class="paper-drag-handle"
          data-between="filetree-editor"
        >
          <div class="paper-drag-line paper-drag-line-v" />
          <Show when={fileTreeCollapsed()}>
            <ExpandLeft onExpand={expandFileTree} title="Expand file tree" />
          </Show>
        </div>

        {/* ── Editor Panel ────────────────────────────────────────────── */}
        <Show when={viewMode() !== "pdf"}>
          <div
            ref={(el) => { editorPanelRef = el }}
            class="shrink-0 h-full overflow-hidden flex flex-col bg-background-base"
            style={{ width: editorCollapsed() ? "0" : viewMode() === "editor" ? "100%" : `${widths.editor}px` }}
          >
            <div class="flex items-center h-8 px-3 border-b border-border-weak-base bg-background-stronger shrink-0">
              <span class="text-11-medium text-text-weak">{state.activeFile}</span>
            </div>
            <div class="flex-1 min-h-0">
              <Show when={isPdfFile(state.activeFile)}>
                <div class="h-full flex flex-col items-center justify-center gap-3 text-center p-8 text-text-weak">
                  <svg width="32" height="32" viewBox="0 0 32 32" fill="none" class="text-red-400">
                    <rect x="4" y="2" width="20" height="26" rx="2" stroke="currentColor" stroke-width="1.5" />
                    <path d="M8 10h12M8 14h8M8 18h10" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" />
                    <path d="M16 2v6h6" stroke="currentColor" stroke-width="1.2" />
                  </svg>
                  <div class="text-13-medium text-text-base">{state.activeFile.split("/").pop()}</div>
                  <div class="text-12-regular">PDF displayed in preview panel →</div>
                </div>
              </Show>
              <Show when={isImageFile(state.activeFile)}>
                <ImagePreviewPanel
                  filePath={state.activeFile}
                  imageData={activeImageData()}
                  onEditRequest={(request: ImageEditRequest) => {
                    const region = request.region
                    const regionStr = region
                      ? ` [REGION: x=${Math.round(region.x)}, y=${Math.round(region.y)}, w=${Math.round(region.w)}, h=${Math.round(region.h)}]`
                      : ""
                    const annotationSummary = request.annotations
                      .map((annotation) => {
                        const r = annotation.region
                        const bounds = `x=${Math.round(r.x)}, y=${Math.round(r.y)}, w=${Math.round(r.w)}, h=${Math.round(r.h)}`
                        return annotation.instruction
                          ? `${annotation.shape}(${bounds}) -> ${annotation.instruction}`
                          : `${annotation.shape}(${bounds})`
                      })
                      .join("; ")
                    const imageDataUrl = activeImageData()
                    const instruction = request.instruction.trim() || "Apply the marked edits."
                    const editPrompt = imageDataUrl
                      ? `@image Edit the image at ${state.activeFile}${regionStr}: ${instruction}`
                      : `@image ${instruction}`
                    const promptWithContext = annotationSummary
                      ? `${editPrompt} [ANNOTATIONS: ${annotationSummary}] [COLLABORATIVE: ${request.collaborative ? "ON" : "OFF"}]`
                      : `${editPrompt} [COLLABORATIVE: ${request.collaborative ? "ON" : "OFF"}]`
                    if (typeof window !== "undefined") {
                      ;(window as any).__paperStudioEditImage = {
                        imageData: imageDataUrl,
                        filePath: state.activeFile,
                        region: request.region || null,
                        annotations: request.annotations,
                        collaborative: request.collaborative,
                        model: request.model,
                      }
                    }
                    if (inputRef) {
                      inputRef.textContent = promptWithContext
                      inputRef.dispatchEvent(new Event("input", { bubbles: true }))
                      inputRef.focus()
                    }
                  }}
                />
              </Show>
              <Show when={!isPdfFile(state.activeFile) && !isImageFile(state.activeFile)}>
                <LatexEditor
                  content={state.editorContent}
                  onChange={handleEditorChange}
                  onSave={handleCompile}
                  onEditorReady={(ev) => { editorViewRef = ev }}
                  dark={true}
                />
              </Show>
            </div>
          </div>
        </Show>

        {/* ── Drag Handle: Editor | Preview (split mode only) ─────────── */}
        <Show when={viewMode() === "split"}>
          <div
            onMouseDown={onEditorHandleDown}
            style={handleStyle(editorCollapsed() || pdfCollapsed())}
            class="paper-drag-handle"
            data-between="editor-preview"
          >
            <div class="paper-drag-line paper-drag-line-v" />
            <Show when={editorCollapsed()}>
              <ExpandLeft onExpand={expandEditor} title="Expand editor" />
            </Show>
            <Show when={pdfCollapsed() && !editorCollapsed()}>
              <ExpandRight onExpand={expandPdf} title="Expand PDF preview" />
            </Show>
          </div>
        </Show>

        {/* ── PDF Preview Panel ────────────────────────────────────────── */}
        <Show when={viewMode() !== "editor"}>
          <div
            ref={(el) => { previewPanelRef = el }}
            class="flex-1 min-w-0 h-full overflow-hidden bg-background-base"
          >
            <PdfPreview
              pdfData={state.pdfData}
              compiling={state.compiling}
              error={state.compilationError}
              compilationTime={state.compilationTime}
              onCompile={handleCompile}
              scale={pdfScale}
              onScaleChange={setPdfScale}
              log={state.compilationLog}
              logErrorCount={logCounts().errors}
              logWarningCount={logCounts().warnings}
              undefinedCitationCount={undefinedCitationCount()}
              compileLabel={isActiveDocx() ? "Convert to PDF" : "Compile"}
              onFixError={handleFixError}
            />
            <Show when={isActiveDocx()}>
              <div class="flex items-center h-8 px-3 border-t border-border-weak-base bg-background-stronger shrink-0">
                <button
                  class="flex items-center gap-1.5 px-2.5 py-1 rounded text-11-medium text-blue-600 hover:bg-blue-50 transition-colors"
                  onClick={handleConvertToLatex}
                  disabled={state.compiling}
                  title="Convert this DOCX file to a .tex file"
                >
                  <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
                    <path d="M4 8h8M9 5l3 3-3 3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
                  </svg>
                  Convert to LaTeX
                </button>
                <span class="ml-2 text-10-regular text-text-weak">DOCX mode</span>
              </div>
            </Show>
          </div>
        </Show>

        {/* ── Drag Handle: Preview | Chat ─────────────────────────────── */}
        <div
          onMouseDown={onChatHandleDown}
          style={handleStyle(state.chatCollapsed || pdfCollapsed())}
          class="paper-drag-handle"
          data-between="preview-chat"
        >
          <div class="paper-drag-line paper-drag-line-v" />
          <Show when={state.chatCollapsed}>
            <ExpandRight onExpand={expandChat} title="Expand chat" />
          </Show>
          <Show when={pdfCollapsed() && !state.chatCollapsed}>
            <ExpandLeft onExpand={expandPdf} title="Expand PDF preview" />
          </Show>
        </div>

        {/* ── Chat Panel ──────────────────────────────────────────────── */}
        {/* Always in DOM (width:0 when collapsed) so chatPanelRef is valid for drag-to-expand */}
        <div
          ref={(el) => { chatPanelRef = el }}
          class="shrink-0 h-full overflow-hidden flex flex-col bg-background-stronger"
          style={{ width: state.chatCollapsed ? "0" : `${widths.chat}px` }}
        >
            <div class="flex items-center h-8 px-2 border-b border-border-weak-base shrink-0 gap-1">
              {/* Session switcher dropdown */}
              <DropdownMenu gutter={4} placement="bottom-start">
                <DropdownMenu.Trigger class="flex items-center gap-1 px-2 py-1 rounded hover:bg-surface-base data-[expanded]:bg-surface-base transition-colors min-w-0 max-w-[160px]">
                  <span class="text-12-medium text-text-base truncate">{currentSessionTitle()}</span>
                  <svg width="10" height="10" viewBox="0 0 16 16" fill="none" class="shrink-0 text-text-weak">
                    <path d="M4 6l4 4 4-4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
                  </svg>
                </DropdownMenu.Trigger>
                <DropdownMenu.Portal>
                  <DropdownMenu.Content>
                    <For each={projectSessions()}>
                      {(session) => (
                        <DropdownMenu.Item
                          onSelect={() => navigate(`/${params.dir}/paper/${session.id}`)}
                        >
                          <DropdownMenu.ItemLabel>
                            <div class="flex items-center gap-2 min-w-0">
                              <Show when={session.id === params.id}>
                                <div class="w-1.5 h-1.5 rounded-full bg-accent-base shrink-0" />
                              </Show>
                              <Show when={session.id !== params.id}>
                                <div class="w-1.5 h-1.5 shrink-0" />
                              </Show>
                              <span class="truncate max-w-[200px]">{session.title || "New session"}</span>
                            </div>
                          </DropdownMenu.ItemLabel>
                        </DropdownMenu.Item>
                      )}
                    </For>
                    <DropdownMenu.Separator />
                    <DropdownMenu.Item onSelect={() => navigate(`/${params.dir}/paper`)}>
                      <DropdownMenu.ItemLabel>
                        <div class="flex items-center gap-2">
                          <svg width="11" height="11" viewBox="0 0 16 16" fill="none">
                            <path d="M8 3v10M3 8h10" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" />
                          </svg>
                          New session
                        </div>
                      </DropdownMenu.ItemLabel>
                    </DropdownMenu.Item>
                  </DropdownMenu.Content>
                </DropdownMenu.Portal>
              </DropdownMenu>

              {/* Spacer */}
              <div class="flex-1" />

              {/* Close chat */}
              <button
                class="flex items-center justify-center w-5 h-5 rounded text-text-weak hover:text-text-base hover:bg-surface-base transition-colors shrink-0"
                onClick={toggleChat}
                title="Close chat"
              >
                <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
                  <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
                </svg>
              </button>
            </div>

            {/* Chat messages */}
            <div class="flex-1 min-h-0 flex flex-col">
              <Show
                when={params.id && messagesReady()}
                fallback={
                  <div class="flex-1 flex items-center justify-center text-12-regular text-text-weak p-4 text-center">
                    <Show when={!params.id} fallback="Loading messages...">
                      Start a conversation to get AI help with your paper.
                    </Show>
                  </div>
                }
              >
                <div
                  ref={setChatScrollRef}
                  class="flex-1 min-h-0 overflow-y-auto"
                  onScroll={() => {
                    autoScroll.handleScroll()
                    schedulePersistChatScroll()
                  }}
                >
                  <div
                    ref={(el) => {
                      chatContent = el
                      autoScroll.contentRef(el)
                    }}
                  >
                    <Show when={lastUserMessage()}>
                      <MessageTimeline
                        mobileChanges={false}
                        mobileFallback={<></>}
                        scroll={{ overflow: false, bottom: true }}
                        onResumeScroll={() => autoScroll.forceScrollToBottom()}
                        setScrollRef={setChatScrollRef}
                        onScheduleScrollState={() => {
                          autoScroll.handleScroll()
                          schedulePersistChatScroll()
                        }}
                        onAutoScrollHandleScroll={() => autoScroll.handleScroll()}
                        onMarkScrollGesture={() => {}}
                        hasScrollGesture={() => false}
                        isDesktop={isDesktop()}
                        onScrollSpyScroll={() => {}}
                        onAutoScrollInteraction={() => autoScroll.handleInteraction()}
                        centered={false}
                        setContentRef={(el) => {
                          chatContent = el
                          autoScroll.contentRef(el)
                        }}
                        turnStart={0}
                        onRenderEarlier={() => {}}
                        historyMore={false}
                        historyLoading={false}
                        onLoadEarlier={() => {}}
                        renderedUserMessages={renderedUserMessages()}
                        anchor={anchor}
                        onRegisterMessage={() => {}}
                        onUnregisterMessage={() => {}}
                        lastUserMessageID={lastUserMessage()?.id}
                      />
                    </Show>
                  </div>
                </div>
              </Show>

              {/* Composer */}
              <SessionComposerRegion
                state={composer}
                centered={false}
                inputRef={(el) => {
                  inputRef = el
                }}
                newSessionWorktree="main"
                onNewSessionWorktreeReset={() => {}}
                onSubmit={() => {
                  comments.clear()
                  autoScroll.forceScrollToBottom()
                }}
                onResponseSubmit={() => autoScroll.forceScrollToBottom()}
                setPromptDockRef={(el) => {
                  promptDock = el
                }}
              />
            </div>
          </div>
      </div>

      {/* Terminal at bottom */}
      <TerminalPanel />

      {/* Drag handle styles */}
      <style>{`
        .paper-drag-handle {
          position: relative;
          flex-shrink: 0;
        }
        .paper-drag-line-v {
          position: absolute;
          width: 1px;
          top: 0;
          bottom: 0;
          left: 50%;
          transform: translateX(-50%);
          background-color: var(--border-weak-base, #e0e0e0);
          transition: width 0.15s, background-color 0.15s;
          pointer-events: none;
        }
        .paper-drag-handle:hover .paper-drag-line-v,
        .paper-drag-handle:active .paper-drag-line-v {
          width: 3px;
          background-color: var(--icon-brand-base, #6366f1);
        }
        .paper-drag-line-h {
          position: absolute;
          height: 1px;
          left: 0;
          right: 0;
          top: 50%;
          transform: translateY(-50%);
          background-color: var(--border-weak-base, #e0e0e0);
          transition: height 0.15s, background-color 0.15s;
          pointer-events: none;
        }
        .paper-drag-handle:hover .paper-drag-line-h,
        .paper-drag-handle:active .paper-drag-line-h {
          height: 3px;
          background-color: var(--icon-brand-base, #6366f1);
        }
      `}</style>
    </div>
  )
}
