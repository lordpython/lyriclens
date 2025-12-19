import React, { useState } from 'react';
import { FileUpload } from './components/FileUpload';
import { ProcessingStep } from './components/ProcessingStep';
import { ImageGenerator } from './components/ImageGenerator';
import { TimelinePlayer } from './components/TimelinePlayer';
import { TranscriptList } from './components/TranscriptList';
import { VideoExportModal } from './components/VideoExportModal';
import { AppState, SongData, GeneratedImage } from './types';
import { transcribeAudioWithWordTiming, generatePromptsFromLyrics, fileToGenerativePart, generateImageFromPrompt, translateSubtitles } from './services/geminiService';
import { parseSRT, subtitlesToSRT } from './utils/srtParser';
import { Music, RefreshCw, Download, Video, Wand2, Loader2, Palette, Languages } from 'lucide-react';

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
  const [appState, setAppState] = useState<AppState>(AppState.IDLE);
  const [songData, setSongData] = useState<SongData | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showExportModal, setShowExportModal] = useState(false);
  const [isBulkGenerating, setIsBulkGenerating] = useState(false);
  const [selectedStyle, setSelectedStyle] = useState("Cinematic");

  // Translation State
  const [targetLang, setTargetLang] = useState("Spanish");
  const [isTranslating, setIsTranslating] = useState(false);

  // Audio Playback State
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  const handleFileSelect = async (file: File) => {
    try {
      setErrorMsg(null);
      setAppState(AppState.PROCESSING_AUDIO);

      // 1. Setup local preview
      const audioUrl = URL.createObjectURL(file);
      const partialData: SongData = {
        fileName: file.name,
        audioUrl,
        srtContent: '',
        parsedSubtitles: [],
        prompts: [],
        generatedImages: []
      };
      setSongData(partialData);

      // 2. Convert to Base64
      const base64Audio = await fileToGenerativePart(file);

      // 3. Transcribe with word-level timing
      const parsedSubs = await transcribeAudioWithWordTiming(base64Audio, file.type);
      // Generate SRT string for backward compat (downloads, prompts)
      const srt = subtitlesToSRT(parsedSubs);

      partialData.srtContent = srt;
      partialData.parsedSubtitles = parsedSubs;
      setSongData({ ...partialData });

      setAppState(AppState.ANALYZING_LYRICS);

      // 4. Generate Prompts with selected Style
      const prompts = await generatePromptsFromLyrics(srt, selectedStyle);
      partialData.prompts = prompts;
      setSongData({ ...partialData });

      setAppState(AppState.READY);
    } catch (e: any) {
      console.error(e);
      setErrorMsg(e.message || "An unexpected error occurred.");
      setAppState(AppState.ERROR);
    }
  };

  const handleImageGenerated = (newImg: GeneratedImage) => {
    if (!songData) return;
    setSongData(prev => {
      if (!prev) return null;
      if (prev.generatedImages.some(img => img.promptId === newImg.promptId)) return prev;

      return {
        ...prev,
        generatedImages: [...prev.generatedImages, newImg]
      };
    });
  };

  const handleGenerateAll = async () => {
    if (!songData || isBulkGenerating) return;
    setIsBulkGenerating(true);

    const pendingPrompts = songData.prompts.filter(p =>
      !songData.generatedImages.some(img => img.promptId === p.id)
    );

    for (const prompt of pendingPrompts) {
      try {
        const base64 = await generateImageFromPrompt(prompt.text);
        handleImageGenerated({ promptId: prompt.id, imageUrl: base64 });
      } catch (e) {
        console.error(`Failed to generate image for prompt ${prompt.id}`, e);
      }
    }

    setIsBulkGenerating(false);
  };

  const handleTranslate = async () => {
    if (!songData || isTranslating) return;
    setIsTranslating(true);
    try {
      const translations = await translateSubtitles(songData.parsedSubtitles, targetLang);

      // Merge translations
      const updatedSubs = songData.parsedSubtitles.map(sub => {
        const trans = translations.find(t => t.id === sub.id);
        return trans ? { ...sub, translation: trans.translation } : sub;
      });

      setSongData(prev => prev ? { ...prev, parsedSubtitles: updatedSubs } : null);
    } catch (e) {
      console.error("Translation failed", e);
      alert("Translation failed. Please try again.");
    } finally {
      setIsTranslating(false);
    }
  };

  const loadTestData = async () => {
    try {
      setErrorMsg(null);
      setAppState(AppState.PROCESSING_AUDIO);

      // Use browser-compatible test data
      const { createTestSongData } = await import('./utils/testData');
      const testData = createTestSongData();

      setSongData(testData);
      setAppState(AppState.READY);

      console.log('✅ Test data loaded successfully');
    } catch (e: any) {
      console.error('Failed to load test data:', e);
      setErrorMsg('Failed to load test data: ' + e.message);
      setAppState(AppState.ERROR);
    }
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

  const resetApp = () => {
    setAppState(AppState.IDLE);
    setSongData(null);
    setErrorMsg(null);
    setIsPlaying(false);
    setCurrentTime(0);
    setDuration(0);
    setShowExportModal(false);
    setIsBulkGenerating(false);
    setIsTranslating(false);
  };

  return (
    <div className="min-h-screen bg-[#0f172a] text-slate-200 selection:bg-cyan-500/30">

      <header className="fixed top-0 w-full z-50 bg-[#0f172a]/80 backdrop-blur-md border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center">
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
              <h2 className="text-4xl md:text-5xl font-bold text-white mb-4 bg-clip-text text-transparent bg-gradient-to-r from-cyan-400 to-purple-400">
                Visualize Your Music
              </h2>
              <p className="text-lg text-slate-400 mb-8">
                Upload a song to automatically generate synchronized subtitles and create thematic artwork inspired by the lyrics.
              </p>

              {/* Style Selector */}
              <div className="flex items-center justify-center gap-3 mb-8 bg-slate-800/50 p-2 rounded-xl inline-flex border border-slate-700">
                <Palette size={18} className="text-slate-400 ml-2" />
                <span className="text-sm text-slate-300 font-medium">Art Style:</span>
                <select
                  value={selectedStyle}
                  onChange={(e) => setSelectedStyle(e.target.value)}
                  className="bg-transparent text-white text-sm font-semibold focus:outline-none cursor-pointer p-1"
                >
                  {ART_STYLES.map(style => (
                    <option key={style} value={style} className="bg-slate-800 text-white">
                      {style}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <FileUpload
              onFileSelect={handleFileSelect}
              disabled={false}
            />

            {/* Test Data Button */}
            <div className="text-center mt-6">
              <button
                onClick={loadTestData}
                className="px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white font-semibold rounded-xl transition-all shadow-lg shadow-purple-900/30 flex items-center gap-2 mx-auto"
              >
                <Music size={18} />
                Load Test Data
              </button>
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
                <button
                  onClick={resetApp}
                  className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg text-sm font-medium transition-colors"
                >
                  Try Again
                </button>
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
                  <button
                    onClick={downloadSRT}
                    className="text-xs text-slate-400 hover:text-white flex items-center gap-1 transition-colors bg-slate-800 px-2 py-1 rounded"
                    title="Download SRT"
                  >
                    <Download size={14} /> <span className="hidden sm:inline">SRT</span>
                  </button>
                  <button
                    onClick={() => setShowExportModal(true)}
                    className="text-xs text-white bg-cyan-600 hover:bg-cyan-500 flex items-center gap-1 transition-colors px-2 py-1 rounded shadow-lg shadow-cyan-900/20 font-medium"
                    title="Export Video"
                  >
                    <Video size={14} /> <span className="hidden sm:inline">Export Video</span>
                  </button>
                  <button onClick={resetApp} className="text-xs text-slate-400 hover:text-cyan-400 flex items-center gap-1 transition-colors bg-slate-800 px-2 py-1 rounded">
                    <RefreshCw size={14} />
                  </button>
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
              <div className="flex items-center gap-2 bg-slate-800/50 p-3 rounded-xl border border-slate-700">
                <Languages size={18} className="text-slate-400" />
                <select
                  value={targetLang}
                  onChange={(e) => setTargetLang(e.target.value)}
                  className="bg-transparent text-sm text-white font-medium focus:outline-none flex-1"
                >
                  {LANGUAGES.map(lang => (
                    <option key={lang} value={lang} className="bg-slate-800">{lang}</option>
                  ))}
                </select>
                <button
                  onClick={handleTranslate}
                  disabled={isTranslating}
                  className="text-xs px-3 py-1.5 bg-slate-700 hover:bg-slate-600 rounded-lg text-white font-medium transition-colors disabled:opacity-50"
                >
                  {isTranslating ? <Loader2 size={14} className="animate-spin" /> : 'Translate'}
                </button>
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
                    <span className="text-xs px-2 py-0.5 rounded-full bg-slate-700 text-slate-300 border border-slate-600">
                      {selectedStyle}
                    </span>
                  </div>
                  <p className="text-slate-400 text-sm">
                    Generated image patch based on song structure ({songData.prompts.length} scenes).
                  </p>
                </div>

                <button
                  onClick={handleGenerateAll}
                  disabled={isBulkGenerating}
                  className="flex items-center justify-center gap-2 px-4 py-2 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 disabled:opacity-50 text-white text-sm font-bold rounded-xl transition-all shadow-lg shadow-indigo-900/30 whitespace-nowrap"
                >
                  {isBulkGenerating ? (
                    <><Loader2 size={16} className="animate-spin" /> Generating All...</>
                  ) : (
                    <><Wand2 size={16} /> Generate All Art</>
                  )}
                </button>
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
                    <p className="text-slate-500">No prompts could be generated from the lyrics.</p>
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
          />
        )}

      </main>
    </div>
  );
}