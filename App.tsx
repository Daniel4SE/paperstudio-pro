import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Icons } from './components/Icon';
import MarkdownPreview from './components/MarkdownPreview';
import LatexRenderer from './components/LatexRenderer';
import LatexDocumentPreview from './components/LatexDocumentPreview';
import ChatPanel from './components/ChatPanel';
import FilePreview from './components/FilePreview';
import ImageEditor from './components/ImageEditor';
import FileTree from './components/FileTree';
import CompilationStatus from './components/CompilationStatus';
import CodeEditor from './components/CodeEditor';
import { ViewMode, Reference, ReferenceType, KnowledgeItem, FileSystemNode, FileType, GeneratedFile, CompilationStatus as CompilationStatusType, CompilationLogEntry } from './types';
import { generateResearchDirections, extractPaperDetails } from './services/claudeService';
import { compileDocument, findMainTexFile } from './services/compilationService';
import { extractMacros } from './utils/latexUtils';
import { unzipProject } from './utils/zipUtils';

// Global declaration for html2pdf
declare global {
    interface Window {
        html2pdf: any;
    }
}

// Initial File System — starts empty (user creates/uploads their own files)
const INITIAL_FILES: FileSystemNode[] = [
  {
     id: 'root',
     name: 'Project',
     type: 'folder',
     isOpen: true,
     children: []
  }
];

type SidebarTab = 'explorer' | 'search' | 'settings' | 'none';

type Theme = 'dark' | 'light';

const App = () => {
  // Theme
  const [theme, setTheme] = useState<Theme>(() => {
    const saved = localStorage.getItem('paperstudio-theme') as Theme | null;
    return saved || 'dark';
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('paperstudio-theme', theme);
  }, [theme]);

  const toggleTheme = useCallback(() => setTheme(t => t === 'dark' ? 'light' : 'dark'), []);

  // State
  const [fileSystem, setFileSystem] = useState<FileSystemNode[]>(INITIAL_FILES);
  const [activeFileId, setActiveFileId] = useState<string>('');
  const [viewMode, setViewMode] = useState<ViewMode>(ViewMode.SPLIT);
  const [isUploading, setIsUploading] = useState(false);
  const [isCompiling, setIsCompiling] = useState(false);
  const [isOpeningFolder, setIsOpeningFolder] = useState(false);

  // Compilation state
  const [compilationStatus, setCompilationStatus] = useState<CompilationStatusType>({ stage: 'idle' });
  const [compilationLogs, setCompilationLogs] = useState<CompilationLogEntry[]>([]);
  const [compiledPdfPreview, setCompiledPdfPreview] = useState<{
    fileId: string;
    fileName: string;
    data: string;
  } | null>(null);
  
  // UI Panels
  const [activeSidebar, setActiveSidebar] = useState<SidebarTab>('explorer');
  const [isEditingImage, setIsEditingImage] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);
  
  // AI State
  const [directions, setDirections] = useState<any[]>([]);
  const [isGeneratingDirections, setIsGeneratingDirections] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [urlInput, setUrlInput] = useState('');
  const [showUrlInput, setShowUrlInput] = useState(false);

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Array<{
    fileId: string;
    fileName: string;
    filePath: string;
    matches: Array<{ lineNum: number; lineText: string; matchStart: number; matchEnd: number }>;
  }>>([]);
  const [searchCaseSensitive, setSearchCaseSensitive] = useState(false);
  const [searchRegex, setSearchRegex] = useState(false);

  // Resizable panel widths (px)
  const [sidebarWidth, setSidebarWidth] = useState(280);
  const [chatWidth, setChatWidth] = useState(400);
  const [editorSplitPercent, setEditorSplitPercent] = useState(50); // % for editor in split view
  const dragRef = useRef<{ type: 'sidebar' | 'chat'; startX: number; startW: number } | null>(null);
  const editorAreaRef = useRef<HTMLDivElement>(null);

  const handleDragStart = useCallback((type: 'sidebar' | 'chat', e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startW = type === 'sidebar' ? sidebarWidth : chatWidth;
    dragRef.current = { type, startX, startW };

    const onMove = (ev: MouseEvent) => {
      if (!dragRef.current) return;
      const delta = ev.clientX - dragRef.current.startX;
      if (dragRef.current.type === 'sidebar') {
        setSidebarWidth(Math.max(180, Math.min(500, dragRef.current.startW + delta)));
      } else {
        // Chat: dragging left = wider, right = narrower
        setChatWidth(Math.max(280, Math.min(700, dragRef.current.startW - delta)));
      }
    };

    const onUp = () => {
      dragRef.current = null;
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }, [sidebarWidth, chatWidth]);

  const handleEditorSplitDrag = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startPercent = editorSplitPercent;
    const area = editorAreaRef.current;
    if (!area) return;
    const areaWidth = area.getBoundingClientRect().width;

    const onMove = (ev: MouseEvent) => {
      const delta = ev.clientX - startX;
      const deltaPercent = (delta / areaWidth) * 100;
      setEditorSplitPercent(Math.max(20, Math.min(80, startPercent + deltaPercent)));
    };
    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }, [editorSplitPercent]);

  // Helper to flatten FS for reference passing to Chat
  const getAllReferences = (): Reference[] => {
     const refs: Reference[] = [];
     const traverse = (nodes: FileSystemNode[]) => {
        for (const node of nodes) {
            if (node.type === 'file' && (node.fileType === 'pdf' || node.fileType === 'image' || node.fileType === 'link')) {
              refs.push({
                 id: node.id,
                 name: node.name,
                 type: node.fileType as ReferenceType,
                 content: node.content,
                 data: node.data,
                 mimeType: node.mimeType
              });
           }
           if (node.children) traverse(node.children);
        }
     };
     traverse(fileSystem);
     return refs;
  };

  const getActiveFileContent = () => {
    const findNode = (nodes: FileSystemNode[]): FileSystemNode | undefined => {
      for(const node of nodes) {
         if (node.id === activeFileId) return node;
         if (node.children) {
            const found = findNode(node.children);
            if(found) return found;
         }
      }
      return undefined;
    }
    return findNode(fileSystem);
  };

  const activeNode = getActiveFileContent();

  // Small helper: icon for file type in tab bar
  const getIconForType = (ft?: FileType) => {
    if (ft === 'tex') return <Icons.FileCode className="w-3.5 h-3.5 text-green-400 flex-shrink-0" />;
    if (ft === 'md') return <Icons.FileText className="w-3.5 h-3.5 text-blue-400 flex-shrink-0" />;
    if (ft === 'pdf') return <Icons.FileText className="w-3.5 h-3.5 text-red-400 flex-shrink-0" />;
    if (ft === 'image') return <Icons.Image className="w-3.5 h-3.5 text-purple-400 flex-shrink-0" />;
    return <Icons.FileText className="w-3.5 h-3.5 text-zinc-500 flex-shrink-0" />;
  };

  // Extract macros from the active document content
  const activeMacros = useMemo(() => {
     return activeNode?.content ? extractMacros(activeNode.content) : {};
  }, [activeNode?.content]);

  const updateFileContent = (newContent: string) => {
     const updateRecursive = (nodes: FileSystemNode[]): FileSystemNode[] => {
        return nodes.map(node => {
           if (node.id === activeFileId) return { ...node, content: newContent };
           if (node.children) return { ...node, children: updateRecursive(node.children) };
           return node;
        });
     };
     setFileSystem(prev => updateRecursive(prev));
  };

  const addFileToFolder = (folderId: string, newFile: FileSystemNode) => {
     const updateRecursive = (nodes: FileSystemNode[]): FileSystemNode[] => {
        return nodes.map(node => {
           if (node.id === folderId && node.type === 'folder') {
              return { ...node, children: [...(node.children || []), { ...newFile, parentId: folderId }] };
           }
           if (node.children) return { ...node, children: updateRecursive(node.children) };
           return node;
        });
     };
     setFileSystem(prev => updateRecursive(prev));
  };

  // Create multiple files from research pipeline into a new folder under root
  const handleCreateFiles = useCallback((folderName: string, files: GeneratedFile[]) => {
    console.log('[handleCreateFiles] Creating folder:', folderName, 'with', files.length, 'files:', files.map(f => f.name));
    const ts = Date.now();
    const folderId = `gen_${ts}`;
    const children = files.map((f, i) => ({
      id: `gen_file_${ts}_${i}`,
      name: f.name,
      type: 'file' as const,
      fileType: f.fileType,
      content: f.content,
      parentId: folderId,
    }));
    const newFolder: FileSystemNode = {
      id: folderId,
      name: folderName,
      type: 'folder',
      isOpen: true,
      children,
    };
    // Directly update fileSystem state to avoid stale closure issues
    setFileSystem(prev => {
      const addToFolder = (nodes: FileSystemNode[]): FileSystemNode[] => {
        return nodes.map(node => {
          if (node.id === 'root' && node.type === 'folder') {
            return { ...node, children: [...(node.children || []), { ...newFolder, parentId: 'root' }] };
          }
          if (node.children) return { ...node, children: addToFolder(node.children) };
          return node;
        });
      };
      return addToFolder(prev);
    });
    // Open the first .tex file if any
    const texFile = children.find(c => c.name.endsWith('.tex'));
    if (texFile) setActiveFileId(texFile.id);
  }, []);

  // ── File management handlers (New File / New Folder / Delete) ──

  const handleNewFile = (parentId: string) => {
    const name = prompt('File name (e.g. main.tex):');
    if (!name?.trim()) return;
    const ext = name.split('.').pop()?.toLowerCase() || '';
    let ft: FileType = 'txt';
    if (['tex', 'sty', 'cls'].includes(ext)) ft = 'tex';
    else if (ext === 'md') ft = 'md';
    else if (ext === 'bib') ft = 'tex'; // bib shown with tex icon
    else if (['png', 'jpg', 'jpeg', 'webp'].includes(ext)) ft = 'image';
    else if (ext === 'pdf') ft = 'pdf';

    const newNode: FileSystemNode = {
      id: `file_${Date.now()}`,
      name: name.trim(),
      type: 'file',
      fileType: ft,
      content: '',
      parentId,
    };
    addFileToFolder(parentId, newNode);
    setActiveFileId(newNode.id);
  };

  const handleNewFolder = (parentId: string) => {
    const name = prompt('Folder name:');
    if (!name?.trim()) return;
    const newFolder: FileSystemNode = {
      id: `folder_${Date.now()}`,
      name: name.trim(),
      type: 'folder',
      isOpen: true,
      children: [],
      parentId,
    };
    addFileToFolder(parentId, newFolder);
  };

  const handleRenameNode = (nodeId: string) => {
    if (nodeId === 'root') return;

    const findNode = (nodes: FileSystemNode[]): FileSystemNode | undefined => {
      for (const n of nodes) {
        if (n.id === nodeId) return n;
        if (n.children) {
          const found = findNode(n.children);
          if (found) return found;
        }
      }
      return undefined;
    };

    const target = findNode(fileSystem);
    if (!target) return;
    const nextName = prompt('Rename to:', target.name);
    if (!nextName?.trim()) return;
    const trimmed = nextName.trim();
    if (trimmed === target.name) return;

    const renameRecursive = (nodes: FileSystemNode[]): FileSystemNode[] =>
      nodes.map(n => {
        if (n.id === nodeId) return { ...n, name: trimmed };
        if (n.children) return { ...n, children: renameRecursive(n.children) };
        return n;
      });

    setFileSystem(prev => renameRecursive(prev));
  };

  const handleDeleteNode = (nodeId: string) => {
    if (nodeId === 'root') return;
    // Find node name for confirmation
    const findName = (nodes: FileSystemNode[]): string => {
      for (const n of nodes) {
        if (n.id === nodeId) return n.name;
        if (n.children) { const r = findName(n.children); if (r) return r; }
      }
      return '';
    };
    const name = findName(fileSystem);
    if (!confirm(`Delete "${name}"?`)) return;

    const isDescendant = (parentId: string, targetId: string, nodes: FileSystemNode[]): boolean => {
      for (const n of nodes) {
        if (n.id === parentId) {
          if (n.type === 'file') return false;
          const checkChildren = (children: FileSystemNode[]): boolean => {
            for (const child of children) {
              if (child.id === targetId) return true;
              if (child.children && checkChildren(child.children)) return true;
            }
            return false;
          };
          return n.children ? checkChildren(n.children) : false;
        }
        if (n.children && isDescendant(parentId, targetId, n.children)) return true;
      }
      return false;
    };

    const removeRecursive = (nodes: FileSystemNode[]): FileSystemNode[] =>
      nodes
        .filter(n => n.id !== nodeId)
        .map(n => n.children ? { ...n, children: removeRecursive(n.children) } : n);

    setFileSystem(prev => removeRecursive(prev));
    // If we deleted the active file or a folder containing it, clear selection
    if (activeFileId === nodeId || (activeFileId && isDescendant(nodeId, activeFileId, fileSystem))) {
      setActiveFileId('');
    }
  };

  useEffect(() => {
    const shouldIgnoreKeybind = (target: EventTarget | null) => {
      if (!(target instanceof HTMLElement)) return false;
      const tag = target.tagName.toLowerCase();
      return target.isContentEditable || tag === 'input' || tag === 'textarea' || tag === 'select';
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (shouldIgnoreKeybind(e.target)) return;
      if (!activeFileId || activeFileId === 'root') return;

      if (e.key === 'F2') {
        e.preventDefault();
        handleRenameNode(activeFileId);
        return;
      }

      if (e.key === 'Delete') {
        e.preventDefault();
        handleDeleteNode(activeFileId);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [activeFileId, fileSystem]);

  // Add a single file to root (used by chat: save image, save code)
  const handleAddSingleFile = (name: string, content: string, fileType: FileType, data?: string) => {
    const newNode: FileSystemNode = {
      id: `chat_file_${Date.now()}`,
      name,
      type: 'file',
      fileType,
      content: data ? undefined : content,
      data: data || undefined,
      mimeType: data ? 'image/png' : undefined,
      parentId: 'root',
    };
    addFileToFolder('root', newNode);
    setActiveFileId(newNode.id);
  };

  // Handle image dropped from chat onto file tree
  const handleDropOnFolder = (folderId: string, imageData: string, imageName: string) => {
    const newNode: FileSystemNode = {
      id: `drop_${Date.now()}`,
      name: imageName,
      type: 'file',
      fileType: 'image',
      data: imageData,
      mimeType: 'image/png',
      parentId: folderId,
    };
    addFileToFolder(folderId, newNode);
    setActiveFileId(newNode.id);
  };

  // Mock Login
  useEffect(() => {
     setTimeout(() => setIsConnected(true), 1000);
  }, []);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Handle ZIP files
    if (file.name.toLowerCase().endsWith('.zip')) {
        setIsUploading(true);
        try {
            const extractedRoot = await unzipProject(file);
            // Add to file system under root
            addFileToFolder('root', extractedRoot);
            
            // Try to find a main.tex to open, or the first tex file
            const findMainTex = (node: FileSystemNode): string | undefined => {
               if(node.type === 'file' && node.name.endsWith('.tex')) return node.id;
               if(node.children) {
                   for(const child of node.children) {
                       const found = findMainTex(child);
                       if(found) return found;
                   }
               }
               return undefined;
            }
            const newActiveId = findMainTex(extractedRoot);
            if (newActiveId) setActiveFileId(newActiveId);

        } catch (err) {
            console.error("Failed to unzip", err);
            alert("Error parsing zip file");
        } finally {
            setIsUploading(false);
        }
        return;
    }

    const reader = new FileReader();
    const type = file.name.split('.').pop()?.toLowerCase();
    
    let refType: ReferenceType = 'txt';
    if (['png', 'jpg', 'jpeg', 'webp'].includes(type || '')) refType = 'image';
    else if (type === 'pdf') refType = 'pdf';
    else if (type === 'tex') refType = 'tex';
    else if (type === 'md') refType = 'md';
    // Zip handled above

    reader.onload = (ev) => {
      const result = ev.target?.result as string;
      const newNode: FileSystemNode = {
        id: Date.now().toString(),
        name: file.name,
        type: 'file',
        fileType: refType,
        mimeType: file.type
      };

      if (refType === 'image' || refType === 'pdf') {
         newNode.data = result; 
      } else {
         newNode.content = result; 
      }
      addFileToFolder('root', newNode);
      setActiveFileId(newNode.id);
    };

    if (refType === 'image' || refType === 'pdf') {
       reader.readAsDataURL(file);
    } else {
       reader.readAsText(file);
    }
  };

  const readFileAsDataURL = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });

  const handleOpenFolder = async () => {
    const picker = (window as any).showDirectoryPicker;
    if (!picker) {
      alert('Folder access is not supported in this browser. Please use Chrome/Edge over localhost or https.');
      return;
    }

    setIsOpeningFolder(true);
    try {
      const dirHandle = await picker();
      const genId = () => `fs_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      const binaryExts = new Set(['png', 'jpg', 'jpeg', 'webp', 'pdf']);
      const textExts = new Set(['tex', 'bib', 'bst', 'sty', 'cls', 'def', 'cfg', 'fd', 'ins', 'dtx', 'md', 'txt', 'json', 'js', 'ts', 'tsx', 'css', 'html', 'yml', 'yaml', 'csv', 'log']);

      const getFileTypeFromName = (name: string): FileType => {
        const ext = name.split('.').pop()?.toLowerCase() || '';
        if (['png', 'jpg', 'jpeg', 'webp'].includes(ext)) return 'image';
        if (ext === 'pdf') return 'pdf';
        if (['tex', 'sty', 'cls', 'bib', 'bst', 'def', 'cfg', 'fd'].includes(ext)) return 'tex';
        return 'txt';
      };

      const getMimeTypeFromExt = (ext: string): string => {
        if (ext === 'png') return 'image/png';
        if (ext === 'jpg' || ext === 'jpeg') return 'image/jpeg';
        if (ext === 'webp') return 'image/webp';
        if (ext === 'pdf') return 'application/pdf';
        return 'text/plain';
      };

      const readDirectory = async (handle: any, name: string, parentId?: string): Promise<FileSystemNode> => {
        const node: FileSystemNode = {
          id: genId(),
          name,
          type: 'folder',
          isOpen: true,
          children: [],
          parentId
        };

        for await (const [entryName, entryHandle] of handle.entries()) {
          if (entryName.startsWith('.')) continue;

          if (entryHandle.kind === 'directory') {
            const childFolder = await readDirectory(entryHandle, entryName, node.id);
            node.children?.push(childFolder);
            continue;
          }

          if (entryHandle.kind === 'file') {
            const file = await entryHandle.getFile();
            const ext = file.name.split('.').pop()?.toLowerCase() || '';
            const isBinary = binaryExts.has(ext);
            const isText = textExts.has(ext);
            if (!isBinary && !isText) continue;

            const childFile: FileSystemNode = {
              id: genId(),
              name: file.name,
              type: 'file',
              fileType: getFileTypeFromName(file.name),
              mimeType: file.type || getMimeTypeFromExt(ext),
              parentId: node.id
            };

            if (isBinary) {
              childFile.data = await readFileAsDataURL(file);
            } else {
              childFile.content = await file.text();
            }

            node.children?.push(childFile);
          }
        }

        return node;
      };

      const projectRoot = await readDirectory(dirHandle, dirHandle.name || 'Local Folder', 'root');
      addFileToFolder('root', projectRoot);

      // Try to set active tex file
      const findMainTex = (node: FileSystemNode): string | undefined => {
        if (node.type === 'file' && node.name.endsWith('.tex')) return node.id;
        if (node.children) {
          for (const child of node.children) {
            const found = findMainTex(child);
            if (found) return found;
          }
        }
        return undefined;
      };
      const newActiveId = findMainTex(projectRoot);
      if (newActiveId) setActiveFileId(newActiveId);
    } catch (err: any) {
      if (err?.name !== 'AbortError') {
        console.error('Failed to open folder', err);
        alert('Failed to open folder. See console for details.');
      }
    } finally {
      setIsOpeningFolder(false);
    }
  };

  const handleAddUrl = () => {
    if(!urlInput.trim()) return;
    const newNode: FileSystemNode = {
        id: Date.now().toString(),
        name: urlInput,
        content: urlInput,
        type: 'file',
        fileType: 'link'
    };
    addFileToFolder('root', newNode);
    setUrlInput('');
    setShowUrlInput(false);
  };

  const handleToggleFolder = (nodeId: string) => {
     const toggleRecursive = (nodes: FileSystemNode[]): FileSystemNode[] => {
        return nodes.map(node => {
           if (node.id === nodeId) return { ...node, isOpen: !node.isOpen };
           if (node.children) return { ...node, children: toggleRecursive(node.children) };
           return node;
        });
     };
     setFileSystem(prev => toggleRecursive(prev));
  };

  const handleDeepExtraction = async () => {
     const refs = getAllReferences();
     if (refs.length === 0) return;
     setIsExtracting(true);
     
     try {
       const jsonStr = await extractPaperDetails(refs);
       const cleanJson = jsonStr.replace(/```json/g, '').replace(/```/g, '');
       const items = JSON.parse(cleanJson);
       
       // Create a new Folder for this extraction
       const baseName = refs[0].name.replace(/\.[^/.]+$/, "");
       const folderName = baseName.substring(0, 20) + "_Data";
       const folderId = `folder_${Date.now()}`;
       
       const children = items.map((item: any, i: number) => ({
          id: `asset_${Date.now()}_${i}`,
          name: item.filename || `${item.type}_${i+1}.md`,
          type: 'file' as const,
          fileType: item.type as FileType,
          content: item.content,
          data: item.explanation,
          parentId: folderId
       }));

       const newFolder: FileSystemNode = {
          id: folderId,
          name: folderName,
          type: 'folder',
          isOpen: true,
          children
       };

       addFileToFolder('root', newFolder);

     } catch (e) {
       console.error(e);
     } finally {
       setIsExtracting(false);
     }
  };

  const handleBrainstormDirections = async () => {
    setIsGeneratingDirections(true);
    // Find content of active file or first tex file
    const contentToUse = activeNode?.content || '';
    
    const titleMatch = contentToUse.match(/^# (.*$)/m);
    const title = titleMatch ? titleMatch[1] : "Current Paper";
    
    try {
      const jsonStr = await generateResearchDirections(title, contentToUse, getAllReferences());
      const cleanJson = jsonStr.replace(/```json/g, '').replace(/```/g, '').trim();
      // Try to extract a JSON array from the response
      const arrayMatch = cleanJson.match(/\[[\s\S]*\]/);
      if (arrayMatch) {
        setDirections(JSON.parse(arrayMatch[0]));
      } else {
        console.warn("No JSON array found in directions response, skipping");
      }
    } catch (e) {
      console.error("Failed to parse directions", e);
    } finally {
      setIsGeneratingDirections(false);
    }
  };

  const handleCompilePDF = async () => {
    // Prefer compiling the currently opened .tex file; only fall back to auto-detected main.
    const rootFolder = fileSystem[0];
    const allNodes = rootFolder?.children || [];
    const mainTexNode = findMainTexFile(allNodes);

    const activeTexNode =
      activeNode?.type === 'file' && activeNode.name.toLowerCase().endsWith('.tex')
        ? activeNode
        : null;
    const compileTarget = activeTexNode || mainTexNode;
    const compileFileId = compileTarget?.id || '';
    const compileFileName = compileTarget?.name || '';

    if (!compileFileId) {
      alert("No .tex file found to compile. Please create or upload a .tex file with \\documentclass.");
      return;
    }

    // Clear stale preview for the current compile target to avoid showing outdated PDFs.
    if (compiledPdfPreview?.fileId === compileFileId) {
      setCompiledPdfPreview(null);
    }

    setIsCompiling(true);
    setCompilationLogs([]);
    setCompilationStatus({ stage: 'collecting', message: `Compiling ${compileFileName}...` });

    // Switch to split view so user can see the TeX source and upcoming PDF
    if (viewMode === ViewMode.EDITOR) {
      setViewMode(ViewMode.SPLIT);
    }

    try {
      const result = await compileDocument(
        fileSystem,
        compileFileId,
        {
          mode: 'online',
          timeout: 120000,
          onStatusChange: (status) => {
            setCompilationStatus(status);
          },
        }
      );

      setCompilationLogs(result.logs);

      if (result.success && result.pdfData) {
        // Bind the compiled PDF to the exact source file that produced it.
        setCompiledPdfPreview({
          fileId: compileFileId,
          fileName: compileFileName,
          data: result.pdfData,
        });

        // Ensure preview is focused on the file that was actually compiled.
        if (activeFileId !== compileFileId) {
          setActiveFileId(compileFileId);
        }

        // Auto-dismiss success status after 3 seconds
        setTimeout(() => {
          setCompilationStatus({ stage: 'idle' });
        }, 3000);
      } else {
        // Some backends may still return a PDF with compilation errors.
        if (result.pdfData) {
          setCompiledPdfPreview({
            fileId: compileFileId,
            fileName: compileFileName,
            data: result.pdfData,
          });
          setCompilationStatus({
            stage: 'error',
            message: `Compilation has errors in ${compileFileName}, showing generated PDF.`,
            error: result.error || {
              code: 'COMPILATION_FAILED',
              message: 'Compilation completed with errors.',
            },
          });
        } else {
          setCompilationStatus({
            stage: 'error',
            message: `Compilation failed for ${compileFileName}. No PDF was generated.`,
            error: result.error || {
              code: 'COMPILATION_FAILED',
              message: 'Compilation failed.',
            },
          });
        }
        console.error("Compilation failed:", result.error);
      }

    } catch (e) {
      console.error("Compilation failed", e);
      setCompilationStatus({
        stage: 'error',
        message: 'An unexpected error occurred',
        error: {
          code: 'UNKNOWN',
          message: 'Compilation failed unexpectedly. See console for details.',
        }
      });
    } finally {
      setIsCompiling(false);
    }
  }

  const handleDismissCompilationStatus = () => {
    setCompilationStatus({ stage: 'idle' });
    setCompilationLogs([]);
  }

  // Full-text search across all project files
  const performSearch = useCallback((query: string) => {
    setSearchQuery(query);
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }

    let re: RegExp;
    try {
      if (searchRegex) {
        re = new RegExp(query, searchCaseSensitive ? 'g' : 'gi');
      } else {
        const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        re = new RegExp(escaped, searchCaseSensitive ? 'g' : 'gi');
      }
    } catch {
      setSearchResults([]);
      return;
    }

    const results: typeof searchResults = [];

    const traverse = (nodes: FileSystemNode[], pathPrefix: string) => {
      for (const node of nodes) {
        if (node.type === 'folder' && node.children) {
          const p = pathPrefix ? `${pathPrefix}/${node.name}` : node.name;
          traverse(node.children, p);
        } else if (node.type === 'file' && node.content) {
          const lines = node.content.split('\n');
          const matches: Array<{ lineNum: number; lineText: string; matchStart: number; matchEnd: number }> = [];
          for (let i = 0; i < lines.length; i++) {
            re.lastIndex = 0;
            let m: RegExpExecArray | null;
            while ((m = re.exec(lines[i])) !== null) {
              matches.push({
                lineNum: i + 1,
                lineText: lines[i],
                matchStart: m.index,
                matchEnd: m.index + m[0].length,
              });
              if (!re.global) break;
            }
          }
          if (matches.length > 0) {
            results.push({
              fileId: node.id,
              fileName: node.name,
              filePath: pathPrefix ? `${pathPrefix}/${node.name}` : node.name,
              matches,
            });
          }
        }
      }
    };

    traverse(fileSystem, '');
    setSearchResults(results);
  }, [fileSystem, searchCaseSensitive, searchRegex]);

  // Re-run search when options change
  useEffect(() => {
    if (searchQuery) performSearch(searchQuery);
  }, [searchCaseSensitive, searchRegex]);

  return (
    <div className="flex h-screen w-full bg-studio-900 font-sans selection:bg-studio-accent relative" style={{ color: 'var(--c-text-secondary)' }}>
      
      {/* 1. Left Sidebar (Navigation) */}
      <div className="w-16 flex flex-col items-center py-4 border-r border-studio-border bg-studio-900 space-y-6 z-20">
        <div className="p-2 bg-studio-accent rounded-lg text-white mb-4 shadow-lg shadow-blue-900/20">
          <Icons.Cpu size={24} />
        </div>
        <div className="flex flex-col space-y-4 w-full items-center">
           <button 
                onClick={() => setActiveSidebar(activeSidebar === 'explorer' ? 'none' : 'explorer')} 
                className={`p-2 rounded hover:bg-studio-800 ${activeSidebar === 'explorer' ? 'text-studio-accent' : 'text-zinc-500'}`} 
                title="Explorer"
            >
                <Icons.Folder size={20} />
            </button>
           <button 
                onClick={() => setViewMode(ViewMode.SPLIT)} 
                className={`p-2 rounded hover:bg-studio-800 ${viewMode === ViewMode.SPLIT ? 'text-studio-accent' : 'text-zinc-500'}`} 
                title="Split View"
            >
                <Icons.Split size={20} />
            </button>
           <button 
                onClick={() => setActiveSidebar(activeSidebar === 'search' ? 'none' : 'search')}
                className={`p-2 rounded hover:bg-studio-800 ${activeSidebar === 'search' ? 'text-studio-accent' : 'text-zinc-500'}`} 
                title="Search"
            >
                <Icons.MessageSquare size={20} />
            </button>
        </div>
        <div className="flex-1" />
        <button 
            onClick={() => setActiveSidebar(activeSidebar === 'settings' ? 'none' : 'settings')}
            className={`p-2 rounded hover:bg-studio-800 ${activeSidebar === 'settings' ? 'text-studio-accent' : 'text-zinc-500'}`} 
            title="Settings"
        >
            <Icons.Settings size={20} />
        </button>
        <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-purple-500 to-blue-500 mb-2 border-2 border-studio-800 cursor-pointer" onClick={() => alert("Profile: Scholar User")} title="User Profile"></div>
      </div>

      {/* 2. Side Panel Area */}
      {activeSidebar !== 'none' && (<>
        <div className="bg-studio-800/50 border-r border-studio-border flex flex-col z-10 backdrop-blur-sm relative" style={{ width: sidebarWidth, minWidth: 180, maxWidth: 500 }}>
          
          {/* Explorer Tab */}
          {activeSidebar === 'explorer' && (
            <>
                {/* Header with title */}
                <div className="px-3 py-2.5 border-b border-studio-border font-medium text-zinc-100 flex justify-between items-center bg-studio-900/50">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">File Tree</span>
                    <button onClick={() => setActiveSidebar('none')} className="p-0.5 rounded hover:bg-studio-700" title="Close panel">
                      <Icons.X size={14} className="text-zinc-500 hover:text-zinc-300"/>
                    </button>
                </div>

                {/* Toolbar row - Overleaf style */}
                <div className="flex items-center px-2 py-1.5 border-b border-studio-border/50 bg-studio-900/30 gap-0.5">
                    <label className={`p-1.5 rounded hover:bg-studio-700 cursor-pointer transition-colors ${isUploading ? 'opacity-50' : ''}`} title="Upload File or Zip">
                        <Icons.Upload size={15} className={`text-zinc-400 hover:text-zinc-200 ${isUploading ? 'animate-pulse' : ''}`} />
                        <input type="file" className="hidden" onChange={handleFileUpload} accept=".txt,.md,.tex,.pdf,.png,.jpg,.jpeg,.zip" disabled={isUploading} />
                    </label>
                    <button
                        onClick={handleOpenFolder}
                        disabled={isOpeningFolder}
                        className="p-1.5 rounded hover:bg-studio-700 transition-colors disabled:opacity-50"
                        title="Open Folder"
                    >
                        <Icons.FolderOpen size={15} className={`text-zinc-400 hover:text-zinc-200 ${isOpeningFolder ? 'animate-pulse' : ''}`} />
                    </button>
                    <button onClick={() => setShowUrlInput(!showUrlInput)} className="p-1.5 rounded hover:bg-studio-700 transition-colors" title="Add URL Reference">
                        <Icons.Link size={15} className="text-zinc-400 hover:text-zinc-200" />
                    </button>
                    <div className="flex-1" />
                    <button 
                        onClick={handleDeepExtraction}
                        disabled={isExtracting}
                        className="p-1.5 rounded hover:bg-studio-700 transition-colors disabled:opacity-50"
                        title="Extract Figures & Data"
                    >
                        {isExtracting ? <Icons.Cpu size={15} className="text-zinc-400 animate-spin"/> : <Icons.RefreshCw size={15} className="text-zinc-400 hover:text-zinc-200"/>}
                    </button>
                    <button 
                        onClick={handleBrainstormDirections}
                        disabled={isGeneratingDirections}
                        className="p-1.5 rounded hover:bg-studio-700 transition-colors disabled:opacity-50"
                        title="Generate Research Directions"
                    >
                        {isGeneratingDirections ? <Icons.Cpu size={15} className="text-zinc-400 animate-spin"/> : <Icons.Magic size={15} className="text-studio-accent hover:text-blue-400"/>}
                    </button>
                </div>

                {/* URL input (shown inline when toggled) */}
                {showUrlInput && (
                    <div className="flex items-center gap-1 px-2 py-1.5 border-b border-studio-border/50 bg-studio-800/30">
                        <input 
                            className="flex-1 bg-studio-900 border border-studio-600 rounded px-2 py-1 text-xs outline-none focus:border-studio-accent text-zinc-300 placeholder-zinc-600" 
                            value={urlInput} 
                            onChange={e => setUrlInput(e.target.value)} 
                            onKeyDown={e => { if (e.key === 'Enter') handleAddUrl(); if (e.key === 'Escape') setShowUrlInput(false); }}
                            placeholder="https://..."
                            autoFocus
                        />
                        <button onClick={handleAddUrl} className="p-1 bg-studio-700 rounded hover:bg-studio-600 transition-colors"><Icons.Check size={12} className="text-zinc-300"/></button>
                        <button onClick={() => setShowUrlInput(false)} className="p-1 rounded hover:bg-studio-700 transition-colors"><Icons.X size={12} className="text-zinc-500"/></button>
                    </div>
                )}

                {/* File tree */}
                <div className="flex-1 overflow-y-auto custom-scrollbar py-1">
                    <FileTree 
                        nodes={fileSystem} 
                        selectedId={activeFileId} 
                        onSelect={(node) => setActiveFileId(node.id)} 
                        onToggle={handleToggleFolder}
                        onRename={handleRenameNode}
                        onNewFile={handleNewFile}
                        onNewFolder={handleNewFolder}
                        onDelete={handleDeleteNode}
                        onDropImage={handleDropOnFolder}
                    />
                </div>

                {/* Directions results (shown at bottom if any) */}
                {directions.length > 0 && (
                    <div className="border-t border-studio-border/50 max-h-40 overflow-y-auto custom-scrollbar">
                        <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Directions</div>
                        <div className="px-2 pb-2 space-y-1">
                            {directions.map((d, i) => (
                                <div key={i} className="bg-studio-900/80 border border-studio-700/50 px-2 py-1.5 rounded text-[10px] hover:border-studio-accent/50 cursor-pointer transition-colors">
                                    <div className="font-medium text-indigo-400">{d.title}</div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </>
          )}

          {/* Search Tab */}
          {activeSidebar === 'search' && (
              <>
                 <div className="px-3 py-2.5 border-b border-studio-border font-medium text-zinc-100 flex justify-between items-center bg-studio-900/50">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">Search</span>
                    <button onClick={() => setActiveSidebar('none')} className="p-0.5 rounded hover:bg-studio-700">
                      <Icons.X size={14} className="text-zinc-500 hover:text-zinc-300"/>
                    </button>
                 </div>
                 <div className="px-2 py-2 border-b border-studio-border/50 space-y-1.5">
                    <div className="flex items-center gap-1">
                      <div className="flex-1 relative">
                        <Icons.Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-zinc-500" />
                        <input
                          type="text"
                          value={searchQuery}
                          onChange={e => performSearch(e.target.value)}
                          placeholder="Search in files..."
                          className="w-full bg-studio-900 border border-studio-600 rounded pl-7 pr-2 py-1.5 text-xs outline-none focus:border-studio-accent text-zinc-300 placeholder-zinc-600"
                          autoFocus
                        />
                      </div>
                    </div>
                    <div className="flex items-center gap-2 px-0.5">
                      <label className="flex items-center gap-1 text-[10px] text-zinc-500 cursor-pointer select-none">
                        <input type="checkbox" checked={searchCaseSensitive} onChange={e => setSearchCaseSensitive(e.target.checked)} className="w-3 h-3 rounded accent-studio-accent" />
                        Aa
                      </label>
                      <label className="flex items-center gap-1 text-[10px] text-zinc-500 cursor-pointer select-none">
                        <input type="checkbox" checked={searchRegex} onChange={e => setSearchRegex(e.target.checked)} className="w-3 h-3 rounded accent-studio-accent" />
                        .*
                      </label>
                      {searchResults.length > 0 && (
                        <span className="text-[10px] text-zinc-500 ml-auto">
                          {searchResults.reduce((a, r) => a + r.matches.length, 0)} results in {searchResults.length} files
                        </span>
                      )}
                    </div>
                 </div>
                 <div className="flex-1 overflow-y-auto custom-scrollbar">
                   {searchQuery && searchResults.length === 0 && (
                     <div className="p-4 text-center text-zinc-500 text-xs">No results found</div>
                   )}
                   {searchResults.map(result => (
                     <div key={result.fileId} className="border-b border-studio-border/30">
                       <button
                         className="w-full text-left px-3 py-1.5 text-[11px] font-medium text-zinc-300 hover:bg-studio-800/50 flex items-center gap-1.5 truncate"
                         onClick={() => setActiveFileId(result.fileId)}
                       >
                         <Icons.FileCode className="w-3 h-3 text-zinc-500 flex-shrink-0" />
                         <span className="truncate">{result.filePath}</span>
                         <span className="text-zinc-600 ml-auto flex-shrink-0">{result.matches.length}</span>
                       </button>
                       <div className="pb-0.5">
                         {result.matches.slice(0, 20).map((m, i) => (
                           <button
                             key={i}
                             className="w-full text-left px-3 py-0.5 hover:bg-studio-800/30 flex items-start gap-2 text-[11px] group"
                             onClick={() => setActiveFileId(result.fileId)}
                           >
                             <span className="text-zinc-600 flex-shrink-0 w-6 text-right tabular-nums">{m.lineNum}</span>
                             <span className="truncate text-zinc-400 font-mono">
                               {m.lineText.substring(Math.max(0, m.matchStart - 30), m.matchStart)}
                               <span className="bg-yellow-500/20 text-yellow-300 font-medium">
                                 {m.lineText.substring(m.matchStart, m.matchEnd)}
                               </span>
                               {m.lineText.substring(m.matchEnd, m.matchEnd + 60)}
                             </span>
                           </button>
                         ))}
                         {result.matches.length > 20 && (
                           <div className="px-3 py-0.5 text-[10px] text-zinc-600">...and {result.matches.length - 20} more</div>
                         )}
                       </div>
                     </div>
                   ))}
                   {!searchQuery && (
                     <div className="p-6 flex flex-col items-center justify-center text-zinc-500 space-y-3">
                       <Icons.Search size={28} className="opacity-15"/>
                       <p className="text-center text-xs">Search across all files in your project</p>
                     </div>
                   )}
                 </div>
              </>
          )}

          {/* Settings Tab */}
          {activeSidebar === 'settings' && (
              <>
                 <div className="p-4 border-b border-studio-border font-medium text-zinc-100 flex justify-between items-center bg-studio-900/50">
                    <span className="text-xs font-bold uppercase tracking-wider">Settings</span>
                    <button onClick={() => setActiveSidebar('none')}><Icons.Split size={14} className="text-zinc-500 hover:text-zinc-300 rotate-90"/></button>
                 </div>
                 <div className="p-4 space-y-4">
                     <div className="space-y-2">
                         <label className="text-xs text-zinc-400 font-bold uppercase">Theme</label>
                         <div className="flex items-center gap-2">
                           <button onClick={toggleTheme}
                             className="flex items-center gap-2 w-full px-3 py-2 bg-studio-900 border border-studio-600 rounded text-xs text-zinc-300 hover:border-studio-accent transition-colors">
                             {theme === 'dark' ? <Icons.Sun size={14} /> : <Icons.Moon size={14} />}
                             <span>{theme === 'dark' ? 'Switch to Light' : 'Switch to Dark'}</span>
                           </button>
                         </div>
                     </div>
                    <div className="space-y-2">
                        <label className="text-xs text-zinc-400 font-bold uppercase">Text AI Model</label>
                        <div className="w-full bg-studio-900 border border-studio-600 p-2 rounded text-xs text-zinc-300">
                            Claude Opus 4.6 (Chat, Research, Extraction)
                        </div>
                    </div>
                    <div className="space-y-2">
                        <label className="text-xs text-zinc-400 font-bold uppercase">Image AI Model</label>
                        <div className="w-full bg-studio-900 border border-studio-600 p-2 rounded text-xs text-zinc-300">
                            Gemini 3.0 Pro Image (Image Editing Only)
                        </div>
                    </div>
                    <div className="pt-4 border-t border-studio-700">
                        <p className="text-[10px] text-zinc-500">Paper Studio Pro v1.0.2</p>
                    </div>
                 </div>
              </>
          )}

        </div>
        {/* Sidebar resize handle */}
        <div
          className="w-1 cursor-col-resize hover:bg-studio-accent/40 active:bg-studio-accent/60 transition-colors flex-shrink-0"
          onMouseDown={(e) => handleDragStart('sidebar', e)}
        />
      </>)}

      {/* 3. Main Editor Area */}
      <div className="flex-1 flex flex-col min-w-0 bg-studio-900 relative">
        
        {/* Top Bar — Overleaf-style tab bar */}
        <div className="h-10 border-b border-studio-border flex items-center justify-between px-2 bg-studio-800/60">
           {/* Left: file tab + editor mode toggle */}
           <div className="flex items-center space-x-1 min-w-0">
              {activeNode ? (
                <div className="flex items-center bg-studio-900 border border-studio-border rounded-t px-3 py-1.5 text-xs text-zinc-200 font-medium max-w-[200px] truncate">
                  {getIconForType(activeNode.fileType)}
                  <span className="ml-1.5 truncate">{activeNode.name}</span>
                </div>
              ) : (
                <span className="text-xs text-zinc-500 px-2">No file open</span>
              )}
              {/* Code / Visual toggle (Overleaf style) */}
              {activeNode && ['tex', 'md'].includes(activeNode.fileType || '') && (
                <div className="flex items-center bg-studio-900 border border-studio-border rounded ml-2 overflow-hidden">
                  <button
                    onClick={() => setViewMode(ViewMode.EDITOR)}
                    className={`px-2.5 py-1 text-[10px] font-medium transition-colors ${viewMode === ViewMode.EDITOR ? 'bg-studio-accent text-white' : 'text-zinc-400 hover:text-zinc-200'}`}
                  >Source</button>
                  <button
                    onClick={() => setViewMode(ViewMode.SPLIT)}
                    className={`px-2.5 py-1 text-[10px] font-medium transition-colors ${viewMode === ViewMode.SPLIT ? 'bg-studio-accent text-white' : 'text-zinc-400 hover:text-zinc-200'}`}
                  >Split</button>
                  <button
                    onClick={() => setViewMode(ViewMode.PREVIEW)}
                    className={`px-2.5 py-1 text-[10px] font-medium transition-colors ${viewMode === ViewMode.PREVIEW ? 'bg-studio-accent text-white' : 'text-zinc-400 hover:text-zinc-200'}`}
                  >Preview</button>
                </div>
              )}
           </div>
           {/* Right: theme toggle + status + Recompile button */}
           <div className="flex items-center space-x-2">
              <button onClick={toggleTheme} className="p-1.5 rounded hover:bg-studio-700 transition-colors" title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}>
                {theme === 'dark' ? <Icons.Sun className="w-3.5 h-3.5 text-zinc-400" /> : <Icons.Moon className="w-3.5 h-3.5 text-zinc-500" />}
              </button>
              <span className={`text-[10px] flex items-center space-x-1 ${isConnected ? 'text-green-500' : 'text-amber-500'}`}>
                 <div className={`w-1.5 h-1.5 rounded-full ${isConnected ? 'bg-green-500' : 'bg-amber-500 animate-pulse'}`}></div>
                 <span>{isConnected ? 'Online' : 'Connecting...'}</span>
              </span>
              <button 
                onClick={handleCompilePDF}
                disabled={isCompiling}
                className="bg-green-600 hover:bg-green-500 text-white px-3 py-1.5 rounded text-xs font-bold transition-colors disabled:opacity-50 disabled:cursor-wait flex items-center space-x-1.5 shadow-sm"
              >
                {isCompiling ? <Icons.Cpu className="w-3 h-3 animate-spin" /> : <Icons.RefreshCw className="w-3 h-3" />}
                <span>{isCompiling ? 'Compiling...' : 'Recompile'}</span>
              </button>
           </div>
        </div>

        {/* Editor / Content Area */}
        <div ref={editorAreaRef} className="flex-1 flex overflow-hidden relative">
          
          {/* Main Content Render Logic */}
          {activeNode ? (
             <>
                {/* Case: Tex/Md/Txt File - Show Editor */}
                {['tex', 'md', 'txt', 'table'].includes(activeNode.fileType || '') && (
                   <div
                     className={`flex flex-col min-w-0 ${viewMode === ViewMode.PREVIEW ? 'hidden' : ''}`}
                     style={viewMode === ViewMode.SPLIT && ['tex', 'md'].includes(activeNode.fileType || '') ? { width: `${editorSplitPercent}%`, flexShrink: 0 } : { flex: 1 }}
                   >
                      <CodeEditor
                        key={activeFileId}
                        content={activeNode.content || ''}
                        onChange={updateFileContent}
                        fileType={activeNode.fileType}
                        fileName={activeNode.name}
                        readOnly={activeNode.fileType === 'table'}
                        theme={theme}
                      />
                   </div>
                )}

               {/* Case: LaTeX Formula Extracted */}
               {activeNode.fileType === 'formula' && (
                  <div className="flex-1 flex flex-col items-center justify-center bg-studio-900 p-8">
                      <div className="bg-studio-800 p-8 rounded-lg border border-studio-700 shadow-xl max-w-2xl w-full">
                          <h3 className="text-zinc-500 text-xs font-bold uppercase mb-4">LaTeX Formula</h3>
                          <LatexRenderer content={activeNode.content || ''} block macros={activeMacros} />
                          <div className="mt-6 pt-6 border-t border-studio-700 text-zinc-400 text-sm">
                             <span className="font-bold text-zinc-300">Explanation:</span> {activeNode.data}
                          </div>
                      </div>
                  </div>
               )}

               {/* Case: Figure (Virtual) */}
               {activeNode.fileType === 'figure' && (
                  <div className="flex-1 flex flex-col items-center justify-center bg-studio-900 p-8">
                      <div className="bg-studio-800 p-8 rounded-lg border border-studio-700 shadow-xl max-w-2xl w-full">
                          <div className="aspect-video bg-black rounded flex items-center justify-center mb-6 border border-studio-600 border-dashed">
                             <div className="text-center">
                                <Icons.Image className="w-12 h-12 text-zinc-600 mx-auto mb-2" />
                                <span className="text-zinc-500 text-xs">Figure Placeholder (Extraction)</span>
                             </div>
                          </div>
                          <h3 className="text-lg font-bold text-white mb-2">{activeNode.name}</h3>
                          <p className="text-zinc-400 text-sm leading-relaxed">{activeNode.content}</p>
                          {activeNode.data && <p className="mt-4 text-xs text-zinc-500 italic">{activeNode.data}</p>}
                      </div>
                  </div>
               )}

               {/* Case: PDF/Image/Link Reference */}
               {['pdf', 'image', 'link'].includes(activeNode.fileType || '') && (
                  <div className="flex-1">
                      <FilePreview 
                        file={{
                            id: activeNode.id, 
                            name: activeNode.name, 
                            type: activeNode.fileType as ReferenceType,
                            content: activeNode.content,
                            data: activeNode.data,
                            mimeType: activeNode.mimeType
                        }} 
                        onClose={() => setActiveFileId('')}
                        onEdit={activeNode.fileType === 'image' ? () => setIsEditingImage(true) : undefined}
                      />
                  </div>
               )}

               {/* Draggable divider between editor and preview */}
                {['tex', 'md'].includes(activeNode.fileType || '') && viewMode === ViewMode.SPLIT && (
                   <div
                     className="w-1.5 cursor-col-resize hover:bg-studio-accent/40 active:bg-studio-accent/60 transition-colors flex-shrink-0 relative group"
                     onMouseDown={handleEditorSplitDrag}
                   >
                     <div className="absolute inset-y-0 -left-1 -right-1" /> {/* Wider hit area */}
                     <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-1 h-8 rounded-full bg-studio-border group-hover:bg-studio-accent/60 transition-colors" />
                   </div>
                )}

               {/* Split View Preview (Only for Text files) */}
                {['tex', 'md'].includes(activeNode.fileType || '') && (
                   <div
                     className={`border-l border-studio-border bg-studio-800/30 min-w-0 ${viewMode === ViewMode.EDITOR ? 'hidden' : ''}`}
                     style={viewMode === ViewMode.SPLIT ? { width: `${100 - editorSplitPercent}%`, flexShrink: 0 } : { flex: 1 }}
                   >
                     {/* Show compiled PDF only when it matches the currently opened tex file */}
                     {activeNode.fileType === 'tex' && compiledPdfPreview?.fileId === activeNode.id ? (
                       <div className="h-full flex flex-col">
                         <div className="flex items-center justify-between px-3 py-1.5 bg-studio-800 border-b border-studio-border">
                           <span className="text-[10px] text-zinc-400 font-medium flex items-center gap-1.5">
                             <Icons.FileText className="w-3 h-3 text-green-500" />
                             Compiled PDF
                           </span>
                           <div className="flex items-center gap-1.5">
                             <a
                               href={compiledPdfPreview.data}
                               download={`${compiledPdfPreview.fileName.replace(/\.tex$/i, '') || 'compiled'}.pdf`}
                               className="text-[10px] text-zinc-500 hover:text-studio-accent flex items-center gap-1"
                             >
                               <Icons.Download className="w-3 h-3" /> Download
                             </a>
                             <button
                               onClick={() => setCompiledPdfPreview(null)}
                               className="text-[10px] text-zinc-500 hover:text-zinc-300 flex items-center gap-1"
                               title="Switch back to LaTeX preview"
                             >
                               <Icons.X className="w-3 h-3" /> Close
                             </button>
                           </div>
                         </div>
                         <iframe
                           src={compiledPdfPreview.data}
                           title="Compiled PDF Preview"
                           className="flex-1 w-full border-0 bg-white"
                         />
                       </div>
                     ) : (
                       <div className="h-full overflow-y-auto custom-scrollbar">
                          {activeNode.fileType === 'tex' ? (
                            <LatexDocumentPreview content={activeNode.content || ''} />
                          ) : (
                            <MarkdownPreview content={activeNode.content || ''} macros={activeMacros} mode="panel" />
                          )}
                       </div>
                     )}
                  </div>
               )}
             </>
          ) : (
             <div className="flex-1 flex items-center justify-center" style={{ color: 'var(--c-text-muted)' }}>
                <div className="text-center max-w-sm">
                   <Icons.FileText className="w-16 h-16 mx-auto mb-6 opacity-10" />
                   <h2 className="text-lg font-semibold mb-2" style={{ color: 'var(--c-text-secondary)' }}>No file open</h2>
                   <p className="text-sm mb-6" style={{ color: 'var(--c-text-muted)' }}>Create a new file, upload a project, or use <span className="text-studio-accent font-mono">@research</span> in the chat to generate a paper.</p>
                  <div className="flex items-center justify-center gap-3">
                    <button
                      onClick={() => handleNewFile('root')}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-studio-800 border border-studio-border rounded text-xs text-zinc-300 hover:bg-studio-700 transition-colors"
                    >
                      <Icons.FilePlus className="w-3.5 h-3.5" /> New File
                    </button>
                    <label className="flex items-center gap-1.5 px-3 py-1.5 bg-studio-800 border border-studio-border rounded text-xs text-zinc-300 hover:bg-studio-700 transition-colors cursor-pointer">
                      <Icons.Upload className="w-3.5 h-3.5" /> Upload
                      <input type="file" className="hidden" onChange={handleFileUpload} accept=".txt,.md,.tex,.pdf,.png,.jpg,.jpeg,.zip" />
                    </label>
                  </div>
               </div>
            </div>
          )}

           {/* Image Editor Modal */}
           {isEditingImage && activeNode?.fileType === 'image' && activeNode.data && (
               <div className="absolute inset-4 z-50 rounded-lg shadow-2xl animate-in fade-in zoom-in-95 duration-200">
                   <ImageEditor 
                       imageData={activeNode.data} 
                       mimeType={activeNode.mimeType || 'image/png'}
                       name={activeNode.name}
                       onClose={() => setIsEditingImage(false)} 
                       onSaveNew={(newData, newName) => {
                           const newNode: FileSystemNode = {
                               id: Date.now().toString(),
                               name: newName,
                               type: 'file',
                               fileType: 'image',
                               data: newData,
                               mimeType: activeNode.mimeType
                           };
      addFileToFolder('root', newNode);
      setActiveFileId(newNode.id);
                           setIsEditingImage(false);
                       }}
                   />
               </div>
           )}
        </div>
      </div>

      {/* Chat resize handle */}
      <div
        className="w-1 cursor-col-resize hover:bg-studio-accent/40 active:bg-studio-accent/60 transition-colors flex-shrink-0"
        onMouseDown={(e) => handleDragStart('chat', e)}
      />

      {/* 4. Right Sidebar (Chat) */}
      <div className="bg-studio-900 border-l border-studio-border flex flex-col shadow-2xl z-10" style={{ width: chatWidth, minWidth: 280, maxWidth: 700 }}>
         <ChatPanel
            documentContent={activeNode?.content || ''}
            activeFileName={activeNode?.name}
            references={getAllReferences()}
            onApplyCode={(code) => updateFileContent((activeNode?.content || '') + '\n' + code)}
            onUpdateContent={updateFileContent}
            onCreateFiles={handleCreateFiles}
            onAddFile={handleAddSingleFile}
         />
      </div>

      {/* Compilation Status Overlay */}
      <CompilationStatus
        status={compilationStatus}
        logs={compilationLogs}
        onClose={handleDismissCompilationStatus}
      />

    </div>
  );
};

export default App;
