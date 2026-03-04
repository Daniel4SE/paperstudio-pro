import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import morphdom from 'morphdom';
import LatexRenderer from './LatexRenderer';

// ─── LRU cache (max 200 entries) ─────────────────────────

interface CacheEntry {
  hash: string;
  html: string;
}

const MAX_CACHE = 200;
const cache = new Map<string, CacheEntry>();

function touchCache(key: string, entry: CacheEntry) {
  cache.delete(key);
  cache.set(key, entry);
  if (cache.size > MAX_CACHE) {
    const first = cache.keys().next().value;
    if (first) cache.delete(first);
  }
}

// Simple hash for cache keying
function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const c = str.charCodeAt(i);
    hash = ((hash << 5) - hash + c) | 0;
  }
  return hash.toString(36);
}

// ─── DOMPurify config ────────────────────────────────────

const PURIFY_CONFIG = {
  USE_PROFILES: { html: true, mathMl: true } as any,
  SANITIZE_NAMED_PROPS: true,
  FORBID_TAGS: ['style'] as string[],
  FORBID_CONTENTS: ['style', 'script'] as string[],
  ADD_ATTR: ['target', 'rel'],
};

// Add noopener/noreferrer to target=_blank links
if (typeof window !== 'undefined' && DOMPurify.isSupported) {
  DOMPurify.addHook('afterSanitizeAttributes', (node: Element) => {
    if (!(node instanceof HTMLAnchorElement)) return;
    if (node.target === '_blank') {
      const rel = new Set((node.getAttribute('rel') ?? '').split(/\s+/).filter(Boolean));
      rel.add('noopener');
      rel.add('noreferrer');
      node.setAttribute('rel', Array.from(rel).join(' '));
    }
  });
}

// ─── marked configuration ────────────────────────────────

// Configure marked with GFM tables, breaks, etc.
marked.setOptions({
  gfm: true,
  breaks: false,
});

// Custom renderer for code blocks
const renderer = new marked.Renderer();

// Code blocks: language label + wrapper for copy button
renderer.code = function ({ text, lang }: { text: string; lang?: string | undefined }) {
  const escaped = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
  const langLabel = lang
    ? `<div class="code-lang-label">${lang}</div>`
    : '';
  return `<div class="code-block-wrapper">${langLabel}<pre><code class="language-${lang || 'text'}">${escaped}</code></pre><button class="code-copy-btn" data-code="${escaped}" title="Copy code"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg></button></div>`;
};

// Inline code
renderer.codespan = function ({ text }: { text: string }) {
  return `<code class="inline-code">${text}</code>`;
};

// Links open in new tab
renderer.link = function ({ href, title, text }: { href: string; title?: string | null | undefined; text: string }) {
  const titleAttr = title ? ` title="${title}"` : '';
  return `<a href="${href}" target="_blank" rel="noopener noreferrer"${titleAttr}>${text}</a>`;
};

// Tables with wrapper
renderer.table = function ({ header, body }: { header: string; body: string }) {
  return `<div class="table-wrapper"><table><thead>${header}</thead><tbody>${body}</tbody></table></div>`;
};

marked.use({ renderer });

// ─── Parse + sanitize ────────────────────────────────────

function renderMarkdown(text: string, cacheKey?: string): string {
  const hash = simpleHash(text);
  const key = cacheKey ?? hash;

  // Check cache
  const cached = cache.get(key);
  if (cached && cached.hash === hash) {
    touchCache(key, cached);
    return cached.html;
  }

  // Pre-process: extract KaTeX blocks to protect from marked
  // Replace $$ ... $$ and $ ... $ with placeholders
  let idx = 0;
  const mathBlocks: Array<{ placeholder: string; content: string; block: boolean }> = [];

  // Block math: $$ ... $$
  let processed = text.replace(/\$\$([\s\S]*?)\$\$/g, (_, content) => {
    const placeholder = `\x00MATH_BLOCK_${idx++}\x00`;
    mathBlocks.push({ placeholder, content: content.trim(), block: true });
    return placeholder;
  });

  // Inline math: $ ... $ (not preceded/followed by $)
  processed = processed.replace(/(?<!\$)\$(?!\$)([^\n$]+?)(?<!\$)\$(?!\$)/g, (_, content) => {
    const placeholder = `\x00MATH_INLINE_${idx++}\x00`;
    mathBlocks.push({ placeholder, content: content.trim(), block: false });
    return placeholder;
  });

  // Parse with marked
  let html = marked.parse(processed) as string;

  // Restore math placeholders with KaTeX spans
  for (const { placeholder, content, block } of mathBlocks) {
    const escaped = content
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
    const tag = block
      ? `<div class="math-block" data-math="${escaped}" data-math-block="true"></div>`
      : `<span class="math-inline" data-math="${escaped}"></span>`;
    html = html.replace(placeholder, tag);
  }

  // Sanitize
  const safe = DOMPurify.isSupported ? DOMPurify.sanitize(html, PURIFY_CONFIG) : html;

  // Cache
  touchCache(key, { hash, html: safe });
  return safe;
}

// ─── Mermaid block ───────────────────────────────────────

declare global {
  interface Window {
    mermaid: any;
    katex: any;
  }
}

const MermaidBlock = ({ code }: { code: string }) => {
  const [svg, setSvg] = useState('');
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!window.mermaid) { setError(true); return; }
    let cancelled = false;
    const id = `mermaid-${Math.random().toString(36).substr(2, 9)}`;
    (async () => {
      try {
        await window.mermaid.parse(code);
        if (cancelled) return;
        const result = await window.mermaid.render(id, code);
        if (!cancelled) setSvg(result.svg);
      } catch {
        if (!cancelled) setError(true);
      }
    })();
    return () => { cancelled = true; };
  }, [code]);

  if (error) {
    return (
      <div className="my-4 bg-studio-800 border border-studio-700 rounded-lg p-4 overflow-x-auto">
        <div className="text-[10px] text-zinc-500 mb-2 font-mono">mermaid (render failed)</div>
        <pre className="text-xs text-zinc-400 whitespace-pre-wrap font-mono">{code}</pre>
      </div>
    );
  }

  if (!svg) return <div className="my-4 bg-studio-800 rounded-lg p-4 text-zinc-500 text-xs animate-pulse">Rendering diagram...</div>;

  return <div className="my-6 flex justify-center bg-studio-800 p-4 rounded-lg overflow-x-auto" dangerouslySetInnerHTML={{ __html: svg }} />;
};

// ─── Main component ──────────────────────────────────────

interface MarkdownPreviewProps {
  content: string;
  macros?: Record<string, any>;
  /** 'panel' = split-view preview (dark bg), 'chat' = inline in chat (transparent bg) */
  mode?: 'panel' | 'chat';
  cacheKey?: string;
}

const MarkdownPreviewInner = ({ content, macros = {}, mode = 'chat', cacheKey }: MarkdownPreviewProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const isPanel = mode === 'panel';

  const wrapperClass = isPanel
    ? 'prose prose-invert prose-zinc max-w-none p-12 bg-studio-900 text-zinc-200 overflow-y-auto h-full text-sm leading-relaxed'
    : 'prose prose-invert prose-zinc max-w-none text-zinc-300 text-sm leading-relaxed';

  // Render HTML from markdown
  const html = useMemo(() => renderMarkdown(content, cacheKey), [content, cacheKey]);

  // DOM-patch with morphdom instead of full React re-render
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    if (!html) {
      container.innerHTML = '';
      return;
    }

    const temp = document.createElement('div');
    temp.innerHTML = html;

    morphdom(container, temp, {
      childrenOnly: true,
      onBeforeElUpdated: (fromEl, toEl) => {
        if (fromEl.isEqualNode(toEl)) return false;
        return true;
      },
    });

    // ── Post-processing: KaTeX math rendering ──
    if (window.katex) {
      const mathEls = container.querySelectorAll('[data-math]');
      mathEls.forEach(el => {
        const mathContent = el.getAttribute('data-math');
        const isBlock = el.getAttribute('data-math-block') === 'true';
        if (!mathContent || el.getAttribute('data-katex-rendered') === 'true') return;
        try {
          const decoded = mathContent
            .replace(/&amp;/g, '&')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>');
          window.katex.render(decoded, el as HTMLElement, {
            throwOnError: false,
            displayMode: isBlock,
            output: 'html',
            macros: { ...macros },
          });
          el.setAttribute('data-katex-rendered', 'true');
        } catch (e) {
          (el as HTMLElement).textContent = mathContent;
        }
      });
    }

    // ── Post-processing: code copy buttons ──
    const copyBtns = container.querySelectorAll('.code-copy-btn');
    const cleanups: Array<() => void> = [];
    copyBtns.forEach(btn => {
      const handler = async () => {
        const codeEl = btn.parentElement?.querySelector('code');
        const text = codeEl?.textContent ?? '';
        if (!text) return;
        await navigator.clipboard.writeText(text);
        btn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgb(34,197,94)" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>';
        setTimeout(() => {
          btn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>';
        }, 2000);
      };
      btn.addEventListener('click', handler);
      cleanups.push(() => btn.removeEventListener('click', handler));
    });

    return () => {
      cleanups.forEach(fn => fn());
    };
  }, [html, macros]);

  return (
    <div
      ref={containerRef}
      className={wrapperClass}
      data-component="markdown"
    />
  );
};

const MarkdownPreview = React.memo(MarkdownPreviewInner);

export default MarkdownPreview;
