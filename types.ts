export interface WordTiming {
  word: string;
  startTime: number; // seconds
  endTime: number; // seconds
}

export interface SubtitleItem {
  id: number;
  startTime: number;
  endTime: number;
  text: string;
  translation?: string;
  words?: WordTiming[]; // Optional for backward-compat with word-level timing
}

/**
 * Asset generation type for each prompt card
 * - image: Generate a still image only
 * - video: Generate a video directly from prompt (Veo)
 * - video_with_image: Generate image first, then animate it (DeAPI style)
 */
export type AssetType = "image" | "video" | "video_with_image";

export interface ImagePrompt {
  id: string;
  text: string;
  mood: string;
  timestamp?: string; // Rough timestamp string (e.g. "00:01:30")
  timestampSeconds?: number; // Parsed seconds for sorting/display
  assetType?: AssetType; // Per-card generation type (defaults to global setting)
}

export interface GeneratedImage {
  promptId: string;
  imageUrl: string;
  type?: "image" | "video";
  /** If video_with_image, stores the base image separately */
  baseImageUrl?: string;
}

export enum AppState {
  IDLE = "IDLE",
  CONFIGURING = "CONFIGURING",
  PROCESSING_AUDIO = "PROCESSING_AUDIO",
  TRANSCRIBING = "TRANSCRIBING",
  ANALYZING_LYRICS = "ANALYZING_LYRICS",
  GENERATING_PROMPTS = "GENERATING_PROMPTS",
  READY = "READY",
  ERROR = "ERROR",
}

export interface SongData {
  fileName: string;
  audioUrl: string; // Blob URL for playback
  srtContent: string;
  parsedSubtitles: SubtitleItem[];
  prompts: ImagePrompt[];
  generatedImages: GeneratedImage[];
}

/**
 * Transition effects between scenes during video export
 */
export type TransitionType =
  | "none"      // Hard cut
  | "fade"      // Fade through black
  | "dissolve"  // Cross-dissolve (blend)
  | "zoom"      // Zoom into next scene
  | "slide";    // Slide left/right

/**
 * Text reveal direction for wipe animations
 */
export type TextRevealDirection = "ltr" | "rtl" | "center-out" | "center-in";

/**
 * Layout zone definition for zone-based rendering
 * Uses normalized coordinates (0-1) for responsive scaling
 */
export interface LayoutZone {
  name: string;
  x: number; // normalized 0-1
  y: number; // normalized 0-1
  width: number; // normalized 0-1
  height: number; // normalized 0-1
  zIndex: number;
}

/**
 * Layout configuration with zone definitions
 */
export interface LayoutConfig {
  orientation: "landscape" | "portrait";
  zones: {
    background: LayoutZone;
    visualizer: LayoutZone;
    text: LayoutZone;
    translation: LayoutZone;
  };
}

/**
 * Text animation configuration for wipe effects
 */
export interface TextAnimationConfig {
  revealDirection: TextRevealDirection;
  revealDuration: number; // seconds
  wordReveal: boolean; // word-by-word or line-by-line
}

/**
 * Visualizer configuration options
 */
export interface VisualizerConfig {
  enabled: boolean;
  opacity: number; // 0.0-1.0
  maxHeightRatio: number; // 0.0-1.0
  zIndex: number;
  barWidth: number; // pixels
  barGap: number; // pixels
  colorScheme: "cyan-purple" | "rainbow" | "monochrome";
}
