import React, { useEffect, useState } from 'react';
import { FileSystemNode, FileType } from '../types';
import { Icons } from './Icon';

interface FileTreeProps {
  nodes: FileSystemNode[];
  selectedId: string | null;
  onSelect: (node: FileSystemNode) => void;
  onToggle: (nodeId: string) => void;
  onDelete?: (nodeId: string) => void;
  onRename?: (nodeId: string) => void;
  onNewFile?: (parentId: string) => void;
  onNewFolder?: (parentId: string) => void;
  onDropImage?: (folderId: string, imageData: string, imageName: string) => void;
  level?: number;
}

const getIconForFileType = (type?: FileType, name?: string) => {
  if (name?.endsWith('.tex')) return <Icons.FileCode size={14} className="text-green-400" />;
  if (name?.endsWith('.bib')) return <Icons.FileText size={14} className="text-yellow-400" />;
  if (name?.endsWith('.sty') || name?.endsWith('.cls') || name?.endsWith('.bst')) return <Icons.FileCode size={14} className="text-orange-400" />;
  
  switch (type) {
    case 'folder': return <Icons.Folder size={14} className="text-blue-400" />;
    case 'pdf': return <Icons.FileText size={14} className="text-red-400" />;
    case 'image': return <Icons.Image size={14} className="text-purple-400" />;
    case 'figure': return <Icons.Image size={14} className="text-purple-400" />;
    case 'table': return <Icons.Table size={14} className="text-orange-400" />;
    case 'formula': return <Icons.Sigma size={14} className="text-green-400" />;
    case 'link': return <Icons.Share2 size={14} className="text-blue-400" />;
    case 'zip': return <Icons.Upload size={14} className="text-yellow-400" />;
    case 'tex': return <Icons.FileCode size={14} className="text-green-400" />;
    default: return <Icons.FileText size={14} className="text-zinc-500" />;
  }
};

const FileTree: React.FC<FileTreeProps> = ({ nodes, selectedId, onSelect, onToggle, onDelete, onRename, onNewFile, onNewFolder, onDropImage, level = 0 }) => {
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<{
    nodeId: string;
    x: number;
    y: number;
  } | null>(null);

  useEffect(() => {
    const closeMenu = () => setContextMenu(null);
    const closeMenuOnEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setContextMenu(null);
    };
    window.addEventListener('click', closeMenu);
    window.addEventListener('keydown', closeMenuOnEscape);
    window.addEventListener('scroll', closeMenu, true);

    return () => {
      window.removeEventListener('click', closeMenu);
      window.removeEventListener('keydown', closeMenuOnEscape);
      window.removeEventListener('scroll', closeMenu, true);
    };
  }, []);

  const handleDragOver = (e: React.DragEvent, nodeId: string) => {
    // Only accept if this is a folder and the drag data is a paperstudio image
    if (e.dataTransfer.types.includes('application/paperstudio-image')) {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
      setDragOverId(nodeId);
    }
  };

  const handleDragLeave = () => {
    setDragOverId(null);
  };

  const handleDrop = (e: React.DragEvent, nodeId: string) => {
    e.preventDefault();
    setDragOverId(null);
    const raw = e.dataTransfer.getData('application/paperstudio-image');
    if (!raw || !onDropImage) return;
    try {
      const { imageData, name } = JSON.parse(raw);
      onDropImage(nodeId, imageData, name);
    } catch {
      // Invalid data
    }
  };

  return (
    <div className="select-none">
      {nodes.map((node) => (
        <React.Fragment key={node.id}>
          <div
            className={`group flex items-center py-[3px] pr-1 cursor-pointer transition-colors ${
              dragOverId === node.id
                ? 'bg-studio-accent/30 ring-1 ring-studio-accent ring-inset'
                : selectedId === node.id 
                  ? 'bg-studio-accent/20 text-white' 
                  : 'text-zinc-400 hover:bg-studio-800 hover:text-zinc-200'
            }`}
            style={{ paddingLeft: `${level * 12 + 8}px` }}
            onClick={(e) => {
              e.stopPropagation();
              setContextMenu(null);
              if (node.type === 'folder') {
                onToggle(node.id);
              } else {
                onSelect(node);
              }
            }}
            onContextMenu={(e) => {
              e.preventDefault();
              e.stopPropagation();
              const isRoot = node.id === 'root';
              if (isRoot || (!onRename && !onDelete)) return;
              const menuWidth = 180;
              const menuHeight = 74;
              const x = Math.min(e.clientX, window.innerWidth - menuWidth - 8);
              const y = Math.min(e.clientY, window.innerHeight - menuHeight - 8);
              setContextMenu({ nodeId: node.id, x, y });
            }}
            // Drop zone for folders
            {...(node.type === 'folder' ? {
              onDragOver: (e: React.DragEvent) => handleDragOver(e, node.id),
              onDragLeave: handleDragLeave,
              onDrop: (e: React.DragEvent) => handleDrop(e, node.id),
            } : {})}
          >
            {/* Icon area */}
            <div className="flex items-center mr-1.5 flex-shrink-0">
              {node.type === 'folder' && (
                <span className="mr-0.5 text-zinc-500">
                  {node.isOpen ? <Icons.ChevronDown size={12} /> : <Icons.ChevronRight size={12} />}
                </span>
              )}
              {node.type === 'folder' 
                 ? (node.isOpen ? <Icons.FolderOpen size={14} className="text-blue-400" /> : <Icons.Folder size={14} className="text-blue-400" />)
                 : getIconForFileType(node.fileType, node.name)
              }
            </div>

            {/* Name */}
            <span className="text-xs truncate flex-1">{node.name}</span>

            {/* Drop indicator for folders */}
            {node.type === 'folder' && dragOverId === node.id && (
              <span className="text-[9px] text-studio-accent flex-shrink-0 mr-1">Drop here</span>
            )}

            {/* Hover actions (Overleaf style) */}
            <div className="hidden group-hover:flex items-center gap-0.5 flex-shrink-0 ml-1">
              {node.type === 'folder' && onNewFile && (
                <button
                  onClick={(e) => { e.stopPropagation(); onNewFile(node.id); }}
                  className="p-0.5 rounded hover:bg-studio-600 text-zinc-500 hover:text-zinc-200"
                  title="New File"
                >
                  <Icons.FilePlus size={12} />
                </button>
              )}
              {node.type === 'folder' && onNewFolder && (
                <button
                  onClick={(e) => { e.stopPropagation(); onNewFolder(node.id); }}
                  className="p-0.5 rounded hover:bg-studio-600 text-zinc-500 hover:text-zinc-200"
                  title="New Folder"
                >
                  <Icons.FolderPlus size={12} />
                </button>
              )}
              {node.id !== 'root' && onDelete && (
                <button
                  onClick={(e) => { e.stopPropagation(); onDelete(node.id); }}
                  className="p-0.5 rounded hover:bg-red-500/20 text-zinc-500 hover:text-red-400"
                  title="Delete"
                >
                  <Icons.Trash2 size={12} />
                </button>
              )}
            </div>
          </div>
          
          {node.type === 'folder' && node.isOpen && node.children && (
            <FileTree 
              nodes={node.children} 
              selectedId={selectedId} 
              onSelect={onSelect} 
              onToggle={onToggle}
              onDelete={onDelete}
              onRename={onRename}
              onNewFile={onNewFile}
              onNewFolder={onNewFolder}
              onDropImage={onDropImage}
              level={level + 1} 
            />
          )}
        </React.Fragment>
      ))}

      {contextMenu && (
        <div
          className="fixed min-w-[180px] rounded-md border border-studio-600 bg-studio-900 py-1 text-zinc-100 shadow-2xl backdrop-blur-none"
          style={{ left: `${contextMenu.x}px`, top: `${contextMenu.y}px`, zIndex: 60 }}
          onClick={(e) => e.stopPropagation()}
        >
          {onRename && (
            <button
              className="w-full px-3 py-1.5 text-left text-xs hover:bg-studio-700 transition-colors flex items-center"
              onClick={() => {
                onRename(contextMenu.nodeId);
                setContextMenu(null);
              }}
            >
              <span>Rename</span>
              <span className="ml-auto text-[10px] text-zinc-500">F2</span>
            </button>
          )}
          {onDelete && (
            <button
              className="w-full px-3 py-1.5 text-left text-xs text-red-300 hover:bg-red-500/20 hover:text-red-200 transition-colors flex items-center"
              onClick={() => {
                onDelete(contextMenu.nodeId);
                setContextMenu(null);
              }}
            >
              <span>Delete</span>
              <span className="ml-auto text-[10px] text-zinc-500">Del</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default FileTree;
