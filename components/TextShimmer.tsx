import React, { useMemo } from 'react';

interface TextShimmerProps {
  text: string;
  active?: boolean;
  stepMs?: number;
  durationMs?: number;
  className?: string;
  as?: keyof JSX.IntrinsicElements;
}

const TextShimmerInner: React.FC<TextShimmerProps> = ({
  text,
  active = true,
  stepMs = 45,
  durationMs = 1200,
  className,
  as: Tag = 'span',
}) => {
  const chars = useMemo(() => Array.from(text), [text]);

  return (
    <Tag
      data-component="text-shimmer"
      data-active={active}
      className={className}
      aria-label={text}
      style={{
        '--text-shimmer-step': `${stepMs}ms`,
        '--text-shimmer-duration': `${durationMs}ms`,
      } as React.CSSProperties}
    >
      {chars.map((char, index) => (
        <span
          key={index}
          data-slot="text-shimmer-char"
          aria-hidden="true"
          style={{ '--text-shimmer-index': `${index}` } as React.CSSProperties}
        >
          {char}
        </span>
      ))}
    </Tag>
  );
};

export const TextShimmer = React.memo(TextShimmerInner);
export default TextShimmer;
