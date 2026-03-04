import React from 'react';
import { CompilationStatus as CompilationStatusType, CompilationLogEntry } from '../types';
import { Icons } from './Icon';

interface CompilationStatusProps {
  status: CompilationStatusType;
  logs?: CompilationLogEntry[];
  onClose?: () => void;
}

const CompilationStatus: React.FC<CompilationStatusProps> = ({
  status,
  logs = [],
  onClose,
}) => {
  // Don't show anything when idle
  if (status.stage === 'idle') {
    return null;
  }

  const isProcessing = ['collecting', 'uploading', 'compiling', 'downloading'].includes(status.stage);
  const isComplete = status.stage === 'complete';
  const isError = status.stage === 'error';

  // Filter logs by type for display
  const errors = logs.filter(l => l.type === 'error');
  const warnings = logs.filter(l => l.type === 'warning');

  return (
    <div className="fixed bottom-4 right-4 w-96 bg-studio-800 border border-studio-600 rounded-lg shadow-2xl z-50 overflow-hidden animate-in slide-in-from-bottom-5 duration-200">
      {/* Header */}
      <div className={`px-4 py-3 flex items-center justify-between ${
        isComplete ? 'bg-green-900/30 border-b border-green-800/50' :
        isError ? 'bg-red-900/30 border-b border-red-800/50' :
        'bg-studio-700 border-b border-studio-600'
      }`}>
        <div className="flex items-center space-x-3">
          {isProcessing && (
            <div className="w-5 h-5 border-2 border-studio-accent border-t-transparent rounded-full animate-spin" />
          )}
          {isComplete && (
            <div className="w-5 h-5 rounded-full bg-green-500 flex items-center justify-center">
              <Icons.Check size={12} className="text-white" />
            </div>
          )}
          {isError && (
            <div className="w-5 h-5 rounded-full bg-red-500 flex items-center justify-center">
              <Icons.X size={12} className="text-white" />
            </div>
          )}
          <span className="font-medium text-sm text-zinc-100">
            {isProcessing && 'Compiling...'}
            {isComplete && 'Compilation Complete'}
            {isError && 'Compilation Failed'}
          </span>
        </div>
        {(isComplete || isError) && onClose && (
          <button
            onClick={onClose}
            className="text-zinc-400 hover:text-zinc-200 p-1"
          >
            <Icons.X size={14} />
          </button>
        )}
      </div>

      {/* Progress */}
      <div className="px-4 py-3">
        <div className="flex items-center space-x-2 text-sm text-zinc-300 mb-2">
          <span>{status.message}</span>
        </div>

        {/* Progress bar for processing states */}
        {isProcessing && (
          <div className="h-1 bg-studio-600 rounded-full overflow-hidden">
            <div className="h-full bg-studio-accent animate-pulse" style={{ width: '100%' }} />
          </div>
        )}
      </div>

      {/* Error details */}
      {isError && status.stage === 'error' && status.error && (
        <div className="px-4 pb-3">
          <div className="bg-red-900/20 border border-red-800/30 rounded p-3 text-xs text-red-300">
            <div className="font-medium mb-1">Error: {status.error.code}</div>
            {status.error.details && (
              <div className="text-red-400/80 mt-1 font-mono text-[10px] max-h-32 overflow-y-auto">
                {status.error.details.slice(0, 500)}
                {status.error.details.length > 500 && '...'}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Compilation logs */}
      {(errors.length > 0 || warnings.length > 0) && (
        <div className="px-4 pb-3 space-y-2 max-h-48 overflow-y-auto">
          {errors.map((log, i) => (
            <div key={`err-${i}`} className="flex items-start space-x-2 text-xs">
              <span className="text-red-400 font-bold shrink-0">ERROR</span>
              <div className="text-zinc-300">
                <span>{log.message}</span>
                {log.file && (
                  <span className="text-zinc-500 ml-1">
                    ({log.file}{log.line ? `:${log.line}` : ''})
                  </span>
                )}
              </div>
            </div>
          ))}
          {warnings.slice(0, 5).map((log, i) => (
            <div key={`warn-${i}`} className="flex items-start space-x-2 text-xs">
              <span className="text-amber-400 font-bold shrink-0">WARN</span>
              <div className="text-zinc-400">
                <span>{log.message}</span>
                {log.file && (
                  <span className="text-zinc-500 ml-1">
                    ({log.file}{log.line ? `:${log.line}` : ''})
                  </span>
                )}
              </div>
            </div>
          ))}
          {warnings.length > 5 && (
            <div className="text-xs text-zinc-500">
              +{warnings.length - 5} more warnings
            </div>
          )}
        </div>
      )}

      {/* Success message */}
      {isComplete && (
        <div className="px-4 pb-3">
          <div className="bg-green-900/20 border border-green-800/30 rounded p-3 text-xs text-green-300">
            PDF generated successfully. Check the file explorer for the compiled output.
          </div>
        </div>
      )}
    </div>
  );
};

export default CompilationStatus;
