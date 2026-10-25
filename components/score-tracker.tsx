'use client';

import { Card, CardContent } from '@/components/ui/card';
import { Target, CheckCircle2, XCircle, Percent } from 'lucide-react';

interface ScoreTrackerProps {
  correct: number;
  incorrect: number;
  total: number;
}

export function ScoreTracker({ correct, incorrect, total }: ScoreTrackerProps) {
  const accuracy = total > 0 ? ((correct / total) * 100).toFixed(1) : '0.0';

  return (
    <Card className="border-2">
      <CardContent className="flex items-center justify-between gap-4 p-4">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <Target className="h-5 w-5 text-primary" />
            <span className="text-sm font-medium text-muted-foreground">Total:</span>
            <span className="text-lg font-bold">{total}</span>
          </div>
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-[oklch(0.55_0.18_150)]" />
            <span className="text-sm font-medium text-muted-foreground">Correctas:</span>
            <span className="text-lg font-bold text-[oklch(0.55_0.18_150)]">{correct}</span>
          </div>
          <div className="flex items-center gap-2">
            <XCircle className="h-5 w-5 text-destructive" />
            <span className="text-sm font-medium text-muted-foreground">Incorrectas:</span>
            <span className="text-lg font-bold text-destructive">{incorrect}</span>
          </div>
        </div>
        <div className="flex items-center gap-2 rounded-lg bg-primary/10 px-4 py-2">
          <Percent className="h-5 w-5 text-primary" />
          <span className="text-xl font-bold text-primary">{accuracy}%</span>
        </div>
      </CardContent>
    </Card>
  );
}
