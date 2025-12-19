import React, { useEffect, useState } from 'react';
import { SongData } from '../types';
import { Download, X, Film, AlertCircle } from 'lucide-react';
import { exportVideoWithFFmpeg, ExportProgress } from '../services/ffmpegService';

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

  useEffect(() => {
    let cancelled = false;

    const runExport = async () => {
      try {
        const blob = await exportVideoWithFFmpeg(songData, (progress) => {
          if (!cancelled) setExportProgress(progress);
        });
        
        if (!cancelled) {
          const url = URL.createObjectURL(blob);
          setVideoBlobUrl(url);
        }
      } catch (e: any) {
        console.error('Export failed:', e);
        if (!cancelled) {
          setError(e.message || 'Export failed. Please try again.');
        }
      }
    };

    runExport();

    return () => {
      cancelled = true;
      if (videoBlobUrl) URL.revokeObjectURL(videoBlobUrl);
    };
  }, []);

  const handleDownload = () => {
    if (videoBlobUrl) {
      const a = document.createElement('a');
      a.href = videoBlobUrl;
      a.download = `${songData.fileName.replace(/\.[^/.]+$/, '')}-lyriclens.mp4`;
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
          {isComplete ? 'Video Ready!' : 'Exporting Video'}
        </h2>
        <p className="text-slate-400 text-sm mb-6">
          {isComplete ? 'Your MP4 video is ready to download.' : 'Creating your lyric video with FFmpeg...'}
        </p>

        {error ? (
          <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-6 text-center">
            <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-3" />
            <p className="text-red-300 mb-4">{error}</p>
            <button
              onClick={onClose}
              className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg text-sm font-medium transition-colors"
            >
              Close
            </button>
          </div>
        ) : !isComplete ? (
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
        ) : (
          <div className="text-center space-y-6">
            <div className="p-6 bg-green-500/10 rounded-full w-24 h-24 mx-auto flex items-center justify-center">
              <Download className="w-12 h-12 text-green-400" />
            </div>
            
            {videoBlobUrl && (
              <video 
                src={videoBlobUrl} 
                controls 
                className="w-full rounded-lg border border-slate-700"
              />
            )}

            <button
              onClick={handleDownload}
              className="w-full py-3 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-cyan-900/30"
            >
              <Download size={20} />
              Download MP4
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
