import React, { useEffect, useRef } from 'react';

interface LatexRendererProps {
  content: string;
  block?: boolean;
  macros?: Record<string, any>;
}

declare global {
  interface Window {
    katex: any;
  }
}

const LatexRenderer: React.FC<LatexRendererProps> = ({ content, block = false, macros = {} }) => {
  const containerRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (containerRef.current && window.katex) {
      try {
        window.katex.render(content, containerRef.current, {
          throwOnError: false,
          displayMode: block,
          output: 'html', 
          macros: { ...macros },
          trust: true // Allow some safe HTML if needed, though KaTeX is secure by default
        });
      } catch (e) {
        console.error("KaTeX render error:", e);
        containerRef.current.innerText = content;
      }
    }
  }, [content, block, macros]);

  return <span ref={containerRef} className={block ? "block my-4 text-center overflow-x-auto" : "mx-1"} />;
};

export default LatexRenderer;