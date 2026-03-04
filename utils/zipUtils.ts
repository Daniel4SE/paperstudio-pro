import JSZip from 'jszip';
import { FileSystemNode, FileType } from '../types';

const BINARY_EXTENSIONS = ['png', 'jpg', 'jpeg', 'gif', 'pdf', 'zip', 'webp', 'ico'];
const TEXT_EXTENSIONS = ['tex', 'bib', 'sty', 'cls', 'md', 'txt', 'json', 'js', 'ts', 'css', 'html', 'log', 'aux'];

const getFileType = (filename: string): FileType => {
  const ext = filename.split('.').pop()?.toLowerCase() || '';
  if (['png', 'jpg', 'jpeg', 'webp'].includes(ext)) return 'image';
  if (ext === 'pdf') return 'pdf';
  if (ext === 'tex' || ext === 'sty' || ext === 'cls') return 'tex';
  return 'txt';
};

const getMimeType = (filename: string): string => {
    const ext = filename.split('.').pop()?.toLowerCase() || '';
    if (ext === 'png') return 'image/png';
    if (ext === 'jpg' || ext === 'jpeg') return 'image/jpeg';
    if (ext === 'webp') return 'image/webp';
    if (ext === 'pdf') return 'application/pdf';
    return 'text/plain';
};

export const unzipProject = async (file: File): Promise<FileSystemNode> => {
  const zip = new JSZip();
  const loadedZip = await zip.loadAsync(file);
  
  // 1. Flatten entries and organize by path
  const fileMap = new Map<string, FileSystemNode>();
  const rootId = `folder_${Date.now()}_root`;
  
  // Create the top-level folder node representing the zip itself
  const projectRoot: FileSystemNode = {
      id: rootId,
      name: file.name.replace('.zip', ''),
      type: 'folder',
      isOpen: true,
      children: []
  };

  // 2. Iterate through all files in the zip
  const entries = Object.keys(loadedZip.files);
  
  // Sort entries to ensure folders might come before files (though we handle this via map)
  entries.sort();

  for (const path of entries) {
      const zipEntry = loadedZip.files[path];
      const isDir = zipEntry.dir;
      const name = path.split('/').filter(p => p).pop() || path;
      // Skip __MACOSX and hidden files
      if (path.includes('__MACOSX') || name.startsWith('.')) continue;

      const ext = name.split('.').pop()?.toLowerCase() || '';
      const isBinary = BINARY_EXTENSIONS.includes(ext);

      const node: FileSystemNode = {
          id: `zip_node_${Date.now()}_${path}`,
          name: name,
          type: isDir ? 'folder' : 'file',
          isOpen: isDir ? false : undefined, // Start subfolders closed to reduce clutter
          children: isDir ? [] : undefined
      };

      if (!isDir) {
          node.fileType = getFileType(name);
          node.mimeType = getMimeType(name);
          
          if (isBinary) {
              const base64 = await zipEntry.async('base64');
              // Prefix with data URI scheme
              node.data = `data:${node.mimeType};base64,${base64}`;
          } else {
              node.content = await zipEntry.async('string');
          }
      }

      fileMap.set(path, node);
  }

  // 3. Reconstruct the tree structure
  fileMap.forEach((node, path) => {
      // Logic to find parent path: 'foo/bar/baz.tex' -> parent is 'foo/bar/'
      // JSZip paths usually don't start with /, but folders end with /
      
      // Clean trailing slash for directory check
      const cleanPath = path.endsWith('/') ? path.slice(0, -1) : path;
      const parts = cleanPath.split('/');
      
      if (parts.length === 1) {
          // Top level in the zip -> add to projectRoot
          node.parentId = rootId;
          projectRoot.children?.push(node);
      } else {
          // Has a parent
          parts.pop(); // Remove self
          const parentPath = parts.join('/') + '/'; // Re-add slash to match JSZip folder key
          
          const parentNode = fileMap.get(parentPath);
          
          if (parentNode && parentNode.children) {
              node.parentId = parentNode.id;
              parentNode.children.push(node);
              // If we put something in a folder, open it if it's high level? 
              // Let's keep deep folders closed, but maybe open top level?
              if(parts.length < 2) parentNode.isOpen = true; 
          } else {
              // Fallback: If parent folder entry didn't exist explicitly in zip (rare but possible),
              // add to project root to avoid data loss.
              node.parentId = rootId;
              projectRoot.children?.push(node);
          }
      }
  });

  return projectRoot;
};