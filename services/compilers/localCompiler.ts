/**
 * Local LaTeX Compiler for Electron/Desktop Mode
 *
 * This module provides a placeholder for future Electron integration
 * that will use locally installed LaTeX (pdflatex, xelatex, lualatex).
 *
 * Prerequisites for local compilation:
 * - TeX Live, MiKTeX, or MacTeX installed
 * - pdflatex/xelatex/lualatex in PATH
 * - Electron main process IPC handler
 */

import {
  CompilationRequest,
  CompilationResult,
  CompilationError,
} from '../../types';

// Type for Electron API when available
declare global {
  interface Window {
    electronAPI?: {
      compileLatex: (request: CompilationRequest) => Promise<CompilationResult>;
      isElectron: boolean;
    };
  }
}

/**
 * Check if running in Electron with local compilation support
 */
export const isLocalCompilationAvailable = (): boolean => {
  return typeof window !== 'undefined' &&
         window.electronAPI?.isElectron === true &&
         typeof window.electronAPI?.compileLatex === 'function';
};

/**
 * Compile LaTeX document using local TeX installation via Electron IPC
 *
 * Future implementation will:
 * 1. Write project files to a temporary directory
 * 2. Execute pdflatex/xelatex with appropriate flags
 * 3. Run bibtex if bibliography is present
 * 4. Run pdflatex again for cross-references
 * 5. Read and return the generated PDF
 *
 * Example Electron main process handler:
 *
 * ```typescript
 * // main.ts (Electron main process)
 * import { ipcMain } from 'electron';
 * import { exec } from 'child_process';
 * import * as fs from 'fs/promises';
 * import * as path from 'path';
 * import * as os from 'os';
 *
 * ipcMain.handle('compile-latex', async (event, request: CompilationRequest) => {
 *   const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'paperstudio-'));
 *
 *   try {
 *     // Write all resources to temp directory
 *     for (const resource of request.resources) {
 *       const filePath = path.join(tempDir, resource.path);
 *       await fs.mkdir(path.dirname(filePath), { recursive: true });
 *
 *       if (resource.isBinary) {
 *         const buffer = Buffer.from(resource.content, 'base64');
 *         await fs.writeFile(filePath, buffer);
 *       } else {
 *         await fs.writeFile(filePath, resource.content);
 *       }
 *     }
 *
 *     // Run compilation
 *     const engine = request.options.engine || 'pdflatex';
 *     const mainFile = request.mainFile;
 *     const cmd = `${engine} -interaction=nonstopmode -output-directory="${tempDir}" "${path.join(tempDir, mainFile)}"`;
 *
 *     await execPromise(cmd);
 *
 *     // Run twice for references
 *     await execPromise(cmd);
 *
 *     // Read PDF
 *     const pdfPath = path.join(tempDir, mainFile.replace('.tex', '.pdf'));
 *     const pdfBuffer = await fs.readFile(pdfPath);
 *     const pdfBase64 = `data:application/pdf;base64,${pdfBuffer.toString('base64')}`;
 *
 *     return {
 *       success: true,
 *       pdfData: pdfBase64,
 *       logs: [{ type: 'info', message: 'Local compilation successful' }],
 *     };
 *   } finally {
 *     // Cleanup temp directory
 *     await fs.rm(tempDir, { recursive: true, force: true });
 *   }
 * });
 * ```
 */
export const compileLocal = async (
  request: CompilationRequest,
  onProgress?: (message: string) => void
): Promise<CompilationResult> => {
  if (!isLocalCompilationAvailable()) {
    return {
      success: false,
      logs: [],
      error: {
        code: 'INVALID_REQUEST',
        message: 'Local compilation is not available. This feature requires the desktop (Electron) version of PaperStudio Pro.',
      },
    };
  }

  onProgress?.('Starting local compilation...');

  try {
    // Call Electron IPC handler
    const result = await window.electronAPI!.compileLatex(request);
    return result;
  } catch (error: any) {
    return {
      success: false,
      logs: [],
      error: {
        code: 'UNKNOWN',
        message: 'Local compilation failed',
        details: error.message,
      },
    };
  }
};

export default { compileLocal, isLocalCompilationAvailable };
