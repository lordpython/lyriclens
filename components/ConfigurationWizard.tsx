import React from "react";
import { motion } from "framer-motion";
import {
    Sparkles,
    Image,
    Video,
    Monitor,
    Smartphone,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { VideoPurpose } from "@/services/geminiService";

interface ConfigurationWizardProps {
    fileName: string;
    onComplete: (config: any) => void;
    onCancel: () => void;
    contentType: "music" | "story";
    setContentType: (val: "music" | "story") => void;
    videoPurpose: VideoPurpose;
    setVideoPurpose: (val: VideoPurpose) => void;
    aspectRatio: string;
    setAspectRatio: (val: string) => void;
    generationMode: "image" | "video";
    setGenerationMode: (val: "image" | "video") => void;
    videoProvider: "veo" | "deapi";
    setVideoProvider: (val: "veo" | "deapi") => void;
    globalSubject: string;
    setGlobalSubject: (val: string) => void;
    selectedStyle: string;
    setSelectedStyle: (val: string) => void;
    artStyles: string[];
    videoPurposes: { value: string; label: string; description: string }[];
}

export const ConfigurationWizard: React.FC<ConfigurationWizardProps> = ({
    fileName,
    onComplete,
    onCancel,
    aspectRatio,
    setAspectRatio,
    generationMode,
    setGenerationMode,
    setVideoProvider,
    globalSubject,
    setGlobalSubject,
    selectedStyle,
    setSelectedStyle,
    artStyles,
}) => {
    // When user picks "Video", automatically use DeAPI (Image → Video flow)
    const handleOutputChange = (mode: "image" | "video") => {
        setGenerationMode(mode);
        if (mode === "video") {
            setVideoProvider("deapi"); // Always use DeAPI for video (generates image first, then animates)
        }
    };

    return (
        <div className="w-full max-w-2xl mx-auto p-6 h-full flex flex-col justify-center">
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-card/60 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl p-8"
            >
                {/* Header */}
                <div className="text-center mb-8">
                    <h1 className="text-2xl font-bold mb-2">Configure Your Video</h1>
                    <p className="text-muted-foreground text-sm truncate" title={fileName}>
                        {fileName}
                    </p>
                </div>

                {/* Simple Options Grid */}
                <div className="space-y-6">

                    {/* Row 1: Output Type */}
                    <div className="space-y-3">
                        <label className="text-sm font-medium text-muted-foreground">What to Generate</label>
                        <div className="grid grid-cols-2 gap-3">
                            <button
                                onClick={() => handleOutputChange("image")}
                                className={cn(
                                    "p-4 rounded-xl border-2 transition-all flex flex-col items-center gap-2",
                                    generationMode === "image"
                                        ? "border-blue-500 bg-blue-500/10 text-blue-400"
                                        : "border-border/50 hover:border-blue-500/30"
                                )}
                            >
                                <Image size={24} />
                                <span className="font-medium">Images</span>
                                <span className="text-xs text-muted-foreground">Static scenes</span>
                            </button>

                            <button
                                onClick={() => handleOutputChange("video")}
                                className={cn(
                                    "p-4 rounded-xl border-2 transition-all flex flex-col items-center gap-2",
                                    generationMode === "video"
                                        ? "border-green-500 bg-green-500/10 text-green-400"
                                        : "border-border/50 hover:border-green-500/30"
                                )}
                            >
                                <Video size={24} />
                                <span className="font-medium">Videos</span>
                                <span className="text-xs text-muted-foreground">Animated clips</span>
                            </button>
                        </div>
                    </div>

                    {/* Row 2: Aspect Ratio */}
                    <div className="space-y-3">
                        <label className="text-sm font-medium text-muted-foreground">Aspect Ratio</label>
                        <div className="grid grid-cols-2 gap-3">
                            <button
                                onClick={() => setAspectRatio("16:9")}
                                className={cn(
                                    "p-3 rounded-xl border-2 transition-all flex items-center justify-center gap-3",
                                    aspectRatio === "16:9"
                                        ? "border-primary bg-primary/10"
                                        : "border-border/50 hover:border-primary/30"
                                )}
                            >
                                <Monitor size={20} />
                                <span className="font-medium">16:9</span>
                            </button>

                            <button
                                onClick={() => setAspectRatio("9:16")}
                                className={cn(
                                    "p-3 rounded-xl border-2 transition-all flex items-center justify-center gap-3",
                                    aspectRatio === "9:16"
                                        ? "border-primary bg-primary/10"
                                        : "border-border/50 hover:border-primary/30"
                                )}
                            >
                                <Smartphone size={20} />
                                <span className="font-medium">9:16</span>
                            </button>
                        </div>
                    </div>

                    {/* Row 3: Art Style */}
                    <div className="space-y-3">
                        <label className="text-sm font-medium text-muted-foreground">Art Style</label>
                        <Select value={selectedStyle} onValueChange={setSelectedStyle}>
                            <SelectTrigger className="h-12 bg-background/50">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="max-h-[250px]">
                                {artStyles.map((style) => (
                                    <SelectItem key={style} value={style}>
                                        {style}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Row 4: Subject (Optional) */}
                    <div className="space-y-3">
                        <label className="text-sm font-medium text-muted-foreground">
                            Main Character <span className="text-muted-foreground/50">(optional)</span>
                        </label>
                        <Input
                            value={globalSubject}
                            onChange={(e) => setGlobalSubject(e.target.value)}
                            placeholder="e.g. A girl with red hair, a robot"
                            className="h-12 bg-background/50"
                        />
                    </div>
                </div>

                {/* Actions */}
                <div className="flex gap-3 mt-8">
                    <Button
                        variant="ghost"
                        onClick={onCancel}
                        className="flex-1 h-12"
                    >
                        Cancel
                    </Button>
                    <Button
                        onClick={() => onComplete({})}
                        className="flex-1 h-12 bg-primary hover:bg-primary/90 font-semibold"
                    >
                        <Sparkles size={18} className="mr-2" />
                        Start
                    </Button>
                </div>
            </motion.div>
        </div>
    );
};