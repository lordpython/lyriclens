import React, { useState } from 'react';
import { ImagePrompt, GeneratedImage } from '../types';
import { Wand2, Image as ImageIcon, Download, Loader2, Clock, Edit2, X, Check, RefreshCw } from 'lucide-react';
import { generateImageFromPrompt } from '../services/geminiService';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';

interface ImageGeneratorProps {
  prompt: ImagePrompt;
  onImageGenerated: (img: GeneratedImage) => void;
  existingImage?: string;
  style?: string;
  globalSubject?: string;
  aspectRatio?: string;
}

export const ImageGenerator: React.FC<ImageGeneratorProps> = ({
  prompt,
  onImageGenerated,
  existingImage,
  style = "Cinematic",
  globalSubject = "",
  aspectRatio = "16:9"
}) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [currentPromptText, setCurrentPromptText] = useState(prompt.text);

  const handleGenerate = async () => {
    setLoading(true);
    setError(null);
    try {
      // Use the potentially edited text
      const base64Image = await generateImageFromPrompt(currentPromptText, style, globalSubject, aspectRatio);
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
    <motion.div
      whileHover={{ y: -5 }}
      transition={{ type: "spring", stiffness: 300 }}
      className="h-full"
    >
      <Card className="group relative bg-card border-border overflow-hidden flex flex-col h-full hover:border-primary/50 transition-all shadow-lg hover:shadow-xl hover:shadow-primary/10">
        {/* Header / Mood Badge */}
        <div className="absolute top-3 left-3 z-10 flex gap-2">
          <Badge variant="secondary" className="bg-primary/20 text-primary-foreground border-primary/20 backdrop-blur-md font-medium uppercase tracking-wider hover:bg-primary/30">
            {prompt.mood}
          </Badge>
          {prompt.timestamp && (
            <Badge variant="outline" className="bg-muted/90 text-muted-foreground border-border backdrop-blur-md flex items-center gap-1 hover:bg-muted">
              <Clock size={10} />
              {prompt.timestamp}
            </Badge>
          )}
        </div>

        {/* Image Area */}
        <div className="aspect-video bg-muted w-full relative overflow-hidden">
          {existingImage ? (
            <img
              src={existingImage}
              alt={prompt.mood}
              className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
            />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center text-muted-foreground p-6 text-center bg-[url('/cubes.png')] bg-opacity-5">
              {loading ? (
                <Loader2 className="w-10 h-10 animate-spin text-primary mb-2" />
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
                  className="min-h-[100px] text-sm bg-muted border-input text-foreground focus:ring-primary"
                />
                <div className="flex justify-end gap-2">
                  <Button onClick={handleCancelEdit} size="icon" variant="ghost" className="h-6 w-6 text-muted-foreground hover:text-destructive">
                    <X size={14} />
                  </Button>
                  <Button onClick={handleSaveEdit} size="icon" variant="ghost" className="h-6 w-6 text-muted-foreground hover:text-primary">
                    <Check size={14} />
                  </Button>
                </div>
              </div>
            ) : (
              <>
                <p className="text-muted-foreground text-sm italic line-clamp-3 group-hover:line-clamp-none transition-all pr-6">
                  "{currentPromptText}"
                </p>
                {!loading && !existingImage && (
                  <button
                    onClick={() => setIsEditing(true)}
                    className="absolute top-0 right-0 p-1 text-muted-foreground hover:text-primary opacity-0 group-hover/text:opacity-100 transition-opacity"
                  >
                    <Edit2 size={14} />
                  </button>
                )}
              </>
            )}
          </div>

          <div className="mt-auto flex justify-end gap-2 items-center">
            {error && <span className="text-destructive text-xs mr-auto">{error}</span>}

            {existingImage ? (
              <div className="flex gap-2 w-full justify-end">
                <Button
                  onClick={handleGenerate}
                  disabled={loading}
                  variant="secondary"
                  size="sm"
                  className="text-xs h-8 bg-secondary text-secondary-foreground hover:bg-muted"
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
                className="text-xs h-8 bg-primary hover:bg-primary/90 text-primary-foreground font-bold border-0 shadow-lg shadow-primary/20"
              >
                {loading ? <Loader2 className="w-3 h-3 animate-spin mr-2" /> : <Wand2 className="w-3 h-3 mr-2" />}
                {loading ? "Generating..." : "Generate Art"}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
};