import React, { useEffect, useState } from 'react';
import { SongData } from '../types';
import { Download, Film, AlertCircle, Settings, Smartphone, Monitor, Loader2, Video, Cloud, Laptop } from 'lucide-react';
import { exportVideoWithFFmpeg, exportVideoClientSide, ExportProgress, ExportConfig } from '../services/ffmpegService';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface VideoExportModalProps {
  songData: SongData;
  onClose: () => void;
  isOpen: boolean;
}

export const VideoExportModal: React.FC<VideoExportModalProps> = ({ songData, onClose, isOpen }) => {
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
  const [useCloudRender, setUseCloudRender] = useState(false);

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
      const exportFn = useCloudRender ? exportVideoWithFFmpeg : exportVideoClientSide;
      const blob = await exportFn(songData, (progress) => {
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
    <Dialog open={isOpen} onOpenChange={(open) => !open && !isExporting && onClose()}>
      <DialogContent className="sm:max-w-md md:max-w-lg bg-slate-900 border-slate-800 text-slate-100">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Film className="w-5 h-5 text-cyan-400" />
            {isComplete ? 'Video Ready!' : isExporting ? 'Exporting Video' : 'Export Settings'}
          </DialogTitle>
          <DialogDescription className="text-slate-400">
            {!isExporting && !isComplete && 'Customize your video export settings.'}
            {isExporting && !isComplete && 'Please wait while we render your video.'}
            {isComplete && 'Your video has been successfully generated.'}
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          {error ? (
            <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-6 text-center mb-6">
              <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-3" />
              <p className="text-red-300 mb-4">{error}</p>
              <Button
                variant="destructive"
                onClick={() => setError(null)}
              >
                Try Again
              </Button>
            </div>
          ) : isExporting && !isComplete ? (
            <div className="space-y-6">
              <div className="flex justify-between text-xs uppercase tracking-wider">
                <span className="text-cyan-400 font-medium">{getStageLabel()}</span>
                <span className="text-slate-400">{Math.round(exportProgress.progress)}%</span>
              </div>

              <Progress value={exportProgress.progress} className="h-2" />

              <p className="text-sm text-slate-400 text-center animate-pulse">
                {exportProgress.message}
              </p>

              <div className="grid grid-cols-5 gap-1 pt-2">
                {['loading', 'preparing', 'rendering', 'encoding', 'complete'].map((stage, i) => {
                  const stages = ['loading', 'preparing', 'rendering', 'encoding', 'complete'];
                  const currentIdx = stages.indexOf(exportProgress.stage);
                  const stageIdx = stages.indexOf(stage);
                  const isActive = stageIdx <= currentIdx;

                  return (
                    <div key={stage} className="flex flex-col items-center gap-1">
                      <div className={cn("w-2 h-2 rounded-full transition-colors", isActive ? "bg-cyan-500" : "bg-slate-700")} />
                      <span className={cn("text-[9px] capitalize", isActive ? "text-cyan-400" : "text-slate-600")}>
                        {stage}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : isComplete ? (
            <div className="space-y-6">
              {videoBlobUrl && (
                <div className="relative aspect-video rounded-lg overflow-hidden bg-black border border-slate-800">
                  <video
                    src={videoBlobUrl}
                    controls
                    className="w-full h-full"
                  />
                </div>
              )}

              <div className="flex flex-col gap-2">
                <Button onClick={handleDownload} className="w-full bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold border-0">
                  <Download className="mr-2 h-4 w-4" /> Download MP4
                </Button>
                <Button variant="ghost" className="text-slate-400 hover:text-white" onClick={() => {
                  setIsExporting(false);
                  setExportProgress({ stage: 'loading', progress: 0, message: 'Initializing...' });
                  setVideoBlobUrl(null);
                }}>
                  Export Another Version
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Render Engine */}
              <div className="space-y-3">
                <Label className="text-slate-300">Render Engine</Label>
                <div className="grid grid-cols-2 gap-4">
                  <Card
                    className={cn(
                      "cursor-pointer transition-all border-slate-700 bg-slate-800/50 hover:bg-slate-700",
                      !useCloudRender && "border-green-500 bg-green-500/10"
                    )}
                    onClick={() => setUseCloudRender(false)}
                  >
                    <CardContent className="flex flex-col items-center justify-center p-4 gap-2">
                      <Laptop className={cn("h-6 w-6", !useCloudRender ? "text-green-400" : "text-slate-400")} />
                      <div className="text-center">
                        <span className="text-sm font-medium">Browser</span>
                        <span className="text-[10px] text-slate-500 block">Private, No Upload</span>
                      </div>
                    </CardContent>
                  </Card>
                  <Card
                    className={cn(
                      "cursor-pointer transition-all border-slate-700 bg-slate-800/50 hover:bg-slate-700",
                      useCloudRender && "border-blue-500 bg-blue-500/10"
                    )}
                    onClick={() => setUseCloudRender(true)}
                  >
                    <CardContent className="flex flex-col items-center justify-center p-4 gap-2">
                      <Cloud className={cn("h-6 w-6", useCloudRender ? "text-blue-400" : "text-slate-400")} />
                      <div className="text-center">
                        <span className="text-sm font-medium">Cloud</span>
                        <span className="text-[10px] text-slate-500 block">Faster for 4K</span>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>

              {/* Orientation */}
              <div className="space-y-3">
                <Label className="text-slate-300">Video Orientation</Label>
                <div className="grid grid-cols-2 gap-4">
                  <Card
                    className={cn(
                      "cursor-pointer transition-all border-slate-700 bg-slate-800/50 hover:bg-slate-700",
                      config.orientation === 'landscape' && "border-cyan-500 bg-cyan-500/10"
                    )}
                    onClick={() => setConfig({ ...config, orientation: 'landscape' })}
                  >
                    <CardContent className="flex flex-col items-center justify-center p-4 gap-2">
                      <Monitor className={cn("h-6 w-6", config.orientation === 'landscape' ? "text-cyan-400" : "text-slate-400")} />
                      <span className="text-sm font-medium">Landscape (16:9)</span>
                    </CardContent>
                  </Card>
                  <Card
                    className={cn(
                      "cursor-pointer transition-all border-slate-700 bg-slate-800/50 hover:bg-slate-700",
                      config.orientation === 'portrait' && "border-cyan-500 bg-cyan-500/10"
                    )}
                    onClick={() => setConfig({ ...config, orientation: 'portrait' })}
                  >
                    <CardContent className="flex flex-col items-center justify-center p-4 gap-2">
                      <Smartphone className={cn("h-6 w-6", config.orientation === 'portrait' ? "text-cyan-400" : "text-slate-400")} />
                      <span className="text-sm font-medium">Portrait (9:16)</span>
                    </CardContent>
                  </Card>
                </div>
              </div>

              {/* Visual Style */}
              <div className="flex items-center justify-between space-x-2 p-3 rounded-lg border border-slate-700 bg-slate-800/30">
                <div className="space-y-0.5">
                  <Label className="text-base text-slate-200 flex items-center gap-2">
                    <Settings className="w-4 h-4 text-purple-400" /> Cinematic Effects
                  </Label>
                  <p className="text-xs text-slate-400">Ken Burns zoom, smooth transitions, glow</p>
                </div>
                <Switch
                  checked={config.useModernEffects}
                  onCheckedChange={(checked) => setConfig({ ...config, useModernEffects: checked })}
                  className="data-[state=checked]:bg-purple-600"
                />
              </div>

              <div className="space-y-4 pt-2 border-t border-slate-700/50">
                <Label className="text-slate-300">Lyric Animation</Label>

                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-xs text-slate-400">Sync Offset</span>
                    <span className="text-xs text-cyan-400 font-mono">{config.syncOffsetMs}ms</span>
                  </div>
                  <Slider
                    min={-200}
                    max={100}
                    step={10}
                    value={[config.syncOffsetMs]}
                    onValueChange={(vals) => setConfig({ ...config, syncOffsetMs: vals[0] })}
                    className="py-2"
                  />
                  <p className="text-[10px] text-slate-500">Negative values make lyrics appear earlier.</p>
                </div>

                <div className="flex items-center justify-between space-x-2">
                  <div className="space-y-0.5">
                    <Label className="text-sm text-slate-300">Word-by-Word Karaoke</Label>
                    <p className="text-xs text-slate-500">Highlight each word as it's sung</p>
                  </div>
                  <Switch
                    checked={config.wordLevelHighlight}
                    onCheckedChange={(checked) => setConfig({ ...config, wordLevelHighlight: checked })}
                  />
                </div>

                <div className="flex items-center justify-between space-x-2">
                  <div className="space-y-0.5">
                    <Label className="text-sm text-slate-300">Fade Before Scene Change</Label>
                    <p className="text-xs text-slate-500">Lyrics fade out before transitions</p>
                  </div>
                  <Switch
                    checked={config.fadeOutBeforeCut}
                    onCheckedChange={(checked) => setConfig({ ...config, fadeOutBeforeCut: checked })}
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="sm:justify-between">
          {!isExporting && !isComplete && (
            <Button
              className="w-full bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold border-0 h-11"
              onClick={startExport}
            >
              <Film className="mr-2 h-4 w-4" /> Start Export
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
