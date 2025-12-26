# Video Generation Pipeline Optimization Plan

## Executive Summary

This plan outlines comprehensive optimizations to the LyricLens video generation pipeline focusing on:
1. Dynamic asset calculation using agentDirectorService
2. Bidirectional RTL text wipe animations
3. Refined audio visualizer with proper layering
4. Visual hierarchy layout system

---

## 1. Dynamic Asset Calculation with agentDirectorService

### Current State
- Fixed 10 prompts generated regardless of audio duration
- No semantic analysis of content density
- Potential for repetitive loops or insufficient coverage

### Proposed Solution

#### 1.1 New Service: `assetCalculatorService.ts`

Create a new service that integrates with [`agentDirectorService`](services/agentDirectorService.ts) to calculate optimal asset count.

```typescript
// services/assetCalculatorService.ts

export interface AssetCalculationInput {
  audioDuration: number; // seconds
  analysisOutput: AnalysisOutput; // from directorService
  videoPurpose: VideoPurpose;
  contentType: "lyrics" | "story";
  minAssets?: number; // minimum assets (default: 6)
  maxAssets?: number; // maximum assets (default: 15)
}

export interface AssetCalculationResult {
  optimalAssetCount: number;
  assetTimestamps: number[]; // seconds for each asset
  reasoning: string;
  sections: {
    start: number;
    end: number;
    assetCount: number;
    emotionalIntensity: number;
  }[];
}

export async function calculateOptimalAssets(
  input: AssetCalculationInput
): Promise<AssetCalculationResult>
```

#### 1.2 Calculation Algorithm

**Factors to Consider:**
1. **Audio Duration**: Longer content needs more assets
   - < 30s: 6-8 assets
   - 30-60s: 8-10 assets
   - 60-120s: 10-12 assets
   - > 120s: 12-15 assets

2. **Semantic Sections**: Use [`AnalysisOutput.sections`](services/directorService.ts:25-31) from directorService
   - Each section (intro, verse, chorus, bridge) gets at least 1 asset
   - High emotional intensity sections (intensity > 7) get 2 assets
   - Transition sections get dedicated assets

3. **Content Density**: Analyze subtitle timing
   - Dense lyrics (short intervals) → more assets
   - Sparse lyrics (long intervals) → fewer assets

4. **Video Purpose**: Adjust based on [`VideoPurpose`](constants/video.ts:47-53)
   - `social_short`: Fewer, faster cuts (6-8 assets)
   - `music_video`: Balanced (8-12 assets)
   - `documentary`: More coverage (10-15 assets)
   - `lyric_video`: Text-focused (6-10 assets)

#### 1.3 Integration Points

**Modify [`useLyricLens.ts`](hooks/useLyricLens.ts:84-102):**
```typescript
// After transcription, before prompt generation
const audioDuration = audioBuffer.duration;

// Get analysis from agentDirectorService
const analysis = await runAnalyzer(srt, contentType);

// Calculate optimal asset count
const assetCalc = await calculateOptimalAssets({
  audioDuration,
  analysisOutput: analysis,
  videoPurpose,
  contentType,
});

// Pass asset count to prompt generation
prompts = await generatePromptsWithAgent(
  srt,
  selectedStyle,
  contentType,
  videoPurpose,
  globalSubject,
  { targetAssetCount: assetCalc.optimalAssetCount }
);
```

**Modify [`agentDirectorService.ts`](services/agentDirectorService.ts:171):**
```typescript
// Add to AgentDirectorConfig
export interface AgentDirectorConfig {
  model?: string;
  temperature?: number;
  maxIterations?: number;
  qualityThreshold?: number;
  targetAssetCount?: number; // NEW: Dynamic asset count
}

// Update generate_storyboard tool description
description: `Generate a visual storyboard with ${targetAssetCount || 10} detailed image prompts...`
```

---

## 2. Bidirectional RTL Text Wipe Animation

### Current State
- RTL detection exists in [`lib/utils.ts`](lib/utils.ts:24-27)
- Text rendering in [`ffmpegService.ts`](services/ffmpegService.ts:388-596) handles RTL but lacks wipe animation
- No directional reveal effect

### Proposed Solution

#### 2.1 Wipe Animation System

**New Types in [`types.ts`](types.ts):**
```typescript
export type TextRevealDirection = "ltr" | "rtl" | "center-out" | "center-in";

export interface TextAnimationConfig {
  revealDirection: TextRevealDirection;
  revealDuration: number; // seconds
  wordReveal: boolean; // word-by-word or line-by-line
}
```

#### 2.2 Canvas Wipe Implementation

**Add to [`ffmpegService.ts`](services/ffmpegService.ts):**

```typescript
/**
 * Renders text with directional wipe animation
 */
function renderTextWithWipe(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  fontSize: number,
  progress: number, // 0-1 animation progress
  isRTL: boolean,
  config: TextAnimationConfig
): void {
  const textWidth = ctx.measureText(text).width;
  
  ctx.save();
  
  // Create clipping region for wipe effect
  ctx.beginPath();
  
  if (isRTL) {
    // RTL: Reveal from right to left
    const revealWidth = textWidth * progress;
    ctx.rect(x + textWidth - revealWidth, y - fontSize, revealWidth, fontSize * 1.5);
  } else {
    // LTR: Reveal from left to right
    const revealWidth = textWidth * progress;
    ctx.rect(x, y - fontSize, revealWidth, fontSize * 1.5);
  }
  
  ctx.clip();
  
  // Render text (only visible in clipped region)
  ctx.fillText(text, x, y);
  
  ctx.restore();
}
```

#### 2.3 Word-Level Wipe Integration

**Modify [`renderFrameToCanvas`](services/ffmpegService.ts:353-639):**

```typescript
// Calculate word reveal progress with wipe
if (config.wordLevelHighlight) {
  const wordRevealProgress = calculateWordRevealProgress(
    adjustedTime,
    activeSub,
    isTextRTL
  );
  
  // Render each word with wipe effect
  displayLineWords.forEach((word, wordIdx) => {
    const wordProgress = wordRevealProgress[wordIdx] || 0;
    
    renderTextWithWipe(
      ctx,
      word,
      xPos,
      yPos,
      fontSize,
      wordProgress,
      isTextRTL,
      {
        revealDirection: isTextRTL ? "rtl" : "ltr",
        revealDuration: 0.3, // 300ms per word
        wordReveal: true
      }
    );
    
    xPos += wordWidth + spaceWidth;
  });
}
```

#### 2.4 Animation Timing Calculation

**New Helper Function:**
```typescript
function calculateWordRevealProgress(
  currentTime: number,
  subtitle: SubtitleItem,
  isRTL: boolean
): number[] {
  if (!subtitle.words || subtitle.words.length === 0) {
    return [1]; // Full reveal for non-word-timed
  }
  
  const revealDuration = 0.3; // 300ms per word
  const progress: number[] = [];
  
  subtitle.words.forEach((word, idx) => {
    const wordStart = word.startTime;
    const wordEnd = word.endTime;
    
    // For RTL, reverse index for display order
    const displayIdx = isRTL 
      ? subtitle.words.length - 1 - idx 
      : idx;
    
    if (currentTime < wordStart) {
      progress[displayIdx] = 0;
    } else if (currentTime >= wordEnd) {
      progress[displayIdx] = 1;
    } else {
      // In reveal window
      progress[displayIdx] = (currentTime - wordStart) / revealDuration;
    }
  });
  
  return progress;
}
```

---

## 3. Refined Audio Visualizer

### Current State
- Visualizer rendered at full opacity in [`ffmpegService.ts:256-333`](services/ffmpegService.ts:256-333)
- Height: 60% of canvas height
- No z-index control (rendered before text overlay)
- Gradient: 0.2-0.8 opacity

### Proposed Solution

#### 3.1 Visualizer Configuration

**Add to [`ExportConfig`](services/ffmpegService.ts:50-59):**
```typescript
export interface ExportConfig {
  orientation: "landscape" | "portrait";
  useModernEffects: boolean;
  syncOffsetMs: number;
  fadeOutBeforeCut: boolean;
  wordLevelHighlight: boolean;
  contentMode: "music" | "story";
  transitionType: TransitionType;
  transitionDuration: number;
  
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
}
```

#### 3.2 Layered Rendering System

**Modify [`renderFrameToCanvas`](services/ffmpegService.ts:67-640) rendering order:**

```typescript
// NEW LAYER ORDER:
// 1. Background (black)
// 2. Visual Layer (images/videos with Ken Burns)
// 3. Visualizer Layer (translucent, behind text)
// 4. Gradient Overlay (subtle)
// 5. Text Layer (lyrics with wipe animation)
// 6. Translation Layer (if present)

const renderFrameToCanvas = async (
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  currentTime: number,
  assets: RenderAsset[],
  subtitles: SongData["parsedSubtitles"],
  frequencyData: Uint8Array | null,
  previousFrequencyData: Uint8Array | null,
  config: ExportConfig,
): Promise<void> => {
  // 1. Background
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, width, height);
  
  // 2. Visual Layer (existing code)
  // ... (keep existing asset rendering)
  
  // 3. Visualizer Layer (NEW: refined)
  if (frequencyData && config.contentMode === "music" && config.visualizerConfig?.enabled) {
    await renderVisualizerLayer(
      ctx,
      width,
      height,
      frequencyData,
      previousFrequencyData,
      config.visualizerConfig,
      config.useModernEffects
    );
  }
  
  // 4. Gradient Overlay (existing, adjusted)
  // ... (keep existing overlay code)
  
  // 5. Text Layer (NEW: with wipe animation)
  // ... (modified text rendering with wipe)
  
  // 6. Translation Layer (existing)
  // ... (keep existing translation code)
};
```

#### 3.3 Refined Visualizer Rendering

**New Function:**
```typescript
async function renderVisualizerLayer(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  frequencyData: Uint8Array,
  previousFrequencyData: Uint8Array | null,
  config: NonNullable<ExportConfig["visualizerConfig"]>,
  useModernEffects: boolean
): Promise<void> {
  const bufferLength = frequencyData.length;
  const maxHeight = height * config.maxHeightRatio;
  const barWidth = config.barWidth;
  const barGap = config.barGap;
  
  // Calculate total width needed
  const totalWidth = (barWidth + barGap) * bufferLength;
  const startX = (width - totalWidth) / 2;
  
  ctx.save();
  
  // Set reduced opacity
  ctx.globalAlpha = config.opacity;
  
  // Create gradient based on color scheme
  const gradient = ctx.createLinearGradient(0, height, 0, height - maxHeight);
  
  switch (config.colorScheme) {
    case "cyan-purple":
      gradient.addColorStop(0, `rgba(34, 211, 238, ${config.opacity * 0.5})`);
      gradient.addColorStop(0.5, `rgba(34, 211, 238, ${config.opacity * 0.8})`);
      gradient.addColorStop(1, `rgba(167, 139, 250, ${config.opacity})`);
      break;
    case "rainbow":
      // Multi-color gradient
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
    
    // Smooth with previous frame
    if (previousFrequencyData) {
      value = (value + previousFrequencyData[i]) / 2;
    }
    
    // Constrain height
    const barHeight = (value / 255) * maxHeight;
    
    if (barHeight > 0) {
      const offset = i * (barWidth + barGap);
      const radius = barWidth / 2;
      
      // Right side
      ctx.beginPath();
      if (useModernEffects) {
        ctx.roundRect(
          centerX + offset,
          height - barHeight,
          barWidth,
          barHeight,
          [radius, radius, 0, 0]
        );
      } else {
        ctx.rect(centerX + offset, height - barHeight, barWidth, barHeight);
      }
      ctx.fill();
      
      // Left side (mirrored)
      ctx.beginPath();
      if (useModernEffects) {
        ctx.roundRect(
          centerX - offset - barWidth,
          height - barHeight,
          barWidth,
          barHeight,
          [radius, radius, 0, 0]
        );
      } else {
        ctx.rect(centerX - offset - barWidth, height - barHeight, barWidth, barHeight);
      }
      ctx.fill();
    }
  }
  
  ctx.restore();
}
```

---

## 4. Visual Hierarchy Layout System

### Current State
- No defined zones
- Elements overlap (visualizer, text, images)
- Congested layout in portrait mode

### Proposed Solution

#### 4.1 Zone-Based Layout System

**New Types in [`types.ts`](types.ts):**
```typescript
export interface LayoutZone {
  name: string;
  x: number; // normalized 0-1
  y: number; // normalized 0-1
  width: number; // normalized 0-1
  height: number; // normalized 0-1
  zIndex: number;
}

export interface LayoutConfig {
  orientation: "landscape" | "portrait";
  zones: {
    background: LayoutZone;
    visualizer: LayoutZone;
    text: LayoutZone;
    translation: LayoutZone;
  };
}
```

#### 4.2 Layout Presets

**New File: `constants/layout.ts`**
```typescript
import { LayoutConfig } from "../types";

export const LAYOUT_PRESETS: Record<string, LayoutConfig> = {
  landscape: {
    orientation: "landscape",
    zones: {
      background: {
        name: "background",
        x: 0, y: 0, width: 1, height: 1, zIndex: 0
      },
      visualizer: {
        name: "visualizer",
        x: 0, y: 0.75, width: 1, height: 0.25, zIndex: 1
      },
      text: {
        name: "text",
        x: 0.1, y: 0.35, width: 0.8, height: 0.3, zIndex: 10
      },
      translation: {
        name: "translation",
        x: 0.1, y: 0.65, width: 0.8, height: 0.1, zIndex: 11
      }
    }
  },
  portrait: {
    orientation: "portrait",
    zones: {
      background: {
        name: "background",
        x: 0, y: 0, width: 1, height: 1, zIndex: 0
      },
      visualizer: {
        name: "visualizer",
        x: 0, y: 0.85, width: 1, height: 0.15, zIndex: 1
      },
      text: {
        name: "text",
        x: 0.05, y: 0.25, width: 0.9, height: 0.4, zIndex: 10
      },
      translation: {
        name: "translation",
        x: 0.05, y: 0.65, width: 0.9, height: 0.15, zIndex: 11
      }
    }
  }
};
```

#### 4.3 Zone Rendering Helper

**New Function in [`ffmpegService.ts`](services/ffmpegService.ts):**
```typescript
function getZoneBounds(
  zone: LayoutZone,
  canvasWidth: number,
  canvasHeight: number
): { x: number; y: number; width: number; height: number } {
  return {
    x: zone.x * canvasWidth,
    y: zone.y * canvasHeight,
    width: zone.width * canvasWidth,
    height: zone.height * canvasHeight
  };
}

function renderInZone(
  ctx: CanvasRenderingContext2D,
  zone: LayoutZone,
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
```

#### 4.4 Updated Rendering with Zones

**Modify [`renderFrameToCanvas`](services/ffmpegService.ts:67-640):**
```typescript
const renderFrameToCanvas = async (
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  currentTime: number,
  assets: RenderAsset[],
  subtitles: SongData["parsedSubtitles"],
  frequencyData: Uint8Array | null,
  previousFrequencyData: Uint8Array | null,
  config: ExportConfig,
): Promise<void> => {
  // Get layout preset
  const layout = LAYOUT_PRESETS[config.orientation];
  
  // 1. Background Zone
  renderInZone(ctx, layout.zones.background, width, height, (bounds) => {
    ctx.fillStyle = "#000";
    ctx.fillRect(bounds.x, bounds.y, bounds.width, bounds.height);
  });
  
  // 2. Visual Layer Zone (full canvas, behind everything)
  renderInZone(ctx, layout.zones.background, width, height, (bounds) => {
    // Render assets with Ken Burns and transitions
    // ... (existing asset rendering code)
  });
  
  // 3. Visualizer Zone (bottom, translucent)
  if (frequencyData && config.contentMode === "music" && config.visualizerConfig?.enabled) {
    renderInZone(ctx, layout.zones.visualizer, width, height, (bounds) => {
      renderVisualizerLayer(
        ctx,
        bounds.width,
        bounds.height,
        frequencyData,
        previousFrequencyData,
        config.visualizerConfig,
        config.useModernEffects
      );
    });
  }
  
  // 4. Gradient Overlay Zone (subtle, full canvas)
  renderInZone(ctx, layout.zones.background, width, height, (bounds) => {
    // ... (existing overlay code)
  });
  
  // 5. Text Zone (centered, with wipe animation)
  if (activeSub && subtitleOpacity > 0) {
    renderInZone(ctx, layout.zones.text, width, height, (bounds) => {
      renderTextWithWipe(
        ctx,
        activeSub.text,
        bounds.x + bounds.width / 2, // center X
        bounds.y + bounds.height / 2, // center Y
        fontSize,
        wordProgress,
        isTextRTL,
        textAnimationConfig
      );
    });
  }
  
  // 6. Translation Zone (below text)
  if (activeSub && activeSub.translation) {
    renderInZone(ctx, layout.zones.translation, width, height, (bounds) => {
      // ... (existing translation rendering)
    });
  }
};
```

---

## 5. Implementation Order

### Phase 1: Foundation (Priority: High)
1. Create `services/assetCalculatorService.ts`
2. Create `constants/layout.ts`
3. Add new types to `types.ts`

### Phase 2: Dynamic Assets (Priority: High)
4. Integrate asset calculation into `useLyricLens.ts`
5. Update `agentDirectorService.ts` to accept dynamic asset count
6. Test with various audio durations

### Phase 3: RTL Wipe Animation (Priority: Medium)
7. Implement `renderTextWithWipe` function
8. Add `calculateWordRevealProgress` helper
9. Update text rendering in `ffmpegService.ts`
10. Test with Arabic/Hebrew content

### Phase 4: Visualizer Refinement (Priority: Medium)
11. Add `visualizerConfig` to `ExportConfig`
12. Implement `renderVisualizerLayer` function
13. Update rendering order in `renderFrameToCanvas`
14. Test opacity and height constraints

### Phase 5: Layout System (Priority: Medium)
15. Implement zone-based rendering helpers
16. Update `renderFrameToCanvas` with zones
17. Test landscape and portrait orientations
18. Verify no overlapping elements

### Phase 6: UI Updates (Priority: Low)
19. Add visualizer controls to `VideoExportModal.tsx`
20. Add layout preview option
21. Update default configurations

---

## 6. Testing Strategy

### 6.1 Dynamic Asset Calculation
- Test with short audio (< 30s)
- Test with long audio (> 120s)
- Verify semantic section coverage
- Check emotional intensity distribution

### 6.2 RTL Wipe Animation
- Test with Arabic text
- Test with Hebrew text
- Test with mixed LTR/RTL content
- Verify smooth animation timing

### 6.3 Visualizer Refinement
- Test opacity levels (0.1, 0.15, 0.2)
- Test height ratios (0.2, 0.25, 0.3)
- Verify z-index layering
- Check performance impact

### 6.4 Layout System
- Test landscape orientation
- Test portrait orientation
- Verify zone boundaries
- Check for element overlap
- Test with different aspect ratios

---

## 7. Performance Considerations

### 7.1 Asset Calculation
- Cache analysis results to avoid re-computation
- Use efficient algorithms for section mapping
- Limit maximum assets to prevent excessive generation

### 7.2 Wipe Animation
- Use canvas clipping for performance
- Pre-calculate animation progress
- Avoid per-frame object creation

### 7.3 Visualizer
- Limit frequency data resolution
- Use efficient gradient creation
- Batch rendering operations

### 7.4 Layout System
- Pre-calculate zone bounds
- Use normalized coordinates
- Minimize state changes

---

## 8. Backward Compatibility

### 8.1 Configuration Migration
- Provide default values for new config options
- Maintain existing behavior when new options not set
- Add deprecation warnings if needed

### 8.2 API Stability
- Keep existing function signatures
- Add optional parameters with defaults
- Document breaking changes

---

## 9. Documentation Updates

### 9.1 Code Comments
- Document new functions
- Explain algorithm choices
- Add usage examples

### 9.2 User Documentation
- Update README with new features
- Add configuration guide
- Provide troubleshooting tips

---

## 10. Success Metrics

### 10.1 Dynamic Assets
- Eliminate repetitive loops
- Reduce low-quality assets by 50%
- Improve semantic coverage by 30%

### 10.2 RTL Wipe Animation
- Smooth directional reveal
- Correct RTL text rendering
- No visual artifacts

### 10.3 Visualizer Refinement
- Reduced visual congestion
- Better text readability
- Professional appearance

### 10.4 Layout System
- Clear visual hierarchy
- No element overlap
- Balanced composition

---

## Appendix: File Changes Summary

### New Files
- `services/assetCalculatorService.ts`
- `constants/layout.ts`

### Modified Files
- `types.ts` - Add new types
- `services/agentDirectorService.ts` - Dynamic asset count
- `services/ffmpegService.ts` - Wipe animation, visualizer, layout
- `hooks/useLyricLens.ts` - Asset calculation integration
- `components/VideoExportModal.tsx` - UI controls

### No Changes Required
- `services/videoService.ts`
- `services/geminiService.ts`
- `services/directorService.ts`
- `utils/audioAnalysis.ts`
- `lib/utils.ts` (already has RTL detection)