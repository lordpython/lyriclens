import { SongData } from '../types';
import { extractFrequencyData } from '../utils/audioAnalysis';
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';
import { applyPolyfills } from '../lib/utils';

const SERVER_URL = 'http://localhost:3001';

export type ExportProgress = {
  stage: 'loading' | 'preparing' | 'rendering' | 'encoding' | 'complete';
  progress: number;
  message: string;
};

export type ProgressCallback = (progress: ExportProgress) => void;

export interface ExportConfig {
  orientation: 'landscape' | 'portrait';
  useModernEffects: boolean;
  syncOffsetMs: number;          // Advance lyrics by N ms (negative = earlier, default: -50)
  fadeOutBeforeCut: boolean;     // Fade lyrics 0.3s before image transition
  wordLevelHighlight: boolean;   // Enable per-word karaoke vs. per-line
}

const renderFrameToCanvas = (
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  currentTime: number,
  imageAssets: { time: number; img: HTMLImageElement }[],
  subtitles: SongData['parsedSubtitles'],
  frequencyData: Uint8Array | null,
  previousFrequencyData: Uint8Array | null, // Added for smoothing
  config: ExportConfig
): void => {
  // 1. Background (Black)
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, width, height);

  // 2. Image Layer with Ken Burns & Transitions
  let currentIndex = 0;
  for (let i = 0; i < imageAssets.length; i++) {
    if (currentTime >= imageAssets[i].time) {
      currentIndex = i;
    } else {
      break;
    }
  }

  const currentAsset = imageAssets[currentIndex];
  const nextAsset = imageAssets[currentIndex + 1];

  // Calculate duration of current slide
  const slideStartTime = currentAsset.time;
  const slideEndTime = nextAsset ? nextAsset.time : (slideStartTime + 30); // Default 30s if last
  const slideDuration = slideEndTime - slideStartTime;
  const slideProgress = (currentTime - slideStartTime) / slideDuration;

  const drawImage = (img: HTMLImageElement, progress: number, opacity: number) => {
    ctx.save();
    ctx.globalAlpha = opacity;

    let scale: number;
    let x: number;
    let y: number;
    let drawWidth: number;
    let drawHeight: number;

    if (config.useModernEffects) {
      // Ken Burns: Zoom from 1.0 to 1.15 over the slide
      const zoom = 1.0 + (progress * 0.15);
      scale = Math.max(width / img.width, height / img.height) * zoom;
    } else {
      // Static fill
      scale = Math.max(width / img.width, height / img.height);
    }

    drawWidth = img.width * scale;
    drawHeight = img.height * scale;
    x = (width - drawWidth) / 2;
    y = (height - drawHeight) / 2;

    ctx.drawImage(img, x, y, drawWidth, drawHeight);
    ctx.restore();
  };

  if (currentAsset?.img) {
    if (config.useModernEffects) {
      // Cross-fade logic
      const TRANSITION_DURATION = 1.5; // seconds
      const timeUntilNext = nextAsset ? (nextAsset.time - currentTime) : Infinity;

      if (timeUntilNext < TRANSITION_DURATION && nextAsset) {
        // Transitioning OUT
        const transitionProgress = 1 - (timeUntilNext / TRANSITION_DURATION);

        // Draw current (fading out)
        drawImage(currentAsset.img, slideProgress, 1);

        // Draw next (fading in)
        // Next slide starts at 0 progress
        drawImage(nextAsset.img, 0, transitionProgress);
      } else {
        // Normal draw
        drawImage(currentAsset.img, slideProgress, 1);
      }
    } else {
      // Simple cut
      drawImage(currentAsset.img, 0, 1);
    }
  }

  // 3. Visualizer Layer
  if (frequencyData) {
    const bufferLength = frequencyData.length;
    const barWidth = (width / bufferLength) * 2.5;
    let x = 0;

    // Create gradient
    const gradient = ctx.createLinearGradient(0, height, 0, height / 2);
    gradient.addColorStop(0, 'rgba(34, 211, 238, 0.2)'); // Cyan transparent bottom
    gradient.addColorStop(0.5, 'rgba(34, 211, 238, 0.6)'); // Cyan mid
    gradient.addColorStop(1, 'rgba(167, 139, 250, 0.8)'); // Purple top

    ctx.save();
    if (config.useModernEffects) {
      // Add a glow effect
      ctx.shadowBlur = 15;
      ctx.shadowColor = 'rgba(34, 211, 238, 0.5)';
    }

    ctx.fillStyle = gradient;

    for (let i = 0; i < bufferLength; i++) {
      let value = frequencyData[i];
      if (config.useModernEffects && previousFrequencyData) {
        // Smooth the data: Average with previous frame
        value = (value + previousFrequencyData[i]) / 2;
      }

      // Non-linear scaling for better visuals (boost lows, dampen highs slightly)
      const barHeight = (value / 255) * height * 0.6;

      // Mirrored spectrum
      const centerX = width / 2;
      const offset = i * (barWidth + 2); // Increased gap slightly

      const radius = barWidth / 2;

      // Right side
      if (barHeight > 0) {
        ctx.beginPath();
        if (config.useModernEffects) {
          ctx.roundRect(centerX + offset, height - barHeight, barWidth, barHeight + 10, [radius, radius, 0, 0]);
        } else {
          ctx.rect(centerX + offset, height - barHeight, barWidth, barHeight);
        }
        ctx.fill();

        // Left side
        ctx.beginPath();
        if (config.useModernEffects) {
          ctx.roundRect(centerX - offset - barWidth, height - barHeight, barWidth, barHeight + 10, [radius, radius, 0, 0]);
        } else {
          ctx.rect(centerX - offset - barWidth, height - barHeight, barWidth, barHeight);
        }
        ctx.fill();
      }

      x += barWidth + 2;
      if (x > width) break;
    }
    ctx.restore();
  }

  // 4. Gradient Overlay
  if (config.useModernEffects) {
    const overlayGradient = ctx.createLinearGradient(0, height, 0, 0);
    overlayGradient.addColorStop(0, 'rgba(2, 6, 23, 0.95)'); // Darker bottom
    overlayGradient.addColorStop(0.3, 'rgba(2, 6, 23, 0.6)');
    overlayGradient.addColorStop(0.7, 'rgba(2, 6, 23, 0.2)');
    overlayGradient.addColorStop(1, 'rgba(2, 6, 23, 0.4)'); // Slight top darken
    ctx.fillStyle = overlayGradient;
    ctx.fillRect(0, 0, width, height);
  } else {
    // Simpler overlay for readability
    const overlayGradient = ctx.createLinearGradient(0, height, 0, height / 2);
    overlayGradient.addColorStop(0, 'rgba(15, 23, 42, 0.9)');
    overlayGradient.addColorStop(1, 'rgba(15, 23, 42, 0.0)');
    ctx.fillStyle = overlayGradient;
    ctx.fillRect(0, 0, width, height);
  }


  // 5. Subtitles with Word-Level Highlighting
  // Apply sync offset (negative = lyrics appear earlier)
  const adjustedTime = currentTime + (config.syncOffsetMs / 1000);

  const activeSub = subtitles.find(
    s => adjustedTime >= s.startTime && adjustedTime <= s.endTime
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
    const lineProgress = Math.max(0, Math.min(1, (adjustedTime - activeSub.startTime) / totalDuration));

    // Adjust font size based on orientation
    const fontSize = config.orientation === 'portrait' ? 48 : 64;
    const fontWeight = config.useModernEffects ? '800' : 'bold';
    ctx.font = `${fontWeight} ${fontSize}px Inter, system-ui, sans-serif`;
    ctx.textAlign = 'left'; // Changed to left for word-level positioning
    ctx.textBaseline = 'middle';

    // === Word-Level Rendering ===
    const hasWordTiming = config.wordLevelHighlight && activeSub.words && activeSub.words.length > 0;

    // Get display text (split by spaces if no word timing)
    const displayWords = hasWordTiming
      ? activeSub.words!.map(w => w.word)
      : activeSub.text.split(' ');

    // Measure total line width
    const fullText = displayWords.join(' ');
    const totalWidth = ctx.measureText(fullText).width;
    const startX = (width - totalWidth) / 2;

    // Text wrapping for long lines
    const maxWidth = width - (config.orientation === 'portrait' ? 80 : 200);
    const wrappedLines: { words: string[]; wordIndices: number[] }[] = [];
    let currentLine: string[] = [];
    let currentLineIndices: number[] = [];
    let currentLineWidth = 0;

    displayWords.forEach((word, idx) => {
      const wordWidth = ctx.measureText(word + ' ').width;
      if (currentLineWidth + wordWidth > maxWidth && currentLine.length > 0) {
        wrappedLines.push({ words: currentLine, wordIndices: currentLineIndices });
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
      wrappedLines.push({ words: currentLine, wordIndices: currentLineIndices });
    }

    const lineHeight = fontSize * 1.3;
    const totalTextHeight = wrappedLines.length * lineHeight;
    const baseY = (height / 2) - (totalTextHeight / 2) - (config.orientation === 'portrait' ? 100 : 0);

    wrappedLines.forEach((lineData, lineIdx) => {
      const yPos = baseY + (lineIdx * lineHeight);
      const lineText = lineData.words.join(' ');
      const lineWidth = ctx.measureText(lineText).width;
      let xPos = (width - lineWidth) / 2;

      lineData.words.forEach((word, wordIdx) => {
        const globalWordIdx = lineData.wordIndices[wordIdx];
        const wordWidth = ctx.measureText(word).width;
        const spaceWidth = ctx.measureText(' ').width;

        // Calculate word progress
        let wordProgress = 0;
        let isActiveWord = false;
        let wordDuration = 0;

        if (hasWordTiming && activeSub.words![globalWordIdx]) {
          const wordTiming = activeSub.words![globalWordIdx];
          const wordStart = wordTiming.startTime;
          const wordEnd = wordTiming.endTime;
          wordDuration = wordEnd - wordStart;

          if (adjustedTime >= wordEnd) {
            wordProgress = 1;
          } else if (adjustedTime >= wordStart) {
            wordProgress = (adjustedTime - wordStart) / (wordEnd - wordStart);
            isActiveWord = true;
          }
        } else {
          // Fallback: calculate progress based on character position
          const charsBefore = displayWords.slice(0, globalWordIdx).join(' ').length;
          const totalChars = fullText.length;
          const wordStartProgress = charsBefore / totalChars;
          const wordEndProgress = (charsBefore + word.length) / totalChars;

          if (lineProgress >= wordEndProgress) {
            wordProgress = 1;
          } else if (lineProgress >= wordStartProgress) {
            wordProgress = (lineProgress - wordStartProgress) / (wordEndProgress - wordStartProgress);
            isActiveWord = true;
          }
        }

        if (config.useModernEffects) {
          // Modern effects: word-by-word glow
          ctx.save();

          // Emphasis effect for held words (words sung longer than average)
          let emphasisScale = 1.0;
          let emphasisGlow = false;
          if (isActiveWord && hasWordTiming && wordDuration > 0.5) {
            // Long word - add emphasis
            emphasisScale = 1.0 + (wordProgress * 0.08); // Subtle scale
            emphasisGlow = true;
          }

          // Apply shadow for all text
          ctx.shadowColor = 'rgba(0,0,0,0.8)';
          ctx.shadowBlur = 20;
          ctx.shadowOffsetY = 4;

          // Draw ghost (inactive) text
          ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
          ctx.textAlign = 'left';
          ctx.fillText(word, xPos, yPos);

          // Draw active text with gradient
          if (wordProgress > 0) {
            ctx.save();
            if (emphasisScale > 1) {
              ctx.translate(xPos + wordWidth / 2, yPos);
              ctx.scale(emphasisScale, emphasisScale);
              ctx.translate(-(xPos + wordWidth / 2), -yPos);
            }

            const gradient = ctx.createLinearGradient(xPos, 0, xPos + wordWidth, 0);
            gradient.addColorStop(0, '#ffffff');
            gradient.addColorStop(Math.max(0, wordProgress - 0.1), '#ffffff');
            gradient.addColorStop(Math.min(1, wordProgress + 0.1), 'rgba(255,255,255,0)');
            gradient.addColorStop(1, 'rgba(255,255,255,0)');

            ctx.fillStyle = gradient;

            // Enhanced glow for active word
            if (isActiveWord || emphasisGlow) {
              ctx.shadowColor = 'rgba(34, 211, 238, 0.8)';
              ctx.shadowBlur = emphasisGlow ? 40 : 25;
            }

            ctx.fillText(word, xPos, yPos);
            ctx.restore();
          }

          ctx.restore();
        } else {
          // Simple mode: solid color transition
          if (wordProgress >= 1) {
            ctx.fillStyle = '#22d3ee'; // cyan-400
          } else if (wordProgress > 0) {
            // Partially active
            ctx.fillStyle = '#67e8f9'; // cyan-300
          } else {
            ctx.fillStyle = '#94a3b8'; // slate-400
          }
          ctx.textAlign = 'left';
          ctx.fillText(word, xPos, yPos);
        }

        xPos += wordWidth + spaceWidth;
      });
    });

    // Translation
    if (activeSub.translation) {
      const transY = baseY + (wrappedLines.length * lineHeight) + 40;
      ctx.textAlign = 'center';

      if (config.useModernEffects) {
        ctx.font = '500 28px Inter, system-ui, sans-serif';
        const transText = activeSub.translation;
        const transWidth = ctx.measureText(transText).width;
        const padding = 24;

        // Pill Background
        ctx.shadowBlur = 0;
        ctx.fillStyle = 'rgba(15, 23, 42, 0.6)';
        ctx.beginPath();
        ctx.roundRect((width / 2) - (transWidth / 2) - padding, transY - 20, transWidth + padding * 2, 40, 20);
        ctx.fill();

        ctx.fillStyle = '#67e8f9';
        ctx.fillText(transText, width / 2, transY + 2);
      } else {
        ctx.font = 'italic 32px Inter, Arial, sans-serif';
        ctx.fillStyle = '#a5f3fc';
        ctx.shadowColor = 'rgba(0,0,0,0.8)';
        ctx.shadowBlur = 4;
        ctx.fillText(activeSub.translation, width / 2, transY);
        ctx.shadowBlur = 0;
      }
    }

    ctx.restore();
  }
}


export const exportVideoWithFFmpeg = async (
  songData: SongData,
  onProgress: ProgressCallback,
  config: ExportConfig = {
    orientation: 'landscape',
    useModernEffects: true,
    syncOffsetMs: -50,
    fadeOutBeforeCut: true,
    wordLevelHighlight: true
  }
): Promise<Blob> => {
  const WIDTH = config.orientation === 'landscape' ? 1920 : 1080;
  const HEIGHT = config.orientation === 'landscape' ? 1080 : 1920;
  const FPS = 30;
  const BATCH_SIZE = 60; // Upload every 60 frames (2 seconds)

  onProgress({ stage: 'preparing', progress: 0, message: 'Analyzing audio...' });

  // 1. Fetch and Decode Audio
  const audioResponse = await fetch(songData.audioUrl);
  const audioBlob = await audioResponse.blob();
  const arrayBuffer = await audioBlob.arrayBuffer();
  const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
  const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

  // 2. Extract Frequency Data
  const frequencyDataArray = await extractFrequencyData(audioBuffer, FPS);

  onProgress({ stage: 'preparing', progress: 10, message: 'Initializing render session...' });

  // 3. Initialize Session
  const initFormData = new FormData();
  initFormData.append('audio', audioBlob, 'audio.mp3');

  const initRes = await fetch(`${SERVER_URL}/api/export/init`, {
    method: 'POST',
    body: initFormData
  });

  if (!initRes.ok) {
    throw new Error('Failed to initialize export session');
  }

  const { sessionId } = await initRes.json();

  onProgress({ stage: 'preparing', progress: 20, message: 'Loading high-res assets...' });

  // 4. Preload images
  const imageAssets: { time: number; img: HTMLImageElement }[] = [];
  const sortedPrompts = [...songData.prompts].sort(
    (a, b) => (a.timestampSeconds || 0) - (b.timestampSeconds || 0)
  );

  for (const prompt of sortedPrompts) {
    const generated = songData.generatedImages.find(g => g.promptId === prompt.id);
    if (generated) {
      const img = new Image();
      img.crossOrigin = "anonymous";
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = reject;
        img.src = generated.imageUrl;
      });
      imageAssets.push({ time: prompt.timestampSeconds || 0, img });
    }
  }

  const duration = audioBuffer.duration;
  const totalFrames = Math.ceil(duration * FPS);

  onProgress({ stage: 'rendering', progress: 0, message: 'Rendering cinematic frames...' });

  // 5. Create canvas
  const canvas = document.createElement('canvas');
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const ctx = canvas.getContext('2d')!;

  // Polyfill roundRect
  applyPolyfills(ctx);

  // 6. Render Loop with Batch Upload
  let previousFreqData: Uint8Array | null = null;
  let frameBuffer: { blob: Blob; name: string }[] = [];

  for (let frame = 0; frame < totalFrames; frame++) {
    const currentTime = frame / FPS;

    const freqData = frequencyDataArray[frame] || new Uint8Array(128).fill(0);

    renderFrameToCanvas(
      ctx,
      WIDTH,
      HEIGHT,
      currentTime,
      imageAssets,
      songData.parsedSubtitles,
      freqData,
      previousFreqData,
      config
    );

    previousFreqData = freqData;

    const blob = await new Promise<Blob>((resolve) => {
      canvas.toBlob(b => resolve(b!), 'image/jpeg', 0.90);
    });

    // Add to buffer
    frameBuffer.push({
      blob,
      name: `frame${frame.toString().padStart(6, '0')}.jpg`
    });

    // Upload if batch is full
    if (frameBuffer.length >= BATCH_SIZE) {
      const chunkFormData = new FormData();
      frameBuffer.forEach(f => chunkFormData.append('frames', f.blob, f.name));

      const chunkRes = await fetch(`${SERVER_URL}/api/export/chunk?sessionId=${sessionId}`, {
        method: 'POST',
        body: chunkFormData
      });

      if (!chunkRes.ok) throw new Error('Failed to upload video chunk');

      frameBuffer = []; // Clear buffer
    }

    // Update progress
    if (frame % FPS === 0) {
      const progress = Math.round((frame / totalFrames) * 90); // Cap "rendering" at 90%
      onProgress({ stage: 'rendering', progress, message: `Rendering ${Math.floor(frame / FPS)}s / ${Math.floor(duration)}s` });
    }
  }

  // Upload remaining frames
  if (frameBuffer.length > 0) {
    const chunkFormData = new FormData();
    frameBuffer.forEach(f => chunkFormData.append('frames', f.blob, f.name));

    await fetch(`${SERVER_URL}/api/export/chunk?sessionId=${sessionId}`, {
      method: 'POST',
      body: chunkFormData
    });
  }

  onProgress({ stage: 'encoding', progress: 95, message: 'Finalizing video on server...' });

  const finalizeRes = await fetch(`${SERVER_URL}/api/export/finalize`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionId, fps: FPS })
  });

  if (!finalizeRes.ok) {
    const error = await finalizeRes.json();
    throw new Error(error.error || 'Export failed');
  }

  onProgress({ stage: 'encoding', progress: 99, message: 'Downloading...' });

  const videoBlob = await finalizeRes.blob();

  onProgress({ stage: 'complete', progress: 100, message: 'Export complete!' });

  return videoBlob;
};

export const exportVideoClientSide = async (
  songData: SongData,
  onProgress: ProgressCallback,
  config: ExportConfig = {
    orientation: 'landscape',
    useModernEffects: true,
    syncOffsetMs: -50,
    fadeOutBeforeCut: true,
    wordLevelHighlight: true
  }
): Promise<Blob> => {
  const WIDTH = config.orientation === 'landscape' ? 1920 : 1080;
  const HEIGHT = config.orientation === 'landscape' ? 1080 : 1920;
  const FPS = 30;

  onProgress({ stage: 'loading', progress: 0, message: 'Loading FFmpeg Core...' });

  const ffmpeg = new FFmpeg();
  const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.10/dist/esm';
  
  try {
      await ffmpeg.load({
          coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
          wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
      });
  } catch (e) {
      console.error("FFmpeg load failed", e);
      throw new Error("Failed to load FFmpeg. Check browser compatibility.");
  }

  onProgress({ stage: 'preparing', progress: 0, message: 'Analyzing audio...' });

  // 1. Fetch and Decode Audio
  const audioResponse = await fetch(songData.audioUrl);
  const audioBlob = await audioResponse.blob();
  const arrayBuffer = await audioBlob.arrayBuffer();
  const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
  const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

  // Write audio to FFmpeg FS
  await ffmpeg.writeFile('audio.mp3', await fetchFile(audioBlob));

  // 2. Extract Frequency Data
  const frequencyDataArray = await extractFrequencyData(audioBuffer, FPS);

  onProgress({ stage: 'preparing', progress: 20, message: 'Loading high-res assets...' });

  // 3. Preload images
  const imageAssets: { time: number; img: HTMLImageElement }[] = [];
  const sortedPrompts = [...songData.prompts].sort(
    (a, b) => (a.timestampSeconds || 0) - (b.timestampSeconds || 0)
  );

  for (const prompt of sortedPrompts) {
    const generated = songData.generatedImages.find(g => g.promptId === prompt.id);
    if (generated) {
      const img = new Image();
      img.crossOrigin = "anonymous";
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = reject;
        img.src = generated.imageUrl;
      });
      imageAssets.push({ time: prompt.timestampSeconds || 0, img });
    }
  }

  const duration = audioBuffer.duration;
  const totalFrames = Math.ceil(duration * FPS);

  onProgress({ stage: 'rendering', progress: 0, message: 'Rendering frames...' });

  // 4. Create canvas
  const canvas = document.createElement('canvas');
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const ctx = canvas.getContext('2d')!;

  // Polyfill roundRect
  applyPolyfills(ctx);

  // 5. Render Loop
  let previousFreqData: Uint8Array | null = null;

  for (let frame = 0; frame < totalFrames; frame++) {
    const currentTime = frame / FPS;
    const freqData = frequencyDataArray[frame] || new Uint8Array(128).fill(0);

    renderFrameToCanvas(
      ctx,
      WIDTH,
      HEIGHT,
      currentTime,
      imageAssets,
      songData.parsedSubtitles,
      freqData,
      previousFreqData,
      config
    );

    previousFreqData = freqData;

    // Convert canvas to binary for FFmpeg
    // We use a lower quality JPEG for speed in WASM, or PNG for quality. 
    // JPEG is much faster to encode.
    const blob = await new Promise<Blob>((resolve) => {
      canvas.toBlob(b => resolve(b!), 'image/jpeg', 0.90);
    });
    
    const frameName = `frame${frame.toString().padStart(6, '0')}.jpg`;
    await ffmpeg.writeFile(frameName, await fetchFile(blob));

    // Update progress
    if (frame % FPS === 0) {
      const progress = Math.round((frame / totalFrames) * 80); 
      onProgress({ stage: 'rendering', progress, message: `Rendering ${Math.floor(frame / FPS)}s / ${Math.floor(duration)}s` });
    }
  }

  onProgress({ stage: 'encoding', progress: 85, message: 'Encoding MP4 (WASM)...' });

  // 6. Run FFmpeg
  await ffmpeg.exec([
    '-framerate', String(FPS),
    '-i', 'frame%06d.jpg',
    '-i', 'audio.mp3',
    '-c:v', 'libx264',
    '-pix_fmt', 'yuv420p',
    '-shortest',
    '-preset', 'ultrafast', // Speed over size for browser
    'output.mp4'
  ]);

  onProgress({ stage: 'complete', progress: 100, message: 'Done!' });

  // 7. Read output
  const data = await ffmpeg.readFile('output.mp4');
  return new Blob([data], { type: 'video/mp4' });
};
