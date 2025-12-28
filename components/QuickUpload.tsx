import React, { useState, useCallback } from "react";
import { motion } from "framer-motion";
import { Upload, Music, Monitor, Smartphone, Sparkles, ChevronRight, Youtube, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { SERVER_URL } from "@/services/ffmpegService";

interface QuickUploadProps {
  onFileSelect: (file: File, aspectRatio: string) => void;
  onLoadDemo: (aspectRatio: string) => void;
  disabled?: boolean;
}

export const QuickUpload: React.FC<QuickUploadProps> = ({
  onFileSelect,
  onLoadDemo,
  disabled = false,
}) => {
  const [aspectRatio, setAspectRatio] = useState<"16:9" | "9:16">("16:9");
  const [isDragging, setIsDragging] = useState(false);
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [isImporting, setIsImporting] = useState(false);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      if (disabled) return;
      const file = e.dataTransfer.files[0];
      if (file && file.type.startsWith("audio/")) {
        onFileSelect(file, aspectRatio);
      }
    },
    [disabled, onFileSelect, aspectRatio]
  );

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        onFileSelect(file, aspectRatio);
      }
    },
    [onFileSelect, aspectRatio]
  );

  const handleYoutubeImport = async () => {
    if (!youtubeUrl.trim() || isImporting) return;

    setIsImporting(true);
    try {
      const response = await fetch(`${SERVER_URL}/api/import/youtube`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: youtubeUrl }),
      });

      if (!response.ok) {
        throw new Error("Failed to import from YouTube");
      }

      const blob = await response.blob();
      const file = new File([blob], "youtube_audio.mp3", {
        type: "audio/mpeg",
      });
      onFileSelect(file, aspectRatio);
    } catch (error) {
      console.error(error);
      alert(
        "Failed to import YouTube video. Make sure the backend server is running (npm run server) and yt-dlp is installed.",
      );
    } finally {
      setIsImporting(false);
      setYoutubeUrl("");
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-lg mx-auto mt-8 md:mt-16 flex flex-col items-center text-center px-4"
    >
      {/* Hero */}
      <motion.div
        className="mb-6 relative"
        initial={{ scale: 0.9 }}
        animate={{ scale: 1 }}
        transition={{ type: "spring", stiffness: 200 }}
      >
        <div className="absolute inset-0 bg-primary/20 blur-3xl rounded-full" />
        <div className="relative glass-card p-6 rounded-2xl">
          <Sparkles size={48} className="text-primary" />
        </div>
      </motion.div>

      <h1 className="text-3xl md:text-5xl font-bold mb-3 tracking-tight">
        Create Your <span className="gradient-text">Video</span>
      </h1>
      <p className="text-muted-foreground mb-8 text-sm md:text-base">
        Drop an audio file and we'll handle the rest
      </p>

      {/* Aspect Ratio Toggle - Simple inline choice */}
      <div className="flex items-center gap-2 mb-6 p-1 bg-muted/50 rounded-xl">
        <button
          onClick={() => setAspectRatio("16:9")}
          className={cn(
            "flex items-center gap-2 px-4 py-2 rounded-lg transition-all text-sm font-medium",
            aspectRatio === "16:9"
              ? "bg-primary text-primary-foreground shadow-md"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          <Monitor size={16} />
          Landscape
        </button>
        <button
          onClick={() => setAspectRatio("9:16")}
          className={cn(
            "flex items-center gap-2 px-4 py-2 rounded-lg transition-all text-sm font-medium",
            aspectRatio === "9:16"
              ? "bg-primary text-primary-foreground shadow-md"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          <Smartphone size={16} />
          Portrait
        </button>
      </div>

      {/* Drop Zone */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        className={cn(
          "w-full border-2 border-dashed rounded-2xl p-8 transition-all cursor-pointer group",
          isDragging
            ? "border-primary bg-primary/10 scale-[1.02]"
            : "border-border/50 hover:border-primary/50 hover:bg-muted/30",
          disabled && "opacity-50 cursor-not-allowed"
        )}
        onClick={() => !disabled && document.getElementById("audio-input")?.click()}
      >
        <input
          id="audio-input"
          type="file"
          accept="audio/*"
          onChange={handleFileInput}
          className="hidden"
          disabled={disabled}
        />
        <div className="flex flex-col items-center gap-3">
          <div className={cn(
            "w-14 h-14 rounded-full flex items-center justify-center transition-colors",
            isDragging ? "bg-primary/20" : "bg-muted group-hover:bg-primary/10"
          )}>
            <Upload size={24} className={cn(
              "transition-colors",
              isDragging ? "text-primary" : "text-muted-foreground group-hover:text-primary"
            )} />
          </div>
          <div>
            <p className="font-medium text-foreground">
              {isDragging ? "Drop it here!" : "Drop audio or click to browse"}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              MP3, WAV, M4A supported
            </p>
          </div>
        </div>
      </div>

      {/* Demo Button */}
      <div className="relative w-full my-6">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t border-border/50" />
        </div>
        <div className="relative flex justify-center">
          <span className="bg-background px-3 text-xs text-muted-foreground">or</span>
        </div>
      </div>

      {/* YouTube Import */}
      <div className="w-full space-y-3 mb-6">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Youtube
              className={cn(
                "absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 transition-colors",
                youtubeUrl ? "text-red-500" : "text-muted-foreground",
              )}
            />
            <Input
              type="text"
              value={youtubeUrl}
              onChange={(e) => setYoutubeUrl(e.target.value)}
              placeholder="Paste YouTube URL..."
              className={cn(
                "pl-10 h-11",
                "bg-background/50 border-border/50",
                "focus:border-red-500/50 focus:ring-red-500/20",
                "placeholder:text-muted-foreground/50",
              )}
              disabled={isImporting || disabled}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  handleYoutubeImport();
                }
              }}
            />
          </div>
          <Button
            onClick={handleYoutubeImport}
            disabled={isImporting || disabled || !youtubeUrl.trim()}
            className={cn(
              "h-11 px-5",
              "bg-linear-to-r from-red-600 to-red-500",
              "hover:from-red-500 hover:to-red-400",
              "text-white font-semibold",
              "disabled:opacity-50",
            )}
          >
            {isImporting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              "Import"
            )}
          </Button>
        </div>
        <p className="text-[10px] text-muted-foreground/60 text-center">
          Requires backend server (npm run server) with yt-dlp installed
        </p>
      </div>

      {/* Another divider */}
      <div className="relative w-full mb-6">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t border-border/50" />
        </div>
        <div className="relative flex justify-center">
          <span className="bg-background px-3 text-xs text-muted-foreground">or</span>
        </div>
      </div>

      <Button
        onClick={() => onLoadDemo(aspectRatio)}
        variant="outline"
        className="w-full h-11 group border-border/50 hover:border-primary/50"
        disabled={disabled}
      >
        <Music size={16} className="mr-2 text-primary" />
        Try Demo Track
        <ChevronRight size={14} className="ml-2 group-hover:translate-x-1 transition-transform" />
      </Button>

      {/* Feature tags */}
      <div className="flex flex-wrap justify-center gap-2 mt-8">
        {["AI Transcription", "Auto Storyboard", "Video Export"].map((tag) => (
          <span
            key={tag}
            className="px-3 py-1 rounded-full bg-muted/50 text-muted-foreground text-xs border border-border/50"
          >
            {tag}
          </span>
        ))}
      </div>
    </motion.div>
  );
};
