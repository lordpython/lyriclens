import React, { useState } from 'react';
import { ImagePrompt, GeneratedImage } from '../types';
import { Wand2, Image as ImageIcon, Download, Loader2, Clock, Edit2, X, Check, RefreshCw } from 'lucide-react';
import { generateImageFromPrompt } from '../services/geminiService';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

interface ImageGeneratorProps {
  prompt: ImagePrompt;
  onImageGenerated: (img: GeneratedImage) => void;
  existingImage?: string;
}

export const ImageGenerator: React.FC<ImageGeneratorProps> = ({ prompt, onImageGenerated, existingImage }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [currentPromptText, setCurrentPromptText] = useState(prompt.text);

  const handleGenerate = async () => {
    setLoading(true);
    setError(null);
    try {
      // Use the potentially edited text
      const base64Image = await generateImageFromPrompt(currentPromptText);
      onImageGenerated({
        promptId: prompt.id,
        imageUrl: base64Image
      });
    } catch (err) {
      setError("Failed to generate image.");
    } finally {
      setLoading(false);
    }
  };

  const handleSaveEdit = () => {
    setIsEditing(false);
  };

  const handleCancelEdit = () => {
    setCurrentPromptText(prompt.text);
    setIsEditing(false);
  };

  return (
    <Card className="group relative bg-slate-800 border-slate-700 overflow-hidden flex flex-col h-full hover:border-slate-600 transition-all">
      {/* Header / Mood Badge */}
      <div className="absolute top-3 left-3 z-10 flex gap-2">
        <Badge variant="secondary" className="bg-cyan-900/90 text-cyan-100 border-cyan-700 backdrop-blur-md font-medium uppercase tracking-wider hover:bg-cyan-900/90">
          {prompt.mood}
        </Badge>
        {prompt.timestamp && (
          <Badge variant="outline" className="bg-slate-900/90 text-slate-300 border-slate-700 backdrop-blur-md flex items-center gap-1 hover:bg-slate-900/90">
            <Clock size={10} />
            {prompt.timestamp}
          </Badge>
        )}
      </div>

      {/* Image Area */}
      <div className="aspect-video bg-slate-900 w-full relative overflow-hidden">
        {existingImage ? (
          <img
            src={existingImage}
            alt={prompt.mood}
            className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center text-slate-600 p-6 text-center bg-[url('/cubes.png')] bg-opacity-5">
            {loading ? (
              <Loader2 className="w-10 h-10 animate-spin text-cyan-500 mb-2" />
            ) : (
              <ImageIcon className="w-12 h-12 mb-2 opacity-20" />
            )}
            <p className="text-sm">{loading ? "Painting..." : "No image generated yet"}</p>
          </div>
        )}
      </div>

      {/* Prompt & Actions */}
      <CardContent className="p-4 flex flex-col grow">
        <div className="mb-4 relative group/text">
          {isEditing ? (
            <div className="flex flex-col gap-2">
              <Textarea
                value={currentPromptText}
                onChange={(e) => setCurrentPromptText(e.target.value)}
                className="min-h-[100px] text-sm bg-slate-900 border-slate-600 text-slate-200 focus:ring-cyan-500"
              />
              <div className="flex justify-end gap-2">
                 <Button onClick={handleCancelEdit} size="icon" variant="ghost" className="h-6 w-6 text-slate-400 hover:text-red-400">
                  <X size={14} />
                 </Button>
                 <Button onClick={handleSaveEdit} size="icon" variant="ghost" className="h-6 w-6 text-slate-400 hover:text-green-400">
                  <Check size={14} />
                 </Button>
              </div>
            </div>
          ) : (
             <>
               <p className="text-slate-300 text-sm italic line-clamp-3 group-hover:line-clamp-none transition-all pr-6">
                 "{currentPromptText}"
               </p>
               {!loading && !existingImage && (
                 <button 
                   onClick={() => setIsEditing(true)}
                   className="absolute top-0 right-0 p-1 text-slate-500 hover:text-cyan-400 opacity-0 group-hover/text:opacity-100 transition-opacity"
                 >
                   <Edit2 size={14} />
                 </button>
               )}
             </>
          )}
        </div>

        <div className="mt-auto flex justify-end gap-2 items-center">
          {error && <span className="text-red-400 text-xs mr-auto">{error}</span>}

          {existingImage ? (
            <div className="flex gap-2 w-full justify-end">
              <Button 
                onClick={handleGenerate} 
                disabled={loading}
                variant="secondary" 
                size="sm" 
                className="text-xs h-8 bg-slate-700 text-slate-300 hover:bg-slate-600 hover:text-white"
              >
                <RefreshCw className="w-3 h-3 mr-2" />
                Regenerate
              </Button>
              <Button variant="secondary" size="sm" asChild className="text-xs h-8">
                <a
                  href={existingImage}
                  download={`lyric-art-${prompt.mood}.png`}
                >
                  <Download className="mr-2 h-3 w-3" />
                  Download
                </a>
              </Button>
            </div>
          ) : (
            <Button
              onClick={handleGenerate}
              disabled={loading || isEditing}
              size="sm"
              className="text-xs h-8 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold border-0 shadow-lg shadow-cyan-900/20"
            >
              {loading ? <Loader2 className="w-3 h-3 animate-spin mr-2" /> : <Wand2 className="w-3 h-3 mr-2" />}
              {loading ? "Generating..." : "Generate Art"}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
