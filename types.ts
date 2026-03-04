export interface Message {
  id: string;
  role: 'user' | 'model' | 'system';
  content: string;
  type?: 'text' | 'mermaid' | 'suggestion' | 'image';
  imageData?: string; // base64 data URL for generated images
  timestamp: number;
}

export type ReferenceType = 'pdf' | 'txt' | 'tex' | 'md' | 'image' | 'link' | 'zip';
export type FileType = ReferenceType | 'formula' | 'table' | 'figure' | 'folder';

export interface Reference {
  id: string;
  name: string;
  content?: string; // For text/links
  data?: string;    // Base64 for binary
  mimeType?: string;
  type: ReferenceType;
}

export interface FileSystemNode {
  id: string;
  name: string;
  type: 'folder' | 'file';
  fileType?: FileType;
  children?: FileSystemNode[];
  content?: string; // For text/latex/markdown content
  data?: string;    // For binary/image data
  mimeType?: string; // For images/pdfs
  isOpen?: boolean; // UI state for folders
  parentId?: string;
}

export interface PaperState {
  title: string;
  content: string;
  lastSaved: Date;
}

export enum ViewMode {
  EDITOR = 'EDITOR',
  SPLIT = 'SPLIT',
  PREVIEW = 'PREVIEW'
}

export interface GeneratedDiagram {
  code: string;
  description: string;
}

export interface KnowledgeItem {
  id: string;
  type: 'formula' | 'table' | 'figure';
  title: string;
  content: string; // LaTeX, Markdown Table, or Description
  explanation?: string;
}

// ============================================
// LaTeX Compilation Types
// ============================================

export type CompilerEngine = 'pdflatex' | 'xelatex' | 'lualatex';

export interface CompilationOptions {
  engine: CompilerEngine;
  bibtex?: boolean;
  timeout?: number; // milliseconds
}

export interface CompilationResource {
  path: string;
  content: string; // text content or base64 for binary
  isBinary?: boolean;
}

export interface CompilationRequest {
  mainFile: string; // path of main .tex file relative to project root
  resources: CompilationResource[];
  options: CompilationOptions;
}

export interface CompilationLogEntry {
  type: 'error' | 'warning' | 'info';
  message: string;
  file?: string;
  line?: number;
}

export interface CompilationError {
  code: 'NETWORK_ERROR' | 'TIMEOUT' | 'COMPILATION_FAILED' | 'RATE_LIMITED' | 'INVALID_REQUEST' | 'UNKNOWN';
  message: string;
  details?: string;
}

export interface CompilationResult {
  success: boolean;
  pdfData?: string; // Base64 encoded PDF
  logs: CompilationLogEntry[];
  error?: CompilationError;
  compilationTime?: number; // milliseconds
}

// ============================================
// Research Pipeline Types
// ============================================

export interface GeneratedFile {
  name: string;
  content: string;
  fileType: FileType;
  description?: string;
}

export type ResearchStage =
  | 'idle'
  | 'searching'
  | 'papers_found'
  | 'planning'
  | 'plan_ready'
  | 'generating_tex'
  | 'generating_bib'
  | 'generating_figures'
  | 'verifying_refs'
  | 'complete'
  | 'error';

export interface ResearchState {
  stage: ResearchStage;
  topic: string;
  papers: string;
  plan: string;
  files: GeneratedFile[];
  currentStep: string;
  error?: string;
}

export type CompilationStatus =
  | { stage: 'idle' }
  | { stage: 'collecting'; message: string }
  | { stage: 'uploading'; message: string; progress?: number }
  | { stage: 'compiling'; message: string }
  | { stage: 'downloading'; message: string }
  | { stage: 'complete'; message: string }
  | { stage: 'error'; message: string; error: CompilationError };

// ============================================
// OpenCode-style Part-based Message System
// ============================================

export type PartStatus = 'pending' | 'running' | 'completed' | 'error';

export interface BasePart {
  id: string;
  type: string;
  time?: { start?: number; end?: number };
}

export interface TextPart extends BasePart {
  type: 'text';
  text: string;
  isStreaming?: boolean;
}

export interface ThinkingPart extends BasePart {
  type: 'thinking';
  text: string;
  title?: string;
}

export interface ToolCallPart extends BasePart {
  type: 'tool-call';
  tool: string;
  status: PartStatus;
  title?: string;
  subtitle?: string;
  input?: Record<string, any>;
  output?: string;
  metadata?: Record<string, any>;
  children?: MessagePart[];
}

export interface SearchPart extends BasePart {
  type: 'search';
  status: PartStatus;
  sources: Array<{
    name: string;
    url?: string;
    icon?: string;
    status: PartStatus;
    resultCount?: number;
  }>;
  totalResults?: number;
}

export interface ImageGenPart extends BasePart {
  type: 'image-gen';
  status: PartStatus;
  prompt?: string;
  refinedPrompt?: string;
  imageData?: string;
  model?: string;
}

export interface FileGenPart extends BasePart {
  type: 'file-gen';
  status: PartStatus;
  fileName: string;
  fileType: string;
  content?: string;
  size?: number;
}

export interface RefVerifyPart extends BasePart {
  type: 'ref-verify';
  status: PartStatus;
  phases: Array<{
    name: string;
    status: PartStatus;
    details?: string;
  }>;
  report?: string;
}

export interface ErrorPart extends BasePart {
  type: 'error';
  message: string;
  details?: string;
}

export type MessagePart =
  | TextPart
  | ThinkingPart
  | ToolCallPart
  | SearchPart
  | ImageGenPart
  | FileGenPart
  | RefVerifyPart
  | ErrorPart;

export interface PartMessage {
  id: string;
  role: 'user' | 'assistant';
  parts: MessagePart[];
  timestamp: number;
  model?: string;
  agent?: string;
}

// ============================================
// Multi-provider Login System
// ============================================

export type ProviderId = 'anthropic' | 'google' | 'openai';

export interface ProviderConnection {
  id: ProviderId;
  name: string;
  status: 'connected' | 'disconnected' | 'connecting' | 'error';
  apiKey?: string;
  models: string[];
  error?: string;
  icon?: string;
}
