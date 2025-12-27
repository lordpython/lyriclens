import React, { useState, useCallback, Suspense, lazy } from "react";
import { useLyricLens } from "./hooks/useLyricLens";
import { AnimatePresence } from "framer-motion";
import { type VideoPurpose } from "./constants";
import { AppLayout, Sidebar, Header, MainContent } from "./components/layout";
import { ErrorBoundary } from "./components/ErrorBoundary";

// Lazy load heavy components to reduce initial bundle size
const VideoExportModal = lazy(() => import("./components/VideoExportModal").then(m => ({ default: m.VideoExportModal })));
const IntroAnimation = lazy(() => import("./components/IntroAnimation").then(m => ({ default: m.IntroAnimation })));

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
    videoPurpose,
    setGenerationMode,
    videoProvider,
    setVideoProvider,
    setAspectRatio,
    setGlobalSubject,
    setContentType,
    setVideoPurpose,
    processFile,
    handleImageGenerated,
    handleGenerateAll,
    handleTranslate,
    loadTestData,
    resetApp,
  } = useLyricLens();

  // UI-specific state
  const [showIntro, setShowIntro] = useState(true);
  const [showExportModal, setShowExportModal] = useState(false);
  const [selectedStyle, setSelectedStyle] = useState("Cinematic");
  const [targetLang, setTargetLang] = useState("Spanish");
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Quick start handler - file + aspect ratio, then auto-process with defaults
  // File is passed directly to processFile to avoid race condition with state updates
  const handleQuickStart = useCallback((file: File, ratio: string) => {
    setAspectRatio(ratio);
    // Pass file directly to processFile - no setTimeout needed
    processFile(file, selectedStyle);
  }, [setAspectRatio, processFile, selectedStyle]);

  // Demo handler with aspect ratio
  const handleLoadDemo = useCallback((ratio: string) => {
    setAspectRatio(ratio);
    loadTestData();
  }, [loadTestData, setAspectRatio]);

  // Handlers
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

  // Memoized handler for asset type changes - prevents ImageGenerator re-renders
  const handleAssetTypeChange = useCallback((promptId: string, assetType: import("./types").AssetType) => {
    setSongData((prev: import("./types").SongData | null) => {
      if (!prev) return prev;
      return {
        ...prev,
        prompts: prev.prompts.map((p: import("./types").ImagePrompt) =>
          p.id === promptId ? { ...p, assetType } : p,
        ),
      };
    });
  }, [setSongData]);

  return (
    <>
      {/* Intro Animation */}
      <AnimatePresence>
        {showIntro && (
          <Suspense fallback={<div className="fixed inset-0 bg-slate-900 z-50" />}>
            <IntroAnimation onComplete={() => setShowIntro(false)} />
          </Suspense>
        )}
      </AnimatePresence>

      {/* Main App */}
      <AppLayout
        isSidebarOpen={isSidebarOpen}
        onSidebarToggle={setIsSidebarOpen}
        sidebar={
          <ErrorBoundary>
            <Sidebar
              appState={appState}
              contentType={contentType}
              videoPurpose={videoPurpose as VideoPurpose}
              generationMode={generationMode}
              videoProvider={videoProvider}
              aspectRatio={aspectRatio}
              selectedStyle={selectedStyle}
              globalSubject={globalSubject}
              onContentTypeChange={setContentType}
              onVideoPurposeChange={(purpose: VideoPurpose) => setVideoPurpose(purpose)}
              onGenerationModeChange={setGenerationMode}
              onVideoProviderChange={setVideoProvider}
              onAspectRatioChange={setAspectRatio}
              onStyleChange={setSelectedStyle}
              onGlobalSubjectChange={setGlobalSubject}
              onReset={onReset}
            />
          </ErrorBoundary>
        }
        header={
          <Header
            songData={songData}
            contentType={contentType}
            appState={appState}
            onDownloadSRT={downloadSRT}
            onExportVideo={() => setShowExportModal(true)}
          />
        }
      >
        <ErrorBoundary>
          <MainContent
            appState={appState}
            songData={songData}
            errorMsg={errorMsg}
            isBulkGenerating={isBulkGenerating}
            isTranslating={isTranslating}
            selectedStyle={selectedStyle}
            targetLang={targetLang}
            generationMode={generationMode}
            videoProvider={videoProvider}
            aspectRatio={aspectRatio}
            globalSubject={globalSubject}
            isPlaying={isPlaying}
            currentTime={currentTime}
            duration={duration}
            contentType={contentType}
            videoPurpose={videoPurpose}
            onQuickStart={handleQuickStart}
            onLoadDemo={handleLoadDemo}
            onImageGenerated={handleImageGenerated}
            onGenerateAll={() => handleGenerateAll(selectedStyle, aspectRatio)}
            onTranslate={onTranslate}
            onAssetTypeChange={handleAssetTypeChange}
            onPlayStateChange={setIsPlaying}
            onTimeUpdate={setCurrentTime}
            onDurationChange={setDuration}
            onTargetLangChange={setTargetLang}
            onReset={onReset}
          />
        </ErrorBoundary>
      </AppLayout>

      {/* Modals */}
      {showExportModal && songData && (
        <Suspense fallback={null}>
          <VideoExportModal
            songData={songData}
            onClose={() => setShowExportModal(false)}
            isOpen={true}
            contentMode={contentType}
          />
        </Suspense>
      )}
    </>
  );
}
