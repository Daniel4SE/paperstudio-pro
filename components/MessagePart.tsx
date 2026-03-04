import React, { useMemo, useState, useCallback } from 'react';
import type {
  MessagePart as MessagePartType,
  PartMessage,
  TextPart,
  ThinkingPart,
  ToolCallPart,
  SearchPart,
  ImageGenPart,
  FileGenPart,
  RefVerifyPart,
  ErrorPart,
  PartStatus,
} from '../types';
import { BasicTool, getToolIcon } from './BasicTool';
import { TextShimmer } from './TextShimmer';
import { Collapsible } from './Collapsible';
import MarkdownPreview from './MarkdownPreview';
import {
  AlertCircle, CheckCircle, Loader2, Search, FileText,
  Image, BrainCircuit, ChevronDown, Copy, Check, Globe,
  BookOpen, Database, ExternalLink,
} from 'lucide-react';

// ─── Part Registry ───────────────────────────────────────
// Maps part type string → React component. Extensible: call registerPart() to add custom renderers.

export interface PartProps {
  part: MessagePartType;
  message?: PartMessage;
  hideDetails?: boolean;
  defaultOpen?: boolean;
}

export type PartComponent = React.FC<PartProps>;

export const PART_REGISTRY: Record<string, PartComponent | undefined> = {};

export function registerPart(type: string, component: PartComponent) {
  PART_REGISTRY[type] = component;
}

// ─── Status helpers ──────────────────────────────────────

const StatusDot: React.FC<{ status?: PartStatus; size?: number }> = ({ status, size = 8 }) => {
  const color =
    status === 'completed' ? 'rgb(34,197,94)' :
    status === 'error' ? 'rgb(239,68,68)' :
    status === 'running' ? 'var(--c-accent)' :
    'var(--c-text-muted)';
  const shadow = status === 'completed' ? '0 0 6px rgba(34,197,94,0.4)' :
    status === 'error' ? '0 0 6px rgba(239,68,68,0.4)' : 'none';
  return (
    <span style={{
      display: 'inline-block',
      width: size,
      height: size,
      borderRadius: '50%',
      background: color,
      boxShadow: shadow,
      flexShrink: 0,
    }} />
  );
};

const StatusIcon: React.FC<{ status?: PartStatus }> = ({ status }) => {
  if (status === 'pending' || status === 'running')
    return <Loader2 size={14} className="animate-spin" style={{ color: 'var(--c-accent)' }} />;
  if (status === 'completed')
    return <CheckCircle size={14} style={{ color: 'rgb(34,197,94)' }} />;
  if (status === 'error')
    return <AlertCircle size={14} style={{ color: 'rgb(239,68,68)' }} />;
  return null;
};

// ─── Copy button helper ──────────────────────────────────

const CopyButton: React.FC<{ text: string }> = ({ text }) => {
  const [copied, setCopied] = useState(false);
  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [text]);
  return (
    <button
      onClick={handleCopy}
      style={{
        background: 'none', border: 'none', cursor: 'pointer',
        color: 'var(--c-text-muted)', padding: 2, display: 'flex', alignItems: 'center',
      }}
      title={copied ? 'Copied!' : 'Copy'}
    >
      {copied ? <Check size={14} /> : <Copy size={14} />}
    </button>
  );
};

// ═══════════════════════════════════════════════════════════
// Part Renderers
// ═══════════════════════════════════════════════════════════

// ── TextPart ─────────────────────────────────────────────

const TextPartRenderer: React.FC<PartProps> = ({ part }) => {
  const p = part as TextPart;
  const text = (p.text ?? '').trim();
  if (!text) return null;
  return (
    <div data-component="text-part">
      <div data-slot="text-part-body">
        <MarkdownPreview content={text} mode="chat" />
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '2px 0' }}>
        <CopyButton text={text} />
      </div>
    </div>
  );
};
registerPart('text', TextPartRenderer);

// ── ThinkingPart ─────────────────────────────────────────

const ThinkingPartRenderer: React.FC<PartProps> = ({ part }) => {
  const p = part as ThinkingPart;
  const text = (p.text ?? '').trim();
  if (!text) return null;
  const title = p.title || 'Thinking...';

  return (
    <Collapsible defaultOpen={false}>
      <Collapsible.Trigger>
        <div data-component="thinking-step" style={{ cursor: 'pointer' }}>
          <div data-slot="thinking-step-title" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <BrainCircuit size={14} style={{ color: 'var(--c-accent)' }} />
            <span>{title}</span>
            <Collapsible.Arrow />
          </div>
        </div>
      </Collapsible.Trigger>
      <Collapsible.Content>
        <div data-slot="thinking-step-body" style={{ paddingLeft: 20 }}>
          <MarkdownPreview content={text} mode="chat" />
        </div>
      </Collapsible.Content>
    </Collapsible>
  );
};
registerPart('thinking', ThinkingPartRenderer);

// ── ToolCallPart ─────────────────────────────────────────

const ToolCallPartRenderer: React.FC<PartProps> = ({ part, hideDetails, defaultOpen }) => {
  const p = part as ToolCallPart;
  const isPending = p.status === 'pending' || p.status === 'running';

  const triggerTitle = {
    title: p.title || p.tool,
    subtitle: p.subtitle,
  };

  return (
    <BasicTool
      icon={p.tool}
      trigger={triggerTitle}
      status={p.status}
      hideDetails={hideDetails}
      defaultOpen={defaultOpen || false}
    >
      {p.output && (
        <div data-component="tool-output" style={{ maxHeight: 300, overflowY: 'auto' }}>
          <MarkdownPreview content={p.output} mode="chat" />
        </div>
      )}
      {p.children && p.children.length > 0 && (
        <div style={{ paddingLeft: 12 }}>
          {p.children.map(child => (
            <MessagePartDisplay key={child.id} part={child} />
          ))}
        </div>
      )}
    </BasicTool>
  );
};
registerPart('tool-call', ToolCallPartRenderer);

// ── SearchPart ───────────────────────────────────────────

const SOURCE_ICONS: Record<string, string> = {
  'Semantic Scholar': 'https://www.semanticscholar.org/favicon.ico',
  'arXiv': 'https://arxiv.org/favicon.ico',
  'CrossRef': 'https://www.crossref.org/favicon.ico',
  'Google Scholar': 'https://scholar.google.com/favicon.ico',
};

const SearchPartRenderer: React.FC<PartProps> = ({ part }) => {
  const p = part as SearchPart;
  const allDone = p.sources.every(s => s.status === 'completed' || s.status === 'error');
  const totalResults = p.totalResults ?? p.sources.reduce((sum, s) => sum + (s.resultCount ?? 0), 0);

  return (
    <div style={{ padding: '4px 0' }}>
      <div data-component="search-sources">
        {p.sources.map((source, i) => (
          <div
            key={i}
            data-slot="search-source-pill"
            data-status={source.status}
          >
            {(source.icon || SOURCE_ICONS[source.name]) && (
              <img
                data-slot="search-source-icon"
                src={source.icon || SOURCE_ICONS[source.name]}
                alt={source.name}
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
              />
            )}
            {source.status === 'running' || source.status === 'pending' ? (
              <TextShimmer text={source.name} active />
            ) : (
              <span>{source.name}</span>
            )}
            {source.status === 'completed' && source.resultCount !== undefined && (
              <span style={{ color: 'var(--c-text-muted)', fontSize: 11, marginLeft: 2 }}>
                ({source.resultCount})
              </span>
            )}
            {source.status === 'error' && (
              <AlertCircle size={12} style={{ color: 'rgb(239,68,68)', marginLeft: 2 }} />
            )}
          </div>
        ))}
      </div>
      {allDone && totalResults > 0 && (
        <div style={{ fontSize: 12, color: 'var(--c-text-muted)', paddingTop: 4 }}>
          Found {totalResults} result{totalResults !== 1 ? 's' : ''}
        </div>
      )}
    </div>
  );
};
registerPart('search', SearchPartRenderer);

// ── ImageGenPart ─────────────────────────────────────────

const ImageGenPartRenderer: React.FC<PartProps> = ({ part }) => {
  const p = part as ImageGenPart;
  const isPending = p.status === 'pending' || p.status === 'running';

  return (
    <BasicTool
      icon="image-generate"
      trigger={{
        title: 'Image Generation',
        subtitle: p.model || 'Gemini',
      }}
      status={p.status}
      defaultOpen={p.status === 'completed'}
    >
      {p.refinedPrompt && (
        <div style={{ fontSize: 12, color: 'var(--c-text-muted)', padding: '4px 0', fontStyle: 'italic' }}>
          Prompt: {p.refinedPrompt}
        </div>
      )}
      {p.imageData && (
        <div style={{ padding: '8px 0' }}>
          <img
            src={p.imageData}
            alt={p.refinedPrompt || p.prompt || 'Generated image'}
            style={{
              maxWidth: '100%',
              borderRadius: 8,
              border: '1px solid var(--c-border)',
            }}
          />
        </div>
      )}
    </BasicTool>
  );
};
registerPart('image-gen', ImageGenPartRenderer);

// ── FileGenPart ──────────────────────────────────────────

const FileGenPartRenderer: React.FC<PartProps> = ({ part }) => {
  const p = part as FileGenPart;
  const sizeLabel = p.size ? `${(p.size / 1024).toFixed(1)} KB` : undefined;

  return (
    <BasicTool
      icon="write"
      trigger={{
        title: p.fileName,
        subtitle: sizeLabel || p.fileType,
      }}
      status={p.status}
      defaultOpen={false}
    >
      {p.content && (
        <div data-component="tool-output" style={{ maxHeight: 300, overflowY: 'auto' }}>
          <pre style={{
            fontSize: 12,
            color: 'var(--c-text-secondary)',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
            margin: 0,
            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
          }}>
            {p.content.slice(0, 2000)}
            {(p.content.length > 2000) && '\n... (truncated)'}
          </pre>
        </div>
      )}
    </BasicTool>
  );
};
registerPart('file-gen', FileGenPartRenderer);

// ── RefVerifyPart ────────────────────────────────────────

const RefVerifyPartRenderer: React.FC<PartProps> = ({ part }) => {
  const p = part as RefVerifyPart;
  const allDone = p.phases.every(ph => ph.status === 'completed' || ph.status === 'error');

  return (
    <BasicTool
      icon="ref-verify"
      trigger={{
        title: 'Reference Verification',
        subtitle: allDone
          ? `${p.phases.filter(ph => ph.status === 'completed').length}/${p.phases.length} phases complete`
          : undefined,
      }}
      status={allDone ? 'completed' : p.phases.some(ph => ph.status === 'error') ? 'error' : 'running'}
      defaultOpen={allDone}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {p.phases.map((phase, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
            <StatusIcon status={phase.status} />
            <span style={{ color: 'var(--c-text)' }}>{phase.name}</span>
            {phase.details && (
              <span style={{ color: 'var(--c-text-muted)', fontSize: 12 }}>
                {phase.details}
              </span>
            )}
          </div>
        ))}
      </div>
      {p.report && (
        <div style={{ marginTop: 8 }}>
          <MarkdownPreview content={p.report} mode="chat" />
        </div>
      )}
    </BasicTool>
  );
};
registerPart('ref-verify', RefVerifyPartRenderer);

// ── ErrorPart ────────────────────────────────────────────

const ErrorPartRenderer: React.FC<PartProps> = ({ part }) => {
  const p = part as ErrorPart;
  return (
    <div style={{
      display: 'flex',
      alignItems: 'flex-start',
      gap: 8,
      padding: '8px 12px',
      borderRadius: 8,
      background: 'rgba(239,68,68,0.08)',
      border: '1px solid rgba(239,68,68,0.2)',
      fontSize: 13,
    }}>
      <AlertCircle size={16} style={{ color: 'rgb(239,68,68)', flexShrink: 0, marginTop: 2 }} />
      <div>
        <div style={{ color: 'rgb(239,68,68)', fontWeight: 500 }}>
          {p.message}
        </div>
        {p.details && (
          <div style={{ color: 'var(--c-text-muted)', fontSize: 12, marginTop: 4 }}>
            {p.details}
          </div>
        )}
      </div>
    </div>
  );
};
registerPart('error', ErrorPartRenderer);

// ═══════════════════════════════════════════════════════════
// Main dispatch component
// ═══════════════════════════════════════════════════════════

export const MessagePartDisplay: React.FC<PartProps> = React.memo(({ part, message, hideDetails, defaultOpen }) => {
  const Renderer = PART_REGISTRY[part.type];
  if (!Renderer) {
    // Unknown part type — render as generic collapsible
    return (
      <div style={{ fontSize: 12, color: 'var(--c-text-muted)', padding: '4px 0' }}>
        Unknown part type: {part.type}
      </div>
    );
  }
  return <Renderer part={part} message={message} hideDetails={hideDetails} defaultOpen={defaultOpen} />;
});

// ── SessionTurn: groups user message + assistant parts ───

export interface SessionTurnProps {
  userMessage?: PartMessage;
  assistantMessages?: PartMessage[];
  isStreaming?: boolean;
}

const SessionTurnInner: React.FC<SessionTurnProps> = ({ userMessage, assistantMessages, isStreaming }) => {
  return (
    <div data-component="session-turn">
      {/* User message */}
      {userMessage && (
        <div data-component="user-message">
          {userMessage.parts.map(part => (
            <MessagePartDisplay key={part.id} part={part} message={userMessage} />
          ))}
        </div>
      )}

      {/* Assistant messages / parts */}
      {assistantMessages && assistantMessages.map(msg => (
        <div key={msg.id} data-component="assistant-message">
          {msg.parts.map(part => (
            <MessagePartDisplay key={part.id} part={part} message={msg} />
          ))}
          {/* Streaming shimmer at end of last assistant message */}
          {isStreaming && msg === assistantMessages[assistantMessages.length - 1] && (
            <div style={{ padding: '6px 0' }}>
              <TextShimmer text="Generating..." active />
            </div>
          )}
        </div>
      ))}
    </div>
  );
};

export const SessionTurn = React.memo(SessionTurnInner);

export default MessagePartDisplay;
