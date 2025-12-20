import React, { useState } from 'react';
import { FileUpload } from './components/FileUpload';
import { ProcessingStep } from './components/ProcessingStep';
import { ImageGenerator } from './components/ImageGenerator';
import { TimelinePlayer } from './components/TimelinePlayer';
import { TranscriptList } from './components/TranscriptList';
import { VideoExportModal } from './components/VideoExportModal';
import { AppState } from './types';
import {
  Music, RefreshCw, Download, Video, Wand2, Loader2, Palette,
  Languages, Speech, User, Smartphone, Monitor, Menu, X, Sparkles, LayoutDashboard
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useLyricLens } from './hooks/useLyricLens';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';

const ART_STYLES = [
  "Cinematic", "Anime / Manga", "Cyberpunk", "Watercolor",
  "Oil Painting", "Pixel Art", "Surrealist", "Dark Fantasy",
  "Commercial / Ad", "Minimalist / Tutorial", "Comic Book",
  "Corporate / Brand", "Photorealistic"
];

const LANGUAGES = [
  "Spanish", "French", "German", "Japanese", "Korean", "Chinese", "Hindi", "Italian", "Portuguese", "English", "Arabic"
];

export default function App() {
  const {
    appState,
    songData,
    errorMsg,
    isBulkGenerating,
    contentType,
    isTranslating,
    globalSubject,
    aspectRatio,
    setAspectRatio,
    setGlobalSubject,
    setContentType,
    handleFileSelect,
    handleImageGenerated,
    handleGenerateAll,
    handleTranslate,
    loadTestData,
    resetApp
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
    const blob = new Blob([songData.srtContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
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
      <div className="h-16 flex items-center px-6 border-b border-border/50 shrink-0">
        <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center mr-3 shadow-sm border border-primary/20">
          <Music className="text-primary w-5 h-5" />
        </div>
        <span className="font-bold text-lg tracking-tight text-foreground">LyricLens</span>
      </div>

      <ScrollArea className="flex-1 py-6 px-4">
        <div className="space-y-8">

          {/* Section: Configuration */}
          <div className="space-y-4">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-2">Project Config</h3>

            {/* Mode */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground/80 px-2 flex items-center gap-2">
                {contentType === 'music' ? <Music size={14} /> : <Speech size={14} />} Mode
              </label>
              <Select value={contentType} onValueChange={(val: any) => setContentType(val)}>
                <SelectTrigger className="bg-background/50 border-input text-foreground h-10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="music">Music Video</SelectItem>
                  <SelectItem value="story">Story / Speech</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Ratio */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground/80 px-2 flex items-center gap-2">
                {aspectRatio === '16:9' ? <Monitor size={14} /> : <Smartphone size={14} />} Aspect Ratio
              </label>
              <Select value={aspectRatio} onValueChange={setAspectRatio}>
                <SelectTrigger className="bg-background/50 border-input text-foreground h-10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="16:9">16:9 Landscape</SelectItem>
                  <SelectItem value="9:16">9:16 Portrait</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Section: Art Direction */}
          <div className="space-y-4">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-2 flex items-center gap-2">
              <Sparkles size={12} /> Art Direction
            </h3>

            {/* Style */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground/80 px-2">Visual Style</label>
              <Select value={selectedStyle} onValueChange={setSelectedStyle}>
                <SelectTrigger className="bg-background/50 border-input text-foreground h-10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="max-h-[300px]">
                  {ART_STYLES.map(style => (
                    <SelectItem key={style} value={style}>{style}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Subject */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground/80 px-2">Main Subject</label>
              <div className="relative">
                <User size={14} className="absolute left-3 top-3 text-muted-foreground" />
                <Input
                  value={globalSubject}
                  onChange={(e) => setGlobalSubject(e.target.value)}
                  placeholder="e.g. A red robot"
                  className="pl-9 bg-background/50 border-input text-foreground h-10 focus-visible:ring-primary/50"
                />
              </div>
            </div>
          </div>

          {/* Actions (Only in READY) */}
          {appState === AppState.READY && (
            <div className="pt-4 border-t border-border/50 space-y-3">
              <Button
                onClick={onReset}
                variant="outline"
                className="w-full justify-start text-muted-foreground hover:text-foreground border-border bg-transparent hover:bg-muted/50"
              >
                <RefreshCw size={16} className="mr-2" /> New Project
              </Button>
            </div>
          )}

        </div>
      </ScrollArea>

      <div className="p-4 border-t border-border text-[10px] text-muted-foreground font-mono text-center shrink-0">
        Powered by Gemini 2.5 & FFmpeg
      </div>
    </div>
  );

  return (
    // Use h-[100dvh] for mobile browser viewport correctness
    <div className="flex flex-col md:flex-row h-[100dvh] bg-background text-foreground font-sans overflow-hidden">

      {/* Mobile Header */}
      <header className="h-16 px-4 flex items-center justify-between border-b border-border bg-background/80 backdrop-blur-xl md:hidden shrink-0 z-30 relative">
        <div className="flex items-center gap-3">
          <Button size="icon" variant="ghost" onClick={() => setIsSidebarOpen(true)}>
            <Menu size={20} />
          </Button>
          <span className="font-bold text-lg tracking-tight">LyricLens</span>
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
                <Button size="icon" variant="ghost" onClick={() => setIsSidebarOpen(false)} className="h-8 w-8">
                  <X size={18} />
                </Button>
              </div>
              <SidebarContent />
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Desktop Sidebar */}
      <aside className="hidden md:flex w-[280px] bg-card border-r border-border flex-col h-full shrink-0 z-20 shadow-xl">
        <SidebarContent />
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0 bg-secondary/30 relative overflow-hidden min-h-0">

        {/* Desktop Toolbar */}
        <header className="hidden md:flex h-16 border-b border-border/60 bg-background/50 backdrop-blur-xl items-center justify-between px-6 shrink-0 z-10 sticky top-0">
          <div className="flex items-center gap-3">
            {songData ? (
              <div className="flex flex-col">
                <h2 className="font-semibold text-foreground leading-tight truncate max-w-[300px]">{songData.fileName}</h2>
                <span className="text-[10px] text-muted-foreground font-mono uppercase tracking-wider">{contentType} mode</span>
              </div>
            ) : (
              <span className="text-muted-foreground font-medium">New Project</span>
            )}
          </div>

          <div className="flex items-center gap-3">
            {appState === AppState.READY && (
              <>
                <Button onClick={downloadSRT} variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground">
                  <Download size={16} className="mr-2" /> SRT
                </Button>
                <Button
                  onClick={() => setShowExportModal(true)}
                  className="bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg shadow-primary/20"
                >
                  <Video size={16} className="mr-2" /> Export
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
                className="max-w-xl mx-auto mt-10 md:mt-20 flex flex-col items-center text-center px-4"
              >
                <div className="mb-8 relative">
                  <div className="absolute inset-0 bg-primary/20 blur-3xl rounded-full" />
                  <div className="relative bg-card border border-border p-6 rounded-3xl shadow-2xl">
                    <LayoutDashboard size={48} className="text-primary" />
                  </div>
                </div>

                <h1 className="text-3xl md:text-5xl font-bold text-foreground mb-4 tracking-tight">
                  Visualize Your Audio
                </h1>
                <p className="text-base md:text-lg text-muted-foreground mb-10 leading-relaxed max-w-md">
                  Turn your music, stories, or podcasts into stunning AI-generated videos with synchronized lyrics.
                </p>

                <div className="w-full max-w-md space-y-6">
                  <FileUpload onFileSelect={onFileSelect} disabled={false} />

                  <div className="relative">
                    <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-border"></span></div>
                    <div className="relative flex justify-center text-xs uppercase"><span className="bg-background px-2 text-muted-foreground">Or try demo</span></div>
                  </div>

                  <Button onClick={loadTestData} variant="outline" className="w-full border-border hover:bg-muted h-12">
                    <Music size={16} className="mr-2 text-primary" /> Load "The True Saba" Demo
                  </Button>
                </div>
              </motion.div>
            )}

            {/* STATE: PROCESSING */}
            {(appState === AppState.PROCESSING_AUDIO || appState === AppState.ANALYZING_LYRICS) && (
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
                <h3 className="text-destructive font-bold mb-2">Error Processing File</h3>
                <p className="text-sm text-destructive-foreground/80 mb-4">{errorMsg}</p>
                <Button onClick={onReset} variant="destructive">Try Again</Button>
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
                          {LANGUAGES.map(l => <SelectItem key={l} value={l}>{l}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      <Button onClick={onTranslate} disabled={isTranslating} size="sm" variant="ghost" className="h-8 text-xs text-muted-foreground hover:text-foreground">
                        {isTranslating ? <Loader2 size={12} className="animate-spin" /> : 'Translate'}
                      </Button>
                    </div>

                    <TranscriptList
                      subtitles={songData.parsedSubtitles}
                      currentTime={currentTime}
                      onSeek={(time) => { setCurrentTime(time); setIsPlaying(true); }}
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
                      onClick={() => handleGenerateAll(selectedStyle, aspectRatio)}
                      disabled={isBulkGenerating}
                      className="w-full sm:w-auto bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg shadow-primary/20 border-0"
                    >
                      {isBulkGenerating ? (
                        <><Loader2 size={16} className="animate-spin mr-2" /> Generating...</>
                      ) : (
                        <><Wand2 size={16} className="mr-2" /> Generate All</>
                      )}
                    </Button>
                  </div>

                  {/* Image Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {songData.prompts.map((prompt, idx) => {
                      const existing = songData.generatedImages.find(img => img.promptId === prompt.id);
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
                            style={selectedStyle}
                            globalSubject={globalSubject}
                            aspectRatio={aspectRatio}
                          />
                        </motion.div>
                      );
                    })}
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
        />
      )}
    </div>
  );
}