import React, { useEffect, useState } from 'react';
import { SongData } from '../types';
import { Download, X, Film, AlertCircle, Settings, Smartphone, Monitor } from 'lucide-react';
import { exportVideoWithFFmpeg, ExportProgress, ExportConfig } from '../services/ffmpegService';

interface VideoExportModalProps {
  songData: SongData;
  onClose: () => void;
}

export const VideoExportModal: React.FC<VideoExportModalProps> = ({ songData, onClose }) => {
  const [exportProgress, setExportProgress] = useState<ExportProgress>({
    stage: 'loading',
    progress: 0,
    message: 'Initializing...'
  });
  const [videoBlobUrl, setVideoBlobUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Configuration State
  const [config, setConfig] = useState<ExportConfig>({
    orientation: 'landscape',
    useModernEffects: true,
    syncOffsetMs: -50,
    fadeOutBeforeCut: true,
    wordLevelHighlight: true
  });
  const [isExporting, setIsExporting] = useState(false);

  // Cleanup blob URL on unmount
  useEffect(() => {
    return () => {
      if (videoBlobUrl) URL.revokeObjectURL(videoBlobUrl);
    };
  }, [videoBlobUrl]);

  const startExport = async () => {
    setIsExporting(true);
    setError(null);
    setVideoBlobUrl(null);

    try {
      const blob = await exportVideoWithFFmpeg(songData, (progress) => {
        setExportProgress(progress);
      }, config);

      const url = URL.createObjectURL(blob);
      setVideoBlobUrl(url);
    } catch (e: any) {
      console.error('Export failed:', e);
      setError(e.message || 'Export failed. Please try again.');
      setIsExporting(false);
    }
  };

  const handleDownload = () => {
    if (videoBlobUrl) {
      const a = document.createElement('a');
      a.href = videoBlobUrl;
      a.download = `${songData.fileName.replace(/\.[^/.]+$/, '')}-lyriclens-${config.orientation}.mp4`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
  };

  const isComplete = exportProgress.stage === 'complete' && videoBlobUrl;

  const getStageLabel = () => {
    switch (exportProgress.stage) {
      case 'loading': return 'Loading FFmpeg';
      case 'preparing': return 'Preparing Assets';
      case 'rendering': return 'Rendering Frames';
      case 'encoding': return 'Encoding Video';
      case 'complete': return 'Complete';
      default: return 'Processing';
    }
  };

  return (
    <div className="fixed inset-0 z-[100] bg-slate-900/90 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-slate-800 border border-slate-700 rounded-2xl p-8 max-w-lg w-full shadow-2xl relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-white transition-colors"
        >
          <X size={20} />
        </button>

        <h2 className="text-2xl font-bold text-white mb-2 flex items-center gap-3">
          <Film className="text-cyan-400" />
          {isComplete ? 'Video Ready!' : isExporting ? 'Exporting Video' : 'Export Settings'}
        </h2>

        {!isExporting && !isComplete && (
          <p className="text-slate-400 text-sm mb-6">
            Customize your video export settings.
          </p>
        )}

        {error ? (
          <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-6 text-center mb-6">
            <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-3" />
            <p className="text-red-300 mb-4">{error}</p>
            <button
              onClick={() => setError(null)}
              className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg text-sm font-medium transition-colors"
            >
              Try Again
            </button>
          </div>
        ) : isExporting && !isComplete ? (
          <div className="space-y-6">
            {/* Stage indicator */}
            <div className="flex justify-between text-xs uppercase tracking-wider">
              <span className="text-cyan-400 font-medium">{getStageLabel()}</span>
              <span className="text-slate-400">{Math.round(exportProgress.progress)}%</span>
            </div>

            {/* Progress bar */}
            <div className="h-3 bg-slate-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-cyan-500 to-blue-500 transition-all duration-300 ease-out"
                style={{ width: `${exportProgress.progress}%` }}
              />
            </div>

            {/* Status message */}
            <p className="text-sm text-slate-400 text-center">
              {exportProgress.message}
            </p>

            {/* Stage steps */}
            <div className="flex justify-between text-xs text-slate-500 pt-2">
              {['loading', 'preparing', 'rendering', 'encoding'].map((stage, i) => {
                const stages = ['loading', 'preparing', 'rendering', 'encoding', 'complete'];
                const currentIdx = stages.indexOf(exportProgress.stage);
                const stageIdx = stages.indexOf(stage);
                const isActive = stageIdx <= currentIdx;

                return (
                  <div key={stage} className="flex flex-col items-center gap-1">
                    <div className={`w-3 h-3 rounded-full ${isActive ? 'bg-cyan-500' : 'bg-slate-600'}`} />
                    <span className={isActive ? 'text-cyan-400' : ''}>{stage}</span>
                  </div>
                );
              })}
            </div>

            <p className="text-xs text-slate-500 text-center mt-4">
              This may take a few minutes depending on video length.
            </p>
          </div>
        ) : isComplete ? (
          <div className="text-center space-y-6">
            <div className="p-6 bg-green-500/10 rounded-full w-24 h-24 mx-auto flex items-center justify-center">
              <Download className="w-12 h-12 text-green-400" />
            </div>

            {videoBlobUrl && (
              <video
                src={videoBlobUrl}
                controls
                className="w-full rounded-lg border border-slate-700 max-h-[300px]"
              />
            )}

            <button
              onClick={handleDownload}
              className="w-full py-3 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-cyan-900/30"
            >
              <Download size={20} />
              Download MP4
            </button>

            <button
              onClick={() => {
                setIsExporting(false);
                setExportProgress({ stage: 'loading', progress: 0, message: 'Initializing...' });
                setVideoBlobUrl(null);
              }}
              className="text-slate-400 hover:text-white text-sm underline"
            >
              Export Another Version
            </button>
          </div>
        ) : (
          // Configuration Form
          <div className="space-y-6">

            {/* Orientation Selection */}
            <div className="space-y-3">
              <label className="text-sm font-medium text-slate-300">Video Orientation</label>
              <div className="grid grid-cols-2 gap-4">
                <button
                  onClick={() => setConfig({ ...config, orientation: 'landscape' })}
                  className={`p-4 rounded-xl border flex flex-col items-center gap-2 transition-all ${config.orientation === 'landscape'
                    ? 'bg-cyan-500/10 border-cyan-500 text-cyan-400'
                    : 'bg-slate-700/50 border-slate-600 text-slate-400 hover:bg-slate-700'
                    }`}
                >
                  <Monitor size={24} />
                  <span className="text-sm font-medium">Landscape (16:9)</span>
                </button>
                <button
                  onClick={() => setConfig({ ...config, orientation: 'portrait' })}
                  className={`p-4 rounded-xl border flex flex-col items-center gap-2 transition-all ${config.orientation === 'portrait'
                    ? 'bg-cyan-500/10 border-cyan-500 text-cyan-400'
                    : 'bg-slate-700/50 border-slate-600 text-slate-400 hover:bg-slate-700'
                    }`}
                >
                  <Smartphone size={24} />
                  <span className="text-sm font-medium">Portrait (9:16)</span>
                </button>
              </div>
            </div>

            {/* Modern Effects Toggle */}
            <div className="space-y-3">
              <label className="text-sm font-medium text-slate-300">Visual Style</label>
              <div
                onClick={() => setConfig({ ...config, useModernEffects: !config.useModernEffects })}
                className={`p-4 rounded-xl border cursor-pointer transition-all flex items-center justify-between ${config.useModernEffects
                  ? 'bg-purple-500/10 border-purple-500/50'
                  : 'bg-slate-700/50 border-slate-600'
                  }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${config.useModernEffects ? 'bg-purple-500/20 text-purple-400' : 'bg-slate-600 text-slate-400'}`}>
                    <Settings size={20} />
                  </div>
                  <div>
                    <h3 className={`font-medium ${config.useModernEffects ? 'text-white' : 'text-slate-300'}`}>Cinematic Effects</h3>
                    <p className="text-xs text-slate-400">Ken Burns zoom, smooth transitions, glow</p>
                  </div>
                </div>
                <div className={`w-12 h-6 rounded-full p-1 transition-colors ${config.useModernEffects ? 'bg-purple-500' : 'bg-slate-600'}`}>
                  <div className={`w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${config.useModernEffects ? 'translate-x-6' : 'translate-x-0'}`} />
                </div>
              </div>
            </div>

            {/* Lyric Animation Settings */}
            <div className="space-y-4 border-t border-slate-700 pt-4">
              <label className="text-sm font-medium text-slate-300">Lyric Animation</label>

              {/* Sync Offset Slider */}
              <div className="space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-400">Sync Offset</span>
                  <span className="text-cyan-400 font-mono">{config.syncOffsetMs}ms</span>
                </div>
                <input
                  type="range"
                  min="-200"
                  max="100"
                  step="10"
                  value={config.syncOffsetMs}
                  onChange={(e) => setConfig({ ...config, syncOffsetMs: parseInt(e.target.value) })}
                  className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-cyan-500"
                />
                <p className="text-xs text-slate-500">
                  Negative = lyrics appear earlier (fixes perceived lag)
                </p>
              </div>

              {/* Word-Level Highlighting Toggle */}
              <div
                onClick={() => setConfig({ ...config, wordLevelHighlight: !config.wordLevelHighlight })}
                className={`p-3 rounded-lg border cursor-pointer transition-all flex items-center justify-between ${config.wordLevelHighlight
                  ? 'bg-cyan-500/10 border-cyan-500/50'
                  : 'bg-slate-700/50 border-slate-600'
                  }`}
              >
                <div>
                  <h4 className={`text-sm font-medium ${config.wordLevelHighlight ? 'text-white' : 'text-slate-300'}`}>
                    Word-by-Word Karaoke
                  </h4>
                  <p className="text-xs text-slate-500">Highlight each word as it's sung</p>
                </div>
                <div className={`w-10 h-5 rounded-full p-0.5 transition-colors ${config.wordLevelHighlight ? 'bg-cyan-500' : 'bg-slate-600'}`}>
                  <div className={`w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${config.wordLevelHighlight ? 'translate-x-5' : 'translate-x-0'}`} />
                </div>
              </div>

              {/* Fade Before Cut Toggle */}
              <div
                onClick={() => setConfig({ ...config, fadeOutBeforeCut: !config.fadeOutBeforeCut })}
                className={`p-3 rounded-lg border cursor-pointer transition-all flex items-center justify-between ${config.fadeOutBeforeCut
                  ? 'bg-cyan-500/10 border-cyan-500/50'
                  : 'bg-slate-700/50 border-slate-600'
                  }`}
              >
                <div>
                  <h4 className={`text-sm font-medium ${config.fadeOutBeforeCut ? 'text-white' : 'text-slate-300'}`}>
                    Fade Before Scene Change
                  </h4>
                  <p className="text-xs text-slate-500">Lyrics fade out before image transitions</p>
                </div>
                <div className={`w-10 h-5 rounded-full p-0.5 transition-colors ${config.fadeOutBeforeCut ? 'bg-cyan-500' : 'bg-slate-600'}`}>
                  <div className={`w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${config.fadeOutBeforeCut ? 'translate-x-5' : 'translate-x-0'}`} />
                </div>
              </div>
            </div>

            <button
              onClick={startExport}
              className="w-full py-3 mt-4 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-cyan-900/30"
            >
              <Film size={20} />
              Start Export
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
