'use client';

import { cn } from '@/lib/utils';

interface BloodSmearImageProps {
  imageBase64: string;
  imageId: string;
  difficulty?: 'easy' | 'hard';
  className?: string;
}

export function BloodSmearImage({
  imageBase64,
  imageId,
  difficulty = 'easy',
  className
}: BloodSmearImageProps) {

  const isHard = difficulty === 'hard';

  return (
    <div
      className={cn(
        'relative flex items-center justify-center overflow-hidden rounded-xl border-2 shadow-lg',
        isHard ? 'bg-white border-gray-300' : 'bg-black border-border',
        className
      )}
    >
      {/* ID */}
      <div className="absolute top-3 left-3 z-10 rounded-md bg-background/90 px-3 py-1 text-xs font-medium text-muted-foreground backdrop-blur-sm">
        ID: {imageId}
      </div>

      {/* Imagen */}
      <img
        src={imageBase64}
        alt="Frotis sanguineo"
        draggable={false}
        className={cn(
          'max-h-full max-w-full object-contain transition-all duration-300',
          isHard ? 'scale-[2.5]' : 'scale-100' // 🔥 ZOOM SOLO EN HARD
        )}
      />
    </div>
  );
}