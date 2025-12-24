import { useState } from "react";
import { AppState, SongData, GeneratedImage, AssetType } from "../types";
import {
  transcribeAudioWithWordTiming,
  fileToGenerativePart,
  generateImageFromPrompt,
  generateVideoFromPrompt,
  refineImagePrompt,
  translateSubtitles,
  generateMotionPrompt,
  VideoPurpose,
} from "../services/geminiService";
import { generatePromptsWithLangChain } from "../services/directorService";
import { animateImageWithDeApi } from "../services/deapiService";
import { subtitlesToSRT } from "../utils/srtParser";

export function useLyricLens() {
  const [appState, setAppState] = useState<AppState>(AppState.IDLE);
  const [songData, setSongData] = useState<SongData | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isBulkGenerating, setIsBulkGenerating] = useState(false);
  const [contentType, setContentType] = useState<"music" | "story">("music");
  const [globalSubject, setGlobalSubject] = useState("");
  const [aspectRatio, setAspectRatio] = useState("16:9");
  const [videoPurpose, setVideoPurpose] = useState<VideoPurpose>("music_video");
  const [generationMode, setGenerationMode] = useState<"image" | "video">(
    "image",
  );
  const [videoProvider, setVideoProvider] = useState<"veo" | "deapi">("veo");
  const [pendingFile, setPendingFile] = useState<File | null>(null);

  // Translation State
  const [isTranslating, setIsTranslating] = useState(false);

  const handleFileSelect = (file: File) => {
    setErrorMsg(null);
    setPendingFile(file);
    setAppState(AppState.CONFIGURING);
  };

  const startProcessing = async (selectedStyle: string) => {
    if (!pendingFile) return;
    const file = pendingFile;

    try {
      setErrorMsg(null);
      setAppState(AppState.PROCESSING_AUDIO);

      // 1. Setup local preview
      const audioUrl = URL.createObjectURL(file);
      const partialData: SongData = {
        fileName: file.name,
        audioUrl,
        srtContent: "",
        parsedSubtitles: [],
        prompts: [],
        generatedImages: [],
      };
      setSongData(partialData);

      // 2. Convert to Base64
      const base64Audio = await fileToGenerativePart(file);

      // 3. Transcribe with word-level timing
      const parsedSubs = await transcribeAudioWithWordTiming(
        base64Audio,
        file.type,
      );
      // Generate SRT string for backward compat (downloads, prompts)
      const srt = subtitlesToSRT(parsedSubs);

      partialData.srtContent = srt;
      partialData.parsedSubtitles = parsedSubs;
      setSongData({ ...partialData });

      setAppState(AppState.ANALYZING_LYRICS);

      // 4. Generate Prompts using LangChain Director workflow
      // The generatePromptsWithLangChain function handles both lyrics and story content types
      // and automatically falls back to the original implementation on errors
      const prompts = await generatePromptsWithLangChain(
        srt,
        selectedStyle,
        contentType === "story" ? "story" : "lyrics",
        videoPurpose,
        globalSubject,
      );

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
    setSongData((prev) => {
      if (!prev) return null;
      // Remove existing if replacing
      const filtered = prev.generatedImages.filter(
        (img) => img.promptId !== newImg.promptId,
      );

      return {
        ...prev,
        generatedImages: [...filtered, newImg],
      };
    });
  };

  const handleGenerateAll = async (
    selectedStyle: string,
    selectedAspectRatio: string,
  ) => {
    if (!songData || isBulkGenerating) return;
    setIsBulkGenerating(true);

    const pendingPrompts = songData.prompts.filter(
      (p) => !songData.generatedImages.some((img) => img.promptId === p.id),
    );

    // Track refined prompts for cross-scene deduplication
    const refinedPromptTexts: string[] = [];

    // Collect all existing prompt texts (from already-generated scenes) as initial context
    const existingPromptTexts = songData.prompts
      .filter((p) =>
        songData.generatedImages.some((img) => img.promptId === p.id),
      )
      .map((p) => p.text);

    refinedPromptTexts.push(...existingPromptTexts);

    for (const prompt of pendingPrompts) {
      try {
        // First, refine the prompt with cross-scene awareness
        const { refinedPrompt } = await refineImagePrompt({
          promptText: prompt.text,
          style: selectedStyle,
          globalSubject,
          aspectRatio: selectedAspectRatio,
          intent: "auto",
          previousPrompts: refinedPromptTexts,
        });

        // Track the refined prompt for subsequent scenes
        refinedPromptTexts.push(refinedPrompt);

        // Determine asset type: use per-card setting if available, otherwise fall back to global
        const getAssetTypeForPrompt = (): AssetType => {
          if (prompt.assetType) return prompt.assetType;
          if (generationMode === "video") {
            return videoProvider === "deapi" ? "video_with_image" : "video";
          }
          return "image";
        };

        const assetType = getAssetTypeForPrompt();
        let base64: string;
        let baseImageUrl: string | undefined;
        let resultType: "image" | "video" = "image";

        if (assetType === "video") {
          // Direct video generation (Veo)
          base64 = await generateVideoFromPrompt(
            refinedPrompt,
            selectedStyle,
            globalSubject,
            selectedAspectRatio,
          );
          resultType = "video";
        } else if (assetType === "video_with_image") {
          // Two-step: Image first, then animate (DeAPI)
          // 1. Generate Image (Gemini)
          const imgBase64 = await generateImageFromPrompt(
            refinedPrompt,
            selectedStyle,
            globalSubject,
            selectedAspectRatio,
            true,
          );
          baseImageUrl = imgBase64;

          // 2. Generate motion-optimized prompt for animation
          const motionPrompt = await generateMotionPrompt(
            refinedPrompt,
            prompt.mood || "cinematic",
            globalSubject,
          );

          // 3. Animate with motion-focused prompt (DeAPI)
          base64 = await animateImageWithDeApi(
            imgBase64,
            motionPrompt,
            selectedAspectRatio as "16:9" | "9:16" | "1:1",
          );
          resultType = "video";
        } else {
          // Standard Image Generation
          base64 = await generateImageFromPrompt(
            refinedPrompt,
            selectedStyle,
            globalSubject,
            selectedAspectRatio,
            true, // skipRefine - already refined above with previousPrompts
          );
          resultType = "image";
        }

        handleImageGenerated({
          promptId: prompt.id,
          imageUrl: base64,
          type: resultType,
          baseImageUrl,
        });
      } catch (e) {
        console.error(`Failed to generate asset for prompt ${prompt.id}`, e);
      }
    }

    setIsBulkGenerating(false);
  };

  const handleTranslate = async (targetLang: string) => {
    if (!songData || isTranslating) return;
    setIsTranslating(true);
    try {
      const translations = await translateSubtitles(
        songData.parsedSubtitles,
        targetLang,
      );

      // Merge translations
      const updatedSubs = songData.parsedSubtitles.map((sub) => {
        const trans = translations.find((t) => t.id === sub.id);
        return trans ? { ...sub, translation: trans.translation } : sub;
      });

      setSongData((prev) =>
        prev ? { ...prev, parsedSubtitles: updatedSubs } : null,
      );
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
      const { createTestSongData } = await import("../utils/testData");
      const testData = createTestSongData();

      setSongData(testData);
      setAppState(AppState.READY);

      console.log("✅ Test data loaded successfully");
    } catch (e: any) {
      console.error("Failed to load test data:", e);
      setErrorMsg("Failed to load test data: " + e.message);
      setAppState(AppState.ERROR);
    }
  };

  const resetApp = () => {
    setAppState(AppState.IDLE);
    setSongData(null);
    setPendingFile(null);
    setErrorMsg(null);
    setIsBulkGenerating(false);
    setIsTranslating(false);
    setGlobalSubject("");
    setAspectRatio("16:9");
    setGenerationMode("image");
    setVideoProvider("veo");
    setVideoPurpose("music_video");
  };

  return {
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
    handleFileSelect,
    startProcessing,
    pendingFile,
    handleImageGenerated,
    handleGenerateAll,
    handleTranslate,
    loadTestData,
    resetApp,
  };
}
