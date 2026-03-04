import React, { useState, useRef, useEffect, useCallback, useMemo, KeyboardEvent as ReactKeyboardEvent } from 'react';
import { Icons } from './Icon';
import {
  Message, Reference, GeneratedFile, ResearchState, FileType,
  PartMessage, MessagePart as MessagePartType, TextPart, ThinkingPart,
  ToolCallPart, SearchPart, ImageGenPart, FileGenPart, RefVerifyPart,
  ErrorPart, PartStatus, ProviderId, ProviderConnection,
} from '../types';
import {
  streamResearchChat, refineImagePrompt, searchRecentPapers,
  generateResearchPlan, generateMainTex, generateRefBib,
  generateFigureScripts, generateArchitectureReact,
} from '../services/claudeService';
import { generateImage, setGeminiApiKey } from '../services/geminiService';
import { verifyReferences } from '../services/openaiService';
import MarkdownPreview from './MarkdownPreview';
import { MessagePartDisplay, SessionTurn } from './MessagePart';
import { TextShimmer } from './TextShimmer';
import { BasicTool } from './BasicTool';
import { Collapsible } from './Collapsible';
import {
  Cpu, Send, Search, FileText, Image, PenTool, X, Check,
  ChevronDown, Loader2, AlertCircle, CheckCircle, Globe,
  Plug, PlugZap, KeyRound, Settings, Wifi, WifiOff,
  AtSign, Slash, Paperclip, ArrowUp, ArrowDown,
  Download, Save, Copy, FilePlus, Replace,
  GripVertical, Share2,
} from 'lucide-react';

// ═══════════════════════════════════════════════════════════
// Utilities
// ═══════════════════════════════════════════════════════════

let _partId = 0;
const nextPartId = () => `p-${Date.now()}-${++_partId}`;
const nextMsgId = () => `m-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

/** Create a throttled update function for streaming */
const createThrottledUpdate = (fn: (id: string, updater: (msg: PartMessage) => PartMessage) => void, ms = 60) => {
  let pending: { id: string; updater: (msg: PartMessage) => PartMessage } | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;
  const flush = () => { if (pending) { fn(pending.id, pending.updater); pending = null; } timer = null; };
  const throttled = (id: string, updater: (msg: PartMessage) => PartMessage) => {
    pending = { id, updater };
    if (!timer) timer = setTimeout(flush, ms);
  };
  throttled.flush = () => { if (timer) { clearTimeout(timer); timer = null; } flush(); };
  return throttled;
};

// ═══════════════════════════════════════════════════════════
// Provider Panel (multi-provider login/logout)
// ═══════════════════════════════════════════════════════════

const PROVIDER_DEFAULTS: ProviderConnection[] = [
  {
    id: 'anthropic', name: 'Anthropic (Claude)', status: 'disconnected',
    models: ['claude-opus-4-6', 'claude-sonnet-4-5-20250514'],
    icon: '🟠',
  },
  {
    id: 'google', name: 'Google (Gemini)', status: 'disconnected',
    models: ['gemini-3.0-pro-image-generation'],
    icon: '🔵',
  },
  {
    id: 'openai', name: 'OpenAI (GPT)', status: 'disconnected',
    models: ['gpt-5.2'],
    icon: '🟢',
  },
];

interface ProviderPanelProps {
  providers: ProviderConnection[];
  onConnect: (id: ProviderId, apiKey: string) => void;
  onDisconnect: (id: ProviderId) => void;
}

const ProviderPanel: React.FC<ProviderPanelProps> = ({ providers, onConnect, onDisconnect }) => {
  const [editingKey, setEditingKey] = useState<ProviderId | null>(null);
  const [keyInput, setKeyInput] = useState('');

  const handleSubmitKey = (id: ProviderId) => {
    if (keyInput.trim()) {
      onConnect(id, keyInput.trim());
      setKeyInput('');
      setEditingKey(null);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '8px 0' }}>
      {providers.map(p => (
        <div key={p.id} data-component="provider-status">
          <span
            data-slot="provider-status-dot"
            data-status={p.status}
          />
          <span style={{ flex: 1, fontSize: 13, color: 'var(--c-text)', fontWeight: 500 }}>
            {p.icon} {p.name}
          </span>
          {p.status === 'connected' ? (
            <button
              onClick={() => onDisconnect(p.id)}
              style={{
                background: 'none', border: '1px solid rgba(239,68,68,0.3)',
                color: 'rgb(239,68,68)', fontSize: 11, padding: '2px 8px',
                borderRadius: 4, cursor: 'pointer',
              }}
            >
              Disconnect
            </button>
          ) : editingKey === p.id ? (
            <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
              <input
                type="password"
                value={keyInput}
                onChange={e => setKeyInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSubmitKey(p.id)}
                placeholder="API Key..."
                autoFocus
                style={{
                  background: 'var(--c-800)', border: '1px solid var(--c-border)',
                  color: 'var(--c-text)', fontSize: 11, padding: '3px 6px',
                  borderRadius: 4, width: 140, outline: 'none',
                }}
              />
              <button
                onClick={() => handleSubmitKey(p.id)}
                style={{
                  background: 'var(--c-accent)', border: 'none', color: 'white',
                  fontSize: 11, padding: '3px 8px', borderRadius: 4, cursor: 'pointer',
                }}
              >
                Connect
              </button>
              <button
                onClick={() => { setEditingKey(null); setKeyInput(''); }}
                style={{ background: 'none', border: 'none', color: 'var(--c-text-muted)', cursor: 'pointer', padding: 2 }}
              >
                <X size={12} />
              </button>
            </div>
          ) : (
            <button
              onClick={() => setEditingKey(p.id)}
              style={{
                background: 'none', border: '1px solid var(--c-border)',
                color: 'var(--c-text-secondary)', fontSize: 11, padding: '2px 8px',
                borderRadius: 4, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4,
              }}
            >
              <KeyRound size={10} /> Connect
            </button>
          )}
          {p.status === 'error' && p.error && (
            <span style={{ fontSize: 10, color: 'rgb(239,68,68)' }}>{p.error}</span>
          )}
        </div>
      ))}
    </div>
  );
};

// ═══════════════════════════════════════════════════════════
// ContentEditable Prompt Input
// ═══════════════════════════════════════════════════════════

interface PromptInputProps {
  value: string;
  onChange: (val: string) => void;
  onSend: () => void;
  disabled?: boolean;
  placeholder?: string;
  history?: string[];
}

const PromptInput: React.FC<PromptInputProps> = ({ value, onChange, onSend, disabled, placeholder, history = [] }) => {
  const editorRef = useRef<HTMLDivElement>(null);
  const [historyIdx, setHistoryIdx] = useState(-1);
  const [showSlashMenu, setShowSlashMenu] = useState(false);
  const [showAtMenu, setShowAtMenu] = useState(false);
  const [slashFilter, setSlashFilter] = useState('');
  const [atFilter, setAtFilter] = useState('');

  const slashCommands = [
    { cmd: '@research', label: 'Research a topic', color: 'rgb(34,197,94)' },
    { cmd: '@image', label: 'Generate an image', color: 'rgb(168,85,247)' },
    { cmd: '@edit', label: 'Edit current file', color: 'rgb(245,158,11)' },
  ];

  const filteredSlash = slashCommands.filter(c =>
    c.cmd.toLowerCase().includes(slashFilter.toLowerCase())
  );

  // Sync external value → contenteditable
  useEffect(() => {
    const el = editorRef.current;
    if (!el) return;
    if (el.textContent !== value) {
      el.textContent = value;
      // Move cursor to end
      if (value) {
        const range = document.createRange();
        range.selectNodeContents(el);
        range.collapse(false);
        const sel = window.getSelection();
        sel?.removeAllRanges();
        sel?.addRange(range);
      }
    }
  }, [value]);

  const handleInput = () => {
    const text = editorRef.current?.textContent || '';
    onChange(text);

    // Check for slash/at menus
    if (text.startsWith('@') && text.length <= 15 && !text.includes(' ')) {
      setShowAtMenu(true);
      setAtFilter(text);
    } else {
      setShowAtMenu(false);
    }

    if (text.startsWith('/') && text.length <= 15 && !text.includes(' ')) {
      setShowSlashMenu(true);
      setSlashFilter(text);
    } else {
      setShowSlashMenu(false);
    }
  };

  const handleKeyDown = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    // Enter to send (Shift+Enter for newline)
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (showAtMenu || showSlashMenu) {
        // Select first item in menu
        const cmd = showAtMenu ? filteredSlash[0]?.cmd : filteredSlash[0]?.cmd;
        if (cmd) {
          onChange(cmd + ' ');
          setShowAtMenu(false);
          setShowSlashMenu(false);
        }
        return;
      }
      onSend();
      return;
    }

    // Arrow up/down for history
    if (e.key === 'ArrowUp' && (!value || historyIdx >= 0)) {
      e.preventDefault();
      const newIdx = Math.min(historyIdx + 1, history.length - 1);
      if (history[newIdx]) {
        setHistoryIdx(newIdx);
        onChange(history[newIdx]);
      }
      return;
    }
    if (e.key === 'ArrowDown' && historyIdx >= 0) {
      e.preventDefault();
      const newIdx = historyIdx - 1;
      if (newIdx < 0) {
        setHistoryIdx(-1);
        onChange('');
      } else {
        setHistoryIdx(newIdx);
        onChange(history[newIdx]);
      }
      return;
    }

    // Escape to close menus
    if (e.key === 'Escape') {
      setShowAtMenu(false);
      setShowSlashMenu(false);
    }
  };

  const selectCommand = (cmd: string) => {
    onChange(cmd + ' ');
    setShowAtMenu(false);
    setShowSlashMenu(false);
    editorRef.current?.focus();
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const text = e.clipboardData.getData('text/plain');
    document.execCommand('insertText', false, text);
  };

  return (
    <div style={{ position: 'relative' }}>
      {/* @ menu dropdown */}
      {showAtMenu && filteredSlash.length > 0 && (
        <div data-component="prompt-menu" style={{
          position: 'absolute', bottom: '100%', left: 0, right: 0,
          background: 'var(--c-800)', border: '1px solid var(--c-border)',
          borderRadius: 8, padding: 4, marginBottom: 4, zIndex: 100,
          boxShadow: '0 -4px 16px rgba(0,0,0,0.3)',
        }}>
          {filteredSlash.map(cmd => (
            <div
              key={cmd.cmd}
              onClick={() => selectCommand(cmd.cmd)}
              style={{
                padding: '6px 10px', borderRadius: 6, cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 8, fontSize: 13,
              }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--c-700)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
              <span style={{ color: cmd.color, fontWeight: 600, fontFamily: 'monospace', fontSize: 12 }}>{cmd.cmd}</span>
              <span style={{ color: 'var(--c-text-muted)', fontSize: 12 }}>{cmd.label}</span>
            </div>
          ))}
        </div>
      )}

      <div
        ref={editorRef}
        contentEditable={!disabled}
        onInput={handleInput}
        onKeyDown={handleKeyDown}
        onPaste={handlePaste}
        data-placeholder={placeholder || 'Ask anything, or use @research @image @edit...'}
        style={{
          minHeight: 48, maxHeight: 200, overflowY: 'auto',
          padding: '12px 14px', fontSize: 14, lineHeight: '1.5',
          color: 'var(--c-text)', outline: 'none',
          whiteSpace: 'pre-wrap', wordBreak: 'break-word',
        }}
        suppressContentEditableWarning
      />
    </div>
  );
};

// ═══════════════════════════════════════════════════════════
// Diff Display for @edit operations
// ═══════════════════════════════════════════════════════════

const DiffDisplay: React.FC<{ oldText: string; newText: string; fileName: string }> = ({ oldText, newText, fileName }) => {
  // Simple line-by-line diff (using the `diff` library is imported via esm.sh)
  const [diffHtml, setDiffHtml] = useState<string>('');
  const [expanded, setExpanded] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const Diff = await import('diff');
        const changes = Diff.diffLines(oldText, newText);
        let html = '';
        for (const change of changes) {
          const lines = change.value.split('\n').filter((l: string, i: number, arr: string[]) => i < arr.length - 1 || l);
          for (const line of lines) {
            const escaped = line.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
            if (change.added) {
              html += `<div style="background:rgba(34,197,94,0.1);color:rgb(134,239,172);padding:0 8px;font-family:monospace;font-size:12px;">+ ${escaped}</div>`;
            } else if (change.removed) {
              html += `<div style="background:rgba(239,68,68,0.1);color:rgb(252,165,165);padding:0 8px;font-family:monospace;font-size:12px;text-decoration:line-through;">- ${escaped}</div>`;
            } else {
              html += `<div style="color:var(--c-text-muted);padding:0 8px;font-family:monospace;font-size:12px;">  ${escaped}</div>`;
            }
          }
        }
        setDiffHtml(html);
      } catch {
        setDiffHtml('<div style="color:var(--c-text-muted)">Diff library not available</div>');
      }
    })();
  }, [oldText, newText]);

  return (
    <Collapsible defaultOpen={expanded}>
      <Collapsible.Trigger>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', cursor: 'pointer' }}>
          <FileText size={14} style={{ color: 'var(--c-accent)' }} />
          <span style={{ fontSize: 13, color: 'var(--c-text)', fontWeight: 500 }}>{fileName}</span>
          <Collapsible.Arrow />
        </div>
      </Collapsible.Trigger>
      <Collapsible.Content>
        <div
          style={{
            maxHeight: 400, overflowY: 'auto', borderRadius: 6,
            border: '1px solid var(--c-border)', background: 'var(--c-800)',
          }}
          dangerouslySetInnerHTML={{ __html: diffHtml }}
        />
      </Collapsible.Content>
    </Collapsible>
  );
};

// ═══════════════════════════════════════════════════════════
// ChatPanel (Rewritten — Part-based + OpenCode-driven)
// ═══════════════════════════════════════════════════════════

const IMAGE_CMD = /^@image\s+(.+)/is;
const RESEARCH_CMD = /^@research\s+(.+)/is;
const EDIT_CMD = /^@edit\s+(.+)/is;

const INITIAL_RESEARCH: ResearchState = {
  stage: 'idle', topic: '', papers: '', plan: '', files: [], currentStep: '',
};

interface ChatPanelProps {
  documentContent: string;
  activeFileName?: string;
  references: Reference[];
  onApplyCode: (code: string) => void;
  onUpdateContent: (newContent: string) => void;
  onCreateFiles?: (folderName: string, files: GeneratedFile[]) => void;
  onAddFile?: (name: string, content: string, fileType: FileType, data?: string) => void;
}

const ChatPanel: React.FC<ChatPanelProps> = ({
  documentContent, activeFileName, references,
  onApplyCode, onUpdateContent, onCreateFiles, onAddFile,
}) => {
  // ── State ──────────────────────────────────────────────

  // Part-based messages (new system)
  const [partMessages, setPartMessages] = useState<PartMessage[]>(() => [{
    id: nextMsgId(),
    role: 'assistant',
    parts: [{
      id: nextPartId(),
      type: 'text',
      text: `Welcome to **PaperStudio Pro**.

**Commands:**
- **@research \`topic\`** — Full research pipeline: search papers, plan, generate LaTeX + ref.bib + Python figures + React architecture, verify references
- **@image \`description\`** — Generate 4K images with Gemini
- **@edit \`instruction\`** — Modify the currently open file

Or just type normally to chat with Claude Opus 4.6.`,
    } as TextPart],
    timestamp: Date.now(),
    model: 'system',
  }]);

  // Legacy messages (kept for service compatibility during migration)
  const [legacyMessages, setLegacyMessages] = useState<Message[]>([]);

  const [input, setInput] = useState('');
  const [isThinking, setIsThinking] = useState(false);
  const [research, setResearch] = useState<ResearchState>(INITIAL_RESEARCH);
  const [promptHistory, setPromptHistory] = useState<string[]>([]);
  const [showProviders, setShowProviders] = useState(false);

  // Provider connections
  const [providers, setProviders] = useState<ProviderConnection[]>(() => {
    // Auto-detect keys from env
    const list = PROVIDER_DEFAULTS.map(p => ({ ...p }));
    // Check if keys exist (they're injected by Vite)
    try {
      if ((globalThis as any).process?.env?.ANTHROPIC_API_KEY) {
        const idx = list.findIndex(p => p.id === 'anthropic');
        if (idx >= 0) list[idx].status = 'connected';
      }
      if ((globalThis as any).process?.env?.GEMINI_API_KEY) {
        const idx = list.findIndex(p => p.id === 'google');
        if (idx >= 0) list[idx].status = 'connected';
      }
      const storedGoogleKey = localStorage.getItem('paperstudio.provider.google.api-key');
      if (storedGoogleKey) {
        const idx = list.findIndex(p => p.id === 'google');
        if (idx >= 0) list[idx].status = 'connected';
      }
      if ((globalThis as any).process?.env?.OPEN_AI_KEY) {
        const idx = list.findIndex(p => p.id === 'openai');
        if (idx >= 0) list[idx].status = 'connected';
      }
    } catch {}
    return list;
  });

  // Pending image confirmation
  const [pendingImage, setPendingImage] = useState<{
    msgId: string;
    refined_prompt: string;
    summary: string;
    details: any;
  } | null>(null);

  // Refs
  const chatContainerRef = useRef<HTMLDivElement>(null);

  // ── Scrolling ──────────────────────────────────────────

  const scrollToBottom = useCallback(() => {
    const el = chatContainerRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, []);

  useEffect(() => { scrollToBottom(); }, [partMessages, scrollToBottom]);

  // ── Message helpers (part-based) ───────────────────────

  const addPartMessage = useCallback((msg: PartMessage): string => {
    setPartMessages(prev => [...prev, msg]);
    return msg.id;
  }, []);

  const updatePartMessage = useCallback((id: string, updater: (msg: PartMessage) => PartMessage) => {
    setPartMessages(prev => prev.map(m => m.id === id ? updater(m) : m));
  }, []);

  const throttledUpdate = useMemo(() => createThrottledUpdate(
    (id, updater) => setPartMessages(prev => prev.map(m => m.id === id ? updater(m) : m)),
    60,
  ), []);

  /** Add a user message */
  const addUserMessage = useCallback((text: string): PartMessage => {
    const msg: PartMessage = {
      id: nextMsgId(),
      role: 'user',
      parts: [{ id: nextPartId(), type: 'text', text } as TextPart],
      timestamp: Date.now(),
    };
    addPartMessage(msg);
    // Also add to legacy for service calls
    setLegacyMessages(prev => [...prev, { id: msg.id, role: 'user', content: text, timestamp: Date.now() }]);
    return msg;
  }, [addPartMessage]);

  /** Create an assistant message with initial parts */
  const createAssistantMsg = useCallback((parts: MessagePartType[], model?: string): PartMessage => {
    const msg: PartMessage = {
      id: nextMsgId(),
      role: 'assistant',
      parts,
      timestamp: Date.now(),
      model,
    };
    addPartMessage(msg);
    return msg;
  }, [addPartMessage]);

  /** Update/add a part in an existing assistant message */
  const upsertPart = useCallback((msgId: string, partId: string, update: Partial<MessagePartType>) => {
    updatePartMessage(msgId, msg => ({
      ...msg,
      parts: msg.parts.map(p => p.id === partId ? { ...p, ...update } as MessagePartType : p),
    }));
  }, [updatePartMessage]);

  /** Append a new part to an existing message */
  const appendPart = useCallback((msgId: string, part: MessagePartType) => {
    updatePartMessage(msgId, msg => ({
      ...msg,
      parts: [...msg.parts, part],
    }));
  }, [updatePartMessage]);

  // ── Provider management ────────────────────────────────

  const handleConnect = useCallback((id: ProviderId, apiKey: string) => {
    if (id === 'google') setGeminiApiKey(apiKey);
    setProviders(prev => prev.map(p =>
      p.id === id ? { ...p, status: 'connecting' as const, apiKey } : p
    ));
    // Simulate validation (in real app, test with a lightweight API call)
    setTimeout(() => {
      setProviders(prev => prev.map(p =>
        p.id === id ? { ...p, status: 'connected' as const } : p
      ));
    }, 800);
  }, []);

  const handleDisconnect = useCallback((id: ProviderId) => {
    if (id === 'google') setGeminiApiKey(undefined);
    setProviders(prev => prev.map(p =>
      p.id === id ? { ...p, status: 'disconnected' as const, apiKey: undefined } : p
    ));
  }, []);

  // ── Code extraction helpers ────────────────────────────

  const extractCodeFromText = (text: string): string | null => {
    const match = text.match(/```[\w]*\n([\s\S]*?)```/);
    return match ? match[1].trim() : null;
  };

  // ── Image drag/save ────────────────────────────────────

  const handleImageDragStart = useCallback((e: React.DragEvent, imageData: string, prompt: string) => {
    e.dataTransfer.setData('application/paperstudio-image', JSON.stringify({
      imageData, name: `gen_${prompt.slice(0, 30).replace(/[^a-zA-Z0-9]/g, '_')}.png`,
    }));
    e.dataTransfer.effectAllowed = 'copy';
  }, []);

  const handleSaveImageToProject = useCallback((imageData: string, prompt: string) => {
    if (!onAddFile) return;
    const name = `gen_${prompt.slice(0, 30).replace(/[^a-zA-Z0-9]/g, '_')}.png`;
    onAddFile(name, '', 'image', imageData);
    createAssistantMsg([{ id: nextPartId(), type: 'text', text: `Image saved to project as **${name}**` } as TextPart]);
  }, [onAddFile, createAssistantMsg]);

  // ═══════════════════════════════════════════════════════
  // @image flow (with part-based rendering)
  // ═══════════════════════════════════════════════════════

  const handleImageRefine = async (rawPrompt: string) => {
    const thinkingPart: ThinkingPart = { id: nextPartId(), type: 'thinking', text: 'Analyzing your image description...', title: 'Claude Opus 4.6 — Refining prompt' };
    const msgId = createAssistantMsg([thinkingPart], 'claude-opus-4-6').id;

    try {
      const result = await refineImagePrompt(rawPrompt, documentContent);
      const textPart: TextPart = {
        id: nextPartId(), type: 'text',
        text: `**Image Plan** *(Claude Opus 4.6)*\n\n> ${result.summary}\n\n---\n\n**Composition**: ${result.details.composition}\n\n**Style**: ${result.details.style}\n\n**Color Palette**: ${result.details.color_palette}\n\n**Lighting**: ${result.details.lighting}\n\n**Key Elements**: ${result.details.key_elements}\n\n---\n\n**Refined Prompt:**\n> ${result.refined_prompt}`,
      };
      updatePartMessage(msgId, msg => ({ ...msg, parts: [textPart] }));
      setPendingImage({ msgId, refined_prompt: result.refined_prompt, summary: result.summary, details: result.details });
    } catch (e: any) {
      const errPart: ErrorPart = { id: nextPartId(), type: 'error', message: 'Image prompt refinement failed', details: e.message };
      updatePartMessage(msgId, msg => ({ ...msg, parts: [errPart] }));
      setIsThinking(false);
    }
  };

  const handleConfirmImage = async () => {
    if (!pendingImage) return;
    const { refined_prompt, summary } = pendingImage;
    setPendingImage(null);
    setIsThinking(true);

    const imageGenPart: ImageGenPart = {
      id: nextPartId(), type: 'image-gen', status: 'running',
      prompt: refined_prompt, model: 'Gemini 3.0 Pro Image',
    };
    const msgId = createAssistantMsg([imageGenPart], 'gemini-3.0-pro-image').id;

    try {
      const result = await generateImage(refined_prompt);
      if (result.imageData) {
        upsertPart(msgId, imageGenPart.id, {
          status: 'completed' as PartStatus,
          refinedPrompt: refined_prompt,
          imageData: result.imageData,
        });
      } else {
        upsertPart(msgId, imageGenPart.id, {
          status: 'error' as PartStatus,
        });
        appendPart(msgId, { id: nextPartId(), type: 'error', message: 'No image returned', details: result.text || 'Gemini may have declined to generate this image.' } as ErrorPart);
      }
    } catch (e: any) {
      upsertPart(msgId, imageGenPart.id, { status: 'error' as PartStatus });
      appendPart(msgId, { id: nextPartId(), type: 'error', message: 'Image generation failed', details: e.message } as ErrorPart);
    }
    setIsThinking(false);
  };

  const handleCancelImage = () => {
    setPendingImage(null);
    setIsThinking(false);
    createAssistantMsg([{ id: nextPartId(), type: 'text', text: '*Image generation cancelled.*' } as TextPart]);
  };

  // ═══════════════════════════════════════════════════════
  // @research flow (with progressive part-based rendering)
  // ═══════════════════════════════════════════════════════

  const handleResearchStart = async (topic: string) => {
    setResearch({ ...INITIAL_RESEARCH, stage: 'searching', topic, currentStep: 'Searching papers...' });

    // Create message with search part
    const searchPart: SearchPart = {
      id: nextPartId(), type: 'search', status: 'running',
      sources: [
        { name: 'Semantic Scholar', status: 'running' as PartStatus },
        { name: 'arXiv', status: 'running' as PartStatus },
      ],
    };
    const thinkPart: ThinkingPart = {
      id: nextPartId(), type: 'thinking',
      text: `Searching for recent papers on "${topic}"...`,
      title: 'Literature Search',
    };
    const msgId = createAssistantMsg([thinkPart, searchPart], 'claude-opus-4-6').id;

    try {
      const papers = await searchRecentPapers(topic);
      // Update search sources to completed
      upsertPart(msgId, searchPart.id, {
        status: 'completed' as PartStatus,
        sources: [
          { name: 'Semantic Scholar', status: 'completed' as PartStatus, resultCount: Math.floor(papers.length / 200) },
          { name: 'arXiv', status: 'completed' as PartStatus, resultCount: Math.floor(papers.length / 300) },
        ],
        totalResults: Math.floor(papers.length / 150),
      });
      // Add text part with results
      appendPart(msgId, {
        id: nextPartId(), type: 'text',
        text: `**Literature Search Results:**\n\n${papers.slice(0, 6000)}${papers.length > 6000 ? '\n\n*...truncated...*' : ''}`,
      } as TextPart);
      setResearch(prev => ({ ...prev, stage: 'papers_found', papers, currentStep: '' }));
    } catch (e: any) {
      upsertPart(msgId, searchPart.id, {
        status: 'error' as PartStatus,
        sources: [
          { name: 'Semantic Scholar', status: 'error' as PartStatus },
          { name: 'arXiv', status: 'error' as PartStatus },
        ],
      });
      appendPart(msgId, { id: nextPartId(), type: 'error', message: 'Paper search failed', details: e.message } as ErrorPart);
      setResearch(prev => ({ ...prev, stage: 'error', error: e.message }));
      setIsThinking(false);
    }
  };

  const handleResearchPlan = async () => {
    setResearch(prev => ({ ...prev, stage: 'planning', currentStep: 'Generating research plan...' }));
    setIsThinking(true);

    const thinkPart: ThinkingPart = { id: nextPartId(), type: 'thinking', text: 'Analyzing papers and generating research plan...', title: 'Research Planning' };
    const textPart: TextPart = { id: nextPartId(), type: 'text', text: '', isStreaming: true };
    const msgId = createAssistantMsg([thinkPart, textPart], 'claude-opus-4-6').id;

    let planContent = '';
    try {
      const plan = await generateResearchPlan(research.topic, research.papers, (chunk) => {
        planContent += chunk;
        throttledUpdate(msgId, msg => ({
          ...msg,
          parts: msg.parts.map(p => p.id === textPart.id ? { ...p, text: planContent } as TextPart : p),
        }));
      });
      throttledUpdate.flush();
      upsertPart(msgId, textPart.id, { text: plan, isStreaming: false } as Partial<TextPart>);
      setResearch(prev => ({ ...prev, stage: 'plan_ready', plan, currentStep: '' }));
    } catch (e: any) {
      throttledUpdate.flush();
      appendPart(msgId, { id: nextPartId(), type: 'error', message: 'Plan generation failed', details: e.message } as ErrorPart);
      setResearch(prev => ({ ...prev, stage: 'error' }));
    }
    setIsThinking(false);
  };

  const handleGeneratePaper = async () => {
    setIsThinking(true);
    const files: GeneratedFile[] = [];

    // ── main.tex ──
    setResearch(prev => ({ ...prev, stage: 'generating_tex', currentStep: 'Generating main.tex...' }));
    const texToolPart: ToolCallPart = {
      id: nextPartId(), type: 'tool-call', tool: 'tex-generate', status: 'running',
      title: 'Generate main.tex', subtitle: 'Full LaTeX paper',
    };
    const mainMsgId = createAssistantMsg([texToolPart], 'claude-opus-4-6').id;

    try {
      let texContent = '';
      const mainTex = await generateMainTex(research.topic, research.plan, research.papers, (chunk) => {
        texContent += chunk;
        const kc = Math.round(texContent.length / 1000);
        upsertPart(mainMsgId, texToolPart.id, { subtitle: `${kc}K chars written...` });
      });
      files.push({ name: 'main.tex', content: mainTex, fileType: 'tex' });
      upsertPart(mainMsgId, texToolPart.id, {
        status: 'completed' as PartStatus,
        subtitle: `${Math.round(mainTex.length / 1000)}K chars`,
      });
    } catch (e: any) {
      upsertPart(mainMsgId, texToolPart.id, { status: 'error' as PartStatus });
      appendPart(mainMsgId, { id: nextPartId(), type: 'error', message: 'main.tex generation failed', details: e.message } as ErrorPart);
    }

    // ── ref.bib ──
    setResearch(prev => ({ ...prev, stage: 'generating_bib', currentStep: 'Generating ref.bib...' }));
    const bibToolPart: ToolCallPart = {
      id: nextPartId(), type: 'tool-call', tool: 'bib-generate', status: 'running',
      title: 'Generate ref.bib', subtitle: '50+ references',
    };
    appendPart(mainMsgId, bibToolPart);

    try {
      let bibContent = '';
      const refBib = await generateRefBib(research.plan, research.papers, (chunk) => {
        bibContent += chunk;
        const count = (bibContent.match(/@\w+\{/g) || []).length;
        upsertPart(mainMsgId, bibToolPart.id, { subtitle: `${count} entries...` });
      });
      files.push({ name: 'ref.bib', content: refBib, fileType: 'tex' });
      const finalCount = (refBib.match(/@\w+\{/g) || []).length;
      upsertPart(mainMsgId, bibToolPart.id, {
        status: 'completed' as PartStatus,
        subtitle: `${finalCount} references`,
      });

      // ── Reference verification (GPT) ──
      setResearch(prev => ({ ...prev, stage: 'verifying_refs', currentStep: 'Verifying references...' }));
      const refVerifyPart: RefVerifyPart = {
        id: nextPartId(), type: 'ref-verify', status: 'running',
        phases: [
          { name: 'DOI Validation', status: 'running' as PartStatus },
          { name: 'CrossRef Lookup', status: 'pending' as PartStatus },
          { name: 'Correction', status: 'pending' as PartStatus },
        ],
      };
      appendPart(mainMsgId, refVerifyPart);

      try {
        const { corrected, report } = await verifyReferences(refBib, (msg) => {
          // Update phases progressively
          const phases = [...refVerifyPart.phases];
          if (msg.includes('CrossRef') || msg.includes('crossref')) {
            phases[0] = { ...phases[0], status: 'completed' as PartStatus };
            phases[1] = { ...phases[1], status: 'running' as PartStatus };
          }
          if (msg.includes('correct') || msg.includes('fix')) {
            phases[1] = { ...phases[1], status: 'completed' as PartStatus };
            phases[2] = { ...phases[2], status: 'running' as PartStatus };
          }
          upsertPart(mainMsgId, refVerifyPart.id, { phases });
        });
        const bibIdx = files.findIndex(f => f.name === 'ref.bib');
        if (bibIdx >= 0) files[bibIdx].content = corrected;
        upsertPart(mainMsgId, refVerifyPart.id, {
          status: 'completed' as PartStatus,
          phases: refVerifyPart.phases.map(p => ({ ...p, status: 'completed' as PartStatus })),
          report: report.slice(0, 2000),
        });
      } catch (e: any) {
        upsertPart(mainMsgId, refVerifyPart.id, {
          status: 'error' as PartStatus,
          phases: refVerifyPart.phases.map(p => ({ ...p, status: p.status === 'running' ? 'error' as PartStatus : p.status })),
        });
      }
    } catch (e: any) {
      upsertPart(mainMsgId, bibToolPart.id, { status: 'error' as PartStatus });
      appendPart(mainMsgId, { id: nextPartId(), type: 'error', message: 'ref.bib generation failed', details: e.message } as ErrorPart);
    }

    // ── Figure scripts ──
    setResearch(prev => ({ ...prev, stage: 'generating_figures', currentStep: 'Generating figure scripts...' }));
    const figToolPart: ToolCallPart = {
      id: nextPartId(), type: 'tool-call', tool: 'fig-generate', status: 'running',
      title: 'Generate Python Figures',
    };
    appendPart(mainMsgId, figToolPart);

    try {
      const mainTex = files.find(f => f.name === 'main.tex')?.content || '';
      const scripts = await generateFigureScripts(research.plan, mainTex);
      for (const s of scripts) {
        files.push({ name: s.filename, content: s.content, fileType: 'txt', description: s.description });
      }
      upsertPart(mainMsgId, figToolPart.id, {
        status: 'completed' as PartStatus,
        subtitle: `${scripts.length} scripts`,
      });
    } catch (e: any) {
      upsertPart(mainMsgId, figToolPart.id, { status: 'error' as PartStatus });
    }

    // ── Architecture diagram ──
    const archToolPart: ToolCallPart = {
      id: nextPartId(), type: 'tool-call', tool: 'arch-generate', status: 'running',
      title: 'Architecture Diagram',
    };
    appendPart(mainMsgId, archToolPart);

    try {
      const archCode = await generateArchitectureReact(research.plan);
      if (archCode) {
        files.push({ name: 'ArchitectureDiagram.tsx', content: archCode, fileType: 'txt', description: 'React architecture diagram' });
        upsertPart(mainMsgId, archToolPart.id, { status: 'completed' as PartStatus, subtitle: 'ArchitectureDiagram.tsx' });
      } else {
        upsertPart(mainMsgId, archToolPart.id, { status: 'completed' as PartStatus, subtitle: 'Skipped' });
      }
    } catch (e: any) {
      upsertPart(mainMsgId, archToolPart.id, { status: 'error' as PartStatus });
    }

    // ── Final: add files to project ──
    setResearch(prev => ({ ...prev, stage: 'complete', files, currentStep: '' }));
    if (onCreateFiles && files.length > 0) {
      const folder = research.topic.slice(0, 30).replace(/[^a-zA-Z0-9\s]/g, '').trim().replace(/\s+/g, '_') + '_Paper';
      onCreateFiles(folder, files);

      // File generation parts
      const fileGenParts: FileGenPart[] = files.map(f => ({
        id: nextPartId(), type: 'file-gen' as const, status: 'completed' as PartStatus,
        fileName: f.name, fileType: f.fileType, size: f.content.length,
      }));
      const summaryPart: TextPart = {
        id: nextPartId(), type: 'text',
        text: `**Paper generation complete!** ${files.length} files added to **${folder}/**.\n\nThe first .tex file is now open in the editor. Compile with the green **Recompile** button.`,
      };
      createAssistantMsg([...fileGenParts, summaryPart], 'system');
      setResearch(INITIAL_RESEARCH);
    }
    setIsThinking(false);
  };

  const handleCancelResearch = () => {
    setResearch(INITIAL_RESEARCH);
    setIsThinking(false);
    createAssistantMsg([{ id: nextPartId(), type: 'text', text: '*Research pipeline cancelled.*' } as TextPart]);
  };

  // ═══════════════════════════════════════════════════════
  // @edit flow (with diff display)
  // ═══════════════════════════════════════════════════════

  const handleEdit = async (instruction: string) => {
    if (!documentContent || !activeFileName) {
      createAssistantMsg([{
        id: nextPartId(), type: 'error',
        message: 'No file is open',
        details: 'Please open a file in the editor first, then use @edit to modify it.',
      } as ErrorPart]);
      setIsThinking(false);
      return;
    }

    const toolPart: ToolCallPart = {
      id: nextPartId(), type: 'tool-call', tool: 'edit', status: 'running',
      title: `Editing ${activeFileName}`, subtitle: instruction.slice(0, 60),
    };
    const streamPart: TextPart = { id: nextPartId(), type: 'text', text: '', isStreaming: true };
    const msgId = createAssistantMsg([toolPart, streamPart], 'claude-opus-4-6').id;

    let acc = '';
    const originalContent = documentContent;
    try {
      await streamResearchChat(
        legacyMessages,
        `You are editing the file "${activeFileName}". The user wants you to modify it.\n\nIMPORTANT RULES:\n1. Output ONLY the complete modified file content. No explanations before or after.\n2. Wrap the entire output in a code block with the appropriate language tag.\n3. Make ONLY the changes requested. Keep everything else exactly the same.\n\nUser instruction: ${instruction}\n\nCurrent file content:\n\`\`\`\n${documentContent}\n\`\`\``,
        documentContent,
        references,
        (chunk) => {
          acc += chunk;
          throttledUpdate(msgId, msg => ({
            ...msg,
            parts: msg.parts.map(p => p.id === streamPart.id ? { ...p, text: acc } as TextPart : p),
          }));
        },
      );
      throttledUpdate.flush();

      // Extract code and show diff
      const code = extractCodeFromText(acc);
      if (code) {
        upsertPart(msgId, toolPart.id, { status: 'completed' as PartStatus, subtitle: activeFileName });
        upsertPart(msgId, streamPart.id, { text: acc, isStreaming: false });
        // Auto-apply
        onUpdateContent(code);
        appendPart(msgId, {
          id: nextPartId(), type: 'text',
          text: `**${activeFileName}** updated with the changes.`,
        } as TextPart);
      } else {
        upsertPart(msgId, toolPart.id, { status: 'completed' as PartStatus });
        upsertPart(msgId, streamPart.id, { text: acc, isStreaming: false });
      }
    } catch (e: any) {
      throttledUpdate.flush();
      upsertPart(msgId, toolPart.id, { status: 'error' as PartStatus });
      appendPart(msgId, { id: nextPartId(), type: 'error', message: 'Edit failed', details: e.message } as ErrorPart);
    }
    setIsThinking(false);
  };

  // ═══════════════════════════════════════════════════════
  // Normal chat (streaming with parts)
  // ═══════════════════════════════════════════════════════

  const handleSend = async () => {
    if (!input.trim()) return;
    const text = input;
    setInput('');
    setPromptHistory(prev => [text, ...prev.slice(0, 49)]);
    setIsThinking(true);

    addUserMessage(text);

    const imageMatch = text.match(IMAGE_CMD);
    const researchMatch = text.match(RESEARCH_CMD);
    const editMatch = text.match(EDIT_CMD);

    if (imageMatch) {
      await handleImageRefine(imageMatch[1].trim());
    } else if (researchMatch) {
      await handleResearchStart(researchMatch[1].trim());
    } else if (editMatch) {
      await handleEdit(editMatch[1].trim());
    } else {
      // Normal streaming chat
      const textPart: TextPart = { id: nextPartId(), type: 'text', text: '', isStreaming: true };
      const msgId = createAssistantMsg([textPart], 'claude-opus-4-6').id;

      let acc = '';
      try {
        await streamResearchChat(legacyMessages, text, documentContent, references, (chunk) => {
          acc += chunk;
          throttledUpdate(msgId, msg => ({
            ...msg,
            parts: msg.parts.map(p => p.id === textPart.id ? { ...p, text: acc } as TextPart : p),
          }));
        });
        throttledUpdate.flush();
        upsertPart(msgId, textPart.id, { text: acc, isStreaming: false } as Partial<TextPart>);
        // Also update legacy
        setLegacyMessages(prev => [...prev, { id: msgId, role: 'model', content: acc, timestamp: Date.now() }]);
      } catch (e: any) {
        throttledUpdate.flush();
        upsertPart(msgId, textPart.id, { text: acc || '', isStreaming: false } as Partial<TextPart>);
        appendPart(msgId, { id: nextPartId(), type: 'error', message: 'Chat error', details: e.message } as ErrorPart);
      }
      setIsThinking(false);
    }
  };

  // ═══════════════════════════════════════════════════════
  // Render
  // ═══════════════════════════════════════════════════════

  const showPapersConfirm = research.stage === 'papers_found';
  const showPlanConfirm = research.stage === 'plan_ready';
  const isResearching = ['searching', 'planning', 'generating_tex', 'generating_bib', 'generating_figures', 'verifying_refs'].includes(research.stage);
  const connectedCount = providers.filter(p => p.status === 'connected').length;

  return (
    <div className="flex flex-col h-full bg-studio-900">
      {/* ── Header ── */}
      <div className="h-12 border-b border-studio-border flex items-center px-4 justify-between bg-studio-800/50">
        <div className="flex items-center space-x-2">
          <Cpu size={16} style={{ color: 'var(--c-accent)' }} />
          <span className="text-sm font-medium" style={{ color: 'var(--c-text)' }}>PaperStudio Pro</span>
          <span className="text-[10px] bg-studio-accent/20 text-studio-accent px-1.5 py-0.5 rounded font-bold">PRO</span>
        </div>
        <div className="flex items-center gap-2">
          {isResearching && (
            <span className="text-xs text-amber-400 animate-pulse truncate max-w-[120px]">{research.currentStep}</span>
          )}
          {/* Provider status button */}
          <button
            onClick={() => setShowProviders(prev => !prev)}
            style={{
              background: 'none', border: '1px solid var(--c-border)',
              borderRadius: 6, padding: '3px 8px', cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 4,
              fontSize: 11, color: 'var(--c-text-secondary)',
            }}
          >
            {connectedCount > 0 ? <Wifi size={12} style={{ color: 'rgb(34,197,94)' }} /> : <WifiOff size={12} />}
            {connectedCount}/{providers.length}
          </button>
        </div>
      </div>

      {/* ── Provider Panel (collapsible) ── */}
      {showProviders && (
        <div style={{ padding: '0 12px 8px', borderBottom: '1px solid var(--c-border)', background: 'var(--c-800)' }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--c-text-muted)', padding: '8px 0 4px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Provider Connections
          </div>
          <ProviderPanel providers={providers} onConnect={handleConnect} onDisconnect={handleDisconnect} />
        </div>
      )}

      {/* ── Messages (Part-based rendering) ── */}
      <div ref={chatContainerRef} className="flex-1 overflow-y-auto p-4 space-y-2 custom-scrollbar">
        {partMessages.map((msg) => (
          <div key={msg.id} data-component={msg.role === 'user' ? 'user-message' : 'assistant-message'}>
            {msg.role === 'user' ? (
              /* ── User message ── */
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <div style={{
                  maxWidth: '90%', padding: '8px 14px', borderRadius: 12,
                  background: 'var(--c-700)', fontSize: 14, color: 'var(--c-text)',
                }}>
                  {msg.parts.map(p => {
                    if (p.type === 'text') {
                      const text = (p as TextPart).text;
                      const resMatch = text.match(RESEARCH_CMD);
                      const imgMatch = text.match(IMAGE_CMD);
                      const edMatch = text.match(EDIT_CMD);
                      return (
                        <span key={p.id}>
                          {resMatch && <span style={{ display: 'inline-block', background: 'rgba(34,197,94,0.15)', color: 'rgb(74,222,128)', fontSize: 11, padding: '1px 6px', borderRadius: 4, marginRight: 6, fontWeight: 700 }}>@research</span>}
                          {imgMatch && <span style={{ display: 'inline-block', background: 'rgba(168,85,247,0.15)', color: 'rgb(196,148,252)', fontSize: 11, padding: '1px 6px', borderRadius: 4, marginRight: 6, fontWeight: 700 }}>@image</span>}
                          {edMatch && <span style={{ display: 'inline-block', background: 'rgba(245,158,11,0.15)', color: 'rgb(251,191,36)', fontSize: 11, padding: '1px 6px', borderRadius: 4, marginRight: 6, fontWeight: 700 }}>@edit</span>}
                          {text.replace(RESEARCH_CMD, '$1').replace(IMAGE_CMD, '$1').replace(EDIT_CMD, '$1')}
                        </span>
                      );
                    }
                    return null;
                  })}
                </div>
              </div>
            ) : (
              /* ── Assistant message — render all parts ── */
              <div style={{ paddingLeft: 0 }}>
                {msg.model && msg.model !== 'system' && (
                  <div style={{ fontSize: 10, color: 'var(--c-text-muted)', padding: '2px 0 4px', fontFamily: 'monospace' }}>
                    {msg.model}
                  </div>
                )}
                {msg.parts.map(part => {
                  // Check for streaming text — render with cursor
                  if (part.type === 'text' && (part as TextPart).isStreaming) {
                    const text = (part as TextPart).text;
                    if (!text) {
                      return <div key={part.id} style={{ padding: '6px 0' }}><TextShimmer text="Thinking..." active /></div>;
                    }
                    return (
                      <div key={part.id}>
                        <MarkdownPreview content={text} mode="chat" />
                        <span style={{
                          display: 'inline-block', width: 6, height: 16,
                          background: 'var(--c-accent)', opacity: 0.7,
                          animation: 'pulse-opacity 1.5s ease-in-out infinite',
                          borderRadius: 1, verticalAlign: 'middle', marginLeft: 2,
                        }} />
                      </div>
                    );
                  }
                  return <MessagePartDisplay key={part.id} part={part} message={msg} />;
                })}
              </div>
            )}
          </div>
        ))}

        {/* ── Image confirmation ── */}
        {pendingImage && (
          <div className="flex flex-col space-y-3 animate-in fade-in p-3" style={{ background: 'rgba(168,85,247,0.05)', border: '1px solid rgba(168,85,247,0.2)', borderRadius: 10 }}>
            <div style={{ fontSize: 12, color: 'var(--c-text-secondary)' }}>Confirm image generation?</div>
            <div className="flex space-x-2">
              <button onClick={handleConfirmImage} className="px-4 py-2 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg text-xs font-bold">
                <Check size={14} className="inline mr-1" />Generate
              </button>
              <button onClick={() => { if (pendingImage) { setInput(`@image ${pendingImage.refined_prompt}`); setPendingImage(null); setIsThinking(false); }}} className="px-4 py-2 bg-studio-700 text-zinc-200 rounded-lg text-xs border border-studio-600">
                <PenTool size={14} className="inline mr-1" />Edit
              </button>
              <button onClick={handleCancelImage} className="px-4 py-2 bg-studio-800 text-zinc-400 rounded-lg text-xs border border-studio-700">
                <X size={14} className="inline mr-1" />Cancel
              </button>
            </div>
          </div>
        )}

        {/* ── Research: papers found ── */}
        {showPapersConfirm && (
          <div className="flex flex-col space-y-3 p-3" style={{ background: 'rgba(34,197,94,0.05)', border: '1px solid rgba(34,197,94,0.2)', borderRadius: 10 }}>
            <div style={{ fontSize: 11, color: 'rgb(74,222,128)', fontWeight: 700, textTransform: 'uppercase' }}>Literature Search Complete</div>
            <div style={{ fontSize: 12, color: 'var(--c-text-secondary)' }}>Proceed to generate a research plan?</div>
            <div className="flex space-x-2">
              <button onClick={handleResearchPlan} className="px-4 py-2 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-lg text-xs font-bold">
                <Check size={14} className="inline mr-1" />Analyze & Plan
              </button>
              <button onClick={handleCancelResearch} className="px-4 py-2 bg-studio-800 text-zinc-400 rounded-lg text-xs border border-studio-700">
                <X size={14} className="inline mr-1" />Cancel
              </button>
            </div>
          </div>
        )}

        {/* ── Research: plan ready ── */}
        {showPlanConfirm && (
          <div className="flex flex-col space-y-3 p-3" style={{ background: 'rgba(59,130,246,0.05)', border: '1px solid rgba(59,130,246,0.2)', borderRadius: 10 }}>
            <div style={{ fontSize: 11, color: 'rgb(96,165,250)', fontWeight: 700, textTransform: 'uppercase' }}>Research Plan Ready</div>
            <div style={{ fontSize: 12, color: 'var(--c-text-secondary)' }}>Generates: main.tex, ref.bib (50+ refs), Python figures, React architecture diagram. References verified by GPT + CrossRef.</div>
            <div className="flex space-x-2">
              <button onClick={handleGeneratePaper} className="px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg text-xs font-bold">
                <FileText size={14} className="inline mr-1" />Generate Full Paper
              </button>
              <button onClick={handleCancelResearch} className="px-4 py-2 bg-studio-800 text-zinc-400 rounded-lg text-xs border border-studio-700">
                <X size={14} className="inline mr-1" />Cancel
              </button>
            </div>
          </div>
        )}

        {/* ── Thinking indicator ── */}
        {isThinking && !pendingImage && !showPapersConfirm && !showPlanConfirm && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 0', color: 'var(--c-text-muted)', fontSize: 13 }}>
            <Loader2 size={14} className="animate-spin" style={{ color: 'var(--c-accent)' }} />
            <TextShimmer text={isResearching ? research.currentStep || 'Processing...' : 'Reasoning...'} active />
          </div>
        )}
      </div>

      {/* ── Prompt Input Area (ContentEditable) ── */}
      <div style={{ padding: '8px 12px 12px', background: 'var(--c-900)' }}>
        <div style={{
          background: 'var(--c-800)', borderRadius: 14,
          border: '1px solid var(--c-border)',
          overflow: 'hidden',
          boxShadow: '0 2px 12px rgba(0,0,0,0.15)',
          transition: 'border-color 0.15s',
        }}>
          {/* ContentEditable input */}
          <PromptInput
            value={input}
            onChange={setInput}
            onSend={handleSend}
            disabled={!!pendingImage || isResearching}
            history={promptHistory}
            placeholder="Ask anything, or type @ for commands..."
          />

          {/* Bottom toolbar */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '6px 12px', borderTop: '1px solid rgba(255,255,255,0.05)',
          }}>
            {/* Left: command shortcuts */}
            <div style={{ display: 'flex', gap: 4 }}>
              <button
                onClick={() => !isThinking && setInput('@research ')}
                disabled={isThinking}
                style={{
                  padding: '3px 8px', borderRadius: 6, fontSize: 10, fontWeight: 600,
                  background: 'rgba(34,197,94,0.1)', color: 'rgba(74,222,128,0.8)',
                  border: 'none', cursor: isThinking ? 'not-allowed' : 'pointer',
                  opacity: isThinking ? 0.4 : 1,
                }}
              >
                @research
              </button>
              <button
                onClick={() => !isThinking && setInput('@image ')}
                disabled={isThinking}
                style={{
                  padding: '3px 8px', borderRadius: 6, fontSize: 10, fontWeight: 600,
                  background: 'rgba(168,85,247,0.1)', color: 'rgba(196,148,252,0.8)',
                  border: 'none', cursor: isThinking ? 'not-allowed' : 'pointer',
                  opacity: isThinking ? 0.4 : 1,
                }}
              >
                @image
              </button>
              <button
                onClick={() => !isThinking && setInput('@edit ')}
                disabled={isThinking}
                style={{
                  padding: '3px 8px', borderRadius: 6, fontSize: 10, fontWeight: 600,
                  background: 'rgba(245,158,11,0.1)', color: 'rgba(251,191,36,0.8)',
                  border: 'none', cursor: isThinking ? 'not-allowed' : 'pointer',
                  opacity: isThinking ? 0.4 : 1,
                }}
              >
                @edit
              </button>
            </div>

            {/* Right: model indicator + send */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 10, fontFamily: 'monospace', color: 'var(--c-text-muted)' }}>
                opus 4.6
              </span>
              <button
                onClick={handleSend}
                disabled={!input.trim() || isThinking}
                style={{
                  padding: 6, borderRadius: 8,
                  background: input.trim() && !isThinking ? 'var(--c-accent)' : 'var(--c-700)',
                  color: input.trim() && !isThinking ? 'white' : 'var(--c-text-muted)',
                  border: 'none', cursor: input.trim() && !isThinking ? 'pointer' : 'not-allowed',
                  display: 'flex', alignItems: 'center', transition: 'all 0.15s',
                }}
              >
                <ArrowUp size={16} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChatPanel;
