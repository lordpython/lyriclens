import React from "react";
import {
  Music,
  RefreshCw,
  Speech,
  Smartphone,
  Monitor,
  Sparkles,
  Film,
  Zap,
  Settings2,
  Layers,
  Play,
  Target,
  User,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { motion, AnimatePresence } from "framer-motion";
import { AppState } from "../../types";
import { ART_STYLES, VIDEO_PURPOSES, type VideoPurpose } from "../../constants";

export interface SidebarProps {
  appState: AppState;
  contentType: "music" | "story";
  videoPurpose: VideoPurpose;
  generationMode: "image" | "video";
  videoProvider: "veo" | "deapi";
  aspectRatio: string;
  selectedStyle: string;
  globalSubject: string;
  onContentTypeChange: (type: "music" | "story") => void;
  onVideoPurposeChange: (purpose: VideoPurpose) => void;
  onGenerationModeChange: (mode: "image" | "video") => void;
  onVideoProviderChange: (provider: "veo" | "deapi") => void;
  onAspectRatioChange: (ratio: string) => void;
  onStyleChange: (style: string) => void;
  onGlobalSubjectChange: (subject: string) => void;
  onReset: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  appState,
  contentType,
  videoPurpose,
  generationMode,
  videoProvider,
  aspectRatio,
  selectedStyle,
  globalSubject,
  onContentTypeChange,
  onVideoPurposeChange,
  onGenerationModeChange,
  onVideoProviderChange,
  onAspectRatioChange,
  onStyleChange,
  onGlobalSubjectChange,
  onReset,
}) => {
  return (
    <div className="flex flex-col h-full">
      {/* Brand */}
      <div className="h-16 flex items-center px-6 border-b border-border/30 shrink-0 bg-linear-to-r from-primary/5 to-transparent">
        <motion.div
          className="relative"
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          <div className="absolute inset-0 bg-primary/30 blur-xl rounded-full" />
          <div className="relative w-9 h-9 rounded-xl bg-linear-to-br from-primary to-accent flex items-center justify-center mr-3 shadow-lg shadow-primary/30">
            <Music className="text-primary-foreground w-5 h-5" />
          </div>
        </motion.div>
        <div className="flex flex-col">
          <span className="font-bold text-lg tracking-tight text-foreground">
            LyricLens
          </span>
          <span className="text-[9px] text-muted-foreground font-medium uppercase tracking-widest">
            AI Video Studio
          </span>
        </div>
      </div>

      <ScrollArea className="flex-1 py-6 px-4">
        {/* Only show full sidebar controls when project is ready (post-wizard) */}
        {appState === AppState.READY ? (
          <div className="space-y-6">
            {/* Section: Configuration */}
            <div className="space-y-4">
              <h3 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest px-2 flex items-center gap-2">
                <Settings2 size={12} className="text-primary/60" />
                Project Config
              </h3>

              {/* Mode */}
              <div className="space-y-2">
                <label className="text-xs font-medium text-foreground/70 px-2 flex items-center gap-2">
                  {contentType === "music" ? (
                    <Music size={12} className="text-primary" />
                  ) : (
                    <Speech size={12} className="text-primary" />
                  )}
                  Content Mode
                </label>
                <Select
                  value={contentType}
                  onValueChange={(val: "music" | "story") => onContentTypeChange(val)}
                >
                  <SelectTrigger aria-label="Content mode" className="bg-background/80 border-border/50 text-foreground h-10 hover:bg-background hover:border-primary/30 transition-colors">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="music">
                      <span className="flex items-center gap-2">
                        <Music size={14} className="text-primary" />
                        Music Video
                      </span>
                    </SelectItem>
                    <SelectItem value="story">
                      <span className="flex items-center gap-2">
                        <Speech size={14} className="text-accent" />
                        Story / Speech
                      </span>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Video Purpose */}
              <div className="space-y-2">
                <label className="text-xs font-medium text-foreground/70 px-2 flex items-center gap-2">
                  <Target size={12} className="text-accent" />
                  Video Purpose
                </label>
                <Select
                  value={videoPurpose}
                  onValueChange={(val: VideoPurpose) => onVideoPurposeChange(val)}
                >
                  <SelectTrigger aria-label="Video purpose" className="bg-background/80 border-border/50 text-foreground h-10 hover:bg-background hover:border-primary/30 transition-colors">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {VIDEO_PURPOSES.map((purpose) => (
                      <SelectItem key={purpose.value} value={purpose.value}>
                        <div className="flex flex-col items-start">
                          <span className="font-medium">{purpose.label}</span>
                          <span className="text-[10px] text-muted-foreground">
                            {purpose.description}
                          </span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-[10px] text-muted-foreground px-2">
                  Optimizes scene composition & pacing
                </p>
              </div>

              {/* Output Format */}
              <div className="space-y-2">
                <label className="text-xs font-medium text-foreground/70 px-2 flex items-center gap-2">
                  <Film size={12} className="text-primary" /> Output Format
                </label>
                <Select
                  value={generationMode}
                  onValueChange={(val: "image" | "video") => onGenerationModeChange(val)}
                >
                  <SelectTrigger aria-label="Output format" className="bg-background/80 border-border/50 text-foreground h-10 hover:bg-background hover:border-primary/30 transition-colors">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="image">
                      <span className="flex items-center gap-2">
                        <Layers size={14} className="text-blue-400" />
                        Static Images
                      </span>
                    </SelectItem>
                    <SelectItem value="video">
                      <span className="flex items-center gap-2">
                        <Play size={14} className="text-green-400" />
                        Motion Loops
                      </span>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Video Provider Selector (Conditional) */}
              <AnimatePresence>
                {generationMode === "video" && (
                  <motion.div
                    className="space-y-2"
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <label className="text-xs font-medium text-foreground/70 px-2 flex items-center gap-2">
                      <Zap size={12} className="text-yellow-400" /> Video Engine
                    </label>
                    <Select
                      value={videoProvider}
                      onValueChange={(val: "veo" | "deapi") => onVideoProviderChange(val)}
                    >
                      <SelectTrigger aria-label="Video engine" className="bg-background/80 border-border/50 text-foreground h-10 hover:bg-background hover:border-primary/30 transition-colors">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="veo">
                          <span className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-green-400" />
                            Google Veo (Premium)
                          </span>
                        </SelectItem>
                        <SelectItem value="deapi">
                          <span className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-blue-400" />
                            DeAPI (Fast)
                          </span>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Ratio */}
              <div className="space-y-2">
                <label className="text-xs font-medium text-foreground/70 px-2 flex items-center gap-2">
                  {aspectRatio === "16:9" ? (
                    <Monitor size={12} className="text-primary" />
                  ) : (
                    <Smartphone size={12} className="text-primary" />
                  )}
                  Aspect Ratio
                </label>
                <Select value={aspectRatio} onValueChange={onAspectRatioChange}>
                  <SelectTrigger aria-label="Aspect ratio" className="bg-background/80 border-border/50 text-foreground h-10 hover:bg-background hover:border-primary/30 transition-colors">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="16:9">
                      <span className="flex items-center gap-2">
                        <Monitor size={14} />
                        16:9 Landscape
                      </span>
                    </SelectItem>
                    <SelectItem value="9:16">
                      <span className="flex items-center gap-2">
                        <Smartphone size={14} />
                        9:16 Portrait
                      </span>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Section: Art Direction */}
            <div className="space-y-4">
              <h3 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest px-2 flex items-center gap-2">
                <Sparkles size={12} className="text-accent/60" /> Art Direction
              </h3>

              {/* Style */}
              <div className="space-y-2">
                <label className="text-xs font-medium text-foreground/70 px-2">
                  Visual Style
                </label>
                <Select value={selectedStyle} onValueChange={onStyleChange}>
                  <SelectTrigger aria-label="Visual style" className="bg-background/80 border-border/50 text-foreground h-10 hover:bg-background hover:border-primary/30 transition-colors">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="max-h-80[300px]">
                    {ART_STYLES.map((style) => (
                      <SelectItem key={style} value={style}>
                        <span className="flex items-center gap-2">
                          <span className="w-1.5 h-1.5 rounded-full bg-linear-to-r from-primary to-accent" />
                          {style}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Subject */}
              <div className="space-y-2">
                <label className="text-xs font-medium text-foreground/70 px-2">
                  Main Subject
                </label>
                <div className="relative group">
                  <User
                    size={14}
                    className="absolute left-3 top-3 text-muted-foreground group-focus-within:text-primary transition-colors"
                  />
                  <Input
                    value={globalSubject}
                    onChange={(e) => onGlobalSubjectChange(e.target.value)}
                    placeholder="e.g. A red robot, a girl with blue hair"
                    className="pl-9 bg-background/80 border-border/50 text-foreground h-10 focus-visible:ring-primary/30 focus-visible:border-primary/50 hover:border-primary/30 transition-colors placeholder:text-muted-foreground/40"
                  />
                </div>
                <p className="text-[10px] text-muted-foreground px-2">
                  Maintains consistency across all scenes
                </p>
              </div>
            </div>

            {/* Actions (Only in READY) */}
            {appState === AppState.READY && (
              <motion.div
                className="pt-4 border-t border-border/30 space-y-3"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.2 }}
              >
                <Button
                  onClick={onReset}
                  variant="outline"
                  className="w-full justify-start text-muted-foreground border-border/50 bg-transparent hover:bg-destructive/10 hover:border-destructive/30 hover:text-destructive transition-all group"
                >
                  <RefreshCw
                    size={14}
                    className="mr-2 group-hover:rotate-180 transition-transform duration-500"
                  />
                  New Project
                </Button>
              </motion.div>
            )}
          </div>
        ) : (
          /* Empty state or minimal info when not ready */
          <div className="h-full flex flex-col items-center justify-center text-center p-4 text-muted-foreground/50">
            <Settings2 size={48} className="mb-4 opacity-20" />
            <p className="text-xs uppercase tracking-widest">Awaiting Configuration</p>
          </div>
        )}
      </ScrollArea>

      {/* Footer */}
      <div className="p-4 border-t border-border/30 shrink-0">
        <div className="flex items-center justify-center gap-2 text-[10px] text-muted-foreground">
          <span className="font-medium">Powered by</span>
          <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary/80 font-semibold">
            Gemini 2.5
          </span>
          <span>&</span>
          <span className="px-2 py-0.5 rounded-full bg-accent/10 text-accent/80 font-semibold">
            FFmpeg
          </span>
        </div>
      </div>
    </div>
  );
};
