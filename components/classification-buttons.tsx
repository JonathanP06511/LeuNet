'use client';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface ClassificationButtonsProps {
  selectedAnswer: 'ALL' | 'Normal' | null;
  onSelect: (answer: 'ALL' | 'Normal') => void;
  disabled?: boolean;
}

export function ClassificationButtons({ selectedAnswer, onSelect, disabled }: ClassificationButtonsProps) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:gap-4">
      <Button
        size="lg"
        variant={selectedAnswer === 'ALL' ? 'default' : 'outline'}
        onClick={() => onSelect('ALL')}
        disabled={disabled}
        className={cn(
          'h-14 flex-1 text-base font-semibold transition-all sm:h-16 sm:text-lg',
          selectedAnswer === 'ALL' && 'ring-2 ring-primary ring-offset-2'
        )}
      >
        <span className="mr-2 text-xl"></span>
        Celula con Leucemia
      </Button>
      <Button
        size="lg"
        variant={selectedAnswer === 'Normal' ? 'default' : 'outline'}
        onClick={() => onSelect('Normal')}
        disabled={disabled}
        className={cn(
          'h-14 flex-1 text-base font-semibold transition-all sm:h-16 sm:text-lg',
          selectedAnswer === 'Normal' && 'ring-2 ring-primary ring-offset-2'
        )}
      >
        <span className="mr-2 text-xl"></span>
        Celula Sana 
      </Button>
    </div>
  );
}
