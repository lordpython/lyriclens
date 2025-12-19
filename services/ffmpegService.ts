import { SongData } from '../types';

const SERVER_URL = 'http://localhost:3001';

export type ExportProgress = {
  stage: 'loading' | 'preparing' | 'rendering' | 'encoding' | 'complete';
  progress: number;
  message: string;
};

export type ProgressCallback = (progress: ExportProgress) => void;

const renderFrameToCanvas = (
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  currentTime: number,
  imageAssets: { time: number; img: HTMLImageElement }[],
  subtitles: SongData['parsedSubtitles']
): void => {
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, width, height);

  let currentImg = imageAssets[0]?.img;
  for (const asset of imageAssets) {
    if (currentTime >= asset.time) {
      currentImg = asset.img;
    } else {
      break;
    }
  }

  if (currentImg) {
    const scale = Math.max(width / currentImg.width, height / currentImg.height);
    const x = (width - currentImg.width * scale) / 2;
    const y = (height - currentImg.height * scale) / 2;
    ctx.drawImage(currentImg, x, y, currentImg.width * scale, currentImg.height * scale);
  }

  const gradient = ctx.createLinearGradient(0, height - 200, 0, height);
  gradient.addColorStop(0, 'rgba(0,0,0,0)');
  gradient.addColorStop(1, 'rgba(0,0,0,0.8)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, height - 250, width, 250);

  const activeSub = subtitles.find(
    s => currentTime >= s.startTime && currentTime <= s.endTime
  );

  if (activeSub) {
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 42px Inter, Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.shadowColor = 'rgba(0,0,0,0.9)';
    ctx.shadowBlur = 6;
    ctx.shadowOffsetX = 2;
    ctx.shadowOffsetY = 2;

    const words = activeSub.text.split(' ');
    let line = '';
    const lines: string[] = [];
    
    for (const word of words) {
      const testLine = line + word + ' ';
      if (ctx.measureText(testLine).width > width - 120 && line) {
        lines.push(line.trim());
        line = word + ' ';
      } else {
        line = testLine;
      }
    }
    lines.push(line.trim());

    lines.forEach((l, i) => {
      const yPos = height - 80 - ((lines.length - 1 - i) * 55);
      ctx.fillText(l, width / 2, yPos);
    });

    if (activeSub.translation) {
      ctx.font = 'italic 28px Inter, Arial, sans-serif';
      ctx.fillStyle = '#22d3ee';
      ctx.fillText(activeSub.translation, width / 2, height - 30);
    }
  }
};


export const exportVideoWithFFmpeg = async (
  songData: SongData,
  onProgress: ProgressCallback
): Promise<Blob> => {
  const WIDTH = 1280;
  const HEIGHT = 720;
  const FPS = 24; // Reduced from 30 for faster processing

  onProgress({ stage: 'preparing', progress: 0, message: 'Preparing assets...' });

  // Preload images
  const imageAssets: { time: number; img: HTMLImageElement }[] = [];
  const sortedPrompts = [...songData.prompts].sort(
    (a, b) => (a.timestampSeconds || 0) - (b.timestampSeconds || 0)
  );

  for (const prompt of sortedPrompts) {
    const generated = songData.generatedImages.find(g => g.promptId === prompt.id);
    if (generated) {
      const img = new Image();
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = reject;
        img.src = generated.imageUrl;
      });
      imageAssets.push({ time: prompt.timestampSeconds || 0, img });
    }
  }

  // Get audio duration and blob
  const audioResponse = await fetch(songData.audioUrl);
  const audioBlob = await audioResponse.blob();
  
  const audio = new Audio(songData.audioUrl);
  await new Promise<void>(resolve => {
    audio.onloadedmetadata = () => resolve();
  });
  const duration = audio.duration;
  const totalFrames = Math.ceil(duration * FPS);

  onProgress({ stage: 'rendering', progress: 0, message: 'Rendering frames...' });

  // Create canvas
  const canvas = document.createElement('canvas');
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const ctx = canvas.getContext('2d')!;

  // Build FormData with frames as blobs (much faster than base64 JSON)
  const formData = new FormData();
  formData.append('fps', String(FPS));
  formData.append('audio', audioBlob, 'audio.mp3');

  // Render frames and add to FormData
  for (let frame = 0; frame < totalFrames; frame++) {
    const currentTime = frame / FPS;
    renderFrameToCanvas(ctx, WIDTH, HEIGHT, currentTime, imageAssets, songData.parsedSubtitles);
    
    // Use JPEG for much smaller file size (vs PNG)
    const blob = await new Promise<Blob>((resolve) => {
      canvas.toBlob(b => resolve(b!), 'image/jpeg', 0.85);
    });
    
    formData.append('frames', blob, `frame${frame.toString().padStart(6, '0')}.jpg`);

    if (frame % FPS === 0) {
      const progress = Math.round((frame / totalFrames) * 100);
      onProgress({ stage: 'rendering', progress, message: `Rendering ${Math.floor(frame/FPS)}s / ${Math.floor(duration)}s` });
    }
  }

  onProgress({ stage: 'encoding', progress: 0, message: 'Uploading to FFmpeg server...' });

  // Send as multipart form (binary, not base64)
  const response = await fetch(`${SERVER_URL}/api/export-multipart`, {
    method: 'POST',
    body: formData
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Export failed');
  }

  onProgress({ stage: 'encoding', progress: 80, message: 'Encoding video...' });

  // Response is the video blob directly
  const videoBlob = await response.blob();

  onProgress({ stage: 'complete', progress: 100, message: 'Export complete!' });

  return videoBlob;
};
