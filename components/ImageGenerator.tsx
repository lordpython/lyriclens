import React, { useState } from 'react';
import { ImagePrompt, GeneratedImage } from '../types';
import { Wand2, Image as ImageIcon, Download, Loader2, Clock } from 'lucide-react';
import { generateImageFromPrompt } from '../services/geminiService';

interface ImageGeneratorProps {
  prompt: ImagePrompt;
  onImageGenerated: (img: GeneratedImage) => void;
  existingImage?: string;
}

export const ImageGenerator: React.FC<ImageGeneratorProps> = ({ prompt, onImageGenerated, existingImage }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGenerate = async () => {
    setLoading(true);
    setError(null);
    try {
      const base64Image = await generateImageFromPrompt(prompt.text);
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

  return (
    <div className="group relative bg-slate-800 rounded-xl overflow-hidden border border-slate-700 hover:border-slate-600 transition-all flex flex-col h-full">
      {/* Header / Mood Badge */}
      <div className="absolute top-3 left-3 z-10 flex gap-2">
        <span className="bg-cyan-900/90 text-cyan-100 text-xs px-2 py-1 rounded-full border border-cyan-700 backdrop-blur-md font-medium uppercase tracking-wider">
          {prompt.mood}
        </span>
        {prompt.timestamp && (
           <span className="bg-slate-900/90 text-slate-300 text-xs px-2 py-1 rounded-full border border-slate-700 backdrop-blur-md flex items-center gap-1">
             <Clock size={10} />
             {prompt.timestamp}
           </span>
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
          <div className="w-full h-full flex flex-col items-center justify-center text-slate-600 p-6 text-center bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] bg-opacity-5">
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
      <div className="p-4 flex flex-col grow">
        <p className="text-slate-300 text-sm italic mb-4 line-clamp-3 group-hover:line-clamp-none transition-all">
          "{prompt.text}"
        </p>
        
        <div className="mt-auto flex justify-end gap-2">
          {error && <span className="text-red-400 text-xs self-center mr-auto">{error}</span>}
          
          {existingImage ? (
             <a 
               href={existingImage} 
               download={`lyric-art-${prompt.mood}.png`}
               className="flex items-center gap-2 px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-white text-xs rounded-lg transition-colors"
             >
               <Download size={14} />
               Download
             </a>
          ) : (
            <button
              onClick={handleGenerate}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 disabled:opacity-50 text-white text-xs font-bold rounded-lg transition-all shadow-lg shadow-cyan-900/20"
            >
              {loading ? (
                <>Generating...</>
              ) : (
                <>
                  <Wand2 size={14} />
                  Generate Art
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
