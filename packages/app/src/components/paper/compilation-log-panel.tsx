/**
 * CompilationLogPanel — Overleaf-style compilation log viewer.
 *
 * Displays parsed LaTeX compilation logs in a filterable, expandable panel
 * with colored entries by severity (error / warning / info).
 */
import { createSignal, createMemo, For, Show } from "solid-js"
import { parseLatexLog, countLogEntries, type LogEntry, type LogEntryType } from "./latex-log-parser"

interface CompilationLogPanelProps {
  log?: string
  onClose: () => void
}

type TabFilter = "all" | "error" | "warning" | "info"

const TAB_LABELS: Record<TabFilter, string> = {
  all: "All logs",
  error: "Errors",
  warning: "Warnings",
  info: "Info",
}

export function CompilationLogPanel(props: CompilationLogPanelProps) {
  const [activeTab, setActiveTab] = createSignal<TabFilter>("all")
  const [expandedSet, setExpandedSet] = createSignal<Set<number>>(new Set())

  const entries = createMemo(() => parseLatexLog(props.log ?? ""))
  const counts = createMemo(() => countLogEntries(entries()))

  const filteredEntries = createMemo(() => {
    const tab = activeTab()
    if (tab === "all") return entries()
    return entries().filter((e) => e.type === tab)
  })

  const toggleExpanded = (index: number) => {
    setExpandedSet((prev) => {
      const next = new Set(prev)
      if (next.has(index)) next.delete(index)
      else next.add(index)
      return next
    })
  }

  const isExpanded = (index: number) => expandedSet().has(index)

  const tabCount = (tab: TabFilter): number => {
    if (tab === "all") return entries().length
    if (tab === "error") return counts().errors
    if (tab === "warning") return counts().warnings
    return counts().info
  }

  const badgeColor = (tab: TabFilter): string => {
    if (tab === "error") return "bg-[#ef4444]/20 text-[#ef4444]"
    if (tab === "warning") return "bg-[#f59e0b]/20 text-[#f59e0b]"
    if (tab === "info") return "bg-[#6b7280]/20 text-[#9ca3af]"
    // "all" badge — neutral
    return "bg-[#6b7280]/15 text-[#9ca3af]"
  }

  const borderColor = (type: LogEntryType): string => {
    if (type === "error") return "border-l-[#ef4444]"
    if (type === "warning") return "border-l-[#f59e0b]"
    return "border-l-[#6b7280]"
  }

  const messageColor = (type: LogEntryType): string => {
    if (type === "error") return "text-[#ef4444]"
    if (type === "warning") return "text-[#f59e0b]"
    return "text-text-base"
  }

  const emptyLabel = (): string => {
    const tab = activeTab()
    if (tab === "all") return "No compilation issues"
    return `No ${TAB_LABELS[tab].toLowerCase()}`
  }

  return (
    <div class="flex flex-col h-full bg-background-stronger text-text-base overflow-hidden">
      {/* ── Header ───────────────────────────────────────────────────── */}
      <div class="flex items-center justify-between h-10 px-4 border-b border-border-weak-base shrink-0">
        <span class="text-13-medium text-text-strong">Compilation Logs</span>
        <button
          class="w-7 h-7 flex items-center justify-center rounded text-text-base hover:text-text-strong hover:bg-surface-base transition-colors"
          onClick={() => props.onClose()}
          title="Close logs"
        >
          <CloseIcon />
        </button>
      </div>

      {/* ── Tab bar ──────────────────────────────────────────────────── */}
      <div class="flex items-center gap-0 px-2 border-b border-border-weak-base shrink-0">
        <For each={["all", "error", "warning", "info"] as TabFilter[]}>
          {(tab) => (
            <button
              class="relative flex items-center gap-1.5 px-3 py-2.5 text-12-medium transition-colors"
              classList={{
                "text-text-strong": activeTab() === tab,
                "text-text-base hover:text-text-strong": activeTab() !== tab,
              }}
              onClick={() => setActiveTab(tab)}
            >
              {TAB_LABELS[tab]}
              <Show when={tabCount(tab) > 0}>
                <span
                  class={`inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-10-medium ${badgeColor(tab)}`}
                >
                  {tabCount(tab)}
                </span>
              </Show>
              {/* Active indicator */}
              <Show when={activeTab() === tab}>
                <div class="absolute bottom-0 left-2 right-2 h-0.5 bg-accent-base rounded-t" />
              </Show>
            </button>
          )}
        </For>
      </div>

      {/* ── Entry list ───────────────────────────────────────────────── */}
      <div class="flex-1 min-h-0 overflow-y-auto">
        <Show
          when={filteredEntries().length > 0}
          fallback={
            <div class="flex flex-col items-center justify-center h-full gap-3 text-text-base">
              <EmptyIcon />
              <span class="text-13-regular">{emptyLabel()}</span>
            </div>
          }
        >
          <div class="flex flex-col">
            <For each={filteredEntries()}>
              {(entry, index) => {
                const idx = () => index()
                const expanded = () => isExpanded(idx())
                const hasContext = () => !!entry.context

                return (
                  <div
                    class={`border-l-[3px] ${borderColor(entry.type)} transition-colors`}
                    classList={{
                      "bg-background-stronger": !expanded(),
                      "bg-surface-base": expanded(),
                    }}
                  >
                    {/* Entry header row */}
                    <button
                      class="w-full flex items-start gap-2 px-3 py-2.5 text-left hover:bg-surface-base transition-colors"
                      onClick={() => {
                        if (hasContext()) toggleExpanded(idx())
                      }}
                      style={{ cursor: hasContext() ? "pointer" : "default" }}
                    >
                      {/* Chevron */}
                      <Show when={hasContext()}>
                        <span
                          class="mt-0.5 shrink-0 text-text-base transition-transform duration-150"
                          style={{ transform: expanded() ? "rotate(90deg)" : "rotate(0deg)" }}
                        >
                          <ChevronRightIcon />
                        </span>
                      </Show>
                      <Show when={!hasContext()}>
                        <span class="w-3 shrink-0" />
                      </Show>

                      {/* Message */}
                      <span
                        class={`flex-1 text-12-regular break-words ${messageColor(entry.type)}`}
                        classList={{
                          "font-medium": entry.type === "error" || entry.type === "warning",
                        }}
                      >
                        {entry.message}
                      </span>

                      {/* File:line badge */}
                      <Show when={entry.file || entry.line}>
                        <span class="shrink-0 ml-2 px-1.5 py-0.5 rounded text-10-regular text-text-base bg-surface-raised-base whitespace-nowrap">
                          {entry.file ?? ""}
                          <Show when={entry.file && entry.line}>:</Show>
                          <Show when={entry.line}>{entry.line}</Show>
                        </span>
                      </Show>
                    </button>

                    {/* Context block (expanded) */}
                    <Show when={expanded() && entry.context}>
                      <div class="mx-3 mb-2.5 ml-8 rounded bg-background-base border border-border-weak-base">
                        <pre class="px-3 py-2 text-11-regular text-text-base font-mono whitespace-pre-wrap overflow-x-auto leading-relaxed">
                          {entry.context}
                        </pre>
                      </div>
                    </Show>
                  </div>
                )
              }}
            </For>
          </div>
        </Show>
      </div>
    </div>
  )
}

// ── Icons ───────────────────────────────────────────────────────────────────

function CloseIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
    </svg>
  )
}

function ChevronRightIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M6 4l4 4-4 4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
    </svg>
  )
}

function EmptyIcon() {
  return (
    <svg width="40" height="40" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" class="opacity-30">
      <rect x="6" y="8" width="28" height="24" rx="3" stroke="currentColor" stroke-width="1.5" />
      <path d="M12 16h16M12 21h12M12 26h8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
      <circle cx="32" cy="12" r="5" fill="#22c55e" fill-opacity="0.3" stroke="#22c55e" stroke-width="1.2" />
      <path d="M30 12l1.5 1.5L34 10.5" stroke="#22c55e" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round" />
    </svg>
  )
}
