import React, { useRef, useState } from "react";
import {
  Upload,
  Music,
  AlertCircle,
  Youtube,
  Sparkles,
  Waves,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

interface FileUploadProps {
  onFileSelect: (file: File) => void;
  disabled: boolean;
}

export const FileUpload: React.FC<FileUploadProps> = ({
  onFileSelect,
  disabled,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isHovering, setIsHovering] = useState(false);
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
      const response = await fetch("http://localhost:3001/api/import/youtube", {
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
      validateAndPassFile(file);
    } catch (error) {
      console.error(error);
      alert(
        "Failed to import YouTube video. Make sure the server is running and yt-dlp is installed.",
      );
    } finally {
      setIsLoading(false);
      setYoutubeUrl("");
    }
  };

  const validateAndPassFile = (file: File) => {
    if (file.type.startsWith("audio/")) {
      onFileSelect(file);
    } else {
      alert("Please upload a valid audio file.");
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
    >
      <Card
        className={cn(
          "relative overflow-hidden transition-all duration-500",
          "border-2 border-dashed",
          "bg-gradient-to-br from-card/80 via-card/60 to-card/40",
          "backdrop-blur-xl",
          isDragging
            ? "border-primary bg-primary/5 scale-[1.02] shadow-2xl shadow-primary/20"
            : "border-border/50 hover:border-primary/50",
          isHovering && !isDragging && "shadow-xl shadow-primary/10",
          disabled && "opacity-50 pointer-events-none",
        )}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onMouseEnter={() => setIsHovering(true)}
        onMouseLeave={() => setIsHovering(false)}
      >
        {/* Animated Background Gradient */}
        <div
          className={cn(
            "absolute inset-0 opacity-0 transition-opacity duration-500",
            "bg-gradient-to-br from-primary/10 via-accent/5 to-transparent",
            (isDragging || isHovering) && "opacity-100",
          )}
        />

        {/* Floating Orbs */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <motion.div
            className="absolute w-64 h-64 rounded-full bg-primary/10 blur-3xl"
            animate={{
              x: isDragging ? [0, 20, 0] : [0, 10, 0],
              y: isDragging ? [0, -20, 0] : [0, -10, 0],
            }}
            transition={{
              duration: isDragging ? 2 : 4,
              repeat: Infinity,
              ease: "easeInOut",
            }}
            style={{ top: "-20%", left: "-10%" }}
          />
          <motion.div
            className="absolute w-48 h-48 rounded-full bg-accent/10 blur-3xl"
            animate={{
              x: isDragging ? [0, -20, 0] : [0, -10, 0],
              y: isDragging ? [0, 20, 0] : [0, 10, 0],
            }}
            transition={{
              duration: isDragging ? 2 : 4,
              repeat: Infinity,
              ease: "easeInOut",
              delay: 1,
            }}
            style={{ bottom: "-20%", right: "-10%" }}
          />
        </div>

        {/* Drag Overlay */}
        <AnimatePresence>
          {isDragging && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 z-20 flex items-center justify-center bg-primary/10 backdrop-blur-sm"
            >
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.8, opacity: 0 }}
                className="flex flex-col items-center gap-4"
              >
                <motion.div
                  animate={{ y: [0, -10, 0] }}
                  transition={{ duration: 1, repeat: Infinity }}
                  className="p-6 rounded-full bg-primary/20 border-2 border-primary/40"
                >
                  <Upload className="w-12 h-12 text-primary" />
                </motion.div>
                <p className="text-lg font-semibold text-primary text-glow">
                  Drop your audio file here
                </p>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        <CardContent className="relative z-10 flex flex-col items-center justify-center p-8 md:p-12 select-none">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileInput}
            accept="audio/*"
            className="hidden"
          />

          {/* Main Upload Area */}
          <motion.div
            className="flex flex-col items-center gap-6 cursor-pointer group"
            onClick={() => fileInputRef.current?.click()}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            {/* Icon Container */}
            <div className="relative">
              {/* Glow Ring */}
              <motion.div
                className={cn(
                  "absolute inset-0 rounded-full",
                  "bg-gradient-to-r from-primary via-accent to-primary",
                  "opacity-0 blur-xl transition-opacity duration-500",
                  isHovering && "opacity-40",
                )}
                animate={
                  isHovering
                    ? {
                        scale: [1, 1.2, 1],
                        rotate: [0, 180, 360],
                      }
                    : {}
                }
                transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
              />

              {/* Outer Ring */}
              <motion.div
                className={cn(
                  "relative p-1 rounded-full",
                  "bg-gradient-to-r from-primary/50 via-accent/50 to-primary/50",
                )}
                animate={isHovering ? { rotate: 360 } : { rotate: 0 }}
                transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
              >
                {/* Inner Container */}
                <div
                  className={cn(
                    "p-6 rounded-full transition-all duration-500",
                    "bg-gradient-to-br from-card via-card to-background",
                    "border border-border/50",
                    "group-hover:from-primary/10 group-hover:via-card group-hover:to-card",
                  )}
                >
                  <motion.div
                    animate={isHovering ? { rotate: [0, 10, -10, 0] } : {}}
                    transition={{ duration: 0.5 }}
                  >
                    <Music
                      className={cn(
                        "w-12 h-12 transition-colors duration-300",
                        isHovering ? "text-primary" : "text-muted-foreground",
                      )}
                    />
                  </motion.div>
                </div>
              </motion.div>

              {/* Sparkles */}
              <AnimatePresence>
                {isHovering && (
                  <>
                    {[...Array(3)].map((_, i) => (
                      <motion.div
                        key={i}
                        initial={{ opacity: 0, scale: 0 }}
                        animate={{
                          opacity: [0, 1, 0],
                          scale: [0, 1, 0],
                          x: [0, (i - 1) * 40],
                          y: [0, -30 - i * 10],
                        }}
                        exit={{ opacity: 0, scale: 0 }}
                        transition={{
                          duration: 1,
                          repeat: Infinity,
                          delay: i * 0.3,
                        }}
                        className="absolute top-0 left-1/2"
                      >
                        <Sparkles className="w-4 h-4 text-primary" />
                      </motion.div>
                    ))}
                  </>
                )}
              </AnimatePresence>
            </div>

            {/* Text Content */}
            <div className="text-center space-y-2">
              <h3 className="text-xl md:text-2xl font-bold text-foreground">
                Upload your <span className="gradient-text">audio</span>
              </h3>
              <p className="text-muted-foreground text-sm md:text-base max-w-[280px]">
                Drag & drop an MP3 or WAV file, or click to browse
              </p>
            </div>

            {/* File Info Badge */}
            <motion.div
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-full",
                "bg-muted/50 border border-border/50",
                "text-xs text-muted-foreground",
                "transition-all duration-300",
                isHovering && "bg-primary/10 border-primary/30 text-primary/80",
              )}
              whileHover={{ scale: 1.05 }}
            >
              <Waves size={14} />
              <span>Supports MP3, WAV, M4A, OGG • Up to 50MB</span>
            </motion.div>
          </motion.div>

          {/* Divider */}
          <div className="w-full max-w-sm mt-8 relative z-10">
            <div className="flex items-center gap-4 w-full">
              <div className="h-px bg-gradient-to-r from-transparent via-border to-transparent flex-1" />
              <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
                or import
              </span>
              <div className="h-px bg-gradient-to-r from-transparent via-border to-transparent flex-1" />
            </div>
          </div>

          {/* YouTube Import */}
          <motion.div
            className="w-full max-w-sm mt-6 space-y-3"
            onClick={(e) => e.stopPropagation()}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <div className="flex gap-2">
              <div className="relative flex-1 group/input">
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
                    "transition-all duration-300",
                  )}
                  disabled={isLoading || disabled}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      handleYoutubeImport();
                    }
                  }}
                />
              </div>
              <Button
                onClick={handleYoutubeImport}
                disabled={isLoading || disabled || !youtubeUrl.trim()}
                className={cn(
                  "h-11 px-5",
                  "bg-gradient-to-r from-red-600 to-red-500",
                  "hover:from-red-500 hover:to-red-400",
                  "text-white font-semibold",
                  "shadow-lg shadow-red-500/20",
                  "disabled:opacity-50 disabled:shadow-none",
                  "transition-all duration-300",
                )}
              >
                {isLoading ? (
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{
                      duration: 1,
                      repeat: Infinity,
                      ease: "linear",
                    }}
                  >
                    <Loader2 className="w-4 h-4" />
                  </motion.div>
                ) : (
                  "Import"
                )}
              </Button>
            </div>

            <p className="text-[10px] text-muted-foreground/60 text-center">
              Requires backend server with yt-dlp installed
            </p>
          </motion.div>
        </CardContent>

        {/* Bottom Gradient Line */}
        <div
          className={cn(
            "absolute bottom-0 left-0 right-0 h-1",
            "bg-gradient-to-r from-transparent via-primary/50 to-transparent",
            "opacity-0 transition-opacity duration-500",
            (isDragging || isHovering) && "opacity-100",
          )}
        />
      </Card>
    </motion.div>
  );
};

// Loader component
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
