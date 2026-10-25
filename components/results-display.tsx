'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { CheckCircle2, XCircle, Brain, User } from 'lucide-react';
import type { EvaluationResponse } from '@/lib/api';

interface ResultsDisplayProps {
  result: EvaluationResponse;
}

export function ResultsDisplay({ result }: ResultsDisplayProps) {
  return (
    <Card className={cn(
      'border-2 transition-all',
      result.user_correct 
        ? 'border-[oklch(0.55_0.18_150)] bg-[oklch(0.55_0.18_150/0.05)]' 
        : 'border-destructive bg-destructive/5'
    )}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          {result.user_correct ? (
            <>
              <CheckCircle2 className="h-6 w-6 text-[oklch(0.55_0.18_150)]" />
              <span className="text-[oklch(0.55_0.18_150)]">Correcto</span>
            </>
          ) : (
            <>
              <XCircle className="h-6 w-6 text-destructive" />
              <span className="text-destructive">Incorrecto</span>
            </>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-3">
          {/* User Answer */}
          <div className="rounded-lg border bg-card p-3">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <User className="h-4 w-4" />
              Tu respuesta
            </div>
            <p className={cn(
              'mt-1 text-lg font-semibold',
              result.user_correct ? 'text-[oklch(0.55_0.18_150)]' : 'text-destructive'
            )}>
              {result.user_answer === 'ALL' ? 'Leucemia' : 'Sano'}
            </p>
          </div>

          {/* Model Prediction */}
          <div className="rounded-lg border bg-card p-3">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Brain className="h-4 w-4" />
              Prediccion IA
            </div>
            <p className={cn(
              'mt-1 text-lg font-semibold',
              result.model_correct ? 'text-[oklch(0.55_0.18_150)]' : 'text-destructive'
            )}>
              {result.model_prediction === 'ALL' ? 'Leucemia' : 'Sano'}
            </p>
            <p className="text-xs text-muted-foreground">
              Confianza: {result.model_confidence.toFixed(1)}%
            </p>
          </div>

          {/* True Label */}
          <div className="rounded-lg border-2 border-primary bg-primary/5 p-3">
            <div className="text-sm text-muted-foreground">
              Etiqueta Real
            </div>
            <p className="mt-1 text-lg font-bold text-primary">
              {result.true_label === 'ALL' ? 'Leucemia' : 'Sano'}
            </p>
          </div>
        </div>

        {/* Probability Bar */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span>ALL: {result.probability_all.toFixed(1)}%</span>
            <span>Normal: {result.probability_normal.toFixed(1)}%</span>
          </div>
          <div className="h-3 overflow-hidden rounded-full bg-muted">
            <div 
              className="h-full bg-primary transition-all duration-500"
              style={{ width: `${result.probability_all}%` }}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
