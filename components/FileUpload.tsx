import React, { useRef, useState } from 'react';
import { Upload, Music, AlertCircle } from 'lucide-react';

interface FileUploadProps {
  onFileSelect: (file: File) => void;
  disabled: boolean;
}

export const FileUpload: React.FC<FileUploadProps> = ({ onFileSelect, disabled }) => {
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      validateAndPassFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      validateAndPassFile(e.target.files[0]);
    }
  };

  const validateAndPassFile = (file: File) => {
    // Basic validation for audio types
    if (file.type.startsWith('audio/')) {
      onFileSelect(file);
    } else {
      alert("Please upload a valid audio file.");
    }
  };

  return (
    <div 
      className={`relative border-2 border-dashed rounded-2xl p-10 text-center transition-all duration-300
        ${isDragging 
          ? 'border-cyan-400 bg-cyan-400/10 scale-[1.02]' 
          : 'border-slate-600 hover:border-slate-400 hover:bg-slate-800/50'
        }
        ${disabled ? 'opacity-50 pointer-events-none' : 'cursor-pointer'}
      `}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={() => fileInputRef.current?.click()}
    >
      <input 
        type="file" 
        ref={fileInputRef} 
        onChange={handleFileInput} 
        accept="audio/*" 
        className="hidden" 
      />
      
      <div className="flex flex-col items-center gap-4">
        <div className={`p-4 rounded-full ${isDragging ? 'bg-cyan-500/20' : 'bg-slate-700/50'}`}>
          <Music className={`w-12 h-12 ${isDragging ? 'text-cyan-400' : 'text-slate-400'}`} />
        </div>
        <div>
          <h3 className="text-xl font-semibold text-white mb-2">
            Upload your song
          </h3>
          <p className="text-slate-400">
            Drag & drop an MP3 or WAV file, or click to browse
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-500 mt-2">
          <AlertCircle size={14} />
          <span>Max file size recommended: 10MB</span>
        </div>
      </div>
    </div>
  );
};
