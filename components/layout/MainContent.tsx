import React, { Suspense, lazy } from "react";
import {
  Music,
  Wand2,
  Loader2,
  Sparkles,
  LayoutDashboard,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { motion, AnimatePresence } from "framer-motion";
import { AppState, SongData, AssetType } from "../../types";
import { LANGUAGES } from "../../constants";
import { FileUpload } from "../FileUpload";
import { ProcessingStep } from "../ProcessingStep";
import { ImageGenerator } from "../ImageGenerator";
import { TimelinePlayer } from "../TimelinePlayer";
import { TranscriptList } from "../TranscriptList";

// Lazy load heavy components
const ConfigurationWizard = lazy(() =>
  import("../ConfigurationWizard").then((m) => ({ default: m.ConfigurationWizard }))
);

export interface MainContentProps {
  appState: AppState;
  songData: SongData | null;
  errorMsg: string;
  pendingFile: File | null;
  isBulkGenerating: boolean;
  isTranslating: boolean;
  selectedStyle: string;
  targetLang: string;
  generationMode: "image" | "video";
  videoProvider: "veo" | "deapi";
  aspectRatio: string;
  globalSubject: string;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  contentType: "music" | "story";
  videoPurpose: string;
  artStyles: readonly string[];
  videoPurposes: Array<{ value: string; label: string; description: string }>;
  onFileSelect: (file: File) => void;
  onConfigComplete: () => void;
  onConfigCancel: () => void;
  onImageGenerated: (promptId: string, imageUrl: string, type?: "image" | "video") => void;
  onGenerateAll: () => void;
  onTranslate: () => void;
  onAssetTypeChange: (promptId: string, assetType: AssetType) => void;
  onLoadTestData: () => void;
  onPlayStateChange: (playing: boolean) => void;
  onTimeUpdate: (time: number) => void;
  onDurationChange: (duration: number) => void;
  onTargetLangChange: (lang: string) => void;
  onReset: () => void;
  // Configuration wizard props
  setContentType: (type: "music" | "story") => void;
  setVideoPurpose: (purpose: string) => void;
  setAspectRatio: (ratio: string) => void;
  setGenerationMode: (mode: "image" | "video") => void;
  setVideoProvider: (provider: "veo" | "deapi") => void;
  directorMode: "chain" | "agent";
  setDirectorMode: (mode: "chain" | "agent") => void;
  setGlobalSubject: (subject: string) => void;
  setSelectedStyle: (style: string) => void;
}

export const MainContent: React.FC<MainContentProps> = ({
  appState,
  songData,
  errorMsg,
  pendingFile,
  isBulkGenerating,
  isTranslating,
  selectedStyle,
  targetLang,
  generationMode,
  videoProvider,
  aspectRatio,
  globalSubject,
  isPlaying,
  currentTime,
  duration,
  contentType,
  videoPurpose,
  artStyles,
  videoPurposes,
  onFileSelect,
  onConfigComplete,
  onConfigCancel,
  onImageGenerated,
  onGenerateAll,
  onTranslate,
  onAssetTypeChange,
  onLoadTestData,
  onPlayStateChange,
  onTimeUpdate,
  onDurationChange,
  onTargetLangChange,
  onReset,
  setContentType,
  setVideoPurpose,
  setAspectRatio,
  setGenerationMode,
  setVideoProvider,
  directorMode,
  setDirectorMode,
  setGlobalSubject,
  setSelectedStyle,
}) => {
  return (
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
              <div className="absolute inset-0 bg-linear-to-r from-primary/30 via-accent/20 to-primary/30 blur-3xl rounded-full animate-pulse" />
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
                  onClick={onLoadTestData}
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

        {/* STATE: CONFIGURING */}
        {appState === AppState.CONFIGURING && pendingFile && (
          <Suspense
            fallback={
              <div className="flex items-center justify-center h-64">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              </div>
            }
          >
            <ConfigurationWizard
              fileName={pendingFile.name}
              onComplete={onConfigComplete}
              onCancel={onConfigCancel}
              contentType={contentType}
              setContentType={setContentType}
              videoPurpose={videoPurpose}
              setVideoPurpose={setVideoPurpose}
              aspectRatio={aspectRatio}
              setAspectRatio={setAspectRatio}
              generationMode={generationMode}
              setGenerationMode={setGenerationMode}
              videoProvider={videoProvider}
              setVideoProvider={setVideoProvider}
              directorMode={directorMode}
              setDirectorMode={setDirectorMode}
              globalSubject={globalSubject}
              setGlobalSubject={setGlobalSubject}
              selectedStyle={selectedStyle}
              setSelectedStyle={setSelectedStyle}
              artStyles={artStyles}
              videoPurposes={videoPurposes}
            />
          </Suspense>
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
                  onPlayPause={() => onPlayStateChange(!isPlaying)}
                  onSeek={(time) => onTimeUpdate(time)}
                  onTimeUpdate={(time) => onTimeUpdate(time)}
                  onDurationChange={(dur) => onDurationChange(dur)}
                  onEnded={() => onPlayStateChange(false)}
                  contentMode={contentType}
                />
              </div>

              {/* Translation & Transcript */}
              <div className="bg-card/30 border border-border/50 rounded-2xl p-4 flex-1 flex flex-col min-h-[400px]">
                <div className="flex items-center gap-2 mb-4">
                  <Select value={targetLang} onValueChange={onTargetLangChange}>
                    <SelectTrigger
                      aria-label="Translation language"
                      className="h-8 bg-card border-input text-xs w-[120px]"
                    >
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
                    onTimeUpdate(time);
                    onPlayStateChange(true);
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
                  onClick={onGenerateAll}
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
                      }) => img.promptId === prompt.id
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
                          onImageGenerated={onImageGenerated}
                          existingImage={existing?.imageUrl}
                          existingType={existing?.type}
                          existingBaseImage={existing?.baseImageUrl}
                          style={selectedStyle}
                          globalSubject={globalSubject}
                          aspectRatio={aspectRatio}
                          generationMode={generationMode}
                          videoProvider={videoProvider}
                          siblingPromptTexts={siblingPromptTexts}
                          onAssetTypeChange={onAssetTypeChange}
                        />
                      </motion.div>
                    );
                  }
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
