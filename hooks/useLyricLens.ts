import { useState } from 'react';
import { AppState, SongData, GeneratedImage } from '../types';
import { 
  transcribeAudioWithWordTiming, 
  generatePromptsFromLyrics, 
  generatePromptsFromStory, 
  fileToGenerativePart, 
  generateImageFromPrompt, 
  translateSubtitles 
} from '../services/geminiService';
import { subtitlesToSRT } from '../utils/srtParser';

export function useLyricLens() {
  const [appState, setAppState] = useState<AppState>(AppState.IDLE);
  const [songData, setSongData] = useState<SongData | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isBulkGenerating, setIsBulkGenerating] = useState(false);
  const [contentType, setContentType] = useState<"music" | "story">("music");
  const [globalSubject, setGlobalSubject] = useState("");
  const [aspectRatio, setAspectRatio] = useState("16:9");
  
  // Translation State
  const [isTranslating, setIsTranslating] = useState(false);

  const handleFileSelect = async (file: File, selectedStyle: string) => {
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

      // 4. Generate Prompts based on Content Type
      let prompts;
      if (contentType === 'story') {
        prompts = await generatePromptsFromStory(srt, selectedStyle);
      } else {
        prompts = await generatePromptsFromLyrics(srt, selectedStyle);
      }
      
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

  const handleGenerateAll = async (selectedStyle: string, selectedAspectRatio: string) => {
    if (!songData || isBulkGenerating) return;
    setIsBulkGenerating(true);

    const pendingPrompts = songData.prompts.filter(p =>
      !songData.generatedImages.some(img => img.promptId === p.id)
    );

    for (const prompt of pendingPrompts) {
      try {
        const base64 = await generateImageFromPrompt(prompt.text, selectedStyle, globalSubject, selectedAspectRatio);
        handleImageGenerated({ promptId: prompt.id, imageUrl: base64 });
      } catch (e) {
        console.error(`Failed to generate image for prompt ${prompt.id}`, e);
      }
    }

    setIsBulkGenerating(false);
  };

  const handleTranslate = async (targetLang: string) => {
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
      const { createTestSongData } = await import('../utils/testData');
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

  const resetApp = () => {
    setAppState(AppState.IDLE);
    setSongData(null);
    setErrorMsg(null);
    setIsBulkGenerating(false);
    setIsTranslating(false);
    setGlobalSubject("");
    setAspectRatio("16:9");
  };

  return {
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
  };
}