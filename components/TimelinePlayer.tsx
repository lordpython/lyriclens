import React, { useRef, useEffect, useState } from 'react';
import { Play, Pause, RotateCcw, Activity, Circle, Waves, Sparkles } from 'lucide-react';
import { SubtitleItem } from '../types';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Card } from '@/components/ui/card';

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

type VisualizerMode = 'bars' | 'circular' | 'wave' | 'particles';

// Particle System Helper
class ParticleSystem {
  particles: { x: number; y: number; vx: number; vy: number; life: number; color: string; size: number }[] = [];

  update(width: number, height: number, bassEnergy: number) {
    // Spawn particles on bass kick
    if (bassEnergy > 230) { // Threshold for bass kick
      const count = Math.floor(bassEnergy / 20);
      for (let i = 0; i < count; i++) {
        this.particles.push({
          x: width / 2,
          y: height / 2,
          vx: (Math.random() - 0.5) * 10,
          vy: (Math.random() - 0.5) * 10,
          life: 1.0,
          color: `hsl(${Math.random() * 60 + 180}, 100%, 70%)`, // Cyan to Blue
          size: Math.random() * 4 + 1
        });
      }
    }

    // Update existing
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.life -= 0.02;
      p.size *= 0.95;

      if (p.life <= 0 || p.x < 0 || p.x > width || p.y < 0 || p.y > height) {
        this.particles.splice(i, 1);
      }
    }
  }

  draw(ctx: CanvasRenderingContext2D) {
    ctx.globalCompositeOperation = 'lighter';
    this.particles.forEach(p => {
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fillStyle = p.color;
      ctx.globalAlpha = p.life;
      ctx.fill();
    });
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1.0;
  }
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
  const [visualizerMode, setVisualizerMode] = useState<VisualizerMode>('wave');

  // Visualizer State
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const particleSystemRef = useRef<ParticleSystem>(new ParticleSystem());

  // Initialize Audio Context for Visualizer
  useEffect(() => {
    // We strictly need to resume/init context on user interaction or play
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

          // Tune FFT size based on mode
          // 256 for bars, 2048 for wave/fine details
          analyserRef.current.fftSize = visualizerMode === 'wave' ? 2048 : 256;
          analyserRef.current.smoothingTimeConstant = 0.8;

          sourceRef.current.connect(analyserRef.current);
          analyserRef.current.connect(ctx.destination);
        } catch (e) {
          console.warn("MediaElementSource already connected or error:", e);
        }
      }

      // Ensure FFT size is improved if we switched modes while playing
      if (analyserRef.current) {
        analyserRef.current.fftSize = visualizerMode === 'circular' ? 512 : (visualizerMode === 'wave' ? 2048 : 256);
      }

      // Resume context if suspended (browser policy)
      if (ctx.state === 'suspended') {
        ctx.resume();
      }

      startRenderLoop();
    };

    initAudioContext();

    return () => {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    };
  }, [isPlaying, visualizerMode]);

  const startRenderLoop = () => {
    const canvas = visualizerCanvasRef.current;
    const analyser = analyserRef.current;
    if (!canvas || !analyser) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Handle High DPI
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);
    const width = rect.width;
    const height = rect.height;

    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const render = () => {
      if (!analyser) return;
      analyser.getByteFrequencyData(dataArray);

      ctx.clearRect(0, 0, width, height);

      switch (visualizerMode) {
        case 'circular':
          drawCircular(ctx, width, height, dataArray, bufferLength);
          break;
        case 'wave':
          drawWave(ctx, width, height, dataArray, bufferLength);
          break;
        case 'particles':
          drawParticles(ctx, width, height, dataArray, bufferLength);
          break;
        default:
          drawBars(ctx, width, height, dataArray, bufferLength);
      }

      animationFrameRef.current = requestAnimationFrame(render);
    };

    render();
  };

  const drawBars = (ctx: CanvasRenderingContext2D, w: number, h: number, data: Uint8Array, len: number) => {
    const barWidth = (w / len) * 2.5;
    let x = 0;

    const gradient = ctx.createLinearGradient(0, h, 0, 0);
    gradient.addColorStop(0, 'rgba(34, 211, 238, 0.1)');
    gradient.addColorStop(0.5, 'rgba(34, 211, 238, 0.8)');
    gradient.addColorStop(1, 'rgba(167, 139, 250, 0.9)');

    ctx.fillStyle = gradient;

    for (let i = 0; i < len; i++) {
      const barHeight = (data[i] / 255) * h * 0.8;
      const centerX = w / 2;
      const offset = i * (barWidth + 1);

      ctx.fillRect(centerX + offset, h - barHeight, barWidth, barHeight);
      ctx.fillRect(centerX - offset - barWidth, h - barHeight, barWidth, barHeight);

      x += barWidth + 1;
      if (x > w) break;
    }
  };

  const drawCircular = (ctx: CanvasRenderingContext2D, w: number, h: number, data: Uint8Array, len: number) => {
    const cx = w / 2;
    const cy = h / 2;
    const radius = Math.min(w, h) * 0.3;

    ctx.lineWidth = 2;
    ctx.lineCap = 'round';

    // Glow effect
    ctx.shadowBlur = 15;
    ctx.shadowColor = '#22d3ee';

    const angleStep = (Math.PI * 2) / len;

    // Draw multiple rings for depth
    // 1. Bass ring (inner)
    ctx.beginPath();
    for (let i = 0; i < len; i += 2) { // Skip some for style
      const value = data[i];
      const barHeight = (value / 255) * 60;
      const angle = i * angleStep;

      const xStart = cx + Math.cos(angle) * radius;
      const yStart = cy + Math.sin(angle) * radius;
      const xEnd = cx + Math.cos(angle) * (radius + barHeight);
      const yEnd = cy + Math.sin(angle) * (radius + barHeight);

      ctx.moveTo(xStart, yStart);
      ctx.lineTo(xEnd, yEnd);
    }
    ctx.strokeStyle = `rgba(34, 211, 238, 0.8)`;
    ctx.stroke();

    // 2. High freq ring (outer, lighter)
    ctx.shadowBlur = 5;
    ctx.shadowColor = '#a78bfa';
    ctx.beginPath();
    for (let i = 0; i < len; i += 4) {
      const value = data[len - i - 1]; // Reverse for high freqs outside if we want, or just mirror
      if (value < 50) continue;
      const barHeight = (value / 255) * 40;
      const angle = i * angleStep - Math.PI / 2; // Offset rotation

      const rOuter = radius + 70;
      const xStart = cx + Math.cos(angle) * rOuter;
      const yStart = cy + Math.sin(angle) * rOuter;
      const xEnd = cx + Math.cos(angle) * (rOuter + barHeight);
      const yEnd = cy + Math.sin(angle) * (rOuter + barHeight);

      ctx.moveTo(xStart, yStart);
      ctx.lineTo(xEnd, yEnd);
    }
    ctx.strokeStyle = `rgba(167, 139, 250, 0.6)`;
    ctx.stroke();

    ctx.shadowBlur = 0; // Reset
  };

  const drawWave = (ctx: CanvasRenderingContext2D, w: number, h: number, data: Uint8Array, len: number) => {
    // Smooth Bezier Curve Visualizer
    ctx.lineWidth = 3;

    // Create gradient fill
    const gradient = ctx.createLinearGradient(0, h, 0, h / 2);
    gradient.addColorStop(0, 'rgba(34, 211, 238, 0.0)');
    gradient.addColorStop(0.5, 'rgba(34, 211, 238, 0.2)');
    gradient.addColorStop(1, 'rgba(167, 139, 250, 0.4)');

    const strokeGradient = ctx.createLinearGradient(0, 0, w, 0);
    strokeGradient.addColorStop(0, '#22d3ee');
    strokeGradient.addColorStop(0.5, '#a78bfa');
    strokeGradient.addColorStop(1, '#22d3ee');

    const sliceWidth = w / (len / 3); // Zoom in on lower frequencies mostly
    let x = 0;

    ctx.beginPath();
    ctx.moveTo(0, h);

    // Control points for bezier
    let lastX = 0;
    let lastY = h;

    // Use a subset of data for smoother curve (e.g., skip every 4)
    const step = 4;
    for (let i = 0; i < len / 3; i += step) {
      const value = data[i];
      const percent = value / 255;
      const y = h - (percent * h * 0.6) - 20; // -20 offset

      const nextX = i * sliceWidth * step; // Rough x approx
      // Actual x needs precise calculation or just loop index

      const xc = (lastX + (x + sliceWidth * step)) / 2;
      const yc = (lastY + y) / 2;

      ctx.quadraticCurveTo(lastX, lastY, xc, yc);
      // ctx.lineTo(x + sliceWidth * step, y); // Straight line test

      lastX = x + sliceWidth * step;
      lastY = y;
      x += sliceWidth * step;
    }

    ctx.lineTo(w, h);
    ctx.closePath();

    ctx.fillStyle = gradient;
    ctx.fill();

    ctx.strokeStyle = strokeGradient;
    ctx.stroke();
  };

  const drawParticles = (ctx: CanvasRenderingContext2D, w: number, h: number, data: Uint8Array, len: number) => {
    // 1. Draw a subtle background wave
    const bassEnergy = data.slice(0, 10).reduce((a, b) => a + b, 0) / 10;

    // Pulse background
    if (bassEnergy > 200) {
      ctx.fillStyle = `rgba(34, 211, 238, ${0.05 + (bassEnergy / 255) * 0.05})`;
      ctx.fillRect(0, 0, w, h);
    }

    // 2. Draw circular center pulse
    const radius = 50 + (bassEnergy / 255) * 30;
    ctx.beginPath();
    ctx.arc(w / 2, h / 2, radius, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(167, 139, 250, 0.2)';
    ctx.fill();

    // 3. Update and Draw Particles
    particleSystemRef.current.update(w, h, bassEnergy);
    particleSystemRef.current.draw(ctx);
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

  const visuals = [
    { id: 'wave', icon: Waves, label: 'Fluid' },
    { id: 'circular', icon: Circle, label: 'Radial' },
    { id: 'particles', icon: Sparkles, label: 'Particles' },
    { id: 'bars', icon: Activity, label: 'Bars' },
  ];

  return (
    <Card className="flex flex-col gap-4 bg-slate-800/80 border-slate-700 p-6 shadow-xl backdrop-blur-sm">
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
          className="absolute inset-0 w-full h-full opacity-60 z-0 pointer-events-none"
        />

        {/* Gradient Overlay for Readability */}
        <div className="absolute inset-0 bg-gradient-to-t from-slate-900/90 via-transparent to-slate-900/40 z-1 pointer-events-none"></div>

        {/* Visualizer Controls (Top Right, Hidden unless hovered) */}
        <div className="absolute top-4 right-4 z-20 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
          {visuals.map((v) => (
            <Button
              key={v.id}
              variant="outline"
              size="icon"
              onClick={() => setVisualizerMode(v.id as VisualizerMode)}
              className={cn(
                "h-8 w-8 hover:bg-slate-800",
                visualizerMode === v.id ? "bg-cyan-500/20 border-cyan-400 text-cyan-400" : "bg-black/40 border-slate-700 text-slate-400"
              )}
              title={v.label}
            >
              <v.icon size={16} />
            </Button>
          ))}
        </div>

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
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onSeek(0)}
              className="rounded-full text-slate-400 hover:text-white hover:bg-slate-700/50"
              title="Restart"
            >
              <RotateCcw size={18} />
            </Button>

            <Button
              onClick={onPlayPause}
              className="w-14 h-14 rounded-full bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white flex items-center justify-center transition-all active:scale-95 shadow-lg shadow-cyan-900/30 border border-cyan-400/20 p-0"
            >
              {isPlaying ? <Pause size={24} fill="currentColor" /> : <Play size={24} fill="currentColor" className="ml-1" />}
            </Button>
          </div>

          <div className="text-xs font-mono text-slate-500 w-20 text-right">
            {formatTime(duration)}
          </div>
        </div>
      </div>
    </Card>
  );
};