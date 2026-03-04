import React, { useState } from 'react';
import { Icons } from './Icon';
import { editImage } from '../services/geminiService';

interface ImageEditorProps {
  imageData: string;
  mimeType: string;
  name: string;
  onClose: () => void;
  onSaveNew: (newData: string, newName: string) => void;
}

const ImageEditor: React.FC<ImageEditorProps> = ({ imageData, mimeType, name, onClose, onSaveNew }) => {
  const [currentImage, setCurrentImage] = useState(imageData);
  const [prompt, setPrompt] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  const handleEdit = async () => {
    if (!prompt.trim()) return;
    setIsProcessing(true);
    try {
      const result = await editImage(currentImage, mimeType, prompt);
      if (result) {
        setCurrentImage(result);
        setPrompt('');
      }
    } catch (e) {
      alert("Failed to edit image. Please try again.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSave = () => {
    onSaveNew(currentImage, `edited_${name}`);
  };

  return (
    <div className="flex flex-col h-full bg-studio-900 rounded-lg overflow-hidden border border-studio-border shadow-2xl">
      <div className="flex items-center justify-between p-3 border-b border-studio-border bg-studio-800">
        <div className="flex items-center space-x-2">
          <Icons.Magic className="w-4 h-4 text-studio-accent" />
          <span className="text-sm font-medium text-white">AI Image Editor</span>
        </div>
        <div className="flex space-x-2">
            <button onClick={handleSave} className="text-xs bg-studio-700 hover:bg-studio-600 px-3 py-1 rounded text-white transition-colors">Save Copy</button>
            <button onClick={onClose} className="text-zinc-400 hover:text-white"><Icons.Error size={18} /></button>
        </div>
      </div>

      <div className="flex-1 bg-black flex items-center justify-center p-4 relative overflow-hidden">
        <img 
            src={currentImage} 
            alt="Preview" 
            className="max-w-full max-h-full object-contain rounded border border-studio-700 shadow-lg" 
        />
        {isProcessing && (
            <div className="absolute inset-0 bg-black/70 flex items-center justify-center z-10 backdrop-blur-sm">
                <div className="flex flex-col items-center space-y-3">
                    <Icons.Cpu className="w-8 h-8 text-studio-accent animate-spin" />
                    <span className="text-sm text-zinc-300 font-medium">Generating new version...</span>
                </div>
            </div>
        )}
      </div>

      <div className="p-4 bg-studio-800 border-t border-studio-border">
        <div className="flex space-x-2">
          <input 
            type="text" 
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleEdit()}
            placeholder="Describe change (e.g., 'Make it look like a pencil sketch', 'Add a robot')"
            className="flex-1 bg-studio-900 border border-studio-600 rounded px-3 py-2 text-sm text-zinc-200 outline-none focus:border-studio-accent placeholder-zinc-500"
          />
          <button 
            onClick={handleEdit}
            disabled={isProcessing || !prompt.trim()}
            className="bg-studio-accent hover:bg-blue-600 text-white px-4 py-2 rounded text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Icons.Magic className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default ImageEditor;