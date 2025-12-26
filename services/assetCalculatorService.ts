/**
 * Asset Calculator Service
 * Dynamically calculates optimal number of image/video assets based on:
 * - Audio duration
 * - Semantic analysis from directorService
 * - Content density
 * - Video purpose
 */

import { VideoPurpose } from "../constants";
import type { AnalysisOutput } from "./directorService";

/**
 * Input for asset calculation
 */
export interface AssetCalculationInput {
    audioDuration: number; // seconds
    analysisOutput: AnalysisOutput;
    videoPurpose: VideoPurpose;
    contentType: "lyrics" | "story";
    minAssets?: number; // minimum assets (default: 6)
    maxAssets?: number; // maximum assets (default: 15)
}

/**
 * Result of asset calculation
 */
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

/**
 * Calculate optimal number of assets based on multiple factors
 */
export async function calculateOptimalAssets(
    input: AssetCalculationInput
): Promise<AssetCalculationResult> {
    const {
        audioDuration,
        analysisOutput,
        videoPurpose,
        contentType,
        minAssets = 6,
        maxAssets = 15,
    } = input;

    console.log("[AssetCalculator] Calculating optimal assets...");
    console.log(`[AssetCalculator] Duration: ${audioDuration}s, Purpose: ${videoPurpose}`);

    // Factor 1: Duration-based baseline
    const durationBaseline = calculateDurationBaseline(audioDuration);
    console.log(`[AssetCalculator] Duration baseline: ${durationBaseline} assets`);

    // Factor 2: Semantic section analysis
    const sectionBasedCount = calculateSectionBasedCount(analysisOutput);
    console.log(`[AssetCalculator] Section-based count: ${sectionBasedCount} assets`);

    // Factor 3: Video purpose adjustment
    const purposeAdjustedCount = adjustForPurpose(
        Math.max(durationBaseline, sectionBasedCount),
        videoPurpose
    );
    console.log(`[AssetCalculator] Purpose-adjusted count: ${purposeAdjustedCount} assets`);

    // Factor 4: Content density (subtitle timing)
    const densityAdjustedCount = adjustForContentDensity(
        purposeAdjustedCount,
        analysisOutput,
        audioDuration
    );
    console.log(`[AssetCalculator] Density-adjusted count: ${densityAdjustedCount} assets`);

    // Apply min/max constraints
    const optimalAssetCount = Math.max(
        minAssets,
        Math.min(maxAssets, densityAdjustedCount)
    );

    console.log(`[AssetCalculator] Final optimal count: ${optimalAssetCount} assets`);

    // Calculate timestamps for each asset
    const assetTimestamps = calculateAssetTimestamps(
        optimalAssetCount,
        audioDuration,
        analysisOutput
    );

    // Generate section breakdown
    const sections = generateSectionBreakdown(
        assetTimestamps,
        analysisOutput,
        audioDuration
    );

    // Generate reasoning
    const reasoning = generateReasoning({
        audioDuration,
        durationBaseline,
        sectionBasedCount,
        purposeAdjustedCount,
        densityAdjustedCount,
        optimalAssetCount,
        videoPurpose,
    });

    return {
        optimalAssetCount,
        assetTimestamps,
        reasoning,
        sections,
    };
}

/**
 * Calculate baseline asset count based on audio duration
 */
function calculateDurationBaseline(duration: number): number {
    if (duration < 30) {
        // Short content: 6-8 assets
        return Math.round(6 + (duration / 30) * 2);
    } else if (duration < 60) {
        // Medium content: 8-10 assets
        return Math.round(8 + ((duration - 30) / 30) * 2);
    } else if (duration < 120) {
        // Long content: 10-12 assets
        return Math.round(10 + ((duration - 60) / 60) * 2);
    } else {
        // Very long content: 12-15 assets
        return Math.round(12 + Math.min(3, (duration - 120) / 60));
    }
}

/**
 * Calculate asset count based on semantic sections
 */
function calculateSectionBasedCount(analysis: AnalysisOutput): number {
    if (!analysis.sections || analysis.sections.length === 0) {
        return 8; // Default if no sections
    }

    let count = 0;

    analysis.sections.forEach((section) => {
        // Each section gets at least 1 asset
        count += 1;

        // High emotional intensity sections get 2 assets
        if (section.emotionalIntensity > 7) {
            count += 1;
        }

        // Transition sections get dedicated assets
        if (section.type === "transition") {
            count += 1;
        }
    });

    return count;
}

/**
 * Adjust asset count based on video purpose
 */
function adjustForPurpose(count: number, purpose: VideoPurpose): number {
    switch (purpose) {
        case "social_short":
            // Fewer, faster cuts
            return Math.round(count * 0.75);
        case "music_video":
            // Balanced
            return count;
        case "documentary":
            // More coverage
            return Math.round(count * 1.2);
        case "commercial":
            // Product-focused, fewer cuts
            return Math.round(count * 0.8);
        case "podcast_visual":
            // Ambient, fewer changes
            return Math.round(count * 0.7);
        case "lyric_video":
            // Text-focused, moderate
            return Math.round(count * 0.9);
        default:
            return count;
    }
}

/**
 * Adjust asset count based on content density
 */
function adjustForContentDensity(
    count: number,
    analysis: AnalysisOutput,
    duration: number
): number {
    if (!analysis.sections || analysis.sections.length === 0) {
        return count;
    }

    // Calculate average section duration
    const totalSectionDuration = analysis.sections.reduce((sum, section) => {
        const start = parseTimestamp(section.startTimestamp);
        const end = parseTimestamp(section.endTimestamp);
        return sum + (end - start);
    }, 0);

    const avgSectionDuration = totalSectionDuration / analysis.sections.length;

    // Dense content (short sections) → more assets
    // Sparse content (long sections) → fewer assets
    const densityFactor = avgSectionDuration / (duration / analysis.sections.length);

    if (densityFactor < 0.8) {
        // Dense: increase by 20%
        return Math.round(count * 1.2);
    } else if (densityFactor > 1.2) {
        // Sparse: decrease by 15%
        return Math.round(count * 0.85);
    }

    return count;
}

/**
 * Calculate timestamps for each asset
 * Distributes assets evenly across duration with semantic awareness
 */
function calculateAssetTimestamps(
    count: number,
    duration: number,
    analysis: AnalysisOutput
): number[] {
    const timestamps: number[] = [];

    if (!analysis.sections || analysis.sections.length === 0) {
        // Even distribution if no sections
        const interval = duration / (count + 1);
        for (let i = 1; i <= count; i++) {
            timestamps.push(i * interval);
        }
        return timestamps;
    }

    // Distribute assets across sections
    let assetsPerSection = Math.floor(count / analysis.sections.length);
    let remainingAssets = count % analysis.sections.length;

    analysis.sections.forEach((section, idx) => {
        const start = parseTimestamp(section.startTimestamp);
        const end = parseTimestamp(section.endTimestamp);
        const sectionDuration = end - start;

        // Allocate assets to this section
        const sectionAssets = assetsPerSection + (idx < remainingAssets ? 1 : 0);

        // Distribute evenly within section
        const interval = sectionDuration / (sectionAssets + 1);
        for (let i = 1; i <= sectionAssets; i++) {
            timestamps.push(start + i * interval);
        }
    });

    return timestamps;
}

/**
 * Generate section breakdown for debugging
 */
function generateSectionBreakdown(
    timestamps: number[],
    analysis: AnalysisOutput,
    duration: number
): Array<{
    start: number;
    end: number;
    assetCount: number;
    emotionalIntensity: number;
}> {
    if (!analysis.sections || analysis.sections.length === 0) {
        return [];
    }

    return analysis.sections.map((section) => {
        const start = parseTimestamp(section.startTimestamp);
        const end = parseTimestamp(section.endTimestamp);

        // Count assets in this section
        const assetCount = timestamps.filter(
            (t) => t >= start && t < end
        ).length;

        return {
            start,
            end,
            assetCount,
            emotionalIntensity: section.emotionalIntensity,
        };
    });
}

/**
 * Generate human-readable reasoning
 */
function generateReasoning(params: {
    audioDuration: number;
    durationBaseline: number;
    sectionBasedCount: number;
    purposeAdjustedCount: number;
    densityAdjustedCount: number;
    optimalAssetCount: number;
    videoPurpose: VideoPurpose;
}): string {
    const {
        audioDuration,
        durationBaseline,
        sectionBasedCount,
        purposeAdjustedCount,
        densityAdjustedCount,
        optimalAssetCount,
        videoPurpose,
    } = params;

    const parts: string[] = [];

    parts.push(`Audio duration: ${Math.round(audioDuration)}s`);
    parts.push(`Duration baseline: ${durationBaseline} assets`);
    parts.push(`Semantic sections: ${sectionBasedCount} assets`);
    parts.push(`Purpose adjustment (${videoPurpose}): ${purposeAdjustedCount} assets`);
    parts.push(`Content density: ${densityAdjustedCount} assets`);
    parts.push(`Final optimal count: ${optimalAssetCount} assets`);

    return parts.join("\n");
}

/**
 * Parse timestamp string (MM:SS) to seconds
 */
function parseTimestamp(timestamp: string): number {
    const parts = timestamp.split(":");
    if (parts.length !== 2) {
        return 0;
    }

    const minutes = parseInt(parts[0], 10);
    const seconds = parseInt(parts[1], 10);

    return minutes * 60 + seconds;
}