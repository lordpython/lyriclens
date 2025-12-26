import { SongData, TransitionType } from "../types";
import { extractFrequencyData } from "../utils/audioAnalysis";
import { FFmpeg } from "@ffmpeg/ffmpeg";
import { fetchFile, toBlobURL } from "@ffmpeg/util";
import { applyPolyfills, isRTL } from "../lib/utils";
import { isNative, isAndroid, isFFmpegWasmSupported, getRecommendedExportEngine } from "../utils/platformUtils";
import { LAYOUT_PRESETS } from "../constants/layout";

/**
 * Get the server URL based on the current platform
 * - Android emulator: 10.0.2.2 (special alias for host machine)
 * - iOS simulator: localhost works
 * - Web browser: localhost
 */
const getServerUrl = (): string => {
  if (isAndroid()) {
    // Android emulator uses 10.0.2.2 to reach host machine's localhost
    return "http://10.0.2.2:3001";
  }
  // iOS simulator and web use localhost
  return "http://localhost:3001";
};

// Dynamic SERVER_URL based on platform
export const SERVER_URL = getServerUrl();

/**
 * Check if client-side FFmpeg WASM export is available on this platform
 * Returns false on mobile (Capacitor) as SharedArrayBuffer is not supported in WebViews
 */
export const isClientSideExportAvailable = (): boolean => {
  return isFFmpegWasmSupported();
};

/**
 * Get the recommended export engine for current platform
 * Mobile apps should use 'cloud' rendering, web can use 'browser' if supported
 */
export const getDefaultExportEngine = (): 'cloud' | 'browser' => {
  return getRecommendedExportEngine();
};

export type ExportProgress = {
  stage: "loading" | "preparing" | "rendering" | "encoding" | "complete";
  progress: number;
  message: string;
};

export type ProgressCallback = (progress: ExportProgress) => void;

export interface ExportConfig {
  orientation: "landscape" | "portrait";
  useModernEffects: boolean;
  syncOffsetMs: number; // Advance lyrics by N ms (negative = earlier, default: -50)
  fadeOutBeforeCut: boolean; // Fade lyrics 0.3s before image transition
  wordLevelHighlight: boolean; // Enable per-word karaoke vs. per-line
  contentMode: "music" | "story"; // "story" disables audio visualizer
  transitionType: TransitionType; // Type of transition between scenes
  transitionDuration: number; // Duration in seconds (default: 1.5)

  // NEW: Visualizer configuration
  visualizerConfig?: {
    enabled: boolean;
    opacity: number; // 0.0-1.0, default: 0.15
    maxHeightRatio: number; // 0.0-1.0, default: 0.25
    zIndex: number; // layer order, default: 1 (behind text)
    barWidth: number; // pixels, default: 3
    barGap: number; // pixels, default: 2
    colorScheme: "cyan-purple" | "rainbow" | "monochrome";
  };

  // NEW: Text animation configuration
  textAnimationConfig?: {
    revealDirection: "ltr" | "rtl" | "center-out" | "center-in";
    revealDuration: number; // seconds, default: 0.3
    wordReveal: boolean; // word-by-word or line-by-line
  };
}

type RenderAsset = {
  time: number;
  type: "image" | "video";
  element: HTMLImageElement | HTMLVideoElement;
};

/**
 * Get zone bounds from normalized coordinates
 */
function getZoneBounds(
  zone: { x: number; y: number; width: number; height: number },
  canvasWidth: number,
  canvasHeight: number
): { x: number; y: number; width: number; height: number } {
  return {
    x: zone.x * canvasWidth,
    y: zone.y * canvasHeight,
    width: zone.width * canvasWidth,
    height: zone.height * canvasHeight,
  };
}

/**
 * Render content within a zone with clipping
 */
function renderInZone(
  ctx: CanvasRenderingContext2D,
  zone: { x: number; y: number; width: number; height: number },
  canvasWidth: number,
  canvasHeight: number,
  renderFn: (bounds: { x: number; y: number; width: number; height: number }) => void
): void {
  const bounds = getZoneBounds(zone, canvasWidth, canvasHeight);

  ctx.save();

  // Clip to zone bounds
  ctx.beginPath();
  ctx.rect(bounds.x, bounds.y, bounds.width, bounds.height);
  ctx.clip();

  // Render content
  renderFn(bounds);

  ctx.restore();
}

/**
 * Calculate word reveal progress for wipe animation
 * Note: For RTL text, we no longer reverse indices - the rendering handles RTL positioning
 */
function calculateWordRevealProgress(
  currentTime: number,
  subtitle: { words?: { startTime: number; endTime: number; word: string }[] },
  _isRTL: boolean // kept for API compatibility but no longer used for reversal
): number[] {
  if (!subtitle.words || subtitle.words.length === 0) {
    return [1]; // Full reveal for non-word-timed
  }

  const revealDuration = 0.3; // 300ms per word
  const progress: number[] = [];

  subtitle.words.forEach((word, idx) => {
    const wordStart = word.startTime;
    const wordEnd = word.endTime;

    // Use natural index - RTL positioning is handled in rendering
    if (currentTime < wordStart) {
      progress[idx] = 0;
    } else if (currentTime >= wordEnd) {
      progress[idx] = 1;
    } else {
      // In reveal window
      progress[idx] = (currentTime - wordStart) / revealDuration;
    }
  });

  return progress;
}

/**
 * Render text with directional wipe animation
 * Draws both inactive (ghost) and active (revealed) text with professional styling
 */
function renderTextWithWipe(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  fontSize: number,
  progress: number, // 0-1 animation progress
  revealDirection: NonNullable<ExportConfig["textAnimationConfig"]>["revealDirection"],
  isTextRTL: boolean
): void {
  const textWidth = ctx.measureText(text).width;
  const clipHeight = fontSize * 1.6;
  const clipTop = y - clipHeight / 2;

  // If text is RTL, force RTL unless caller explicitly chooses a center wipe.
  const effectiveDirection =
    (isTextRTL && (revealDirection === "ltr" || revealDirection === "rtl"))
      ? "rtl"
      : revealDirection;

  const clamped = Math.max(0, Math.min(1, progress));

  // First, draw the ghost (inactive) text - full width, dimmed
  ctx.save();
  ctx.shadowColor = "rgba(0, 0, 0, 0.8)";
  ctx.shadowBlur = 10;
  ctx.shadowOffsetY = 2;
  ctx.strokeStyle = "rgba(0, 0, 0, 0.5)";
  ctx.lineWidth = 3;
  ctx.lineJoin = "round";
  ctx.strokeText(text, x, y);
  ctx.fillStyle = "rgba(255, 255, 255, 0.4)";
  ctx.fillText(text, x, y);
  ctx.restore();

  // Then draw the revealed (active) text with clipping
  if (clamped > 0) {
    ctx.save();
    ctx.beginPath();

    if (effectiveDirection === "rtl") {
      // RTL: Reveal from right to left
      const revealWidth = textWidth * clamped;
      ctx.rect(x + textWidth - revealWidth, clipTop, revealWidth, clipHeight);
    } else if (effectiveDirection === "ltr") {
      // LTR: Reveal from left to right
      const revealWidth = textWidth * clamped;
      ctx.rect(x, clipTop, revealWidth, clipHeight);
    } else if (effectiveDirection === "center-out") {
      // Center-out: expand from center
      const revealWidth = textWidth * clamped;
      const left = x + (textWidth - revealWidth) / 2;
      ctx.rect(left, clipTop, revealWidth, clipHeight);
    } else {
      // center-in: shrink towards center (reverse feel)
      const revealWidth = textWidth * (1 - clamped);
      const left = x + (textWidth - revealWidth) / 2;
      ctx.rect(left, clipTop, revealWidth, clipHeight);
    }

    ctx.clip();
    
    // Draw bright white revealed text with glow
    ctx.shadowColor = "rgba(255, 215, 100, 0.8)";
    ctx.shadowBlur = 15;
    ctx.fillStyle = "#ffffff";
    ctx.fillText(text, x, y);
    ctx.restore();
  }
}

/**
 * Render refined visualizer layer with reduced opacity and constrained height
 */
function renderVisualizerLayer(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  frequencyData: Uint8Array,
  previousFrequencyData: Uint8Array | null,
  config: NonNullable<ExportConfig["visualizerConfig"]>,
  useModernEffects: boolean,
  zone?: { top: number; height: number }
): void {
  const bufferLength = frequencyData.length;

  const zoneTop = zone?.top ?? 0;
  const zoneHeight = zone?.height ?? height;
  const baselineY = zoneTop + zoneHeight;

  const maxHeight = Math.min(zoneHeight, height * config.maxHeightRatio);
  const barWidth = config.barWidth;
  const barGap = config.barGap;

  ctx.save();

  // Hard clip to the visualizer zone so it never invades the lyric zone.
  ctx.beginPath();
  ctx.rect(0, zoneTop, width, zoneHeight);
  ctx.clip();

  // Set reduced opacity
  ctx.globalAlpha = config.opacity;

  // Create gradient based on color scheme
  const gradient = ctx.createLinearGradient(0, baselineY, 0, baselineY - maxHeight);

  switch (config.colorScheme) {
    case "cyan-purple":
      gradient.addColorStop(0, `rgba(34, 211, 238, ${config.opacity * 0.5})`);
      gradient.addColorStop(0.5, `rgba(34, 211, 238, ${config.opacity * 0.8})`);
      gradient.addColorStop(1, `rgba(167, 139, 250, ${config.opacity})`);
      break;
    case "rainbow":
      gradient.addColorStop(0, `rgba(255, 0, 0, ${config.opacity})`);
      gradient.addColorStop(0.2, `rgba(255, 165, 0, ${config.opacity})`);
      gradient.addColorStop(0.4, `rgba(255, 255, 0, ${config.opacity})`);
      gradient.addColorStop(0.6, `rgba(0, 255, 0, ${config.opacity})`);
      gradient.addColorStop(0.8, `rgba(0, 0, 255, ${config.opacity})`);
      gradient.addColorStop(1, `rgba(128, 0, 128, ${config.opacity})`);
      break;
    case "monochrome":
      gradient.addColorStop(0, `rgba(255, 255, 255, ${config.opacity * 0.3})`);
      gradient.addColorStop(1, `rgba(255, 255, 255, ${config.opacity})`);
      break;
  }

  ctx.fillStyle = gradient;

  // Optional: subtle glow for modern effects
  if (useModernEffects) {
    ctx.shadowBlur = 8;
    ctx.shadowColor = `rgba(34, 211, 238, ${config.opacity * 0.3})`;
  }

  // Render mirrored spectrum
  const centerX = width / 2;

  for (let i = 0; i < bufferLength; i++) {
    let value = frequencyData[i];

    if (previousFrequencyData) {
      value = (value + previousFrequencyData[i]) / 2;
    }

    const barHeight = (value / 255) * maxHeight;

    if (barHeight > 0) {
      const offset = i * (barWidth + barGap);
      const radius = barWidth / 2;

      // Right side
      ctx.beginPath();
      if (useModernEffects) {
        ctx.roundRect(
          centerX + offset,
          baselineY - barHeight,
          barWidth,
          barHeight,
          [radius, radius, 0, 0]
        );
      } else {
        ctx.rect(centerX + offset, baselineY - barHeight, barWidth, barHeight);
      }
      ctx.fill();

      // Left side (mirrored)
      ctx.beginPath();
      if (useModernEffects) {
        ctx.roundRect(
          centerX - offset - barWidth,
          baselineY - barHeight,
          barWidth,
          barHeight,
          [radius, radius, 0, 0]
        );
      } else {
        ctx.rect(centerX - offset - barWidth, baselineY - barHeight, barWidth, barHeight);
      }
      ctx.fill();
    }
  }

  ctx.restore();
}

const renderFrameToCanvas = async (
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  currentTime: number,
  assets: RenderAsset[],
  subtitles: SongData["parsedSubtitles"],
  frequencyData: Uint8Array | null,
  previousFrequencyData: Uint8Array | null, // Added for smoothing
  config: ExportConfig,
): Promise<void> => {
  // 1. Background (Black)
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, width, height);

  // Layout zones (non-overlapping composition: subject/visual layer, lyrics, visualizer)
  const layoutPreset =
    config.orientation === "portrait"
      ? LAYOUT_PRESETS.portrait
      : LAYOUT_PRESETS.landscape;

  const zones = {
    visualizer: getZoneBounds(layoutPreset.zones.visualizer, width, height),
    text: getZoneBounds(layoutPreset.zones.text, width, height),
    translation: getZoneBounds(layoutPreset.zones.translation, width, height),
  };

  // 2. Visual Layer with Ken Burns & Transitions
  let currentIndex = 0;
  for (let i = 0; i < assets.length; i++) {
    if (currentTime >= assets[i].time) {
      currentIndex = i;
    } else {
      break;
    }
  }

  const currentAsset = assets[currentIndex];
  const nextAsset = assets[currentIndex + 1];

  // Calculate duration of current slide
  const slideStartTime = currentAsset.time;
  const slideEndTime = nextAsset ? nextAsset.time : slideStartTime + 30; // Default 30s if last
  const slideDuration = slideEndTime - slideStartTime;
  const slideProgress = (currentTime - slideStartTime) / slideDuration;

  const drawAsset = async (
    asset: RenderAsset,
    progress: number,
    opacity: number,
    offsetTime: number = 0,
  ) => {
    ctx.save();
    ctx.globalAlpha = opacity;

    let scale: number;
    let x: number;
    let y: number;
    let drawWidth: number;
    let drawHeight: number;
    const element = asset.element;

    // Get natural dimensions
    const naturalWidth =
      asset.type === "video"
        ? (element as HTMLVideoElement).videoWidth
        : (element as HTMLImageElement).width;
    const naturalHeight =
      asset.type === "video"
        ? (element as HTMLVideoElement).videoHeight
        : (element as HTMLImageElement).height;

    // Handle Video Seek
    if (asset.type === "video") {
      const vid = element as HTMLVideoElement;
      if (vid.duration) {
        // Loop logic: absolute time relative to slide start
        // offsetTime allows "peeking" into next slide for crossfade
        const relativeTime = currentTime + offsetTime - asset.time;
        // Ensure positive modulo for loop
        vid.currentTime = relativeTime % vid.duration;

        // In a perfect world, we await 'seeked'.
        // For now, we set it and hope browser buffers are fast enough for the frame capture.
        // A small improvement: check readyState
        // if (vid.readyState < 2) await new Promise(r => vid.oncanplay = r);
      }
    }

    if (config.useModernEffects) {
      // Ken Burns: Zoom from 1.0 to 1.15 over the slide
      // For video, we might want less zoom to avoid shakiness, or keep it for effect.
      const zoom = 1.0 + progress * 0.15;
      scale = Math.max(width / naturalWidth, height / naturalHeight) * zoom;
    } else {
      // Static fill
      scale = Math.max(width / naturalWidth, height / naturalHeight);
    }

    drawWidth = naturalWidth * scale;
    drawHeight = naturalHeight * scale;
    x = (width - drawWidth) / 2;
    y = (height - drawHeight) / 2;

    ctx.drawImage(element, x, y, drawWidth, drawHeight);
    ctx.restore();
  };

  if (currentAsset?.element) {
    const TRANSITION_DURATION = config.transitionDuration || 1.5;
    const timeUntilNext = nextAsset ? nextAsset.time - currentTime : Infinity;
    const isTransitioning = timeUntilNext < TRANSITION_DURATION && nextAsset;

    if (config.transitionType === "none" || !isTransitioning) {
      // No transition or not in transition window - just draw current
      const useKenBurns = config.useModernEffects && config.transitionType !== "none";
      await drawAsset(currentAsset, useKenBurns ? slideProgress : 0, 1);
    } else {
      // Calculate transition progress (0 = just started, 1 = complete)
      const t = 1 - timeUntilNext / TRANSITION_DURATION;

      switch (config.transitionType) {
        case "fade": {
          // Fade through black
          if (t < 0.5) {
            // First half: fade out current to black
            await drawAsset(currentAsset, slideProgress, 1 - t * 2);
          } else {
            // Second half: fade in next from black
            await drawAsset(nextAsset, 0, (t - 0.5) * 2, -timeUntilNext);
          }
          break;
        }

        case "dissolve": {
          // Cross-dissolve (blend both)
          await drawAsset(currentAsset, slideProgress, 1);
          await drawAsset(nextAsset, 0, t, -timeUntilNext);
          break;
        }

        case "zoom": {
          // Zoom into current, then show next
          ctx.save();
          const zoomScale = 1 + t * 0.5; // Zoom up to 1.5x
          const centerX = width / 2;
          const centerY = height / 2;
          ctx.translate(centerX, centerY);
          ctx.scale(zoomScale, zoomScale);
          ctx.translate(-centerX, -centerY);
          ctx.globalAlpha = 1 - t;

          // Draw current (zooming in and fading out)
          const element = currentAsset.element;
          const naturalWidth = currentAsset.type === "video"
            ? (element as HTMLVideoElement).videoWidth
            : (element as HTMLImageElement).width;
          const naturalHeight = currentAsset.type === "video"
            ? (element as HTMLVideoElement).videoHeight
            : (element as HTMLImageElement).height;
          const scale = Math.max(width / naturalWidth, height / naturalHeight);
          const drawWidth = naturalWidth * scale;
          const drawHeight = naturalHeight * scale;
          const x = (width - drawWidth) / 2;
          const y = (height - drawHeight) / 2;
          ctx.drawImage(element, x, y, drawWidth, drawHeight);
          ctx.restore();

          // Draw next (fading in underneath)
          await drawAsset(nextAsset, 0, t, -timeUntilNext);
          break;
        }

        case "slide": {
          // Slide left - current slides out left, next slides in from right
          const slideOffset = t * width;

          // Draw current (sliding left)
          ctx.save();
          ctx.translate(-slideOffset, 0);
          await drawAsset(currentAsset, slideProgress, 1);
          ctx.restore();

          // Draw next (sliding in from right)
          ctx.save();
          ctx.translate(width - slideOffset, 0);
          await drawAsset(nextAsset, 0, 1, -timeUntilNext);
          ctx.restore();
          break;
        }

        default: {
          // Fallback: simple dissolve
          await drawAsset(currentAsset, slideProgress, 1);
          await drawAsset(nextAsset, 0, t, -timeUntilNext);
        }
      }
    }
  }

  // 3. Visualizer Layer (refined with reduced opacity and constrained height)
  if (frequencyData && config.contentMode === "music" && config.visualizerConfig?.enabled) {
    renderVisualizerLayer(
      ctx,
      width,
      height,
      frequencyData,
      previousFrequencyData,
      config.visualizerConfig,
      config.useModernEffects,
      { top: zones.visualizer.y, height: zones.visualizer.height }
    );
  }

  // 4. Gradient Overlay
  if (config.useModernEffects) {
    const overlayGradient = ctx.createLinearGradient(0, height, 0, 0);
    overlayGradient.addColorStop(0, "rgba(2, 6, 23, 0.95)"); // Darker bottom
    overlayGradient.addColorStop(0.3, "rgba(2, 6, 23, 0.6)");
    overlayGradient.addColorStop(0.7, "rgba(2, 6, 23, 0.2)");
    overlayGradient.addColorStop(1, "rgba(2, 6, 23, 0.4)"); // Slight top darken
    ctx.fillStyle = overlayGradient;
    ctx.fillRect(0, 0, width, height);
  } else {
    // Simpler overlay for readability
    const overlayGradient = ctx.createLinearGradient(0, height, 0, height / 2);
    overlayGradient.addColorStop(0, "rgba(15, 23, 42, 0.9)");
    overlayGradient.addColorStop(1, "rgba(15, 23, 42, 0.0)");
    ctx.fillStyle = overlayGradient;
    ctx.fillRect(0, 0, width, height);
  }

  // 5. Subtitles with Word-Level Highlighting
  // Apply sync offset (negative = lyrics appear earlier)
  const adjustedTime = currentTime + config.syncOffsetMs / 1000;

  const activeSub = subtitles.find(
    (s) => adjustedTime >= s.startTime && adjustedTime <= s.endTime,
  );

  // Calculate fade-out opacity if near image transition
  let subtitleOpacity = 1.0;
  if (config.fadeOutBeforeCut) {
    const fadeOutDuration = 0.3; // 300ms fade
    const timeUntilCut = slideEndTime - currentTime;
    if (timeUntilCut < fadeOutDuration && timeUntilCut > 0) {
      subtitleOpacity = timeUntilCut / fadeOutDuration;
    }
  }

  if (activeSub && subtitleOpacity > 0) {
    ctx.save();
    ctx.globalAlpha = subtitleOpacity;

    const totalDuration = activeSub.endTime - activeSub.startTime;
    const lineProgress = Math.max(
      0,
      Math.min(1, (adjustedTime - activeSub.startTime) / totalDuration),
    );

    // Adjust font size based on orientation - LARGER for professional look
    const fontSize = config.orientation === "portrait" ? 72 : 84;
    const fontWeight = config.useModernEffects ? "700" : "bold";
    ctx.font = `${fontWeight} ${fontSize}px "Inter", "Segoe UI", "Arial", sans-serif`;
    ctx.textAlign = "left"; // Changed to left for word-level positioning
    ctx.textBaseline = "middle";

    // === RTL Detection ===
    const isTextRTL = isRTL(activeSub.text);

    // === Word-Level Rendering ===
    const hasWordTiming =
      config.wordLevelHighlight &&
      activeSub.words &&
      activeSub.words.length > 0;

    // Get display text (split by spaces if no word timing)
    // For RTL: Keep original word order - canvas will handle RTL rendering
    // We DON'T reverse words anymore - instead we set canvas direction
    let displayWords = hasWordTiming
      ? activeSub.words!.map((w) => w.word)
      : activeSub.text.split(" ");

    // Measure total line width
    const fullText = displayWords.join(" ");
    const totalWidth = ctx.measureText(fullText).width;
    const startX = (width - totalWidth) / 2;

    // Text wrapping for long lines (constrained to the lyric zone)
    const maxWidth = zones.text.width - (config.orientation === "portrait" ? 80 : 140);
    const wrappedLines: { words: string[]; wordIndices: number[] }[] = [];
    let currentLine: string[] = [];
    let currentLineIndices: number[] = [];
    let currentLineWidth = 0;

    displayWords.forEach((word, idx) => {
      const wordWidth = ctx.measureText(word + " ").width;
      if (currentLineWidth + wordWidth > maxWidth && currentLine.length > 0) {
        wrappedLines.push({
          words: currentLine,
          wordIndices: currentLineIndices,
        });
        currentLine = [word];
        currentLineIndices = [idx];
        currentLineWidth = wordWidth;
      } else {
        currentLine.push(word);
        currentLineIndices.push(idx);
        currentLineWidth += wordWidth;
      }
    });
    if (currentLine.length > 0) {
      wrappedLines.push({
        words: currentLine,
        wordIndices: currentLineIndices,
      });
    }

    const lineHeight = fontSize * 1.3;
    const totalTextHeight = wrappedLines.length * lineHeight;
    // Center lyrics inside the dedicated text zone (prevents overlap with visualizer)
    const baseY = zones.text.y + zones.text.height / 2 - totalTextHeight / 2;

    wrappedLines.forEach((lineData, lineIdx) => {
      const yPos = baseY + lineIdx * lineHeight;

      // For RTL text, we render words in their natural order
      // but position them from right to left
      const displayLineWords = lineData.words;
      const displayLineIndices = lineData.wordIndices;

      const lineText = displayLineWords.join(" ");
      const lineWidth = ctx.measureText(lineText).width;
      
      // For RTL: start from right side and move left
      // For LTR: start from left side and move right
      let xPos: number;
      if (isTextRTL) {
        // Start from right edge of centered text
        xPos = zones.text.x + (zones.text.width + lineWidth) / 2;
      } else {
        xPos = zones.text.x + (zones.text.width - lineWidth) / 2;
      }

      displayLineWords.forEach((word, wordIdx) => {
        const globalWordIdx = displayLineIndices[wordIdx];
        const wordWidth = ctx.measureText(word).width;
        const spaceWidth = ctx.measureText(" ").width;

        // For RTL, move xPos to the left before drawing
        if (isTextRTL) {
          xPos -= wordWidth;
        }

        // Calculate word progress
        let wordProgress = 0;
        let isActiveWord = false;
        let wordDuration = 0;

        // Use the original word index for timing lookup (no reversal needed)
        const timingWordIdx = globalWordIdx;

        if (hasWordTiming && activeSub.words![timingWordIdx]) {
          const wordTiming = activeSub.words![timingWordIdx];
          const wordStart = wordTiming.startTime;
          const wordEnd = wordTiming.endTime;
          wordDuration = wordEnd - wordStart;

          if (adjustedTime >= wordEnd) {
            wordProgress = 1;
          } else if (adjustedTime >= wordStart) {
            const revealDuration =
              config.textAnimationConfig?.revealDuration ?? (wordEnd - wordStart);
            const revealWindow = Math.max(
              0.05,
              Math.min(revealDuration, wordEnd - wordStart)
            );
            wordProgress = (adjustedTime - wordStart) / revealWindow;
            isActiveWord = true;
          }
        } else {
          // Fallback: calculate progress based on character position
          const originalWords = hasWordTiming
            ? activeSub.words!.map((w) => w.word)
            : activeSub.text.split(" ");
          const originalFullText = originalWords.join(" ");

          // Use the global word index directly (no reversal needed)
          const originalIdx = globalWordIdx;

          const charsBefore = originalWords
            .slice(0, originalIdx)
            .join(" ").length;
          const totalChars = originalFullText.length;
          const wordStartProgress = charsBefore / totalChars;
          const wordEndProgress = (charsBefore + word.length) / totalChars;

          if (lineProgress >= wordEndProgress) {
            wordProgress = 1;
          } else if (lineProgress >= wordStartProgress) {
            wordProgress =
              (lineProgress - wordStartProgress) /
              (wordEndProgress - wordStartProgress);
            isActiveWord = true;
          }
        }

        // NEW: Use wipe animation if textAnimationConfig is provided
        if (config.textAnimationConfig) {
          renderTextWithWipe(
            ctx,
            word,
            xPos,
            yPos,
            fontSize,
            wordProgress,
            config.textAnimationConfig.revealDirection,
            isTextRTL
          );
        } else if (config.useModernEffects) {
          // Modern effects: word-by-word glow with professional styling
          ctx.save();

          // Emphasis effect for held words (words sung longer than average)
          let emphasisScale = 1.0;
          let emphasisGlow = false;
          if (isActiveWord && hasWordTiming && wordDuration > 0.5) {
            // Long word - add emphasis
            emphasisScale = 1.0 + wordProgress * 0.06; // Subtle scale
            emphasisGlow = true;
          }

          // Strong text shadow for readability
          ctx.shadowColor = "rgba(0, 0, 0, 0.9)";
          ctx.shadowBlur = 12;
          ctx.shadowOffsetX = 2;
          ctx.shadowOffsetY = 3;

          // Draw outline/stroke for better visibility
          ctx.strokeStyle = "rgba(0, 0, 0, 0.6)";
          ctx.lineWidth = 4;
          ctx.lineJoin = "round";
          ctx.textAlign = "left";
          ctx.strokeText(word, xPos, yPos);

          // Draw ghost (inactive) text - brighter for better visibility
          ctx.fillStyle = "rgba(255, 255, 255, 0.45)";
          ctx.fillText(word, xPos, yPos);

          // Draw active text with gradient
          if (wordProgress > 0) {
            ctx.save();
            if (emphasisScale > 1) {
              ctx.translate(xPos + wordWidth / 2, yPos);
              ctx.scale(emphasisScale, emphasisScale);
              ctx.translate(-(xPos + wordWidth / 2), -yPos);
            }

            // For RTL text, gradient should reveal from right to left
            // For LTR text, gradient reveals from left to right
            let gradient: CanvasGradient;
            if (isTextRTL) {
              // RTL: gradient goes from right (white) to left (transparent)
              gradient = ctx.createLinearGradient(
                xPos + wordWidth,
                0,
                xPos,
                0,
              );
              gradient.addColorStop(0, "#ffffff");
              gradient.addColorStop(Math.max(0, wordProgress - 0.05), "#ffffff");
              gradient.addColorStop(
                Math.min(1, wordProgress + 0.05),
                "rgba(255,255,255,0)",
              );
              gradient.addColorStop(1, "rgba(255,255,255,0)");
            } else {
              // LTR: gradient goes from left (white) to right (transparent)
              gradient = ctx.createLinearGradient(
                xPos,
                0,
                xPos + wordWidth,
                0,
              );
              gradient.addColorStop(0, "#ffffff");
              gradient.addColorStop(Math.max(0, wordProgress - 0.05), "#ffffff");
              gradient.addColorStop(
                Math.min(1, wordProgress + 0.05),
                "rgba(255,255,255,0)",
              );
              gradient.addColorStop(1, "rgba(255,255,255,0)");
            }

            ctx.fillStyle = gradient;

            // Enhanced glow for active word - golden/warm glow
            if (isActiveWord || emphasisGlow) {
              ctx.shadowColor = "rgba(255, 215, 100, 0.9)";
              ctx.shadowBlur = emphasisGlow ? 30 : 20;
            }

            ctx.fillText(word, xPos, yPos);
            ctx.restore();
          }

          ctx.restore();
        } else {
          // Simple mode: solid color transition with professional colors
          ctx.save();
          
          // Add text shadow for readability
          ctx.shadowColor = "rgba(0, 0, 0, 0.8)";
          ctx.shadowBlur = 8;
          ctx.shadowOffsetY = 2;
          
          // Draw outline
          ctx.strokeStyle = "rgba(0, 0, 0, 0.5)";
          ctx.lineWidth = 3;
          ctx.lineJoin = "round";
          ctx.textAlign = "left";
          ctx.strokeText(word, xPos, yPos);
          
          if (wordProgress >= 1) {
            ctx.fillStyle = "#ffffff"; // Pure white for completed words
          } else if (wordProgress > 0) {
            // Partially active - bright yellow/gold
            ctx.fillStyle = "#ffd700";
          } else {
            ctx.fillStyle = "rgba(255, 255, 255, 0.7)"; // Brighter inactive text
          }
          ctx.fillText(word, xPos, yPos);
          ctx.restore();
        }

        // Update xPos for next word
        // For RTL: subtract space (we already subtracted wordWidth before drawing)
        // For LTR: add word width and space
        if (isTextRTL) {
          xPos -= spaceWidth;
        } else {
          xPos += wordWidth + spaceWidth;
        }
      });
    });

    // Translation
    if (activeSub.translation) {
      const transY = zones.translation.y + zones.translation.height / 2;
      ctx.textAlign = "center";

      // Check if translation is RTL
      const isTranslationRTL = isRTL(activeSub.translation);

      if (config.useModernEffects) {
        // Larger, more readable translation text
        const transFontSize = config.orientation === "portrait" ? 36 : 42;
        ctx.font = `500 ${transFontSize}px "Inter", "Segoe UI", "Arial", sans-serif`;
        const transText = activeSub.translation;
        const transWidth = ctx.measureText(transText).width;
        const padding = 32;

        // Elegant pill background with blur effect
        ctx.shadowBlur = 0;
        ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
        ctx.beginPath();
        ctx.roundRect(
          width / 2 - transWidth / 2 - padding,
          transY - transFontSize / 2 - 8,
          transWidth + padding * 2,
          transFontSize + 16,
          24,
        );
        ctx.fill();

        // Bright, readable translation text
        ctx.shadowColor = "rgba(0, 0, 0, 0.5)";
        ctx.shadowBlur = 4;
        ctx.fillStyle = "#ffffff";
        ctx.fillText(transText, width / 2, transY + 2);
      } else {
        // Simple mode - still professional
        const transFontSize = config.orientation === "portrait" ? 32 : 38;
        ctx.font = `italic ${transFontSize}px "Inter", "Arial", sans-serif`;
        ctx.shadowColor = "rgba(0, 0, 0, 0.9)";
        ctx.shadowBlur = 8;
        ctx.shadowOffsetY = 2;
        
        // Draw outline for readability
        ctx.strokeStyle = "rgba(0, 0, 0, 0.6)";
        ctx.lineWidth = 3;
        ctx.strokeText(activeSub.translation, width / 2, transY);
        
        ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
        ctx.fillText(activeSub.translation, width / 2, transY);
        ctx.shadowBlur = 0;
      }
    }

    ctx.restore();
  }
};

export const exportVideoWithFFmpeg = async (
  songData: SongData,
  onProgress: ProgressCallback,
  config: ExportConfig = {
    orientation: "landscape",
    useModernEffects: true,
    syncOffsetMs: -50,
    fadeOutBeforeCut: true,
    wordLevelHighlight: true,
    contentMode: "music",
    transitionType: "dissolve",
    transitionDuration: 1.5,
    // NEW: Default visualizer configuration
    visualizerConfig: {
      enabled: true,
      opacity: 0.15,
      maxHeightRatio: 0.25,
      zIndex: 1,
      barWidth: 3,
      barGap: 2,
      colorScheme: "cyan-purple",
    },
    // NEW: Default text animation configuration
    textAnimationConfig: {
      revealDirection: "ltr",
      revealDuration: 0.3,
      wordReveal: true,
    },
  },
): Promise<Blob> => {
  const WIDTH = config.orientation === "landscape" ? 1920 : 1080;
  const HEIGHT = config.orientation === "landscape" ? 1080 : 1920;
  const FPS = 30;
  const BATCH_SIZE = 60; // Upload every 60 frames (2 seconds)

  onProgress({
    stage: "preparing",
    progress: 0,
    message: "Analyzing audio...",
  });

  // 1. Fetch and Decode Audio
  const audioResponse = await fetch(songData.audioUrl);
  const audioBlob = await audioResponse.blob();
  const arrayBuffer = await audioBlob.arrayBuffer();
  const audioContext = new (
    window.AudioContext || (window as any).webkitAudioContext
  )();
  const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

  // 2. Extract Frequency Data
  const frequencyDataArray = await extractFrequencyData(audioBuffer, FPS);

  onProgress({
    stage: "preparing",
    progress: 10,
    message: "Initializing render session...",
  });

  // 3. Initialize Session
  const initFormData = new FormData();
  initFormData.append("audio", audioBlob, "audio.mp3");

  const initRes = await fetch(`${SERVER_URL}/api/export/init`, {
    method: "POST",
    body: initFormData,
  });

  if (!initRes.ok) {
    throw new Error("Failed to initialize export session");
  }

  const { sessionId } = await initRes.json();

  onProgress({
    stage: "preparing",
    progress: 20,
    message: "Loading high-res assets...",
  });

  // 4. Preload assets (images/videos)
  const assets: RenderAsset[] = [];
  const sortedPrompts = [...songData.prompts].sort(
    (a, b) => (a.timestampSeconds || 0) - (b.timestampSeconds || 0),
  );

  for (const prompt of sortedPrompts) {
    const generated = songData.generatedImages.find(
      (g) => g.promptId === prompt.id,
    );
    if (generated) {
      if (generated.type === "video") {
        const vid = document.createElement("video");
        vid.crossOrigin = "anonymous";
        vid.src = generated.imageUrl;
        vid.muted = true;
        vid.preload = "auto";
        await new Promise<void>((resolve) => {
          vid.onloadeddata = () => resolve();
          vid.onerror = () => resolve(); // fallback
        });
        assets.push({
          time: prompt.timestampSeconds || 0,
          type: "video",
          element: vid,
        });
      } else {
        const img = new Image();
        img.crossOrigin = "anonymous";
        await new Promise<void>((resolve, reject) => {
          img.onload = () => resolve();
          img.onerror = reject;
          img.src = generated.imageUrl;
        });
        assets.push({
          time: prompt.timestampSeconds || 0,
          type: "image",
          element: img,
        });
      }
    }
  }

  const duration = audioBuffer.duration;
  const totalFrames = Math.ceil(duration * FPS);

  onProgress({
    stage: "rendering",
    progress: 0,
    message: "Rendering cinematic frames...",
  });

  // 5. Create canvas
  const canvas = document.createElement("canvas");
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const ctx = canvas.getContext("2d")!;

  // Polyfill roundRect
  applyPolyfills(ctx);

  // 6. Render Loop with Batch Upload
  let previousFreqData: Uint8Array | null = null;
  let frameBuffer: { blob: Blob; name: string }[] = [];

  for (let frame = 0; frame < totalFrames; frame++) {
    const currentTime = frame / FPS;

    const freqData = frequencyDataArray[frame] || new Uint8Array(128).fill(0);

    await renderFrameToCanvas(
      ctx,
      WIDTH,
      HEIGHT,
      currentTime,
      assets,
      songData.parsedSubtitles,
      freqData,
      previousFreqData,
      config,
    );

    previousFreqData = freqData;

    const blob = await new Promise<Blob>((resolve) => {
      canvas.toBlob((b) => resolve(b!), "image/jpeg", 0.9);
    });

    // Add to buffer
    frameBuffer.push({
      blob,
      name: `frame${frame.toString().padStart(6, "0")}.jpg`,
    });

    // Upload if batch is full
    if (frameBuffer.length >= BATCH_SIZE) {
      const chunkFormData = new FormData();
      frameBuffer.forEach((f) =>
        chunkFormData.append("frames", f.blob, f.name),
      );

      const chunkRes = await fetch(
        `${SERVER_URL}/api/export/chunk?sessionId=${sessionId}`,
        {
          method: "POST",
          body: chunkFormData,
        },
      );

      if (!chunkRes.ok) throw new Error("Failed to upload video chunk");

      frameBuffer = []; // Clear buffer
    }

    // Update progress
    if (frame % FPS === 0) {
      const progress = Math.round((frame / totalFrames) * 90); // Cap "rendering" at 90%
      onProgress({
        stage: "rendering",
        progress,
        message: `Rendering ${Math.floor(frame / FPS)}s / ${Math.floor(duration)}s`,
      });
    }
  }

  // Upload remaining frames
  if (frameBuffer.length > 0) {
    const chunkFormData = new FormData();
    frameBuffer.forEach((f) => chunkFormData.append("frames", f.blob, f.name));

    await fetch(`${SERVER_URL}/api/export/chunk?sessionId=${sessionId}`, {
      method: "POST",
      body: chunkFormData,
    });
  }

  onProgress({
    stage: "encoding",
    progress: 95,
    message: "Finalizing video on server...",
  });

  const finalizeRes = await fetch(`${SERVER_URL}/api/export/finalize`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sessionId, fps: FPS }),
  });

  if (!finalizeRes.ok) {
    const error = await finalizeRes.json();
    throw new Error(error.error || "Export failed");
  }

  onProgress({ stage: "encoding", progress: 99, message: "Downloading..." });

  const videoBlob = await finalizeRes.blob();

  onProgress({ stage: "complete", progress: 100, message: "Export complete!" });

  return videoBlob;
};

export const exportVideoClientSide = async (
  songData: SongData,
  onProgress: ProgressCallback,
  config: ExportConfig = {
    orientation: "landscape",
    useModernEffects: true,
    syncOffsetMs: -50,
    fadeOutBeforeCut: true,
    wordLevelHighlight: true,
    contentMode: "music",
    transitionType: "dissolve",
    transitionDuration: 1.5,
    // NEW: Default visualizer configuration
    visualizerConfig: {
      enabled: true,
      opacity: 0.15,
      maxHeightRatio: 0.25,
      zIndex: 1,
      barWidth: 3,
      barGap: 2,
      colorScheme: "cyan-purple",
    },
    // NEW: Default text animation configuration
    textAnimationConfig: {
      revealDirection: "ltr",
      revealDuration: 0.3,
      wordReveal: true,
    },
  },
): Promise<Blob> => {
  const WIDTH = config.orientation === "landscape" ? 1920 : 1080;
  const HEIGHT = config.orientation === "landscape" ? 1080 : 1920;
  const FPS = 30;

  onProgress({
    stage: "loading",
    progress: 0,
    message: "Loading FFmpeg Core...",
  });

  const ffmpeg = new FFmpeg();
  const baseURL = "https://unpkg.com/@ffmpeg/core@0.12.10/dist/esm";

  try {
    await ffmpeg.load({
      coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, "text/javascript"),
      wasmURL: await toBlobURL(
        `${baseURL}/ffmpeg-core.wasm`,
        "application/wasm",
      ),
    });
  } catch (e) {
    console.error("FFmpeg load failed", e);
    throw new Error("Failed to load FFmpeg. Check browser compatibility.");
  }

  onProgress({
    stage: "preparing",
    progress: 0,
    message: "Analyzing audio...",
  });

  // 1. Fetch and Decode Audio
  const audioResponse = await fetch(songData.audioUrl);
  const audioBlob = await audioResponse.blob();
  const arrayBuffer = await audioBlob.arrayBuffer();
  const audioContext = new (
    window.AudioContext || (window as any).webkitAudioContext
  )();
  const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

  // Write audio to FFmpeg FS
  await ffmpeg.writeFile("audio.mp3", await fetchFile(audioBlob));

  // 2. Extract Frequency Data
  const frequencyDataArray = await extractFrequencyData(audioBuffer, FPS);

  onProgress({
    stage: "preparing",
    progress: 20,
    message: "Loading high-res assets...",
  });

  // 3. Preload assets
  const assets: RenderAsset[] = [];
  const sortedPrompts = [...songData.prompts].sort(
    (a, b) => (a.timestampSeconds || 0) - (b.timestampSeconds || 0),
  );

  for (const prompt of sortedPrompts) {
    const generated = songData.generatedImages.find(
      (g) => g.promptId === prompt.id,
    );
    if (generated) {
      if (generated.type === "video") {
        const vid = document.createElement("video");
        vid.crossOrigin = "anonymous";
        vid.src = generated.imageUrl;
        vid.muted = true;
        vid.preload = "auto";
        await new Promise<void>((resolve) => {
          vid.onloadeddata = () => resolve();
          vid.onerror = () => resolve(); // fallback
        });
        assets.push({
          time: prompt.timestampSeconds || 0,
          type: "video",
          element: vid,
        });
      } else {
        const img = new Image();
        img.crossOrigin = "anonymous";
        await new Promise<void>((resolve, reject) => {
          img.onload = () => resolve();
          img.onerror = reject;
          img.src = generated.imageUrl;
        });
        assets.push({
          time: prompt.timestampSeconds || 0,
          type: "image",
          element: img,
        });
      }
    }
  }

  const duration = audioBuffer.duration;
  const totalFrames = Math.ceil(duration * FPS);

  onProgress({
    stage: "rendering",
    progress: 0,
    message: "Rendering frames...",
  });

  // 4. Create canvas
  const canvas = document.createElement("canvas");
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const ctx = canvas.getContext("2d")!;

  // Polyfill roundRect
  applyPolyfills(ctx);

  // 5. Render Loop
  let previousFreqData: Uint8Array | null = null;

  for (let frame = 0; frame < totalFrames; frame++) {
    const currentTime = frame / FPS;
    const freqData = frequencyDataArray[frame] || new Uint8Array(128).fill(0);

    await renderFrameToCanvas(
      ctx,
      WIDTH,
      HEIGHT,
      currentTime,
      assets,
      songData.parsedSubtitles,
      freqData,
      previousFreqData,
      config,
    );

    previousFreqData = freqData;

    // Convert canvas to binary for FFmpeg
    // We use a lower quality JPEG for speed in WASM, or PNG for quality.
    // JPEG is much faster to encode.
    const blob = await new Promise<Blob>((resolve) => {
      canvas.toBlob((b) => resolve(b!), "image/jpeg", 0.9);
    });

    const frameName = `frame${frame.toString().padStart(6, "0")}.jpg`;
    await ffmpeg.writeFile(frameName, await fetchFile(blob));

    // Update progress
    if (frame % FPS === 0) {
      const progress = Math.round((frame / totalFrames) * 80);
      onProgress({
        stage: "rendering",
        progress,
        message: `Rendering ${Math.floor(frame / FPS)}s / ${Math.floor(duration)}s`,
      });
    }
  }

  onProgress({
    stage: "encoding",
    progress: 85,
    message: "Encoding MP4 (WASM)...",
  });

  // 6. Run FFmpeg
  await ffmpeg.exec([
    "-framerate",
    String(FPS),
    "-i",
    "frame%06d.jpg",
    "-i",
    "audio.mp3",
    "-c:v",
    "libx264",
    "-pix_fmt",
    "yuv420p",
    "-shortest",
    "-preset",
    "ultrafast", // Speed over size for browser
    "output.mp4",
  ]);

  onProgress({ stage: "complete", progress: 100, message: "Done!" });

  // 7. Read output
  const data = (await ffmpeg.readFile("output.mp4")) as Uint8Array;
  // Create a new Uint8Array to ensure it's backed by ArrayBuffer (not SharedArrayBuffer)
  return new Blob([data.slice()], { type: "video/mp4" });
};
