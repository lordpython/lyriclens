import React, { useRef, useState } from 'react';
import { Upload, Music, AlertCircle, Youtube } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

interface FileUploadProps {
  onFileSelect: (file: File) => void;
  disabled: boolean;
}

export const FileUpload: React.FC<FileUploadProps> = ({ onFileSelect, disabled }) => {
  const [isDragging, setIsDragging] = useState(false);
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [isLoading, setIsLoading] = useState(false);
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

  const handleYoutubeImport = async () => {
    if (!youtubeUrl.trim()) return;

    setIsLoading(true);
    try {
      const response = await fetch('http://localhost:3001/api/import/youtube', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: youtubeUrl })
      });

      if (!response.ok) {
        throw new Error('Failed to import from YouTube');
      }

      const blob = await response.blob();
      const file = new File([blob], "youtube_audio.mp3", { type: "audio/mpeg" });
      validateAndPassFile(file);
    } catch (error) {
      console.error(error);
      alert("Failed to import YouTube video. Make sure the server is running and yt-dlp is installed.");
    } finally {
      setIsLoading(false);
      setYoutubeUrl('');
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
    <Card
      className={cn(
        "relative transition-all duration-300 border-2 border-dashed overflow-hidden",
        isDragging ? "border-cyan-400 bg-cyan-400/5 ring-4 ring-cyan-400/10" : "border-slate-700 hover:border-slate-500 hover:bg-slate-800/50",
        disabled && "opacity-50 pointer-events-none"
      )}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <CardContent className="flex flex-col items-center justify-center p-10 select-none">
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileInput}
          accept="audio/*"
          className="hidden"
        />

        <div className="flex flex-col items-center gap-4 cursor-pointer" onClick={() => fileInputRef.current?.click()}>
          <div className={cn(
            "p-5 rounded-full transition-all duration-500",
            isDragging ? "bg-cyan-500/20 scale-110" : "bg-slate-800"
          )}>
            <Music className={cn(
              "w-12 h-12 transition-colors",
              isDragging ? "text-cyan-400" : "text-slate-400"
            )} />
          </div>
          <div className="text-center">
            <h3 className="text-xl font-semibold text-foreground mb-2">
              Upload your song
            </h3>
            <p className="text-slate-400 text-sm max-w-[260px]">
              Drag & drop an MP3 or WAV file, or click to browse
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-500 mt-2 bg-slate-800/50 px-3 py-1 rounded-full">
            <AlertCircle size={14} />
            <span>Max file size recommended: 10MB</span>
          </div>
        </div>

        <div className="w-full max-w-sm mt-8 relative z-10 space-y-3" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center gap-3 w-full my-2">
            <div className="h-px bg-slate-800 flex-1"></div>
            <span className="text-xs text-slate-500 font-medium">OR IMPORT FROM YOUTUBE</span>
            <div className="h-px bg-slate-800 flex-1"></div>
          </div>

          <div className="flex gap-2">
            <div className="relative flex-1">
              <Youtube className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <Input
                type="text"
                value={youtubeUrl}
                onChange={(e) => setYoutubeUrl(e.target.value)}
                placeholder="Paste YouTube URL here..."
                className="pl-9 bg-slate-900/50 border-slate-700"
                disabled={isLoading || disabled}
              />
            </div>
            <Button
              onClick={handleYoutubeImport}
              disabled={isLoading || disabled || !youtubeUrl.trim()}
              className="bg-red-600 hover:bg-red-500 text-white"
            >
              {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Import'}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

// Simple loader icon since lucide-react might strictly export named icons
function Loader2({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
  );
}
