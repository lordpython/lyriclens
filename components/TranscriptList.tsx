import React, { useEffect, useRef } from 'react';
import { SubtitleItem } from '../types';

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
  const scrollRef = useRef<HTMLDivElement>(null);
  const activeItemRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to active subtitle
  useEffect(() => {
    if (activeItemRef.current && scrollRef.current) {
      activeItemRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
    }
  }, [
    subtitles.find(s => currentTime >= s.startTime && currentTime <= s.endTime)?.id
  ]);

  const formatTimestamp = (time: number) => {
    const mins = Math.floor(time / 60);
    const secs = Math.floor(time % 60);
    const ms = Math.floor((time % 1) * 1000);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(3, '0')}`;
  };

  return (
    <div className="flex flex-col h-[500px] bg-slate-800/50 border border-slate-700 rounded-2xl overflow-hidden backdrop-blur-sm">
      <div className="p-4 bg-slate-900/80 border-b border-slate-700 flex justify-between items-center">
        <h3 className="text-sm font-semibold text-white uppercase tracking-wider">
          Transcription
        </h3>
        <span className="text-xs text-slate-500 font-mono">{subtitles.length} lines</span>
      </div>
      
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-2 space-y-1 scroll-smooth bg-slate-900/30">
        {subtitles.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-slate-500 gap-2">
            <p className="text-sm">No transcript available.</p>
          </div>
        ) : (
          subtitles.map((sub) => {
            const isActive = currentTime >= sub.startTime && currentTime <= sub.endTime;
            return (
              <div
                key={sub.id}
                ref={isActive ? activeItemRef : null}
                onClick={() => onSeek(sub.startTime)}
                className={`group flex items-start gap-3 p-3 rounded-lg transition-all cursor-pointer border border-transparent text-sm
                  ${isActive 
                    ? 'bg-cyan-950/40 border-cyan-500/30 shadow-[inset_0_0_10px_rgba(34,211,238,0.1)]' 
                    : 'hover:bg-slate-800 hover:border-slate-700'
                  }
                `}
              >
                {/* Start Time */}
                <div className={`font-mono text-xs shrink-0 pt-0.5 w-20 text-right ${isActive ? 'text-cyan-400' : 'text-slate-600 group-hover:text-slate-500'}`}>
                  {formatTimestamp(sub.startTime)}
                </div>

                {/* Text Content */}
                <div className="flex-1 min-w-0">
                  <p className={`leading-relaxed ${isActive ? 'text-cyan-50 font-medium' : 'text-slate-300 group-hover:text-slate-200'}`}>
                    {sub.text}
                  </p>
                  {sub.translation && (
                    <p className={`mt-1 text-xs italic ${isActive ? 'text-cyan-300/80' : 'text-slate-500'}`}>
                      {sub.translation}
                    </p>
                  )}
                </div>

                {/* End Time */}
                <div className={`font-mono text-xs shrink-0 pt-0.5 w-20 text-right ${isActive ? 'text-cyan-600/70' : 'text-slate-700 group-hover:text-slate-600'}`}>
                  {formatTimestamp(sub.endTime)}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};