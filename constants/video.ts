/**
 * Video purpose options for the sidebar selector.
 * Each purpose affects visual style and pacing of generated content.
 */
export interface VideoPurposeOption {
  value: string;
  label: string;
  description: string;
}

export const VIDEO_PURPOSES: VideoPurposeOption[] = [
  {
    value: "music_video",
    label: "Music Video",
    description: "Cinematic, emotional, dramatic scenes",
  },
  {
    value: "social_short",
    label: "Social Short",
    description: "TikTok/Reels - bold, fast-paced",
  },
  {
    value: "documentary",
    label: "Documentary",
    description: "Realistic, informative visuals",
  },
  {
    value: "commercial",
    label: "Commercial/Ad",
    description: "Clean, product-focused, persuasive",
  },
  {
    value: "podcast_visual",
    label: "Podcast Visual",
    description: "Ambient, non-distracting backgrounds",
  },
  {
    value: "lyric_video",
    label: "Lyric Video",
    description: "Space for text overlays",
  },
];

/**
 * Video purpose type for type-safe usage.
 */
export type VideoPurpose =
  | "music_video"
  | "social_short"
  | "documentary"
  | "commercial"
  | "podcast_visual"
  | "lyric_video";

/**
 * Camera angles for visual variety in prompt generation.
 * Used to ensure diverse compositions across scenes.
 */
export const CAMERA_ANGLES = [
  "wide establishing shot",
  "medium shot",
  "close-up",
  "extreme close-up on details",
  "low angle looking up",
  "high angle looking down",
  "over-the-shoulder",
  "dutch angle",
  "tracking shot",
  "aerial/drone view",
] as const;

export type CameraAngle = (typeof CAMERA_ANGLES)[number];

/**
 * Lighting moods for emotional progression in scenes.
 * Used to create visual variety and emotional arc.
 */
export const LIGHTING_MOODS = [
  "golden hour warm lighting",
  "cool blue moonlight",
  "dramatic chiaroscuro shadows",
  "soft diffused overcast",
  "neon-lit urban glow",
  "harsh midday sun",
  "candlelit intimate warmth",
  "silhouette backlighting",
  "foggy atmospheric haze",
  "studio three-point lighting",
] as const;

export type LightingMood = (typeof LIGHTING_MOODS)[number];

/**
 * Default negative constraints for image/video generation.
 * These are appended to prompts to avoid common generation issues.
 */
export const DEFAULT_NEGATIVE_CONSTRAINTS = [
  "no text",
  "no subtitles",
  "no watermark",
  "no logo",
  "no brand names",
  "no split-screen",
  "no collage",
  "no UI elements",
  "no distorted anatomy",
  "no extra limbs",
  "no deformed hands",
  "no blurry face",
  "no melted faces",
] as const;

export type NegativeConstraint = (typeof DEFAULT_NEGATIVE_CONSTRAINTS)[number];
