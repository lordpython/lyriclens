export interface WordTiming {
  word: string;
  startTime: number;  // seconds
  endTime: number;    // seconds
}

export interface SubtitleItem {
  id: number;
  startTime: number;
  endTime: number;
  text: string;
  translation?: string;
  words?: WordTiming[];  // Optional for backward-compat with word-level timing
}

export interface ImagePrompt {
  id: string;
  text: string;
  mood: string;
  timestamp?: string; // Rough timestamp string (e.g. "00:01:30")
  timestampSeconds?: number; // Parsed seconds for sorting/display
}

export interface GeneratedImage {
  promptId: string;
  imageUrl: string;
}

export enum AppState {
  IDLE = 'IDLE',
  PROCESSING_AUDIO = 'PROCESSING_AUDIO',
  ANALYZING_LYRICS = 'ANALYZING_LYRICS',
  READY = 'READY',
  ERROR = 'ERROR'
}

export interface SongData {
  fileName: string;
  audioUrl: string; // Blob URL for playback
  srtContent: string;
  parsedSubtitles: SubtitleItem[];
  prompts: ImagePrompt[];
  generatedImages: GeneratedImage[];
}