/**
 * Online LaTeX Compiler using YtoTech LaTeX-on-HTTP API
 * https://latex.ytotech.com
 *
 * Features:
 * - Free, open API with full TeX Live support
 * - Supports pdflatex, xelatex, lualatex
 * - Supports multi-file projects and bibtex
 */

import {
  CompilationRequest,
  CompilationResult,
  CompilationLogEntry,
  CompilationError,
  CompilationResource,
} from '../../types';

const API_URL = 'https://latex.ytotech.com/builds/sync';
const DEFAULT_TIMEOUT = 120000; // 2 minutes

// Retry wrapper with exponential backoff
const retryWrapper = async <T>(
  fn: () => Promise<T>,
  retries = 3,
  initialDelay = 2000
): Promise<T> => {
  let currentDelay = initialDelay;
  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (error: any) {
      const isTransient =
        error.code === 'RATE_LIMITED' ||
        error.code === 'NETWORK_ERROR' ||
        error.message?.includes('429') ||
        error.message?.includes('503') ||
        error.message?.includes('fetch');

      if (i === retries - 1 || !isTransient) {
        throw error;
      }

      console.warn(
        `Compilation service busy. Retrying in ${currentDelay}ms... (Attempt ${i + 1}/${retries})`
      );
      await new Promise((resolve) => setTimeout(resolve, currentDelay));
      currentDelay *= 2;
    }
  }
  throw new Error('Max retries reached');
};

/**
 * Parse LaTeX compilation log for errors and warnings
 */
const parseLatexLog = (logText: string): CompilationLogEntry[] => {
  const entries: CompilationLogEntry[] = [];
  const lines = logText.split('\n');

  // Pattern for LaTeX errors: "! Error message"
  const errorPattern = /^!\s*(.+)$/;
  // Pattern for file/line info: "l.123 ..."
  const linePattern = /^l\.(\d+)\s*(.*)$/;
  // Pattern for warnings
  const warningPattern = /Warning[:\s]+(.+)/i;
  // Pattern for file references
  const filePattern = /\(([^()]+\.tex)/;

  let currentFile: string | undefined;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Track current file
    const fileMatch = line.match(filePattern);
    if (fileMatch) {
      currentFile = fileMatch[1];
    }

    // Check for errors
    const errorMatch = line.match(errorPattern);
    if (errorMatch) {
      const entry: CompilationLogEntry = {
        type: 'error',
        message: errorMatch[1],
        file: currentFile,
      };

      // Look for line number in next lines
      for (let j = i + 1; j < Math.min(i + 5, lines.length); j++) {
        const lineMatch = lines[j].match(linePattern);
        if (lineMatch) {
          entry.line = parseInt(lineMatch[1], 10);
          break;
        }
      }

      entries.push(entry);
    }

    // Check for warnings
    const warningMatch = line.match(warningPattern);
    if (warningMatch && !line.includes('Package')) {
      entries.push({
        type: 'warning',
        message: warningMatch[1].trim(),
        file: currentFile,
      });
    }

    // LaTeX Font Warning
    if (line.includes('LaTeX Font Warning')) {
      entries.push({
        type: 'warning',
        message: line.replace('LaTeX Font Warning:', '').trim(),
        file: currentFile,
      });
    }

    // Overfull/Underfull box warnings (common but often ignorable)
    if (line.includes('Overfull') || line.includes('Underfull')) {
      entries.push({
        type: 'info',
        message: line.trim(),
        file: currentFile,
      });
    }
  }

  return entries;
};

const normalizePath = (path: string): string =>
  path.replace(/\\/g, '/').replace(/^\.\//, '');

const toPdfDataUrl = (value: string): string | null => {
  const trimmed = value.trim();
  if (trimmed.startsWith('data:application/pdf;base64,')) {
    return trimmed;
  }

  const compact = trimmed.replace(/\s+/g, '');
  // PDF files begin with "%PDF-", which is "JVBERi0" in base64.
  if (compact.startsWith('JVBERi0') && /^[A-Za-z0-9+/=]+$/.test(compact)) {
    return `data:application/pdf;base64,${compact}`;
  }

  return null;
};

const extractLogText = (payload: any): string => {
  if (!payload || typeof payload !== 'object') return '';

  if (payload.log_files && typeof payload.log_files === 'object') {
    return Object.values(payload.log_files)
      .filter((v) => typeof v === 'string')
      .join('\n');
  }

  if (typeof payload.log === 'string') {
    return payload.log;
  }

  return '';
};

const extractPdfDataFromUnknown = (input: unknown): string | null => {
  const queue: unknown[] = [input];
  const visited = new Set<unknown>();

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current || visited.has(current)) continue;
    visited.add(current);

    if (typeof current === 'string') {
      const dataUrl = toPdfDataUrl(current);
      if (dataUrl) return dataUrl;
      continue;
    }

    if (typeof current !== 'object') continue;
    const entries = Object.entries(current as Record<string, unknown>);

    // Prefer explicit PDF fields first.
    for (const [key, value] of entries) {
      if (typeof value !== 'string') continue;
      if (!key.toLowerCase().includes('pdf')) continue;
      const dataUrl = toPdfDataUrl(value);
      if (dataUrl) return dataUrl;
    }

    for (const [, value] of entries) {
      if (value && typeof value === 'object') {
        queue.push(value);
      }
    }
  }

  return null;
};

/**
 * Compile LaTeX document using YtoTech API
 */
export const compileOnline = async (
  request: CompilationRequest,
  onProgress?: (message: string) => void
): Promise<CompilationResult> => {
  const startTime = Date.now();
  const timeout = request.options.timeout || DEFAULT_TIMEOUT;

  try {
    onProgress?.('Preparing compilation request...');

    // Build resources array for the API
    // YtoTech API format: https://github.com/YtoTech/latex-on-http
    const resources: any[] = [];

    // Get just the filename from mainFile path for fallback comparison
    const mainFileName = request.mainFile.split('/').pop() || request.mainFile;
    const normalizedMainPath = normalizePath(request.mainFile);
    const hasExactMainPathMatch = request.resources.some(
      (resource) => normalizePath(resource.path) === normalizedMainPath
    );

    for (const resource of request.resources) {
      const normalizedResourcePath = normalizePath(resource.path);
      const resourceFileName = resource.path.split('/').pop() || resource.path;
      const isMainFile =
        normalizedResourcePath === normalizedMainPath ||
        (!hasExactMainPathMatch && resourceFileName === mainFileName);

      if (resource.isBinary) {
        // Binary files (images) - send as base64
        // YtoTech expects base64 in 'file' field
        resources.push({
          path: resource.path,
          file: resource.content, // Already base64
        });
      } else {
        // Text files - send content directly
        const resourceEntry: any = {
          path: resource.path,
          content: resource.content,
        };

        // Mark the main file
        if (isMainFile) {
          resourceEntry.main = true;
        }

        resources.push(resourceEntry);
      }
    }

    // Ensure at least one file is marked as main
    const hasMain = resources.some(r => r.main === true);
    if (!hasMain && resources.length > 0) {
      // Find the first .tex file and mark it as main
      const firstTex = resources.find(r => r.path?.endsWith('.tex'));
      if (firstTex) {
        firstTex.main = true;
      }
    }

    // Map engine names
    const engineMap: Record<string, string> = {
      pdflatex: 'pdflatex',
      xelatex: 'xelatex',
      lualatex: 'lualatex',
    };

    const requestBody: any = {
      compiler: engineMap[request.options.engine] || 'pdflatex',
      resources,
    };

    // Check ALL text resources for bibliography commands (not just the main file)
    // This catches cases where the main file detection fails but bib commands exist
    const hasBibFile = resources.some((r: any) => r.path?.endsWith('.bib'));
    const mainResource = resources.find((r: any) => r.main);
    const mainContent = mainResource?.content || '';
    const allTextContent = resources
      .filter((r: any) => !r.file && r.content && r.path?.endsWith('.tex'))
      .map((r: any) => r.content)
      .join('\n');
    const contentToCheck = allTextContent || mainContent;
    const hasBibCommand = /\\bibliography\{/.test(contentToCheck) ||
                          /\\addbibresource\{/.test(contentToCheck) ||
                          /\\printbibliography/.test(contentToCheck) ||
                          /\\bibliographystyle\{/.test(contentToCheck);
    const needsBib = request.options.bibtex || hasBibFile || hasBibCommand;

    if (needsBib) {
      const useBiber = /\\usepackage.*\{biblatex\}/.test(contentToCheck) || /backend\s*=\s*biber/.test(contentToCheck);
      requestBody.options = {
        bibliography: {
          command: useBiber ? 'biber' : 'bibtex',
        },
      };
      console.log(`[Compiler] Bibliography enabled: command=${useBiber ? 'biber' : 'bibtex'}, hasBibFile=${hasBibFile}, hasBibCommand=${hasBibCommand}, optionsBibtex=${request.options.bibtex}`);
    } else {
      console.log('[Compiler] No bibliography detected');
    }

    console.log('=== LaTeX Compilation Debug ===');
    console.log('Compiler:', requestBody.compiler);
    console.log('Main file:', request.mainFile);
    console.log('BibTeX requested:', !!request.options.bibtex);
    console.log('Options sent:', JSON.stringify(requestBody.options || 'none'));
    console.log('Number of resources:', resources.length);
    console.log('Resources:', resources.map((r: any) => ({
      path: r.path,
      main: r.main,
      hasContent: !!r.content,
      contentLength: r.content?.length || 0,
      isBinary: !!r.file
    })));
    // Log .bib file content preview for debugging
    for (const r of resources) {
      if ((r as any).path?.endsWith('.bib') && (r as any).content) {
        const preview = (r as any).content.substring(0, 300);
        console.log(`[Compiler] .bib file "${(r as any).path}" preview:\n${preview}...`);
      }
    }

    onProgress?.('Sending to compilation server...');

    // Create abort controller for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    const response = await retryWrapper(async () => {
      const res = await fetch(API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal,
      });

      if (res.status === 429) {
        const error: CompilationError = {
          code: 'RATE_LIMITED',
          message: 'Too many requests. Please wait and try again.',
        };
        throw error;
      }

      if (!res.ok) {
        const errorText = await res.text();
        console.error('Compilation API error response:', errorText);

        // Check if it's JSON error response
        try {
          const errorJson = JSON.parse(errorText);
          const logContent = extractLogText(errorJson);
          const partialPdf = extractPdfDataFromUnknown(errorJson);
          if (logContent || partialPdf) {
            return {
              ok: false,
              log: logContent || errorText,
              status: res.status,
              errorJson,
              pdfData: partialPdf,
            };
          }
        } catch (e) {
          // Not JSON, might be plain text log
        }

        // Check if it's a compilation error (returns text/plain with log)
        if (res.headers.get('content-type')?.includes('text/plain')) {
          return {
            ok: false,
            log: errorText,
            status: res.status
          };
        }

        const error: CompilationError = {
          code: 'COMPILATION_FAILED',
          message: `Server error: ${res.status}`,
          details: errorText,
        };
        throw error;
      }

      return res;
    });

    clearTimeout(timeoutId);

    // Check if we got an error response object
    if (typeof response === 'object' && 'ok' in response && !response.ok) {
      const logs = parseLatexLog((response as any).log || '');
      return {
        success: false,
        pdfData: (response as any).pdfData,
        logs,
        error: {
          code: 'COMPILATION_FAILED',
          message: 'LaTeX compilation failed',
          details: (response as any).log,
        },
        compilationTime: Date.now() - startTime,
      };
    }

    onProgress?.('Receiving compiled PDF...');

    // Check response content type
    const contentType = (response as Response).headers.get('content-type');

    if (contentType?.includes('application/pdf')) {
      // Success - we got a PDF
      const pdfBlob = await (response as Response).blob();
      const pdfBase64 = await blobToBase64(pdfBlob);

      return {
        success: true,
        pdfData: pdfBase64,
        logs: [{ type: 'info', message: 'Compilation successful' }],
        compilationTime: Date.now() - startTime,
      };
    } else if (contentType?.includes('application/json')) {
      const payload = await (response as Response).json();
      const logText = extractLogText(payload);
      const logs = logText ? parseLatexLog(logText) : [];
      const partialPdf = extractPdfDataFromUnknown(payload);
      const success = Boolean((payload as any)?.success) && !!partialPdf;

      if (partialPdf && success) {
        return {
          success: true,
          pdfData: partialPdf,
          logs: logs.length > 0 ? logs : [{ type: 'info', message: 'Compilation successful' }],
          compilationTime: Date.now() - startTime,
        };
      }

      return {
        success: false,
        pdfData: partialPdf || undefined,
        logs,
        error: {
          code: 'COMPILATION_FAILED',
          message: 'LaTeX compilation failed',
          details: logText || JSON.stringify(payload),
        },
        compilationTime: Date.now() - startTime,
      };
    } else {
      // Error - got log text instead
      const logText = await (response as Response).text();
      const logs = parseLatexLog(logText);

      return {
        success: false,
        logs,
        error: {
          code: 'COMPILATION_FAILED',
          message: 'LaTeX compilation failed',
          details: logText,
        },
        compilationTime: Date.now() - startTime,
      };
    }
  } catch (error: any) {
    // Handle specific error types
    if (error.name === 'AbortError') {
      return {
        success: false,
        logs: [],
        error: {
          code: 'TIMEOUT',
          message: 'Compilation timed out. Try simplifying the document or increasing timeout.',
        },
        compilationTime: Date.now() - startTime,
      };
    }

    if (error.code && ['RATE_LIMITED', 'COMPILATION_FAILED', 'NETWORK_ERROR'].includes(error.code)) {
      return {
        success: false,
        logs: [],
        error: error as CompilationError,
        compilationTime: Date.now() - startTime,
      };
    }

    // Network or unknown error
    return {
      success: false,
      logs: [],
      error: {
        code: 'NETWORK_ERROR',
        message: 'Failed to connect to compilation server. Please check your network connection.',
        details: error.message,
      },
      compilationTime: Date.now() - startTime,
    };
  }
};

/**
 * Convert Blob to Base64 data URL
 */
const blobToBase64 = (blob: Blob): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
};

export default { compileOnline };
