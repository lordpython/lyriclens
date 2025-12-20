import React, { useEffect, useRef, useMemo } from 'react';
import { SubtitleItem } from '../types';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';

interface TranscriptListProps {
  subtitles: SubtitleItem[];
  currentTime: number;
  onSeek: (time: number) => void;
}

export const TranscriptList: React.FC<TranscriptListProps> = ({
  subtitles,
  currentTime,
  onSeek
}) => {
  const activeItemRef = useRef<HTMLDivElement>(null);

  const activeSubtitleId = useMemo(() => {
    return subtitles.find(s => currentTime >= s.startTime && currentTime <= s.endTime)?.id;
  }, [subtitles, currentTime]);

  useEffect(() => {
    if (activeItemRef.current) {
      activeItemRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
    }
  }, [activeSubtitleId]);

  const formatTimestamp = (time: number) => {
    const mins = Math.floor(time / 60);
    const secs = Math.floor(time % 60);
    const ms = Math.floor((time % 1) * 1000);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(3, '0')}`;
  };

  return (
    <Card className="h-full bg-transparent border-0 shadow-none flex flex-col p-0 overflow-hidden">
      <CardHeader className="px-0 py-2 border-b border-border/50 mb-2">
        <div className="flex justify-between items-center">
          <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
            Transcription
          </h3>
          <span className="text-[10px] text-muted-foreground font-mono bg-muted/50 px-2 py-0.5 rounded-full">{subtitles.length} lines</span>
        </div>
      </CardHeader>

      <CardContent className="flex-1 p-0 min-h-0 overflow-hidden relative">
        <div className="h-full w-full overflow-y-auto pr-3">
          {subtitles.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-muted-foreground gap-2">
              <p className="text-sm">No transcript available.</p>
            </div>
          ) : (
            <div className="space-y-1 relative">
              {subtitles.map((sub) => {
                const isActive = currentTime >= sub.startTime && currentTime <= sub.endTime;
                return (
                  <motion.div
                    layout
                    key={sub.id}
                    ref={isActive ? activeItemRef : null}
                    onClick={() => onSeek(sub.startTime)}
                    className={cn(
                      "relative flex items-start gap-3 p-3 rounded-lg transition-colors cursor-pointer text-sm group",
                      !isActive && 'hover:bg-muted/50'
                    )}
                  >
                    {isActive && (
                      <motion.div
                        layoutId="active-transcript-item"
                        className="absolute inset-0 bg-primary/10 border border-primary/20 rounded-lg shadow-sm"
                        initial={false}
                        transition={{ type: "spring", stiffness: 300, damping: 30 }}
                      />
                    )}

                    {/* Start Time */}
                    <div className={cn(
                      "relative font-mono text-[10px] shrink-0 pt-1 w-16 text-right transition-colors",
                      isActive ? 'text-primary font-bold' : 'text-muted-foreground group-hover:text-foreground/70'
                    )}>
                      {formatTimestamp(sub.startTime)}
                    </div>

                    {/* Text Content */}
                    <div className="relative flex-1 min-w-0">
                      <p className={cn(
                        "leading-relaxed transition-colors",
                        isActive ? 'text-foreground font-medium' : 'text-muted-foreground group-hover:text-foreground'
                      )}>
                        {sub.text}
                      </p>
                      {sub.translation && (
                        <p className={cn(
                          "mt-1 text-xs italic transition-colors",
                          isActive ? 'text-primary/70' : 'text-muted-foreground/70'
                        )}>
                          {sub.translation}
                        </p>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
