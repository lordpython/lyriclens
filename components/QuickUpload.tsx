import React, { useState, useCallback } from "react";
import { motion } from "framer-motion";
import { Upload, Music, Monitor, Smartphone, Sparkles, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

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
