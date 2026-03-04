import React from 'react';
import { Collapsible } from './Collapsible';
import { TextShimmer } from './TextShimmer';
import {
  Search, FileText, Code, Terminal, Globe, ListTree, Glasses,
  Pencil, Image, CheckCircle, AlertCircle, Loader2, BrainCircuit
} from 'lucide-react';
import type { PartStatus } from '../types';

// ── Icon mapping ──
const TOOL_ICONS: Record<string, React.FC<{ size?: number; className?: string }>> = {
  'search': Search,
  'paper-search': Search,
  'plan-generate': BrainCircuit,
  'tex-generate': FileText,
  'bib-generate': FileText,
  'fig-generate': Code,
  'arch-generate': Code,
  'ref-verify': CheckCircle,
  'image-refine': Pencil,
  'image-generate': Image,
  'file-edit': Pencil,
  'read': Glasses,
  'write': FileText,
  'edit': Pencil,
  'bash': Terminal,
  'glob': Search,
  'grep': Search,
  'list': ListTree,
  'webfetch': Globe,
  'task': BrainCircuit,
  'default': Code,
};

export function getToolIcon(name: string): React.FC<{ size?: number; className?: string }> {
  return TOOL_ICONS[name] || TOOL_ICONS['default'];
}

// ── Status indicator ──
const StatusIndicator: React.FC<{ status?: PartStatus }> = ({ status }) => {
  if (status === 'pending' || status === 'running') {
    return <Loader2 size={14} className="animate-spin" style={{ color: 'var(--c-accent)' }} />;
  }
  if (status === 'completed') {
    return <CheckCircle size={14} style={{ color: 'rgb(34, 197, 94)' }} />;
  }
  if (status === 'error') {
    return <AlertCircle size={14} style={{ color: 'rgb(239, 68, 68)' }} />;
  }
  return null;
};

// ── TriggerTitle type ──
export interface TriggerTitle {
  title: string;
  titleClass?: string;
  subtitle?: string;
  subtitleClass?: string;
  args?: string[];
  argsClass?: string;
}

function isTriggerTitle(v: any): v is TriggerTitle {
  return v && typeof v === 'object' && 'title' in v && typeof v.title === 'string';
}

// ── BasicTool Props ──
export interface BasicToolProps {
  icon: string;
  trigger: TriggerTitle | React.ReactNode;
  children?: React.ReactNode;
  status?: PartStatus;
  hideDetails?: boolean;
  defaultOpen?: boolean;
  forceOpen?: boolean;
  className?: string;
}

const BasicToolInner: React.FC<BasicToolProps> = ({
  icon,
  trigger,
  children,
  status,
  hideDetails,
  defaultOpen = false,
  forceOpen,
  className,
}) => {
  const isPending = status === 'pending' || status === 'running';
  const hasContent = !!children && !hideDetails;
  const isOpen = forceOpen || defaultOpen;
  const IconComponent = getToolIcon(icon);

  const showArrow = hasContent && !isPending;

  return (
    <Collapsible defaultOpen={isOpen} className={className}>
      <Collapsible.Trigger>
        <div data-component="tool-trigger">
          <div data-slot="basic-tool-tool-indicator">
            {isPending ? (
              <Loader2 size={16} className="animate-spin" style={{ color: 'var(--c-accent)' }} />
            ) : (
              <IconComponent size={16} />
            )}
          </div>
          <div data-slot="basic-tool-tool-info">
            {isTriggerTitle(trigger) ? (
              <div data-slot="basic-tool-tool-info-structured">
                <span data-slot="basic-tool-tool-title" className={trigger.titleClass}>
                  {isPending ? (
                    <TextShimmer text={trigger.title} active />
                  ) : (
                    trigger.title
                  )}
                </span>
                {trigger.subtitle && (
                  <span data-slot="basic-tool-tool-subtitle" className={trigger.subtitleClass}>
                    {trigger.subtitle}
                  </span>
                )}
                {trigger.args?.map((arg, i) => (
                  <span key={i} data-slot="basic-tool-tool-arg" className={trigger.argsClass}>
                    {arg}
                  </span>
                ))}
              </div>
            ) : (
              trigger
            )}
          </div>
          {showArrow && <Collapsible.Arrow />}
        </div>
      </Collapsible.Trigger>
      {hasContent && (
        <Collapsible.Content>
          <div data-slot="basic-tool-tool-content">
            {children}
          </div>
        </Collapsible.Content>
      )}
    </Collapsible>
  );
};

export const BasicTool = React.memo(BasicToolInner);

// ── GenericTool (fallback) ──
export const GenericTool: React.FC<{ tool: string; status?: PartStatus }> = ({ tool, status }) => (
  <BasicTool icon="default" trigger={{ title: tool }} status={status} hideDetails />
);

export default BasicTool;
