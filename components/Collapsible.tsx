import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';

// ── Context ──
interface CollapsibleCtx {
  open: boolean;
  toggle: () => void;
}
const Ctx = createContext<CollapsibleCtx>({ open: false, toggle: () => {} });

// ── Root ──
interface CollapsibleRootProps {
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  variant?: 'normal' | 'ghost';
  className?: string;
  children: React.ReactNode;
}

const CollapsibleRoot: React.FC<CollapsibleRootProps> = ({
  open: controlledOpen,
  defaultOpen = false,
  onOpenChange,
  variant = 'normal',
  className,
  children,
}) => {
  const [internalOpen, setInternalOpen] = useState(defaultOpen);
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : internalOpen;

  const toggle = useCallback(() => {
    const next = !open;
    if (!isControlled) setInternalOpen(next);
    onOpenChange?.(next);
  }, [open, isControlled, onOpenChange]);

  return (
    <Ctx.Provider value={{ open, toggle }}>
      <div
        data-component="collapsible"
        data-variant={variant}
        data-state={open ? 'open' : 'closed'}
        className={className}
      >
        {children}
      </div>
    </Ctx.Provider>
  );
};

// ── Trigger ──
interface TriggerProps {
  className?: string;
  children: React.ReactNode;
  disabled?: boolean;
}

const Trigger: React.FC<TriggerProps> = ({ className, children, disabled }) => {
  const { toggle } = useContext(Ctx);
  return (
    <div
      data-slot="collapsible-trigger"
      className={className}
      onClick={disabled ? undefined : toggle}
      role="button"
      tabIndex={disabled ? -1 : 0}
      onKeyDown={(e) => {
        if (!disabled && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault();
          toggle();
        }
      }}
    >
      {children}
    </div>
  );
};

// ── Content (animated height) ──
interface ContentProps {
  className?: string;
  children: React.ReactNode;
}

const Content: React.FC<ContentProps> = ({ className, children }) => {
  const { open } = useContext(Ctx);
  const ref = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState<number | undefined>(open ? undefined : 0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open) {
      const h = el.scrollHeight;
      setHeight(h);
      const raf = requestAnimationFrame(() => setHeight(undefined));
      return () => cancelAnimationFrame(raf);
    } else {
      const h = el.scrollHeight;
      setHeight(h);
      // Force reflow then collapse
      // eslint-disable-next-line @typescript-eslint/no-unused-expressions
      el.offsetHeight;
      requestAnimationFrame(() => setHeight(0));
    }
  }, [open]);

  return (
    <div
      ref={ref}
      data-slot="collapsible-content"
      data-state={open ? 'open' : 'closed'}
      className={className}
      style={{
        maxHeight: height === undefined ? 'none' : `${height}px`,
        overflow: 'hidden',
        transition: 'max-height 0.2s ease',
      }}
    >
      {open && children}
    </div>
  );
};

// ── Arrow ──
interface ArrowProps {
  className?: string;
}

const Arrow: React.FC<ArrowProps> = ({ className }) => {
  const { open } = useContext(Ctx);
  return (
    <div
      data-slot="collapsible-arrow"
      data-open={open}
      className={className}
    >
      <span data-slot="collapsible-arrow-icon">
        <ChevronDown size={14} />
      </span>
    </div>
  );
};

// ── Compound export ──
export const Collapsible = Object.assign(CollapsibleRoot, {
  Trigger,
  Content,
  Arrow,
});

export default Collapsible;
