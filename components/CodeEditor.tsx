import React, { useEffect, useRef, useCallback } from 'react';
import { EditorView, keymap, lineNumbers, highlightActiveLine, highlightActiveLineGutter, drawSelection, rectangularSelection, highlightSpecialChars, placeholder as cmPlaceholder } from '@codemirror/view';
import { EditorState, Compartment } from '@codemirror/state';
import { StreamLanguage, syntaxHighlighting, HighlightStyle, indentOnInput, bracketMatching, foldGutter, foldKeymap } from '@codemirror/language';
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands';
import { searchKeymap, highlightSelectionMatches } from '@codemirror/search';
import { stexMath } from '@codemirror/legacy-modes/mode/stex';
import { python } from '@codemirror/legacy-modes/mode/python';
import { tags } from '@lezer/highlight';

// We'll define highlight style inline since we use CSS variables for theming
const darkHighlightStyle = HighlightStyle.define([
  { tag: tags.keyword, color: '#c678dd' },
  { tag: tags.operator, color: '#56b6c2' },
  { tag: tags.special(tags.variableName), color: '#e06c75' },
  { tag: tags.typeName, color: '#e5c07b' },
  { tag: tags.atom, color: '#d19a66' },
  { tag: tags.number, color: '#d19a66' },
  { tag: tags.definition(tags.variableName), color: '#61afef' },
  { tag: tags.string, color: '#98c379' },
  { tag: tags.special(tags.string), color: '#56b6c2' },
  { tag: tags.comment, color: '#5c6370', fontStyle: 'italic' },
  { tag: tags.variableName, color: '#e06c75' },
  { tag: tags.tagName, color: '#e06c75' },
  { tag: tags.bracket, color: '#abb2bf' },
  { tag: tags.meta, color: '#61afef' },
  { tag: tags.attributeName, color: '#d19a66' },
  { tag: tags.attributeValue, color: '#98c379' },
  { tag: tags.heading, color: '#61afef', fontWeight: 'bold' },
  { tag: tags.link, color: '#56b6c2', textDecoration: 'underline' },
  { tag: tags.name, color: '#c678dd' },
  { tag: tags.macroName, color: '#c678dd' },
  { tag: tags.labelName, color: '#e5c07b' },
]);

const lightHighlightStyle = HighlightStyle.define([
  { tag: tags.keyword, color: '#a626a4' },
  { tag: tags.operator, color: '#0184bc' },
  { tag: tags.special(tags.variableName), color: '#e45649' },
  { tag: tags.typeName, color: '#c18401' },
  { tag: tags.atom, color: '#986801' },
  { tag: tags.number, color: '#986801' },
  { tag: tags.definition(tags.variableName), color: '#4078f2' },
  { tag: tags.string, color: '#50a14f' },
  { tag: tags.special(tags.string), color: '#0184bc' },
  { tag: tags.comment, color: '#a0a1a7', fontStyle: 'italic' },
  { tag: tags.variableName, color: '#e45649' },
  { tag: tags.tagName, color: '#e45649' },
  { tag: tags.bracket, color: '#383a42' },
  { tag: tags.meta, color: '#4078f2' },
  { tag: tags.attributeName, color: '#986801' },
  { tag: tags.attributeValue, color: '#50a14f' },
  { tag: tags.heading, color: '#4078f2', fontWeight: 'bold' },
  { tag: tags.link, color: '#0184bc', textDecoration: 'underline' },
  { tag: tags.name, color: '#a626a4' },
  { tag: tags.macroName, color: '#a626a4' },
  { tag: tags.labelName, color: '#c18401' },
]);

// Dark theme for the editor chrome
const darkEditorTheme = EditorView.theme({
  '&': {
    backgroundColor: 'var(--c-900)',
    color: 'var(--c-text)',
    height: '100%',
    fontSize: '13px',
  },
  '.cm-content': {
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
    padding: '16px 0',
    caretColor: 'var(--c-accent)',
  },
  '.cm-cursor, .cm-dropCursor': { borderLeftColor: 'var(--c-accent)' },
  '&.cm-focused .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection': {
    backgroundColor: 'rgba(59, 130, 246, 0.25)',
  },
  '.cm-gutters': {
    backgroundColor: 'var(--c-800)',
    color: 'var(--c-text-muted)',
    border: 'none',
    borderRight: '1px solid var(--c-border)',
    minWidth: '48px',
  },
  '.cm-lineNumbers .cm-gutterElement': {
    padding: '0 8px 0 12px',
    minWidth: '32px',
    fontSize: '12px',
  },
  '.cm-activeLineGutter': {
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    color: 'var(--c-text-secondary)',
  },
  '.cm-activeLine': {
    backgroundColor: 'rgba(59, 130, 246, 0.06)',
  },
  '.cm-foldGutter .cm-gutterElement': {
    padding: '0 4px',
    cursor: 'pointer',
  },
  '.cm-foldPlaceholder': {
    backgroundColor: 'var(--c-700)',
    border: '1px solid var(--c-600)',
    color: 'var(--c-text-muted)',
    borderRadius: '3px',
    padding: '0 4px',
    margin: '0 2px',
  },
  '.cm-searchMatch': {
    backgroundColor: 'rgba(234, 179, 8, 0.3)',
    outline: '1px solid rgba(234, 179, 8, 0.5)',
  },
  '.cm-searchMatch.cm-searchMatch-selected': {
    backgroundColor: 'rgba(59, 130, 246, 0.3)',
  },
  '.cm-panels': {
    backgroundColor: 'var(--c-800)',
    color: 'var(--c-text)',
    borderBottom: '1px solid var(--c-border)',
  },
  '.cm-panels.cm-panels-top': {
    borderBottom: '1px solid var(--c-border)',
  },
  '.cm-panel.cm-search': {
    padding: '4px 8px',
  },
  '.cm-panel.cm-search input, .cm-panel.cm-search button': {
    fontSize: '12px',
  },
  '.cm-panel.cm-search input': {
    backgroundColor: 'var(--c-900)',
    border: '1px solid var(--c-600)',
    borderRadius: '3px',
    color: 'var(--c-text)',
    padding: '2px 6px',
    outline: 'none',
  },
  '.cm-panel.cm-search input:focus': {
    borderColor: 'var(--c-accent)',
  },
  '.cm-panel.cm-search button': {
    backgroundColor: 'var(--c-700)',
    border: '1px solid var(--c-600)',
    borderRadius: '3px',
    color: 'var(--c-text-secondary)',
    padding: '2px 8px',
    cursor: 'pointer',
  },
  '.cm-panel.cm-search button:hover': {
    backgroundColor: 'var(--c-600)',
    color: 'var(--c-text)',
  },
  '.cm-tooltip': {
    backgroundColor: 'var(--c-800)',
    border: '1px solid var(--c-border)',
    borderRadius: '4px',
  },
  '.cm-tooltip-autocomplete': {
    '& > ul > li[aria-selected]': {
      backgroundColor: 'rgba(59, 130, 246, 0.2)',
    },
  },
  '.cm-scroller': {
    overflow: 'auto',
  },
}, { dark: true });

function getLanguage(fileType: string | undefined, fileName: string | undefined): StreamLanguage<any> | null {
  const ext = fileName?.split('.').pop()?.toLowerCase() || '';
  if (fileType === 'tex' || ext === 'tex' || ext === 'bib' || ext === 'sty' || ext === 'cls' || ext === 'bst') {
    return StreamLanguage.define(stexMath);
  }
  if (ext === 'py') {
    return StreamLanguage.define(python);
  }
  return null;
}

interface CodeEditorProps {
  content: string;
  onChange: (value: string) => void;
  fileType?: string;
  fileName?: string;
  readOnly?: boolean;
  theme?: 'dark' | 'light';
}

const CodeEditor: React.FC<CodeEditorProps> = ({ content, onChange, fileType, fileName, readOnly = false, theme = 'dark' }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const onChangeRef = useRef(onChange);
  const themeCompartment = useRef(new Compartment());
  const languageCompartment = useRef(new Compartment());
  const readOnlyCompartment = useRef(new Compartment());
  // Track if we're currently updating from external prop change
  const isExternalUpdate = useRef(false);

  // Keep callback ref updated
  onChangeRef.current = onChange;

  // Create or recreate editor when container mounts
  useEffect(() => {
    if (!containerRef.current) return;

    const lang = getLanguage(fileType, fileName);
    const highlightExt = theme === 'dark'
      ? syntaxHighlighting(darkHighlightStyle)
      : syntaxHighlighting(lightHighlightStyle);

    const extensions = [
      lineNumbers(),
      highlightActiveLineGutter(),
      highlightSpecialChars(),
      history(),
      foldGutter(),
      drawSelection(),
      EditorState.allowMultipleSelections.of(true),
      indentOnInput(),
      bracketMatching(),
      rectangularSelection(),
      highlightActiveLine(),
      highlightSelectionMatches(),
      keymap.of([
        ...defaultKeymap,
        ...historyKeymap,
        ...foldKeymap,
        ...searchKeymap,
        indentWithTab,
      ]),
      themeCompartment.current.of([darkEditorTheme, highlightExt]),
      languageCompartment.current.of(lang ? lang : []),
      readOnlyCompartment.current.of(EditorState.readOnly.of(readOnly)),
      EditorView.updateListener.of((update) => {
        if (update.docChanged && !isExternalUpdate.current) {
          onChangeRef.current(update.state.doc.toString());
        }
      }),
      EditorView.lineWrapping,
    ];

    const state = EditorState.create({
      doc: content,
      extensions,
    });

    const view = new EditorView({
      state,
      parent: containerRef.current,
    });

    viewRef.current = view;

    return () => {
      view.destroy();
      viewRef.current = null;
    };
    // Only recreate editor if container changes — content/theme/lang updates are handled via effects below
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync content from prop to editor (when user switches files)
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    const currentDoc = view.state.doc.toString();
    if (currentDoc !== content) {
      isExternalUpdate.current = true;
      view.dispatch({
        changes: { from: 0, to: currentDoc.length, insert: content },
      });
      isExternalUpdate.current = false;
    }
  }, [content]);

  // Update theme
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    const highlightExt = theme === 'dark'
      ? syntaxHighlighting(darkHighlightStyle)
      : syntaxHighlighting(lightHighlightStyle);
    view.dispatch({
      effects: themeCompartment.current.reconfigure([darkEditorTheme, highlightExt]),
    });
  }, [theme]);

  // Update language mode
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    const lang = getLanguage(fileType, fileName);
    view.dispatch({
      effects: languageCompartment.current.reconfigure(lang ? lang : []),
    });
  }, [fileType, fileName]);

  // Update readOnly
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    view.dispatch({
      effects: readOnlyCompartment.current.reconfigure(EditorState.readOnly.of(readOnly)),
    });
  }, [readOnly]);

  return (
    <div ref={containerRef} className="h-full w-full overflow-hidden" />
  );
};

export default React.memo(CodeEditor);
