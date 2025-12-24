import React, { useState, useCallback, Suspense, lazy } from "react";
import { useLyricLens } from "./hooks/useLyricLens";
import { AnimatePresence } from "framer-motion";
import { ART_STYLES, VIDEO_PURPOSES, type VideoPurpose } from "./constants";
import { AppLayout, Sidebar, Header, MainContent } from "./components/layout";

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
    directorMode,
    setDirectorMode,
    setAspectRatio,
    setGlobalSubject,
    setContentType,
    setVideoPurpose,
    handleFileSelect,
    startProcessing,
    pendingFile,
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
  const [isSidebarOpen, setIsSidebarOpen] = useState(false); // Default closed on mobile

  // Handlers
  const onFileSelect = (file: File) => handleFileSelect(file);
  const onConfigComplete = () => startProcessing(selectedStyle);
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
    setSongData((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        prompts: prev.prompts.map((p) =>
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
            onVideoPurposeChange={(purpose) => setVideoPurpose(purpose)}
            onGenerationModeChange={setGenerationMode}
            onVideoProviderChange={setVideoProvider}
            onAspectRatioChange={setAspectRatio}
            onStyleChange={setSelectedStyle}
            onGlobalSubjectChange={setGlobalSubject}
            onReset={onReset}
          />
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
        <MainContent
          appState={appState}
          songData={songData}
          errorMsg={errorMsg}
          pendingFile={pendingFile}
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
          artStyles={ART_STYLES}
          videoPurposes={VIDEO_PURPOSES}
          onFileSelect={onFileSelect}
          onConfigComplete={onConfigComplete}
          onConfigCancel={onReset}
          onImageGenerated={handleImageGenerated}
          onGenerateAll={() => handleGenerateAll(selectedStyle, aspectRatio)}
          onTranslate={onTranslate}
          onAssetTypeChange={handleAssetTypeChange}
          onLoadTestData={loadTestData}
          onPlayStateChange={setIsPlaying}
          onTimeUpdate={setCurrentTime}
          onDurationChange={setDuration}
          onTargetLangChange={setTargetLang}
          onReset={onReset}
          setContentType={setContentType}
          setVideoPurpose={setVideoPurpose}
          setAspectRatio={setAspectRatio}
          setGenerationMode={setGenerationMode}
          setVideoProvider={setVideoProvider}
          directorMode={directorMode}
          setDirectorMode={setDirectorMode}
          setGlobalSubject={setGlobalSubject}
          setSelectedStyle={setSelectedStyle}
        />
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
