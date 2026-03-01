import { createEffect, createSignal, on, onCleanup, onMount } from "solid-js"
import { EditorState, type Extension } from "@codemirror/state"
import { EditorView, keymap, lineNumbers, highlightActiveLine, highlightActiveLineGutter, drawSelection, rectangularSelection } from "@codemirror/view"
import { defaultKeymap, history, historyKeymap, indentWithTab } from "@codemirror/commands"
import { bracketMatching, foldGutter, foldKeymap, foldService, indentOnInput, syntaxHighlighting, defaultHighlightStyle, HighlightStyle } from "@codemirror/language"
import { searchKeymap, highlightSelectionMatches } from "@codemirror/search"
import { autocompletion, completionKeymap, closeBrackets, closeBracketsKeymap } from "@codemirror/autocomplete"
import { StreamLanguage } from "@codemirror/language"
import { tags } from "@lezer/highlight"

// LaTeX stream parser (since there's no built-in @codemirror/lang-latex)
const latexLanguage = StreamLanguage.define({
  startState() {
    return { inMath: false, inComment: false }
  },
  token(stream, state) {
    // Comments
    if (stream.match("%")) {
      stream.skipToEnd()
      return "comment"
    }

    // Math mode delimiters
    if (stream.match("$$") || stream.match("\\[") || stream.match("\\]")) {
      state.inMath = !state.inMath
      return "keyword"
    }
    if (stream.match("$")) {
      state.inMath = !state.inMath
      return "keyword"
    }

    // Commands
    if (stream.match(/\\[a-zA-Z@]+/)) {
      return "keyword"
    }

    // Escaped characters
    if (stream.match(/\\./)) {
      return "string"
    }

    // Braces
    if (stream.match("{") || stream.match("}")) {
      return "bracket"
    }

    // Brackets
    if (stream.match("[") || stream.match("]")) {
      return "bracket"
    }

    // Numbers in math mode
    if (state.inMath && stream.match(/\d+(\.\d+)?/)) {
      return "number"
    }

    // Skip everything else
    stream.next()
    return state.inMath ? "string" : null
  },
})

// Section hierarchy — lower number = higher level (chapter > section > ...)
const SECTION_LEVELS: Record<string, number> = {
  "\\chapter": 0,
  "\\section": 1,
  "\\subsection": 2,
  "\\subsubsection": 3,
  "\\paragraph": 4,
  "\\subparagraph": 5,
}

// Fold service: handles \section hierarchy and \begin{...}...\end{...} environments
const latexFoldService = foldService.of((state, lineStart) => {
  const line = state.doc.lineAt(lineStart)
  const text = line.text

  // \begin{env} ... \end{env}
  const beginMatch = text.match(/^[ \t]*\\begin\{([^}]+)\}/)
  if (beginMatch) {
    const envName = beginMatch[1]
    for (let i = line.number + 1; i <= state.doc.lines; i++) {
      const l = state.doc.line(i)
      if (l.text.includes(`\\end{${envName}}`)) {
        return { from: line.to, to: l.from - 1 }
      }
    }
    return null
  }

  // \section, \subsection, etc. (with optional *)
  const sectionMatch = text.match(/^[ \t]*(\\(?:chapter|section|subsection|subsubsection|paragraph|subparagraph)\*?)/)
  if (sectionMatch) {
    const cmd = sectionMatch[1]!.replace(/\*$/, "")
    const level = SECTION_LEVELS[cmd]
    if (level === undefined) return null

    for (let i = line.number + 1; i <= state.doc.lines; i++) {
      const l = state.doc.line(i)
      const nextMatch = l.text.match(/^[ \t]*(\\(?:chapter|section|subsection|subsubsection|paragraph|subparagraph)\*?)/)
      if (nextMatch) {
        const nextCmd = nextMatch[1]!.replace(/\*$/, "")
        const nextLevel = SECTION_LEVELS[nextCmd]
        if (nextLevel !== undefined && nextLevel <= level) {
          return { from: line.to, to: l.from - 1 }
        }
      }
    }
    // No following peer/parent section — fold to end of document
    const lastLine = state.doc.line(state.doc.lines)
    if (lastLine.from > line.to) {
      return { from: line.to, to: lastLine.to }
    }
  }

  return null
})

// Custom highlight style for LaTeX
const latexHighlightStyle = HighlightStyle.define([
  { tag: tags.keyword, color: "#c678dd" },
  { tag: tags.comment, color: "#5c6370", fontStyle: "italic" },
  { tag: tags.string, color: "#98c379" },
  { tag: tags.bracket, color: "#e06c75" },
  { tag: tags.number, color: "#d19a66" },
])

// Dark theme for the editor
const darkTheme = EditorView.theme(
  {
    "&": {
      backgroundColor: "var(--color-background-base, #1e1e2e)",
      color: "var(--color-text-strong, #cdd6f4)",
      height: "100%",
    },
    ".cm-content": {
      caretColor: "var(--color-text-strong, #cdd6f4)",
      fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace",
      fontSize: "13px",
      lineHeight: "1.6",
    },
    ".cm-cursor, .cm-dropCursor": {
      borderLeftColor: "var(--color-text-strong, #cdd6f4)",
    },
    "&.cm-focused .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection": {
      backgroundColor: "var(--color-surface-raised-base, #45475a)",
    },
    ".cm-gutters": {
      backgroundColor: "var(--color-background-stronger, #181825)",
      color: "var(--color-text-weak, #6c7086)",
      border: "none",
      borderRight: "1px solid var(--color-border-base, #313244)",
    },
    ".cm-activeLineGutter": {
      backgroundColor: "var(--color-surface-base, #1e1e2e)",
      color: "var(--color-text-base, #a6adc8)",
    },
    ".cm-activeLine": {
      backgroundColor: "var(--color-surface-base, rgba(30, 30, 46, 0.5))",
    },
    ".cm-foldGutter .cm-gutterElement": {
      color: "var(--color-text-weak, #6c7086)",
    },
    ".cm-matchingBracket": {
      backgroundColor: "var(--color-surface-raised-base, #45475a)",
      outline: "1px solid var(--color-border-strong, #585b70)",
    },
  },
  { dark: true },
)

// Light theme
const lightTheme = EditorView.theme(
  {
    "&": {
      backgroundColor: "var(--color-background-base, #ffffff)",
      color: "var(--color-text-strong, #1e1e2e)",
      height: "100%",
    },
    ".cm-content": {
      caretColor: "var(--color-text-strong, #1e1e2e)",
      fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace",
      fontSize: "13px",
      lineHeight: "1.6",
    },
    ".cm-gutters": {
      backgroundColor: "var(--color-background-stronger, #f5f5f5)",
      color: "var(--color-text-weak, #999)",
      border: "none",
      borderRight: "1px solid var(--color-border-base, #e0e0e0)",
    },
    ".cm-activeLineGutter": {
      backgroundColor: "var(--color-surface-base, #f0f0f0)",
    },
    ".cm-activeLine": {
      backgroundColor: "var(--color-surface-base, rgba(0, 0, 0, 0.04))",
    },
  },
  { dark: false },
)

export interface LatexEditorProps {
  content: string
  onChange?: (content: string) => void
  onSave?: () => void
  onEditorReady?: (view: EditorView) => void
  dark?: boolean
  readOnly?: boolean
  class?: string
}

export function LatexEditor(props: LatexEditorProps) {
  let containerRef!: HTMLDivElement
  let view: EditorView | undefined

  const [mounted, setMounted] = createSignal(false)

  const baseExtensions: Extension[] = [
    lineNumbers(),
    highlightActiveLineGutter(),
    highlightActiveLine(),
    history(),
    foldGutter(),
    latexFoldService,
    drawSelection(),
    rectangularSelection(),
    indentOnInput(),
    bracketMatching(),
    closeBrackets(),
    autocompletion(),
    highlightSelectionMatches(),
    latexLanguage,
    syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
    syntaxHighlighting(latexHighlightStyle),
    keymap.of([
      ...defaultKeymap,
      ...historyKeymap,
      ...foldKeymap,
      ...searchKeymap,
      ...completionKeymap,
      ...closeBracketsKeymap,
      indentWithTab,
    ]),
    EditorView.lineWrapping,
  ]

  onMount(() => {
    const state = EditorState.create({
      doc: props.content || "",
      extensions: [
        ...baseExtensions,
        props.dark !== false ? darkTheme : lightTheme,
        EditorState.readOnly.of(props.readOnly ?? false),
        EditorView.updateListener.of((update) => {
          if (update.docChanged && props.onChange) {
            props.onChange(update.state.doc.toString())
          }
        }),
        keymap.of([
          {
            key: "Mod-s",
            run: () => {
              props.onSave?.()
              return true
            },
          },
        ]),
      ],
    })

    view = new EditorView({
      state,
      parent: containerRef,
    })

    setMounted(true)
    props.onEditorReady?.(view)
  })

  // Update content when it changes externally
  createEffect(
    on(
      () => props.content,
      (content) => {
        if (!view || !mounted()) return
        const current = view.state.doc.toString()
        if (current === content) return

        view.dispatch({
          changes: {
            from: 0,
            to: current.length,
            insert: content || "",
          },
        })
      },
      { defer: true },
    ),
  )

  onCleanup(() => {
    view?.destroy()
  })

  return <div ref={containerRef} class={`h-full overflow-hidden ${props.class ?? ""}`} />
}
