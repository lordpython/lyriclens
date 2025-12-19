import React, { useRef, useEffect, useState } from 'react';
import { Play, Pause, RotateCcw } from 'lucide-react';
import { SubtitleItem } from '../types';

interface TimelinePlayerProps {
  audioUrl: string;
  subtitles: SubtitleItem[];
  currentTime: number;
  duration: number;
  isPlaying: boolean;
  onPlayPause: () => void;
  onSeek: (time: number) => void;
  onTimeUpdate: (time: number) => void;
  onDurationChange: (duration: number) => void;
  onEnded: () => void;
}

export const TimelinePlayer: React.FC<TimelinePlayerProps> = ({
  audioUrl,
  subtitles,
  currentTime,
  duration,
  isPlaying,
  onPlayPause,
  onSeek,
  onTimeUpdate,
  onDurationChange,
  onEnded
}) => {
  const audioRef = useRef<HTMLAudioElement>(null);
  const progressBarRef = useRef<HTMLDivElement>(null);
  const waveformCanvasRef = useRef<HTMLCanvasElement>(null);
  const visualizerCanvasRef = useRef<HTMLCanvasElement>(null);
  
  const [waveformBuffer, setWaveformBuffer] = useState<AudioBuffer | null>(null);
  
  // Visualizer State
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  // Initialize Audio Context for Visualizer
  useEffect(() => {
    if (!isPlaying) {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
      return;
    }

    const initAudioContext = () => {
      if (!audioRef.current) return;

      // Create context if not exists
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      
      const ctx = audioContextRef.current;

      // Connect source node only once
      if (!sourceRef.current) {
        try {
          sourceRef.current = ctx.createMediaElementSource(audioRef.current);
          analyserRef.current = ctx.createAnalyser();
          analyserRef.current.fftSize = 256;
          
          sourceRef.current.connect(analyserRef.current);
          analyserRef.current.connect(ctx.destination);
        } catch (e) {
          console.warn("MediaElementSource already connected or error:", e);
        }
      }

      // Resume context if suspended (browser policy)
      if (ctx.state === 'suspended') {
        ctx.resume();
      }
      
      drawVisualizer();
    };

    initAudioContext();

    return () => {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    };
  }, [isPlaying]);

  const drawVisualizer = () => {
    const canvas = visualizerCanvasRef.current;
    const analyser = analyserRef.current;
    if (!canvas || !analyser) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    
    const render = () => {
      analyser.getByteFrequencyData(dataArray);
      
      const w = canvas.width;
      const h = canvas.height;
      
      ctx.clearRect(0, 0, w, h);
      
      // Draw 3D-ish bars
      const barWidth = (w / bufferLength) * 2.5;
      let x = 0;

      // Create gradient
      const gradient = ctx.createLinearGradient(0, h, 0, 0);
      gradient.addColorStop(0, 'rgba(34, 211, 238, 0.1)'); // Cyan transparent bottom
      gradient.addColorStop(0.5, 'rgba(34, 211, 238, 0.8)'); // Cyan mid
      gradient.addColorStop(1, 'rgba(167, 139, 250, 0.9)'); // Purple top

      for (let i = 0; i < bufferLength; i++) {
        const barHeight = (dataArray[i] / 255) * h * 0.8; // Scale to fit
        
        // Draw main bar
        ctx.fillStyle = gradient;
        
        // Simple perspective effect: lighter in center, darker on sides
        // Or just standard bars for now, but centered
        
        // Let's do a mirrored spectrum from center
        const centerX = w / 2;
        const offset = i * (barWidth + 1);
        
        // Right side
        ctx.fillRect(centerX + offset, h - barHeight, barWidth, barHeight);
        // Left side
        ctx.fillRect(centerX - offset - barWidth, h - barHeight, barWidth, barHeight);
        
        // Reflection
        ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
        ctx.fillRect(centerX + offset, h, barWidth, barHeight * 0.3);
        ctx.fillRect(centerX - offset - barWidth, h, barWidth, barHeight * 0.3);

        x += barWidth + 1;
        if (x > w) break; 
      }

      animationFrameRef.current = requestAnimationFrame(render);
    };

    render();
  };

  // Sync isPlaying prop with audio element
  useEffect(() => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.play().catch(e => console.error("Play error:", e));
      } else {
        audioRef.current.pause();
      }
    }
  }, [isPlaying]);

  // Sync props -> Audio element seeking
  useEffect(() => {
    if (audioRef.current && Math.abs(audioRef.current.currentTime - currentTime) > 0.5) {
      audioRef.current.currentTime = currentTime;
    }
  }, [currentTime]);

  // Generate Static Waveform Data
  useEffect(() => {
    if (!audioUrl) return;

    const loadAudioData = async () => {
      try {
        const response = await fetch(audioUrl);
        const arrayBuffer = await response.arrayBuffer();
        const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        const decodedBuffer = await audioContext.decodeAudioData(arrayBuffer);
        setWaveformBuffer(decodedBuffer);
      } catch (error) {
        console.error("Error generating waveform:", error);
      }
    };

    loadAudioData();
  }, [audioUrl]);

  // Draw Static Waveform
  useEffect(() => {
    const canvas = waveformCanvasRef.current;
    if (!canvas || !waveformBuffer) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const parent = canvas.parentElement;
    if (parent) {
      canvas.width = parent.clientWidth;
      canvas.height = parent.clientHeight;
    }

    const width = canvas.width;
    const height = canvas.height;
    const data = waveformBuffer.getChannelData(0);
    const step = Math.ceil(data.length / width);
    const amp = height / 2;

    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = '#334155';
    
    for (let i = 0; i < width; i++) {
      let min = 1.0;
      let max = -1.0;
      for (let j = 0; j < step; j++) {
        const datum = data[i * step + j];
        if (datum < min) min = datum;
        if (datum > max) max = datum;
      }
      const barHeight = Math.max(2, (max - min) * amp);
      const y = (height - barHeight) / 2;
      ctx.fillRect(i, y, 1, barHeight);
    }
  }, [waveformBuffer]);

  const handleProgressBarClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (progressBarRef.current && duration > 0) {
      const rect = progressBarRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const percentage = Math.min(Math.max(x / rect.width, 0), 1);
      const newTime = percentage * duration;
      onSeek(newTime);
    }
  };

  const formatTime = (time: number) => {
    const mins = Math.floor(time / 60);
    const secs = Math.floor(time % 60);
    const ms = Math.floor((time % 1) * 100);
    return `${mins}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
  };

  const activeSubtitle = subtitles.find(
    s => currentTime >= s.startTime && currentTime <= s.endTime
  );

  let karaokeStyle: React.CSSProperties = {};
  if (activeSubtitle) {
    const totalDuration = activeSubtitle.endTime - activeSubtitle.startTime;
    const progress = Math.max(0, Math.min(1, (currentTime - activeSubtitle.startTime) / totalDuration));
    const percent = Math.floor(progress * 100);
    
    karaokeStyle = {
      backgroundImage: `linear-gradient(90deg, #22d3ee ${percent}%, #94a3b8 ${percent}%)`,
      WebkitBackgroundClip: 'text',
      WebkitTextFillColor: 'transparent',
      backgroundClip: 'text',
      color: 'transparent'
    };
  }

  return (
    <div className="flex flex-col gap-4 bg-slate-800/80 border border-slate-700 rounded-2xl p-6 shadow-xl backdrop-blur-sm">
      <audio
        ref={audioRef}
        src={audioUrl}
        crossOrigin="anonymous" 
        onTimeUpdate={(e) => onTimeUpdate(e.currentTarget.currentTime)}
        onLoadedMetadata={(e) => onDurationChange(e.currentTarget.duration)}
        onEnded={onEnded}
      />

      {/* Main Display Area (Visualizer + Caption) */}
      <div className="aspect-video w-full flex items-center justify-center text-center p-8 bg-black rounded-xl border border-slate-700 relative overflow-hidden group">
        
        {/* Visualizer Layer (Behind Text) */}
        <canvas 
          ref={visualizerCanvasRef}
          width={800}
          height={400}
          className="absolute inset-0 w-full h-full opacity-60 z-0 pointer-events-none"
        />

        {/* Gradient Overlay for Readability */}
        <div className="absolute inset-0 bg-gradient-to-t from-slate-900/90 via-transparent to-slate-900/40 z-1 pointer-events-none"></div>

        {/* Text Layer */}
        <div className="relative z-10 max-w-2xl flex flex-col gap-4">
           {activeSubtitle ? (
            <div className="animate-in fade-in slide-in-from-bottom-2 duration-200">
               <p className="text-2xl md:text-3xl lg:text-4xl font-bold leading-relaxed drop-shadow-xl">
                 <span 
                   className="bg-slate-900/40 px-4 py-2 rounded-lg box-decoration-clone inline-block backdrop-blur-sm"
                 >
                   <span style={karaokeStyle} className="transition-all duration-75">
                     {activeSubtitle.text}
                   </span>
                 </span>
               </p>
               {activeSubtitle.translation && (
                 <p className="text-lg md:text-xl text-cyan-200 mt-2 font-light italic opacity-90 drop-shadow-md">
                   {activeSubtitle.translation}
                 </p>
               )}
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2 opacity-30">
              <div className="w-12 h-1 bg-slate-600 rounded-full animate-pulse"></div>
              <div className="w-24 h-1 bg-slate-600 rounded-full animate-pulse delay-75"></div>
            </div>
          )}
        </div>
      </div>

      {/* Timeline & Controls */}
      <div className="flex flex-col gap-2 pt-2">
        <div 
          ref={progressBarRef}
          className="relative h-16 bg-slate-900 rounded-lg cursor-pointer group overflow-hidden border border-slate-700/50"
          onClick={handleProgressBarClick}
        >
          <canvas 
            ref={waveformCanvasRef} 
            className="absolute inset-0 w-full h-full opacity-60"
          />

          <div className="absolute inset-0 w-full h-full">
            {subtitles.map(sub => {
              const left = (sub.startTime / duration) * 100;
              const width = ((sub.endTime - sub.startTime) / duration) * 100;
              const isActive = currentTime >= sub.startTime && currentTime <= sub.endTime;

              return (
                <div
                  key={sub.id}
                  className={`absolute bottom-0 h-3 rounded-t-sm transition-all duration-200 pointer-events-none border-x border-slate-900/20
                    ${isActive 
                      ? 'bg-cyan-400 z-10 h-4 shadow-[0_0_15px_rgba(34,211,238,0.6)]' 
                      : 'bg-orange-500/60 hover:bg-orange-400/80 h-3'
                    }
                  `}
                  style={{ 
                    left: `${left}%`, 
                    width: `${Math.max(width, 0.2)}%` 
                  }}
                />
              );
            })}
          </div>

          <div 
             className="absolute top-0 h-full w-0.5 bg-white shadow-[0_0_8px_rgba(255,255,255,0.8)] z-20 pointer-events-none"
             style={{ left: `${(currentTime / duration) * 100}%` }}
          >
             <div className="absolute -top-1 -left-1.5 w-3.5 h-3.5 bg-white rounded-full shadow-sm"></div>
          </div>
        </div>

        <div className="flex items-center justify-between mt-1 px-1">
          <div className="text-xs font-mono text-cyan-400 font-medium w-20">
            {formatTime(currentTime)}
          </div>

          <div className="flex items-center gap-6">
             <button 
                onClick={() => onSeek(0)}
                className="p-2.5 rounded-full text-slate-400 hover:text-white hover:bg-slate-700/50 transition-all"
                title="Restart"
             >
               <RotateCcw size={18} />
             </button>

             <button 
              onClick={onPlayPause}
              className="w-14 h-14 rounded-full bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white flex items-center justify-center transition-all active:scale-95 shadow-lg shadow-cyan-900/30 border border-cyan-400/20"
            >
              {isPlaying ? <Pause size={24} fill="currentColor" /> : <Play size={24} fill="currentColor" className="ml-1" />}
            </button>
          </div>

          <div className="text-xs font-mono text-slate-500 w-20 text-right">
            {formatTime(duration)}
          </div>
        </div>
      </div>
    </div>
  );
};