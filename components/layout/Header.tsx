import React from "react";
import {
  Music,
  Download,
  Video,
  LayoutDashboard,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { AppState, SongData } from "../../types";

export interface HeaderProps {
  songData: SongData | null;
  contentType: "music" | "story";
  appState: AppState;
  onDownloadSRT: () => void;
  onExportVideo: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  songData,
  contentType,
  appState,
  onDownloadSRT,
  onExportVideo,
}) => {
  return (
    <header className="hidden md:flex h-14 border-b border-border/30 bg-card/60 backdrop-blur-xl items-center justify-between px-6 shrink-0 z-10 sticky top-0">
      <div className="flex items-center gap-4">
        {songData ? (
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <Music size={16} className="text-primary" />
            </div>
            <div className="flex flex-col">
              <h2 className="font-semibold text-foreground leading-tight truncate max-w-60">
                {songData.fileName}
              </h2>
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">
                  {contentType} mode
                </span>
                <ChevronRight
                  size={10}
                  className="text-muted-foreground/50"
                />
                <span className="text-[10px] text-primary/80 font-medium">
                  {songData.prompts.length} scenes
                </span>
              </div>
            </div>
          </div>
        ) : (
          <span className="text-muted-foreground font-medium flex items-center gap-2">
            <LayoutDashboard size={16} />
            New Project
          </span>
        )}
      </div>

      <div className="flex items-center gap-2">
        {appState === AppState.READY && (
          <>
            <Button
              onClick={onDownloadSRT}
              variant="ghost"
              size="sm"
              className="text-muted-foreground hover:text-foreground hover:bg-muted/50 h-9"
            >
              <Download size={14} className="mr-2" /> SRT
            </Button>
            <Button
              onClick={onExportVideo}
              className="bg-linear-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 text-primary-foreground shadow-lg shadow-primary/25 h-9 font-semibold"
            >
              <Video size={14} className="mr-2" /> Export Video
            </Button>
          </>
        )}
      </div>
    </header>
  );
};
