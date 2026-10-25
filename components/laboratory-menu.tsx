'use client';

import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ModeSelector, type Mode } from '@/components/mode-selector';

interface LaboratoryMenuProps {
  onBack: () => void;
  onSelectMode: (mode: Mode) => void;
}

export function LaboratoryMenu({ onBack, onSelectMode }: LaboratoryMenuProps) {
  return (
    <div className="space-y-8">
      <div className="flex items-center gap-3">
        <Button variant="outline" size="sm" onClick={onBack} className="gap-2">
          <ArrowLeft className="h-4 w-4" />
          Volver
        </Button>
        <div>
          <h2 className="text-xl font-semibold">Laboratorio virtual</h2>

        </div>
      </div>

      <ModeSelector onSelectMode={onSelectMode} />
    </div>
  );
}
