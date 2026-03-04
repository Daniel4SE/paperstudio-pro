/**
 * LaTeX Compilation Service
 *
 * Unified interface for compiling LaTeX documents.
 * Supports both online (SaaS) and local (Electron) compilation modes.
 */

import {
  FileSystemNode,
  CompilationRequest,
  CompilationResult,
  CompilationResource,
  CompilationOptions,
  CompilerEngine,
  CompilationStatus,
  CompilationLogEntry,
} from '../types';
import { compileOnline } from './compilers/onlineCompiler';
import { compileLocal, isLocalCompilationAvailable } from './compilers/localCompiler';

// File extensions that should be included in compilation
const TEXT_EXTENSIONS = new Set([
  'tex', 'sty', 'cls', 'bib', 'bst', 'def', 'cfg', 'fd', 'ins', 'dtx'
]);

const BINARY_EXTENSIONS = new Set([
  'png', 'jpg', 'jpeg', 'pdf', 'eps', 'ps'
]);

/**
 * Check if a file should be included in the compilation
 */
const shouldIncludeFile = (filename: string): boolean => {
  const ext = filename.split('.').pop()?.toLowerCase() || '';
  return TEXT_EXTENSIONS.has(ext) || BINARY_EXTENSIONS.has(ext);
};

/**
 * Check if a file is binary
 */
const isBinaryFile = (filename: string): boolean => {
  const ext = filename.split('.').pop()?.toLowerCase() || '';
  return BINARY_EXTENSIONS.has(ext);
};

/**
 * Recursively collect all project files from a specific folder
 * Used for multi-file LaTeX projects
 */
export const collectProjectFiles = (
  nodes: FileSystemNode[],
  basePath: string = ''
): CompilationResource[] => {
  const resources: CompilationResource[] = [];

  const traverse = (nodeList: FileSystemNode[], currentPath: string) => {
    for (const node of nodeList) {
      if (node.type === 'folder' && node.children) {
        // Add subfolder name to path
        const folderPath = currentPath ? `${currentPath}/${node.name}` : node.name;
        traverse(node.children, folderPath);
      } else if (node.type === 'file') {
        const filePath = currentPath ? `${currentPath}/${node.name}` : node.name;

        if (!shouldIncludeFile(node.name)) {
          console.log(`[collectProjectFiles] SKIP (unsupported ext): ${filePath}`);
          continue;
        }

        if (isBinaryFile(node.name)) {
          if (node.data) {
            const base64Content = node.data.includes(',')
              ? node.data.split(',')[1]
              : node.data;

            resources.push({
              path: filePath,
              content: base64Content,
              isBinary: true,
            });
            console.log(`[collectProjectFiles] INCLUDE (binary): ${filePath} (${base64Content.length} chars b64)`);
          } else {
            console.warn(`[collectProjectFiles] SKIP (binary, no data): ${filePath}`);
          }
        } else {
          // Keep empty text files too — missing them can break multi-file projects.
          if (node.content !== undefined) {
            resources.push({
              path: filePath,
              content: node.content,
              isBinary: false,
            });
            console.log(`[collectProjectFiles] INCLUDE (text): ${filePath} (${node.content.length} chars)`);
          } else {
            console.warn(`[collectProjectFiles] SKIP (text, EMPTY content): ${filePath} — this file will be MISSING from compilation!`);
          }
        }
      }
    }
  };

  traverse(nodes, basePath);
  return resources;
};

/**
 * Collect files from the project containing the main file
 * This ensures we only include files from the relevant project folder
 */
export const collectProjectFilesForMain = (
  fileSystem: FileSystemNode[],
  mainFileId: string
): { resources: CompilationResource[] } | null => {
  const rootFolder = fileSystem[0];
  if (rootFolder?.type !== 'folder' || !rootFolder.children) {
    return null;
  }

  const mainFilePath = getFilePath(fileSystem, mainFileId);
  if (!mainFilePath) {
    return null;
  }

  // Scope resources to the same top-level project folder as the target main file.
  // This preserves relative paths (folder/main.tex) and avoids cross-project mixing.
  const pathParts = mainFilePath.split('/');
  let scopeNodes = rootFolder.children;

  if (pathParts.length > 1) {
    const topLevelFolderName = pathParts[0];
    const topLevelFolder = rootFolder.children.find(
      (node) => node.type === 'folder' && node.name === topLevelFolderName
    );
    if (topLevelFolder && topLevelFolder.type === 'folder') {
      scopeNodes = [topLevelFolder];
    }
  }

  const resources = collectProjectFiles(scopeNodes, '');
  return { resources };
};

/**
 * Find the main .tex file in the file system.
 * Priority: 1) file with \documentclass, 2) main.tex, 3) first .tex file
 */
export const findMainTexFile = (nodes: FileSystemNode[]): FileSystemNode | null => {
  let firstTexFile: FileSystemNode | null = null;
  let mainTexFile: FileSystemNode | null = null;
  let documentclassFile: FileSystemNode | null = null;

  const traverse = (nodeList: FileSystemNode[]) => {
    for (const node of nodeList) {
      if (node.type === 'folder' && node.children) {
        traverse(node.children);
      } else if (node.type === 'file' && node.name.endsWith('.tex')) {
        if (!firstTexFile) {
          firstTexFile = node;
        }
        if (node.name.toLowerCase() === 'main.tex') {
          mainTexFile = node;
        }
        // Highest priority: the file that contains \documentclass
        if (!documentclassFile && node.content && /\\documentclass/.test(node.content)) {
          documentclassFile = node;
        }
      }
    }
  };

  traverse(nodes);
  return documentclassFile || mainTexFile || firstTexFile;
};

/**
 * Get the path of a file relative to project root
 * Skips root-level folder names to match collectProjectFiles behavior
 */
function getFilePath(
  nodes: FileSystemNode[],
  targetId: string,
  currentPath: string = '',
  isRoot: boolean = true
): string | null {
  for (const node of nodes) {
    // For files, build the path
    if (node.id === targetId) {
      return currentPath ? `${currentPath}/${node.name}` : node.name;
    }

    if (node.type === 'folder' && node.children) {
      // Skip root-level folder names (like "Project Root", "References")
      let newPath: string;
      if (isRoot) {
        newPath = currentPath; // Don't add root folder name
      } else {
        newPath = currentPath ? `${currentPath}/${node.name}` : node.name;
      }

      const found = getFilePath(node.children, targetId, newPath, false);
      if (found) return found;
    }
  }

  return null;
}

const escapeRegExp = (value: string): string =>
  value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const hasUndefinedControlSequence = (result: CompilationResult): boolean => {
  if (result.logs.some((entry) => /Undefined control sequence/i.test(entry.message))) {
    return true;
  }
  return /Undefined control sequence/i.test(result.error?.details || '');
};

const extractUndefinedCommands = (logText: string): string[] => {
  if (!logText) return [];
  const lines = logText.split('\n');
  const commands = new Set<string>();

  for (let i = 0; i < lines.length; i++) {
    if (!/Undefined control sequence/i.test(lines[i])) continue;
    for (let j = i; j < Math.min(i + 6, lines.length); j++) {
      const matches = lines[j].match(/\\[A-Za-z@]+/g);
      if (!matches) continue;
      for (const match of matches) {
        commands.add(match);
      }
    }
  }

  return Array.from(commands);
};

const stripUnknownCommandsFromContent = (
  content: string,
  commands: string[]
): string => {
  let next = content;

  for (const command of commands) {
    const bare = command.replace(/^\\+/, '');
    if (!bare) continue;
    const escaped = escapeRegExp(bare);

    // Replace common command forms while preserving inner text when possible.
    const withOneArg = new RegExp(`\\\\${escaped}\\*?(?:\\[[^\\]]*\\])?\\{([^{}]*)\\}`, 'g');
    next = next.replace(withOneArg, '$1');

    const withNoArg = new RegExp(`\\\\${escaped}\\*?(?:\\[[^\\]]*\\])?`, 'g');
    next = next.replace(withNoArg, '');
  }

  return next;
};

const buildTolerantResources = (
  resources: CompilationResource[],
  commands: string[]
): CompilationResource[] => {
  return resources.map((resource) => {
    if (resource.isBinary) return resource;
    return {
      ...resource,
      content: stripUnknownCommandsFromContent(resource.content, commands),
    };
  });
};

/**
 * Detect compiler engine from document content
 * Returns xelatex if CJK/Unicode content is detected
 */
export const detectCompilerEngine = (content: string): CompilerEngine => {
  // Check for fontspec or polyglossia (requires xelatex/lualatex)
  if (/\\usepackage.*{fontspec}/.test(content) ||
      /\\usepackage.*{polyglossia}/.test(content)) {
    return 'xelatex';
  }

  // Check for CJK content
  if (/[\u4e00-\u9fff]/.test(content) || // Chinese
      /[\u3040-\u309f\u30a0-\u30ff]/.test(content) || // Japanese
      /[\uac00-\ud7af]/.test(content)) { // Korean
    return 'xelatex';
  }

  // Check for unicode-math
  if (/\\usepackage.*{unicode-math}/.test(content)) {
    return 'lualatex';
  }

  // Default to pdflatex
  return 'pdflatex';
};

/**
 * Check if document has bibliography
 */
export const hasBibliography = (content: string): boolean => {
  return /\\bibliography\{/.test(content) ||
         /\\addbibresource\{/.test(content) ||
         /\\printbibliography/.test(content) ||
         /\\bibliographystyle\{/.test(content);
};

export type CompilationMode = 'online' | 'local' | 'auto';

export interface CompileDocumentOptions {
  mode?: CompilationMode;
  engine?: CompilerEngine;
  timeout?: number;
  onStatusChange?: (status: CompilationStatus) => void;
}

/**
 * Main compilation function - compiles a LaTeX project
 */
export const compileDocument = async (
  fileSystem: FileSystemNode[],
  mainFileId: string,
  options: CompileDocumentOptions = {}
): Promise<CompilationResult> => {
  const {
    mode = 'auto',
    engine,
    timeout = 120000,
    onStatusChange,
  } = options;

  const setStatus = (status: CompilationStatus) => {
    onStatusChange?.(status);
  };

  try {
    // Step 1: Find main file
    setStatus({ stage: 'collecting', message: 'Finding main document...' });

    const mainFilePath = getFilePath(fileSystem, mainFileId);
    if (!mainFilePath) {
      return {
        success: false,
        logs: [],
        error: {
          code: 'INVALID_REQUEST',
          message: 'Could not find the main .tex file.',
        },
      };
    }

    // Get main file content
    const findNode = (nodes: FileSystemNode[], id: string): FileSystemNode | null => {
      for (const node of nodes) {
        if (node.id === id) return node;
        if (node.children) {
          const found = findNode(node.children, id);
          if (found) return found;
        }
      }
      return null;
    };

    const mainFileNode = findNode(fileSystem, mainFileId);
    if (!mainFileNode || !mainFileNode.content) {
      return {
        success: false,
        logs: [],
        error: {
          code: 'INVALID_REQUEST',
          message: 'Main file has no content.',
        },
      };
    }

    // Step 2: Collect all project files from the main file's project folder
    setStatus({ stage: 'collecting', message: 'Collecting project files...' });
    const projectFiles = collectProjectFilesForMain(fileSystem, mainFileId);

    if (!projectFiles || projectFiles.resources.length === 0) {
      return {
        success: false,
        logs: [],
        error: {
          code: 'INVALID_REQUEST',
          message: 'No .tex files found in the project.',
        },
      };
    }

    const { resources } = projectFiles;
    console.log(`Collected ${resources.length} files for compilation. Main file: ${mainFilePath}`);
    console.log('Resource paths:', resources.map(r => r.path));

    // Step 3: Detect compiler engine
    const detectedEngine = engine || detectCompilerEngine(mainFileNode.content);
    const needsBibtex = hasBibliography(mainFileNode.content);

    setStatus({
      stage: 'collecting',
      message: `Using ${detectedEngine}${needsBibtex ? ' with BibTeX' : ''}...`
    });

    // Step 4: Build compilation request
    const compilationOptions: CompilationOptions = {
      engine: detectedEngine,
      bibtex: needsBibtex,
      timeout,
    };

    // Keep main file path to avoid collisions like duplicate "main.tex" in subfolders.
    const request: CompilationRequest = {
      mainFile: mainFilePath,
      resources,
      options: compilationOptions,
    };

    // Step 5: Choose compilation mode
    const useLocal = mode === 'local' ||
                     (mode === 'auto' && isLocalCompilationAvailable());

    setStatus({
      stage: 'uploading',
      message: useLocal ? 'Preparing local compilation...' : 'Uploading to server...'
    });

    // Step 6: Compile
    let result: CompilationResult;

    if (useLocal) {
      result = await compileLocal(request, (msg) => {
        setStatus({ stage: 'compiling', message: msg });
      });
    } else {
      result = await compileOnline(request, (msg) => {
        if (msg.includes('Sending')) {
          setStatus({ stage: 'uploading', message: msg });
        } else if (msg.includes('Receiving')) {
          setStatus({ stage: 'downloading', message: msg });
        } else {
          setStatus({ stage: 'compiling', message: msg });
        }
      });
    }

    // Step 7: Fallback strategies for partial output
    if (!useLocal && !result.success && !result.pdfData && hasUndefinedControlSequence(result)) {
      const undefinedCommands = extractUndefinedCommands(result.error?.details || '');
      if (undefinedCommands.length > 0) {
        const shown = undefinedCommands.slice(0, 5).join(', ');
        setStatus({
          stage: 'compiling',
          message: `Undefined commands detected (${shown}). Retrying tolerant compile...`,
        });

        const tolerantRequest: CompilationRequest = {
          ...request,
          resources: buildTolerantResources(resources, undefinedCommands),
        };

        const tolerantResult = await compileOnline(tolerantRequest, (msg) => {
          if (msg.includes('Sending')) {
            setStatus({ stage: 'uploading', message: `Tolerant retry: ${msg}` });
          } else if (msg.includes('Receiving')) {
            setStatus({ stage: 'downloading', message: `Tolerant retry: ${msg}` });
          } else {
            setStatus({ stage: 'compiling', message: `Tolerant retry: ${msg}` });
          }
        });

        if (tolerantResult.success || tolerantResult.pdfData) {
          const warning: CompilationLogEntry = {
            type: 'warning',
            message: `Compiled in tolerant mode (stripped undefined commands: ${shown}${undefinedCommands.length > 5 ? ', ...' : ''}).`,
          };

          result = {
            ...tolerantResult,
            logs: [warning, ...tolerantResult.logs],
          };
        }
      }
    }

    // Engine retry can rescue some documents that fail under pdflatex but work under xelatex.
    if (!useLocal && !result.success && !result.pdfData && detectedEngine === 'pdflatex') {
      setStatus({
        stage: 'compiling',
        message: 'Retrying with XeLaTeX for compatibility...',
      });

      const xelatexRequest: CompilationRequest = {
        ...request,
        options: {
          ...request.options,
          engine: 'xelatex',
        },
      };

      const xelatexResult = await compileOnline(xelatexRequest, (msg) => {
        if (msg.includes('Sending')) {
          setStatus({ stage: 'uploading', message: `XeLaTeX retry: ${msg}` });
        } else if (msg.includes('Receiving')) {
          setStatus({ stage: 'downloading', message: `XeLaTeX retry: ${msg}` });
        } else {
          setStatus({ stage: 'compiling', message: `XeLaTeX retry: ${msg}` });
        }
      });

      if (xelatexResult.success || xelatexResult.pdfData) {
        const warning: CompilationLogEntry = {
          type: 'warning',
          message: 'Compiled using XeLaTeX fallback (original pdflatex run failed).',
        };
        result = {
          ...xelatexResult,
          logs: [warning, ...xelatexResult.logs],
        };
      }
    }

    // Step 8: Report result
    if (result.success) {
      setStatus({
        stage: 'complete',
        message: `Compilation successful (${(result.compilationTime || 0) / 1000}s)`
      });
    } else {
      setStatus({
        stage: 'error',
        message: result.error?.message || 'Compilation failed',
        error: result.error!,
      });
    }

    return result;

  } catch (error: any) {
    const compilationError = {
      code: 'UNKNOWN' as const,
      message: 'An unexpected error occurred',
      details: error.message,
    };

    setStatus({
      stage: 'error',
      message: compilationError.message,
      error: compilationError,
    });

    return {
      success: false,
      logs: [],
      error: compilationError,
    };
  }
};

export default {
  compileDocument,
  collectProjectFiles,
  findMainTexFile,
  detectCompilerEngine,
  hasBibliography,
};
