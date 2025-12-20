import React, { useState } from 'react';
import { FileUpload } from './components/FileUpload';
import { ProcessingStep } from './components/ProcessingStep';
import { ImageGenerator } from './components/ImageGenerator';
import { TimelinePlayer } from './components/TimelinePlayer';
import { TranscriptList } from './components/TranscriptList';
import { VideoExportModal } from './components/VideoExportModal';
import { AppState } from './types';
import { Music, RefreshCw, Download, Video, Wand2, Loader2, Palette, Languages, Speech } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useLyricLens } from './hooks/useLyricLens';

const ART_STYLES = [
  "Cinematic",
  "Anime / Manga",
  "Cyberpunk",
  "Watercolor",
  "Oil Painting",
  "Pixel Art",
  "Surrealist",
  "Dark Fantasy"
];

const LANGUAGES = [
  "Spanish", "French", "German", "Japanese", "Korean", "Chinese", "Hindi", "Italian", "Portuguese", "English", "Arabic"
];

export default function App() {
  // Use the custom hook for business logic
  const {
    appState,
    songData,
    errorMsg,
    isBulkGenerating,
    contentType,
    isTranslating,
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
  
  // Audio Playback State (kept in UI as it drives the player directly)
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  // Wrapper handlers to pass UI state to the hook
  const onFileSelect = (file: File) => {
    handleFileSelect(file, selectedStyle);
  };

  const onTranslate = () => {
    handleTranslate(targetLang);
  };

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

  return (
    <div className="min-h-screen bg-[#0f172a] text-slate-200 selection:bg-cyan-500/30">

      <header className="fixed top-0 w-full z-50 bg-[#0f172a]/80 backdrop-blur-md border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-linear-to-tr from-cyan-500 to-blue-600 flex items-center justify-center">
              <Music className="text-white w-5 h-5" />
            </div>
            <h1 className="font-bold text-xl tracking-tight text-white">LyricLens</h1>
          </div>
          <div className="text-xs font-mono text-slate-500 hidden sm:block">
            Powered by Gemini 2.5
          </div>
        </div>
      </header>

      <main className="pt-24 pb-20 px-4 max-w-7xl mx-auto">

        {appState === AppState.IDLE && (
          <div className="max-w-2xl mx-auto mt-20 fade-in">
            <div className="text-center mb-10">
              <h2 className="text-4xl md:text-5xl font-bold text-white mb-4 bg-clip-text text-transparent bg-linear-to-r from-cyan-400 to-purple-400">
                Visualize Your Audio
              </h2>
              <p className="text-lg text-slate-400 mb-8">
                Upload audio to automatically generate synchronized transcripts and create thematic artwork inspired by the content.
              </p>

              <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-8">
                {/* Content Mode Selector */}
                <div className="flex items-center gap-2 bg-slate-800/50 p-1 pl-3 rounded-xl border border-slate-700">
                  {contentType === 'music' ? <Music size={18} className="text-slate-400" /> : <Speech size={18} className="text-slate-400" />}
                  <span className="text-sm text-slate-300 font-medium shrink-0">Mode:</span>
                  <Select value={contentType} onValueChange={(val: "music" | "story") => setContentType(val)}>
                    <SelectTrigger className="w-[140px] h-8 bg-transparent border-0 text-white font-semibold focus:ring-0 focus:ring-offset-0 px-2 shadow-none">
                      <SelectValue placeholder="Select mode" />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-800 border-slate-700 text-slate-200">
                      <SelectItem value="music" className="focus:bg-slate-700 focus:text-white cursor-pointer">Music Video</SelectItem>
                      <SelectItem value="story" className="focus:bg-slate-700 focus:text-white cursor-pointer">Story / Speech</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Style Selector */}
                <div className="flex items-center gap-2 bg-slate-800/50 p-1 pl-3 rounded-xl border border-slate-700">
                  <Palette size={18} className="text-slate-400" />
                  <span className="text-sm text-slate-300 font-medium shrink-0">Style:</span>
                  <Select value={selectedStyle} onValueChange={setSelectedStyle}>
                    <SelectTrigger className="w-[160px] h-8 bg-transparent border-0 text-white font-semibold focus:ring-0 focus:ring-offset-0 px-2 shadow-none">
                      <SelectValue placeholder="Select style" />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-800 border-slate-700 text-slate-200">
                      {ART_STYLES.map(style => (
                        <SelectItem key={style} value={style} className="focus:bg-slate-700 focus:text-white cursor-pointer">
                          {style}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
            <FileUpload
              onFileSelect={onFileSelect}
              disabled={false}
            />

            {/* Test Data Button */}
            <div className="text-center mt-6">
              <Button
                onClick={loadTestData}
                className="px-6 py-6 bg-linear-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white font-semibold rounded-xl transition-all shadow-lg shadow-purple-900/30 w-auto text-base"
              >
                <Music size={18} className="mr-2" />
                Load Test Data
              </Button>
              <p className="text-xs text-slate-500 mt-2">
                Loads "the true Saba" with pre-generated artwork
              </p>
            </div>
          </div>
        )}

        {(appState === AppState.PROCESSING_AUDIO || appState === AppState.ANALYZING_LYRICS || appState === AppState.ERROR) && (
          <div className="mt-20">
            {appState === AppState.ERROR ? (
              <div className="max-w-md mx-auto p-6 bg-red-500/10 border border-red-500/20 rounded-xl text-center">
                <h3 className="text-red-400 font-bold mb-2">Error Processing File</h3>
                <p className="text-sm text-red-200 mb-4">{errorMsg}</p>
                <Button
                  onClick={onReset}
                  variant="destructive"
                  className="bg-red-600 hover:bg-red-500"
                >
                  Try Again
                </Button>
              </div>
            ) : (
              <ProcessingStep currentStep={appState} />
            )}
          </div>
        )}

        {appState === AppState.READY && songData && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 animate-in fade-in slide-in-from-bottom-4 duration-700">

            <div className="lg:col-span-5 flex flex-col gap-6">
              <div className="flex items-center justify-between">
                <h2 className="font-semibold text-white truncate max-w-[200px]" title={songData.fileName}>{songData.fileName}</h2>
                <div className="flex gap-2">
                  <Button
                    onClick={downloadSRT}
                    variant="outline" // Using secondary/outline with custom styling override if needed, or just keeping it consistent
                    className="text-xs text-slate-400 hover:text-white border-slate-700 bg-slate-800 h-8"
                    title="Download SRT"
                  >
                    <Download size={14} className="mr-1" /> <span className="hidden sm:inline">SRT</span>
                  </Button>
                  <Button
                    onClick={() => setShowExportModal(true)}
                    className="text-xs text-white bg-cyan-600 hover:bg-cyan-500 border-0 shadow-lg shadow-cyan-900/20 font-medium h-8"
                    title="Export Video"
                  >
                    <Video size={14} className="mr-1" /> <span className="hidden sm:inline">Export Video</span>
                  </Button>
                  <Button
                    onClick={onReset}
                    variant="ghost"
                    size="icon"
                    className="text-slate-400 hover:text-cyan-400 bg-slate-800 h-8 w-8"
                  >
                    <RefreshCw size={14} />
                  </Button>
                </div>
              </div>

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

              {/* Translation Controls */}
              <div className="flex items-center gap-2 bg-slate-800/50 p-1.5 pl-3 rounded-xl border border-slate-700">
                <Languages size={18} className="text-slate-400 shrink-0" />
                <Select value={targetLang} onValueChange={setTargetLang}>
                  <SelectTrigger className="w-full h-8 bg-transparent border-0 text-white font-medium focus:ring-0 focus:ring-offset-0 px-2 shadow-none">
                    <SelectValue placeholder="Language" />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-800 border-slate-700 text-slate-200">
                    {LANGUAGES.map(lang => (
                      <SelectItem key={lang} value={lang} className="focus:bg-slate-700 focus:text-white">
                        {lang}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  onClick={onTranslate}
                  disabled={isTranslating}
                  size="sm"
                  className="px-3 bg-slate-700 hover:bg-slate-600 text-white font-medium h-8"
                >
                  {isTranslating ? <Loader2 size={14} className="animate-spin" /> : 'Translate'}
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

            <div className="lg:col-span-7">
              <div className="mb-6 border-b border-slate-800 pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="text-xl font-bold text-white">Visual Storyboard</h3>
                    <Badge variant="secondary" className="bg-slate-700 text-slate-300 border-slate-600 hover:bg-slate-600">
                      {selectedStyle}
                    </Badge>
                  </div>
                  <p className="text-slate-400 text-sm">
                    Generated image patch based on {contentType === 'music' ? 'song' : 'narrative'} structure ({songData.prompts.length} scenes).
                  </p>
                </div>

                <Button
                  onClick={handleGenerateAll}
                  disabled={isBulkGenerating}
                  className="bg-linear-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 disabled:opacity-50 text-white text-sm font-bold shadow-lg shadow-indigo-900/30 whitespace-nowrap border-0"
                >
                  {isBulkGenerating ? (
                    <><Loader2 size={16} className="animate-spin mr-2" /> Generating All...</>
                  ) : (
                    <><Wand2 size={16} className="mr-2" /> Generate All Art</>
                  )}
                </Button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {songData.prompts.map(prompt => {
                  const existing = songData.generatedImages.find(img => img.promptId === prompt.id);
                  return (
                    <ImageGenerator
                      key={prompt.id}
                      prompt={prompt}
                      onImageGenerated={handleImageGenerated}
                      existingImage={existing?.imageUrl}
                    />
                  );
                })}

                {songData.prompts.length === 0 && (
                  <div className="col-span-2 p-12 text-center border border-dashed border-slate-700 rounded-xl">
                    <p className="text-slate-500">No prompts could be generated from the transcript.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {showExportModal && songData && (
          <VideoExportModal
            songData={songData}
            onClose={() => setShowExportModal(false)}
            isOpen={true}
          />
        )}

      </main>
    </div>
  );
}