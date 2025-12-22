import React, { useState } from "react";
import { FileUpload } from "./components/FileUpload";
import { ProcessingStep } from "./components/ProcessingStep";
import { ImageGenerator } from "./components/ImageGenerator";
import { TimelinePlayer } from "./components/TimelinePlayer";
import { TranscriptList } from "./components/TranscriptList";
import { VideoExportModal } from "./components/VideoExportModal";
import { AppState } from "./types";
import {
  Music,
  RefreshCw,
  Download,
  Video,
  Wand2,
  Loader2,
  Speech,
  User,
  Smartphone,
  Monitor,
  Menu,
  X,
  Sparkles,
  LayoutDashboard,
  Film,
  Zap,
  ChevronRight,
  Settings2,
  Layers,
  Play,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useLyricLens } from "./hooks/useLyricLens";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

const ART_STYLES = [
  "Cinematic",
  "Anime / Manga",
  "Cyberpunk",
  "Watercolor",
  "Oil Painting",
  "Pixel Art",
  "Surrealist",
  "Dark Fantasy",
  "Commercial / Ad",
  "Minimalist / Tutorial",
  "Comic Book",
  "Corporate / Brand",
  "Photorealistic",
];

const LANGUAGES = [
  "Spanish",
  "French",
  "German",
  "Japanese",
  "Korean",
  "Chinese",
  "Hindi",
  "Italian",
  "Portuguese",
  "English",
  "Arabic",
];

export default function App() {
  const {
    appState,
    songData,
    setSongData,
    errorMsg,
    isBulkGenerating,
    contentType,
    isTranslating,
    globalSubject,
    aspectRatio,
    generationMode,
    setGenerationMode,
    videoProvider,
    setVideoProvider,
    setAspectRatio,
    setGlobalSubject,
    setContentType,
    handleFileSelect,
    handleImageGenerated,
    handleGenerateAll,
    handleTranslate,
    loadTestData,
    resetApp,
  } = useLyricLens();

  // UI-specific state
  const [showExportModal, setShowExportModal] = useState(false);
  const [selectedStyle, setSelectedStyle] = useState("Cinematic");
  const [targetLang, setTargetLang] = useState("Spanish");
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false); // Default closed on mobile

  // Handlers
  const onFileSelect = (file: File) => handleFileSelect(file, selectedStyle);
  const onTranslate = () => handleTranslate(targetLang);
  const onReset = () => {
    resetApp();
    setShowExportModal(false);
    setIsPlaying(false);
    setCurrentTime(0);
    setDuration(0);
  };

  const downloadSRT = () => {
    if (!songData?.srtContent) return;
    const blob = new Blob([songData.srtContent], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${songData.fileName.replace(/\.[^/.]+$/, "")}.srt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // --- Components ---

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      {/* Brand */}
      <div className="h-16 flex items-center px-6 border-b border-border/30 shrink-0 bg-gradient-to-r from-primary/5 to-transparent">
        <motion.div
          className="relative"
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          <div className="absolute inset-0 bg-primary/30 blur-xl rounded-full" />
          <div className="relative w-9 h-9 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center mr-3 shadow-lg shadow-primary/30">
            <Music className="text-primary-foreground w-5 h-5" />
          </div>
        </motion.div>
        <div className="flex flex-col">
          <span className="font-bold text-lg tracking-tight text-foreground">
            LyricLens
          </span>
          <span className="text-[9px] text-muted-foreground font-medium uppercase tracking-widest">
            AI Video Studio
          </span>
        </div>
      </div>

      <ScrollArea className="flex-1 py-6 px-4">
        <div className="space-y-6">
          {/* Section: Configuration */}
          <div className="space-y-4">
            <h3 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest px-2 flex items-center gap-2">
              <Settings2 size={12} className="text-primary/60" />
              Project Config
            </h3>

            {/* Mode */}
            <div className="space-y-2">
              <label className="text-xs font-medium text-foreground/70 px-2 flex items-center gap-2">
                {contentType === "music" ? (
                  <Music size={12} className="text-primary" />
                ) : (
                  <Speech size={12} className="text-primary" />
                )}
                Content Mode
              </label>
              <Select
                value={contentType}
                onValueChange={(val: any) => setContentType(val)}
              >
                <SelectTrigger className="bg-background/80 border-border/50 text-foreground h-10 hover:bg-background hover:border-primary/30 transition-colors">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="music">
                    <span className="flex items-center gap-2">
                      <Music size={14} className="text-primary" />
                      Music Video
                    </span>
                  </SelectItem>
                  <SelectItem value="story">
                    <span className="flex items-center gap-2">
                      <Speech size={14} className="text-accent" />
                      Story / Speech
                    </span>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Output Format */}
            <div className="space-y-2">
              <label className="text-xs font-medium text-foreground/70 px-2 flex items-center gap-2">
                <Film size={12} className="text-primary" /> Output Format
              </label>
              <Select
                value={generationMode}
                onValueChange={(val: "image" | "video") =>
                  setGenerationMode(val)
                }
              >
                <SelectTrigger className="bg-background/80 border-border/50 text-foreground h-10 hover:bg-background hover:border-primary/30 transition-colors">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="image">
                    <span className="flex items-center gap-2">
                      <Layers size={14} className="text-blue-400" />
                      Static Images
                    </span>
                  </SelectItem>
                  <SelectItem value="video">
                    <span className="flex items-center gap-2">
                      <Play size={14} className="text-green-400" />
                      Motion Loops
                    </span>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Video Provider Selector (Conditional) */}
            <AnimatePresence>
              {generationMode === "video" && (
                <motion.div
                  className="space-y-2"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <label className="text-xs font-medium text-foreground/70 px-2 flex items-center gap-2">
                    <Zap size={12} className="text-yellow-400" /> Video Engine
                  </label>
                  <Select
                    value={videoProvider}
                    onValueChange={(val: "veo" | "deapi") =>
                      setVideoProvider(val)
                    }
                  >
                    <SelectTrigger className="bg-background/80 border-border/50 text-foreground h-10 hover:bg-background hover:border-primary/30 transition-colors">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="veo">
                        <span className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-green-400" />
                          Google Veo (Premium)
                        </span>
                      </SelectItem>
                      <SelectItem value="deapi">
                        <span className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-blue-400" />
                          DeAPI (Fast)
                        </span>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Ratio */}
            <div className="space-y-2">
              <label className="text-xs font-medium text-foreground/70 px-2 flex items-center gap-2">
                {aspectRatio === "16:9" ? (
                  <Monitor size={12} className="text-primary" />
                ) : (
                  <Smartphone size={12} className="text-primary" />
                )}
                Aspect Ratio
              </label>
              <Select value={aspectRatio} onValueChange={setAspectRatio}>
                <SelectTrigger className="bg-background/80 border-border/50 text-foreground h-10 hover:bg-background hover:border-primary/30 transition-colors">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="16:9">
                    <span className="flex items-center gap-2">
                      <Monitor size={14} />
                      16:9 Landscape
                    </span>
                  </SelectItem>
                  <SelectItem value="9:16">
                    <span className="flex items-center gap-2">
                      <Smartphone size={14} />
                      9:16 Portrait
                    </span>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Section: Art Direction */}
          <div className="space-y-4">
            <h3 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest px-2 flex items-center gap-2">
              <Sparkles size={12} className="text-accent/60" /> Art Direction
            </h3>

            {/* Style */}
            <div className="space-y-2">
              <label className="text-xs font-medium text-foreground/70 px-2">
                Visual Style
              </label>
              <Select value={selectedStyle} onValueChange={setSelectedStyle}>
                <SelectTrigger className="bg-background/80 border-border/50 text-foreground h-10 hover:bg-background hover:border-primary/30 transition-colors">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="max-h-80[300px]">
                  {ART_STYLES.map((style) => (
                    <SelectItem key={style} value={style}>
                      <span className="flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-gradient-to-r from-primary to-accent" />
                        {style}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Subject */}
            <div className="space-y-2">
              <label className="text-xs font-medium text-foreground/70 px-2">
                Main Subject
              </label>
              <div className="relative group">
                <User
                  size={14}
                  className="absolute left-3 top-3 text-muted-foreground group-focus-within:text-primary transition-colors"
                />
                <Input
                  value={globalSubject}
                  onChange={(e) =>
                    setGlobalSubject(e.target.value)
                  }
                  placeholder="e.g. A red robot, a girl with blue hair"
                  className="pl-9 bg-background/80 border-border/50 text-foreground h-10 focus-visible:ring-primary/30 focus-visible:border-primary/50 hover:border-primary/30 transition-colors placeholder:text-muted-foreground/40"
                />
              </div>
              <p className="text-[10px] text-muted-foreground/60 px-2">
                Maintains consistency across all scenes
              </p>
            </div>
          </div>

          {/* Actions (Only in READY) */}
          {appState === AppState.READY && (
            <motion.div
              className="pt-4 border-t border-border/30 space-y-3"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2 }}
            >
              <Button
                onClick={onReset}
                variant="outline"
                className="w-full justify-start text-muted-foreground hover:text-foreground border-border/50 bg-transparent hover:bg-destructive/10 hover:border-destructive/30 hover:text-destructive transition-all group"
              >
                <RefreshCw
                  size={14}
                  className="mr-2 group-hover:rotate-180 transition-transform duration-500"
                />
                New Project
              </Button>
            </motion.div>
          )}
        </div>
      </ScrollArea>

      {/* Footer */}
      <div className="p-4 border-t border-border/30 shrink-0">
        <div className="flex items-center justify-center gap-2 text-[10px] text-muted-foreground/60">
          <span className="font-medium">Powered by</span>
          <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary/80 font-semibold">
            Gemini 2.5
          </span>
          <span>&</span>
          <span className="px-2 py-0.5 rounded-full bg-accent/10 text-accent/80 font-semibold">
            FFmpeg
          </span>
        </div>
      </div>
    </div>
  );

  return (
    // Use h-[100dvh] for mobile browser viewport correctness
    <div className="flex flex-col md:flex-row h-[100dvh] bg-background text-foreground font-sans overflow-hidden relative">
      {/* Background Effects */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-primary/5 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-accent/5 rounded-full blur-3xl" />
      </div>

      {/* Mobile Header */}
      <header className="h-14 px-4 flex items-center justify-between border-b border-border/30 bg-card/80 backdrop-blur-xl md:hidden shrink-0 z-30 relative">
        <div className="flex items-center gap-3">
          <Button
            size="icon"
            variant="ghost"
            onClick={() => setIsSidebarOpen(true)}
            className="hover:bg-primary/10"
          >
            <Menu size={20} />
          </Button>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center">
              <Music className="text-primary-foreground w-4 h-4" />
            </div>
            <span className="font-bold text-lg tracking-tight">LyricLens</span>
          </div>
        </div>
      </header>

      {/* Mobile Sidebar Overlay */}
      <AnimatePresence>
        {isSidebarOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 z-40 md:hidden backdrop-blur-sm"
              onClick={() => setIsSidebarOpen(false)}
            />
            <motion.aside
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "spring", bounce: 0, duration: 0.3 }}
              className="fixed top-0 bottom-0 left-0 w-[280px] bg-card border-r border-border z-50 md:hidden"
            >
              <div className="absolute top-4 right-4 z-50">
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => setIsSidebarOpen(false)}
                  className="h-8 w-8"
                >
                  <X size={18} />
                </Button>
              </div>
              <SidebarContent />
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Desktop Sidebar */}
      <aside className="hidden md:flex w-2[280px] bg-card/95 backdrop-blur-xl border-r border-border/30 flex-col h-full shrink-0 z-20 shadow-2xl shadow-black/20">
        <SidebarContent />
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0 bg-gradient-to-br from-background via-background to-secondary/20 relative overflow-hidden min-h-0">
        {/* Desktop Toolbar */}
        <header className="hidden md:flex h-14 border-b border-border/30 bg-card/60 backdrop-blur-xl items-center justify-between px-6 shrink-0 z-10 sticky top-0">
          <div className="flex items-center gap-4">
            {songData ? (
              <div className="flex items-center gap-3[300px]">
">
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Music size={16} className="text-primary" />
                </div>
                <div className="flex flex-col">
                  <h2 className="font-semibold text-foreground leading-tight truncate max-w-60">
                    {songData.fileName}
                  </h2>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">
                      {contentType} mode
                    </span>
                    <ChevronRight
                      size={10}
                      className="text-muted-foreground/50"
                    />
                    <span className="text-[10px] text-primary/80 font-medium">
                      {songData.prompts.length} scenes
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <span className="text-muted-foreground font-medium flex items-center gap-2">
                <LayoutDashboard size={16} />
                New Project
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {appState === AppState.READY && (
              <>
                <Button
                  onClick={downloadSRT}
                  variant="ghost"
                  size="sm"
                  className="text-muted-foreground hover:text-foreground hover:bg-muted/50 h-9"
                >
                  <Download size={14} className="mr-2" /> SRT
                </Button>
                <Button
                  onClick={() => setShowExportModal(true)}
                  className="bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 text-primary-foreground shadow-lg shadow-primary/25 h-9 font-semibold"
                >
                  <Video size={14} className="mr-2" /> Export Video
                </Button>
              </>
            )}
          </div>
        </header>

        {/* Scrollable Workspace */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden p-4 md:p-6 w-full">
          <AnimatePresence mode="wait">
            {/* STATE: IDLE */}
            {appState === AppState.IDLE && (
              <motion.div
                key="idle"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="max-w-2xl mx-auto mt-6 md:mt-16 flex flex-col items-center text-center px-4"
              >
                {/* Hero Icon */}
                <motion.div
                  className="mb-8 relative"
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: 0.1, type: "spring", stiffness: 200 }}
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-primary/30 via-accent/20 to-primary/30 blur-3xl rounded-full animate-pulse" />
                  <div className="absolute inset-0 bg-primary/10 blur-2xl rounded-full" />
                  <motion.div
                    className="relative glass-card p-8 rounded-3xl shadow-2xl"
                    whileHover={{ scale: 1.05, rotate: 2 }}
                    transition={{ type: "spring", stiffness: 300 }}
                  >
                    <div className="relative">
                      <LayoutDashboard size={56} className="text-primary" />
                      <motion.div
                        className="absolute -top-1 -right-1"
                        animate={{ rotate: [0, 15, -15, 0] }}
                        transition={{
                          duration: 2,
                          repeat: Infinity,
                          ease: "easeInOut",
                        }}
                      >
                        <Sparkles size={20} className="text-accent" />
                      </motion.div>
                    </div>
                  </motion.div>
                </motion.div>

                {/* Title */}
                <motion.h1
                  className="text-4xl md:text-6xl font-bold text-foreground mb-4 tracking-tight"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                >
                  Visualize Your <span className="gradient-text">Audio</span>
                </motion.h1>

                <motion.p
                  className="text-base md:text-lg text-muted-foreground mb-10 leading-relaxed max-w-lg"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                >
                  Turn your music, stories, or podcasts into stunning
                  AI-generated videos with synchronized lyrics and visuals.
                </motion.p>

                {/* Upload Area */}
                <motion.div
                  className="w-full max-w-lg space-y-6"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4 }}
                >
                  <FileUpload onFileSelect={onFileSelect} disabled={false} />

                  {/* Divider */}
                  <div className="relative py-2">
                    <div className="absolute inset-0 flex items-center">
                      <span className="w-full border-t border-border/50"></span>
                    </div>
                    <div className="relative flex justify-center">
                      <span className="bg-background px-4 text-xs text-muted-foreground uppercase tracking-wider">
                        Or try demo
                      </span>
                    </div>
                  </div>

                  {/* Demo Button */}
                  <motion.div
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <Button
                      onClick={loadTestData}
                      variant="outline"
                      className="w-full border-border/50 hover:border-primary/50 hover:bg-primary/5 h-12 group transition-all duration-300"
                    >
                      <Music
                        size={16}
                        className="mr-2 text-primary group-hover:scale-110 transition-transform"
                      />
                      <span>Load Demo Track</span>
                      <ChevronRight
                        size={14}
                        className="ml-2 text-muted-foreground group-hover:translate-x-1 transition-transform"
                      />
                    </Button>
                  </motion.div>
                </motion.div>

                {/* Feature Pills */}
                <motion.div
                  className="flex flex-wrap justify-center gap-3 mt-12"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.6 }}
                >
                  {[
                    "AI Transcription",
                    "Visual Storyboard",
                    "Video Export",
                  ].map((feature, i) => (
                    <motion.span
                      key={feature}
                      className="px-4 py-2 rounded-full bg-muted/50 text-muted-foreground text-xs font-medium border border-border/50"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.7 + i * 0.1 }}
                      whileHover={{
                        scale: 1.05,
                        borderColor: "var(--primary)",
                      }}
                    >
                      {feature}
                    </motion.span>
                  ))}
                </motion.div>
              </motion.div>
            )}

            {/* STATE: PROCESSING */}
            {(appState === AppState.PROCESSING_AUDIO ||
              appState === AppState.ANALYZING_LYRICS) && (
              <motion.div
                key="processing"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex flex-col items-center justify-center h-full min-h-[50vh]"
              >
                <ProcessingStep currentStep={appState} />
              </motion.div>
            )}

            {/* STATE: ERROR */}
            {appState === AppState.ERROR && (
              <motion.div
                key="error"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="max-w-md mx-auto mt-20 p-6 bg-destructive/10 border border-destructive/20 rounded-2xl text-center"
              >
                <h3 className="text-destructive font-bold mb-2">
                  Error Processing File
                </h3>
                <p className="text-sm text-destructive-foreground/80 mb-4">
                  {errorMsg}
                </p>
                <Button onClick={onReset} variant="destructive">
                  Try Again
                </Button>
              </motion.div>
            )}

            {/* STATE: READY */}
            {appState === AppState.READY && songData && (
              <motion.div
                key="ready"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.5 }}
                className="grid grid-cols-1 xl:grid-cols-12 gap-6 h-full pb-20"
              >
                {/* Left Panel: Context & Player */}
                <div className="xl:col-span-4 flex flex-col gap-6 order-2 xl:order-1">
                  <div className="bg-card/50 border border-border rounded-2xl p-4 shadow-sm backdrop-blur-sm sticky top-0 z-10">
                    <TimelinePlayer
                      audioUrl={songData.audioUrl}
                      subtitles={songData.parsedSubtitles}
                      currentTime={currentTime}
                      duration={duration}
                      isPlaying={isPlaying}
                      onPlayPause={() => setIsPlaying(!isPlaying)}
                      onSeek={(time) => setCurrentTime(time)}
                      onTimeUpdate={(time) => setCurrentTime(time)}
                      onDurationChange={(dur) => setDuration(dur)}
                      onEnded={() => setIsPlaying(false)}
                      contentMode={contentType}
                    />
                  </div>

                  {/* Translation & Transcript */}
                  <div className="bg-card/30 border border-border/50 rounded-2xl p-4 flex-1 flex flex-col min-h-[400px]">
                    <div className="flex items-center gap-2 mb-4">
                      <Select value={targetLang} onValueChange={setTargetLang}>
                        <SelectTrigger className="h-8 bg-card border-input text-xs w-[120px]">
                          <SelectValue placeholder="Translate" />
                        </SelectTrigger>
                        <SelectContent>
                          {LANGUAGES.map((l) => (
                            <SelectItem key={l} value={l}>
                              {l}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button
                        onClick={onTranslate}
                        disabled={isTranslating}
                        size="sm"
                        variant="ghost"
                        className="h-8 text-xs text-muted-foreground hover:text-foreground"
                      >
                        {isTranslating ? (
                          <Loader2 size={12} className="animate-spin" />
                        ) : (
                          "Translate"
                        )}
                      </Button>
                    </div>

                    <TranscriptList
                      subtitles={songData.parsedSubtitles}
                      currentTime={currentTime}
                      onSeek={(time) => {
                        setCurrentTime(time);
                        setIsPlaying(true);
                      }}
                    />
                  </div>
                </div>

                {/* Right Panel: Visual Generation */}
                <div className="xl:col-span-8 flex flex-col gap-6 order-1 xl:order-2">
                  {/* Action Bar */}
                  <div className="flex flex-col sm:flex-row flex-wrap items-center justify-between gap-4 bg-card/50 p-4 rounded-2xl border border-border/50">
                    <div>
                      <h3 className="font-semibold text-foreground flex items-center gap-2">
                        <Sparkles size={16} className="text-primary" />
                        Storyboard
                      </h3>
                      <p className="text-xs text-muted-foreground mt-1">
                        {songData.prompts.length} scenes based on {contentType}.
                      </p>
                    </div>
                    <Button
                      onClick={() =>
                        handleGenerateAll(selectedStyle, aspectRatio)
                      }
                      disabled={isBulkGenerating}
                      className="w-full sm:w-auto bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg shadow-primary/20 border-0"
                    >
                      {isBulkGenerating ? (
                        <>
                          <Loader2 size={16} className="animate-spin mr-2" />{" "}
                          Generating...
                        </>
                      ) : (
                        <>
                          <Wand2 size={16} className="mr-2" /> Generate All
                        </>
                      )}
                    </Button>
                  </div>

                  {/* Image Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {songData.prompts.map(
                      (prompt: { id: string; text: string }, idx: number) => {
                        const existing = songData.generatedImages.find(
                          (img: {
                            promptId: string;
                            imageUrl: string;
                            type?: "image" | "video";
                            baseImageUrl?: string;
                          }) => img.promptId === prompt.id,
                        );
                        // Collect sibling prompt texts for cross-scene deduplication
                        const siblingPromptTexts = songData.prompts
                          .filter((p: { id: string }) => p.id !== prompt.id)
                          .map((p: { text: string }) => p.text);
                        return (
                          <motion.div
                            key={prompt.id}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: idx * 0.05 }}
                          >
                            <ImageGenerator
                              prompt={prompt}
                              onImageGenerated={handleImageGenerated}
                              existingImage={existing?.imageUrl}
                              existingType={existing?.type}
                              existingBaseImage={existing?.baseImageUrl}
                              style={selectedStyle}
                              globalSubject={globalSubject}
                              aspectRatio={aspectRatio}
                              generationMode={generationMode}
                              videoProvider={videoProvider}
                              siblingPromptTexts={siblingPromptTexts}
                              onAssetTypeChange={(promptId, assetType) => {
                                // Update the prompt's asset type in songData
                                setSongData((prev) => {
                                  if (!prev) return prev;
                                  return {
                                    ...prev,
                                    prompts: prev.prompts.map((p) =>
                                      p.id === promptId
                                        ? { ...p, assetType }
                                        : p,
                                    ),
                                  };
                                });
                              }}
                            />
                          </motion.div>
                        );
                      },
                    )}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>

      {/* Modals */}
      {showExportModal && songData && (
        <VideoExportModal
          songData={songData}
          onClose={() => setShowExportModal(false)}
          isOpen={true}
          contentMode={contentType}
        />
      )}
    </div>
  );
}
