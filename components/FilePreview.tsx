import React from 'react';
import { Reference } from '../types';
import { Icons } from './Icon';
import MarkdownPreview from './MarkdownPreview';

interface FilePreviewProps {
  file: Reference;
  onClose: () => void;
  onEdit?: () => void;
}

const FilePreview: React.FC<FilePreviewProps> = ({ file, onClose, onEdit }) => {
  const renderContent = () => {
    switch (file.type) {
      case 'image':
        return (
          <div className="flex-1 flex items-center justify-center bg-black p-4">
             <img src={file.data} alt={file.name} className="max-w-full max-h-full object-contain" />
          </div>
        );
      case 'pdf':
        return (
           <div className="flex-1 bg-studio-800 overflow-hidden relative">
             {file.data ? (
               <iframe
                  src={file.data}
                  title={file.name}
                  className="w-full h-full border-0"
                  style={{ minHeight: '100%' }}
               />
             ) : (
                <div className="flex flex-col items-center justify-center h-full text-zinc-400">
                    <Icons.FileText className="w-12 h-12 mb-2"/>
                    <p>PDF Preview Not Available</p>
                    <p className="text-xs text-zinc-500 mt-1">No PDF data found</p>
                </div>
             )}
             {file.data && (
               <a
                 href={file.data}
                 download={file.name}
                 className="absolute bottom-4 right-4 bg-studio-accent text-white px-3 py-1.5 rounded text-xs hover:bg-blue-600 transition-colors flex items-center space-x-1"
               >
                 <Icons.Download size={12} />
                 <span>Download</span>
               </a>
             )}
           </div>
        );
      case 'link':
         return (
             <div className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-4">
                <div className="w-16 h-16 bg-studio-700 rounded-full flex items-center justify-center">
                    <Icons.Share2 className="w-8 h-8 text-studio-accent" />
                </div>
                <h3 className="text-xl font-medium text-white">{file.name}</h3>
                <a href={file.content} target="_blank" rel="noopener noreferrer" className="text-studio-accent hover:underline break-all max-w-md">
                    {file.content}
                </a>
                <p className="text-zinc-500 text-sm">External Link Reference</p>
             </div>
         );
      case 'zip':
         return (
            <div className="flex-1 flex flex-col items-center justify-center text-zinc-400">
               <Icons.Upload className="w-16 h-16 mb-4 opacity-50" />
               <p>Archive Preview Not Supported in Browser</p>
               <p className="text-xs mt-2 text-zinc-600">{file.name}</p>
            </div>
         );
      default:
        // Text based
        return (
          <div className="flex-1 overflow-y-auto bg-studio-900 p-6">
             <pre className="font-mono text-xs text-zinc-300 whitespace-pre-wrap">{file.content}</pre>
          </div>
        );
    }
  };

  return (
    <div className="flex flex-col h-full bg-studio-900 rounded-lg overflow-hidden border border-studio-border shadow-2xl">
      <div className="flex items-center justify-between p-3 border-b border-studio-border bg-studio-800">
        <div className="flex items-center space-x-2 overflow-hidden">
           <span className="text-xs uppercase font-bold text-zinc-500 tracking-wider bg-studio-900 px-1.5 py-0.5 rounded">{file.type}</span>
           <span className="text-sm font-medium text-white truncate">{file.name}</span>
        </div>
        <div className="flex space-x-2">
            {file.type === 'image' && onEdit && (
                <button onClick={onEdit} className="text-xs flex items-center space-x-1 bg-studio-700 hover:bg-studio-600 px-3 py-1 rounded text-white transition-colors">
                    <Icons.PenTool size={12} />
                    <span>Edit with AI</span>
                </button>
            )}
            <button onClick={onClose} className="text-zinc-400 hover:text-white"><Icons.Error size={18} /></button>
        </div>
      </div>
      {renderContent()}
    </div>
  );
};

export default FilePreview;