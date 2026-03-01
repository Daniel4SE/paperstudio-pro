import { createSignal, Show } from "solid-js"
import { DropdownMenu } from "@opencode-ai/ui/dropdown-menu"
import type { EditorView } from "@codemirror/view"
import { undo, redo, selectAll, indentMore, indentLess } from "@codemirror/commands"
import { openSearchPanel } from "@codemirror/search"

export type ViewMode = "split" | "editor" | "pdf"

export interface MenuBarProps {
  editorView?: () => EditorView | undefined
  pdfData?: () => string | undefined
  editorContent?: () => string
  viewMode: () => ViewMode
  onViewModeChange: (mode: ViewMode) => void
  onPdfZoomIn?: () => void
  onPdfZoomOut?: () => void
  onPdfFitWidth?: () => void
  onNewFile?: () => void
  onNewFolder?: () => void
  onUploadFile?: (files: FileList) => void
  onDownloadPdf?: () => void
  onDownloadSource?: () => void
  onWordCount?: () => void
}

// ── Editor helpers ────────────────────────────────────────────────────────────

/** Wrap current selection (or insert with placeholder) in before/after. */
function wrap(view: EditorView, before: string, after: string, placeholder = "text") {
  const { from, to } = view.state.selection.main
  const selected = view.state.sliceDoc(from, to)
  const inner = selected || placeholder
  view.dispatch({
    changes: { from, to, insert: `${before}${inner}${after}` },
    selection: { anchor: from + before.length, head: from + before.length + inner.length },
  })
  view.focus()
}

/** Insert a snippet at the cursor. */
function insert(view: EditorView, text: string, cursorOffset?: number) {
  const { from, to } = view.state.selection.main
  view.dispatch({
    changes: { from, to, insert: text },
    selection: { anchor: from + (cursorOffset ?? text.length) },
  })
  view.focus()
}

/** Wrap selection with a LaTeX sectioning command. */
function sectionWrap(view: EditorView, cmd: string) {
  const { from, to } = view.state.selection.main
  const selected = view.state.sliceDoc(from, to)
  const inner = selected || "Title"
  view.dispatch({
    changes: { from, to, insert: `\\${cmd}{${inner}}` },
    selection: { anchor: from + cmd.length + 2, head: from + cmd.length + 2 + inner.length },
  })
  view.focus()
}

// ── Trigger style ─────────────────────────────────────────────────────────────
const T =
  "px-2 py-1 rounded text-12-regular text-text-base hover:bg-surface-base data-[expanded]:bg-surface-base transition-colors"

// ── Component ─────────────────────────────────────────────────────────────────

export function MenuBar(props: MenuBarProps) {
  // Word count modal
  const [showWordCount, setShowWordCount] = createSignal(false)
  const [wc, setWc] = createSignal({ words: 0, chars: 0, lines: 0 })

  // Editor settings (local state — future: persist to prefs)
  const [showBreadcrumbs, setShowBreadcrumbs] = createSignal(true)
  const [showEquationPreview, setShowEquationPreview] = createSignal(true)

  // Keyboard shortcuts modal
  const [showShortcuts, setShowShortcuts] = createSignal(false)

  // Hidden file upload input ref
  let uploadInputRef!: HTMLInputElement

  const v = () => props.editorView?.()

  const handleWordCount = () => {
    const content = props.editorContent?.() ?? v()?.state.doc.toString() ?? ""
    // Strip LaTeX commands/envs for a rough word count (similar to Overleaf)
    const stripped = content
      .replace(/\\begin\{[^}]*\}[\s\S]*?\\end\{[^}]*\}/g, " ")
      .replace(/\\[a-zA-Z]+(?:\[[^\]]*\])?(?:\{[^}]*\})?/g, " ")
      .replace(/\$[^$]*\$/g, " ")
    const words = stripped.match(/\b[a-zA-Z''\-]{2,}\b/g)?.length ?? 0
    setWc({ words, chars: content.replace(/\s/g, "").length, lines: content.split("\n").length })
    setShowWordCount(true)
  }

  return (
    <>
      {/* ── Word Count Modal ──────────────────────────────────────────── */}
      <Show when={showWordCount()}>
        <div
          class="fixed inset-0 z-[200] flex items-center justify-center bg-black/30"
          onClick={() => setShowWordCount(false)}
        >
          <div
            class="bg-surface-raised-base border border-border-base rounded-xl shadow-xl p-6 w-72"
            onClick={(e) => e.stopPropagation()}
          >
            <div class="text-14-medium text-text-strong mb-4">Word Count</div>
            <div class="flex flex-col gap-2">
              {([
                ["Words", wc().words],
                ["Characters (no spaces)", wc().chars],
                ["Lines", wc().lines],
              ] as [string, number][]).map(([label, val]) => (
                <div class="flex justify-between text-13-regular">
                  <span class="text-text-weak">{label}</span>
                  <span class="text-text-base">{val.toLocaleString()}</span>
                </div>
              ))}
            </div>
            <button
              class="mt-5 w-full px-3 py-1.5 rounded-md bg-surface-base text-12-medium text-text-base hover:bg-surface-strong transition-colors"
              onClick={() => setShowWordCount(false)}
            >
              Close
            </button>
          </div>
        </div>
      </Show>

      {/* ── Keyboard Shortcuts Modal ──────────────────────────────────── */}
      <Show when={showShortcuts()}>
        <div
          class="fixed inset-0 z-[200] flex items-center justify-center bg-black/30"
          onClick={() => setShowShortcuts(false)}
        >
          <div
            class="bg-surface-raised-base border border-border-base rounded-xl shadow-xl p-6 w-[480px] max-h-[70vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div class="text-14-medium text-text-strong mb-4">Keyboard Shortcuts</div>
            <div class="grid grid-cols-2 gap-x-8 gap-y-1.5 text-12-regular">
              {([
                ["Compile", "⌘S"],
                ["Undo", "⌘Z"],
                ["Redo", "⌘Y"],
                ["Find & Replace", "⌘F"],
                ["Select All", "⌘A"],
                ["Bold", "⌘B"],
                ["Italic", "⌘I"],
                ["Comment line", "⌘/"],
                ["Split view", "⌃⌘↓"],
                ["Editor only", "⌃⌘←"],
                ["PDF only", "⌃⌘→"],
                ["Zoom in", "⌘+"],
                ["Zoom out", "⌘-"],
                ["Indent", "Tab"],
                ["Outdent", "⇧Tab"],
                ["Go to line", "⌘G"],
              ] as [string, string][]).map(([action, key]) => (
                <div class="flex justify-between py-0.5">
                  <span class="text-text-weak">{action}</span>
                  <kbd class="text-text-muted font-mono text-11-regular">{key}</kbd>
                </div>
              ))}
            </div>
            <button
              class="mt-5 w-full px-3 py-1.5 rounded-md bg-surface-base text-12-medium text-text-base hover:bg-surface-strong transition-colors"
              onClick={() => setShowShortcuts(false)}
            >
              Close
            </button>
          </div>
        </div>
      </Show>

      {/* ── Hidden upload input ───────────────────────────────────────── */}
      <input
        ref={uploadInputRef}
        type="file"
        multiple
        accept=".tex,.bib,.cls,.sty,.bst,.bbx,.cbx,.def,.txt,.png,.jpg,.jpeg,.pdf,.eps"
        class="hidden"
        onChange={(e) => {
          const files = e.currentTarget.files
          if (files && files.length > 0) props.onUploadFile?.(files)
          e.currentTarget.value = ""
        }}
      />

      {/* ── File ─────────────────────────────────────────────────────── */}
      <DropdownMenu gutter={0} placement="bottom-start">
        <DropdownMenu.Trigger class={T}>File</DropdownMenu.Trigger>
        <DropdownMenu.Portal>
          <DropdownMenu.Content>
            <DropdownMenu.Item onSelect={() => props.onNewFile?.()}>
              <DropdownMenu.ItemLabel>New file</DropdownMenu.ItemLabel>
            </DropdownMenu.Item>
            <DropdownMenu.Item onSelect={() => props.onNewFolder?.()}>
              <DropdownMenu.ItemLabel>New folder</DropdownMenu.ItemLabel>
            </DropdownMenu.Item>
            <DropdownMenu.Item onSelect={() => uploadInputRef.click()}>
              <DropdownMenu.ItemLabel>Upload file</DropdownMenu.ItemLabel>
            </DropdownMenu.Item>
            <DropdownMenu.Separator />
            <DropdownMenu.Item>
              <DropdownMenu.ItemLabel>Show version history</DropdownMenu.ItemLabel>
            </DropdownMenu.Item>
            <DropdownMenu.Item onSelect={handleWordCount}>
              <DropdownMenu.ItemLabel>Word count</DropdownMenu.ItemLabel>
            </DropdownMenu.Item>
            <DropdownMenu.Separator />
            <DropdownMenu.Item>
              <DropdownMenu.ItemLabel>Submit</DropdownMenu.ItemLabel>
            </DropdownMenu.Item>
            <DropdownMenu.Separator />
            <DropdownMenu.Item onSelect={() => props.onDownloadSource?.()}>
              <DropdownMenu.ItemLabel>Download as source (.zip)</DropdownMenu.ItemLabel>
            </DropdownMenu.Item>
            <DropdownMenu.Item onSelect={() => props.onDownloadPdf?.()}>
              <DropdownMenu.ItemLabel>Download as PDF</DropdownMenu.ItemLabel>
            </DropdownMenu.Item>
            <DropdownMenu.Separator />
            <DropdownMenu.Item>
              <DropdownMenu.ItemLabel>Settings</DropdownMenu.ItemLabel>
            </DropdownMenu.Item>
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu>

      {/* ── Edit ─────────────────────────────────────────────────────── */}
      <DropdownMenu gutter={0} placement="bottom-start">
        <DropdownMenu.Trigger class={T}>Edit</DropdownMenu.Trigger>
        <DropdownMenu.Portal>
          <DropdownMenu.Content>
            <DropdownMenu.Item onSelect={() => { const e = v(); if (e) undo(e) }}>
              <DropdownMenu.ItemLabel>Undo</DropdownMenu.ItemLabel>
              <DropdownMenu.ItemDescription>⌘Z</DropdownMenu.ItemDescription>
            </DropdownMenu.Item>
            <DropdownMenu.Item onSelect={() => { const e = v(); if (e) redo(e) }}>
              <DropdownMenu.ItemLabel>Redo</DropdownMenu.ItemLabel>
              <DropdownMenu.ItemDescription>⌘Y</DropdownMenu.ItemDescription>
            </DropdownMenu.Item>
            <DropdownMenu.Separator />
            <DropdownMenu.Item onSelect={() => { const e = v(); if (e) openSearchPanel(e) }}>
              <DropdownMenu.ItemLabel>Find</DropdownMenu.ItemLabel>
              <DropdownMenu.ItemDescription>⌘F</DropdownMenu.ItemDescription>
            </DropdownMenu.Item>
            <DropdownMenu.Item onSelect={() => { const e = v(); if (e) selectAll(e) }}>
              <DropdownMenu.ItemLabel>Select all</DropdownMenu.ItemLabel>
              <DropdownMenu.ItemDescription>⌘A</DropdownMenu.ItemDescription>
            </DropdownMenu.Item>
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu>

      {/* ── Insert ───────────────────────────────────────────────────── */}
      <DropdownMenu gutter={0} placement="bottom-start">
        <DropdownMenu.Trigger class={T}>Insert</DropdownMenu.Trigger>
        <DropdownMenu.Portal>
          <DropdownMenu.Content>
            <DropdownMenu.Item
              onSelect={() => {
                const e = v(); if (!e) return
                insert(e,
                  "\\begin{figure}[htbp]\n  \\centering\n  \\includegraphics[width=0.8\\linewidth]{figure}\n  \\caption{Caption}\n  \\label{fig:label}\n\\end{figure}\n",
                  45)
              }}
            >
              <DropdownMenu.ItemLabel>Figure</DropdownMenu.ItemLabel>
            </DropdownMenu.Item>
            <DropdownMenu.Item
              onSelect={() => {
                const e = v(); if (!e) return
                insert(e,
                  "\\begin{table}[htbp]\n  \\centering\n  \\caption{Caption}\n  \\label{tab:label}\n  \\begin{tabular}{cc}\n    \\hline\n    Col 1 & Col 2 \\\\\n    \\hline\n    A & B \\\\\n    \\hline\n  \\end{tabular}\n\\end{table}\n",
                  53)
              }}
            >
              <DropdownMenu.ItemLabel>Table</DropdownMenu.ItemLabel>
            </DropdownMenu.Item>
            <DropdownMenu.Separator />
            <DropdownMenu.Item onSelect={() => { const e = v(); if (e) wrap(e, "$", "$", "expression") }}>
              <DropdownMenu.ItemLabel>Inline math</DropdownMenu.ItemLabel>
            </DropdownMenu.Item>
            <DropdownMenu.Item
              onSelect={() => {
                const e = v(); if (!e) return
                insert(e, "\\[\n  \n\\]", 5)
              }}
            >
              <DropdownMenu.ItemLabel>Display math</DropdownMenu.ItemLabel>
            </DropdownMenu.Item>
            <DropdownMenu.Item
              onSelect={() => {
                const e = v(); if (!e) return
                insert(e, "\\begin{equation}\n  \n\\end{equation}", 20)
              }}
            >
              <DropdownMenu.ItemLabel>Numbered equation</DropdownMenu.ItemLabel>
            </DropdownMenu.Item>
            <DropdownMenu.Separator />
            <DropdownMenu.Item onSelect={() => { const e = v(); if (e) insert(e, "\\ref{}", 5) }}>
              <DropdownMenu.ItemLabel>Cross-reference</DropdownMenu.ItemLabel>
            </DropdownMenu.Item>
            <DropdownMenu.Item onSelect={() => { const e = v(); if (e) insert(e, "\\cite{}", 6) }}>
              <DropdownMenu.ItemLabel>Citation</DropdownMenu.ItemLabel>
            </DropdownMenu.Item>
            <DropdownMenu.Item onSelect={() => { const e = v(); if (e) wrap(e, "\\footnote{", "}", "footnote text") }}>
              <DropdownMenu.ItemLabel>Footnote</DropdownMenu.ItemLabel>
            </DropdownMenu.Item>
            <DropdownMenu.Separator />
            <DropdownMenu.Item onSelect={() => { const e = v(); if (e) insert(e, "\\hrule\n") }}>
              <DropdownMenu.ItemLabel>Horizontal rule</DropdownMenu.ItemLabel>
            </DropdownMenu.Item>
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu>

      {/* ── View ─────────────────────────────────────────────────────── */}
      <DropdownMenu gutter={0} placement="bottom-start">
        <DropdownMenu.Trigger class={T}>View</DropdownMenu.Trigger>
        <DropdownMenu.Portal>
          <DropdownMenu.Content>
            <DropdownMenu.Group>
              <DropdownMenu.GroupLabel>Layout options</DropdownMenu.GroupLabel>
              <DropdownMenu.RadioGroup
                value={props.viewMode()}
                onChange={(v) => props.onViewModeChange(v as ViewMode)}
              >
                <DropdownMenu.RadioItem value="split">
                  <DropdownMenu.ItemLabel>Split view</DropdownMenu.ItemLabel>
                  <DropdownMenu.ItemDescription>⌃⌘↓</DropdownMenu.ItemDescription>
                </DropdownMenu.RadioItem>
                <DropdownMenu.RadioItem value="editor">
                  <DropdownMenu.ItemLabel>Editor only</DropdownMenu.ItemLabel>
                  <DropdownMenu.ItemDescription>⌃⌘←</DropdownMenu.ItemDescription>
                </DropdownMenu.RadioItem>
                <DropdownMenu.RadioItem value="pdf">
                  <DropdownMenu.ItemLabel>PDF only</DropdownMenu.ItemLabel>
                  <DropdownMenu.ItemDescription>⌃⌘→</DropdownMenu.ItemDescription>
                </DropdownMenu.RadioItem>
              </DropdownMenu.RadioGroup>
            </DropdownMenu.Group>
            <DropdownMenu.Separator />
            <DropdownMenu.Group>
              <DropdownMenu.GroupLabel>Editor settings</DropdownMenu.GroupLabel>
              <DropdownMenu.CheckboxItem
                checked={showBreadcrumbs()}
                onChange={setShowBreadcrumbs}
              >
                Show breadcrumbs
              </DropdownMenu.CheckboxItem>
              <DropdownMenu.CheckboxItem
                checked={showEquationPreview()}
                onChange={setShowEquationPreview}
              >
                Show equation preview
              </DropdownMenu.CheckboxItem>
            </DropdownMenu.Group>
            <DropdownMenu.Separator />
            <DropdownMenu.Group>
              <DropdownMenu.GroupLabel>PDF preview</DropdownMenu.GroupLabel>
              <DropdownMenu.Item onSelect={() => props.onPdfZoomIn?.()}>
                <DropdownMenu.ItemLabel>Zoom in</DropdownMenu.ItemLabel>
                <DropdownMenu.ItemDescription>⌘+</DropdownMenu.ItemDescription>
              </DropdownMenu.Item>
              <DropdownMenu.Item onSelect={() => props.onPdfZoomOut?.()}>
                <DropdownMenu.ItemLabel>Zoom out</DropdownMenu.ItemLabel>
                <DropdownMenu.ItemDescription>⌘-</DropdownMenu.ItemDescription>
              </DropdownMenu.Item>
              <DropdownMenu.Item onSelect={() => props.onPdfFitWidth?.()}>
                <DropdownMenu.ItemLabel>Fit to width</DropdownMenu.ItemLabel>
              </DropdownMenu.Item>
            </DropdownMenu.Group>
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu>

      {/* ── Format ───────────────────────────────────────────────────── */}
      <DropdownMenu gutter={0} placement="bottom-start">
        <DropdownMenu.Trigger class={T}>Format</DropdownMenu.Trigger>
        <DropdownMenu.Portal>
          <DropdownMenu.Content>
            <DropdownMenu.Item onSelect={() => { const e = v(); if (e) wrap(e, "\\textbf{", "}") }}>
              <DropdownMenu.ItemLabel>Bold</DropdownMenu.ItemLabel>
              <DropdownMenu.ItemDescription>⌘B</DropdownMenu.ItemDescription>
            </DropdownMenu.Item>
            <DropdownMenu.Item onSelect={() => { const e = v(); if (e) wrap(e, "\\textit{", "}") }}>
              <DropdownMenu.ItemLabel>Italics</DropdownMenu.ItemLabel>
              <DropdownMenu.ItemDescription>⌘I</DropdownMenu.ItemDescription>
            </DropdownMenu.Item>
            <DropdownMenu.Separator />
            <DropdownMenu.Item
              onSelect={() => {
                const e = v(); if (!e) return
                insert(e, "\\begin{itemize}\n  \\item \n\\end{itemize}\n", 29)
              }}
            >
              <DropdownMenu.ItemLabel>Bullet list</DropdownMenu.ItemLabel>
            </DropdownMenu.Item>
            <DropdownMenu.Item
              onSelect={() => {
                const e = v(); if (!e) return
                insert(e, "\\begin{enumerate}\n  \\item \n\\end{enumerate}\n", 32)
              }}
            >
              <DropdownMenu.ItemLabel>Numbered list</DropdownMenu.ItemLabel>
            </DropdownMenu.Item>
            <DropdownMenu.Item onSelect={() => { const e = v(); if (e) indentMore(e) }}>
              <DropdownMenu.ItemLabel>Increase indentation</DropdownMenu.ItemLabel>
            </DropdownMenu.Item>
            <DropdownMenu.Item onSelect={() => { const e = v(); if (e) indentLess(e) }}>
              <DropdownMenu.ItemLabel>Decrease indentation</DropdownMenu.ItemLabel>
            </DropdownMenu.Item>
            <DropdownMenu.Separator />
            <DropdownMenu.Group>
              <DropdownMenu.GroupLabel>Paragraph styles</DropdownMenu.GroupLabel>
              {([
                ["Normal", null],
                ["Section", "section"],
                ["Subsection", "subsection"],
                ["Subsubsection", "subsubsection"],
                ["Paragraph", "paragraph"],
                ["Subparagraph", "subparagraph"],
              ] as [string, string | null][]).map(([label, cmd]) => (
                <DropdownMenu.Item
                  onSelect={() => {
                    const e = v(); if (!e) return
                    if (!cmd) { e.focus(); return }
                    sectionWrap(e, cmd)
                  }}
                >
                  <DropdownMenu.ItemLabel>{label}</DropdownMenu.ItemLabel>
                </DropdownMenu.Item>
              ))}
            </DropdownMenu.Group>
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu>

      {/* ── Help ─────────────────────────────────────────────────────── */}
      <DropdownMenu gutter={0} placement="bottom-start">
        <DropdownMenu.Trigger class={T}>Help</DropdownMenu.Trigger>
        <DropdownMenu.Portal>
          <DropdownMenu.Content>
            <DropdownMenu.Item onSelect={() => setShowShortcuts(true)}>
              <DropdownMenu.ItemLabel>Keyboard shortcuts</DropdownMenu.ItemLabel>
            </DropdownMenu.Item>
            <DropdownMenu.Item
              onSelect={() => window.open("https://www.overleaf.com/learn", "_blank")}
            >
              <DropdownMenu.ItemLabel>Documentation</DropdownMenu.ItemLabel>
            </DropdownMenu.Item>
            <DropdownMenu.Separator />
            <DropdownMenu.Item
              onSelect={() => window.open("https://www.overleaf.com/contact", "_blank")}
            >
              <DropdownMenu.ItemLabel>Contact us</DropdownMenu.ItemLabel>
            </DropdownMenu.Item>
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu>
    </>
  )
}
