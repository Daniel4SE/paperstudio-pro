import React, { useEffect, useRef, useState } from 'react';
import * as latexjs from 'latex.js';

interface LatexDocumentPreviewProps {
  content: string;
}

const LatexDocumentPreview: React.FC<LatexDocumentPreviewProps> = ({ content }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    containerRef.current.innerHTML = '';
    setErrorMessage(null);

    try {
      const hasDocument = /\\begin\s*\{\s*document\s*\}/.test(content);
      let source = hasDocument
        ? content
        : `\\documentclass{article}\n\\begin{document}\n${content}\n\\end{document}\n`;

      // latex.js only supports a small set of built-in classes; fall back if unknown.
      const supported = new Set(['article', 'report', 'book', 'letter', 'proc', 'slides', 'minimal', 'memoir', 'beamer']);
      const classMatch = source.match(/\\documentclass(?:\[[^\]]*\])?\{([^}]+)\}/);
      let unsupportedClass: string | null = null;

      if (classMatch && classMatch[1]) {
        const cls = classMatch[1].trim();
        if (!supported.has(cls)) {
          unsupportedClass = cls;
          // Replace documentclass with article
          source = source.replace(/\\documentclass(?:\[[^\]]*\])?\{[^}]+\}/, '\\documentclass{article}');
        }
      }

      // Remove unsupported packages that latex.js cannot handle
      // Common journal-specific packages that cause issues
      const unsupportedPackages = ['sn-jnl', 'sn-mathphys', 'sn-basic', 'sn-vancouver', 'sn-apa', 'sn-chicago', 'sn-nature', 'lineno', 'xr', 'xr-hyper'];
      unsupportedPackages.forEach(pkg => {
        const pkgRegex = new RegExp(`\\\\usepackage(?:\\[[^\\]]*\\])?\\{${pkg}\\}[^\\n]*\\n?`, 'g');
        source = source.replace(pkgRegex, '');
      });

      // Remove common problematic commands that latex.js doesn't support
      source = source.replace(/\\linenumbers\b/g, '');
      source = source.replace(/\\modulolinenumbers\b\[[^\]]*\]/g, '');
      source = source.replace(/\\externaldocument\{[^}]*\}/g, '');

      if (unsupportedClass) {
        setErrorMessage(`Unsupported documentclass "${unsupportedClass}". Falling back to "article".`);
      }

      const generator = new (latexjs as any).HtmlGenerator({ hyphenate: false });
      (latexjs as any).parse(source, { generator });
      const fragment = generator.domFragment();
      containerRef.current.appendChild(fragment);
    } catch (err) {
      console.error('LaTeX document render error:', err);
      setErrorMessage('LaTeX render failed. Showing formatted source.');

      // Extract text content from LaTeX for a readable fallback
      let fallbackContent = content;
      // Remove LaTeX preamble (everything before \begin{document})
      const docMatch = fallbackContent.match(/\\begin\s*\{\s*document\s*\}([\s\S]*?)\\end\s*\{\s*document\s*\}/);
      if (docMatch) {
        fallbackContent = docMatch[1];
      }
      // Remove common LaTeX commands but keep content
      fallbackContent = fallbackContent
        .replace(/\\[a-zA-Z]+\*?\{([^}]*)\}/g, '$1') // \command{content} -> content
        .replace(/\\[a-zA-Z]+\*?\[[^\]]*\]\{([^}]*)\}/g, '$1') // \command[opt]{content} -> content
        .replace(/\\[a-zA-Z]+\*?/g, '') // remove standalone commands
        .replace(/\{|\}/g, '') // remove stray braces
        .replace(/\$[^$]*\$/g, '[formula]') // replace inline math
        .replace(/\n{3,}/g, '\n\n') // normalize multiple newlines
        .trim();

      // Create formatted HTML
      const formattedHtml = `<div style="font-family: 'Times New Roman', serif; line-height: 1.6; white-space: pre-wrap; color: #d4d4d8;">${fallbackContent.split('\n\n').map(p => `<p style="margin-bottom: 1em;">${p}</p>`).join('')}</div>`;
      containerRef.current.innerHTML = formattedHtml;
    }
  }, [content]);

  return (
    <div
      id="paper-preview-content"
      className="latex-preview h-full overflow-y-auto p-12 bg-studio-900 text-zinc-200 text-sm leading-relaxed"
      style={{ minHeight: '100%' }}
    >
      <style>{`
        #paper-preview-content.latex-preview { color: #e4e4e7 !important; background: #09090b !important; }
        #paper-preview-content.latex-preview .latexjs { color: #e4e4e7 !important; }
        #paper-preview-content.latex-preview h1,
        #paper-preview-content.latex-preview h2,
        #paper-preview-content.latex-preview h3,
        #paper-preview-content.latex-preview h4 { color: #f4f4f5 !important; }
        #paper-preview-content.latex-preview a { color: #60a5fa !important; }
        #paper-preview-content.latex-preview table { border-color: #3f3f46 !important; }
        #paper-preview-content.latex-preview td,
        #paper-preview-content.latex-preview th { border-color: #3f3f46 !important; color: #d4d4d8 !important; }
      `}</style>
      {errorMessage && (
        <div className="mb-4 rounded border border-amber-700 bg-amber-900/30 px-3 py-2 text-xs text-amber-400">
          {errorMessage}
        </div>
      )}
      <div ref={containerRef} className="latexjs" />
    </div>
  );
};

export default LatexDocumentPreview;
