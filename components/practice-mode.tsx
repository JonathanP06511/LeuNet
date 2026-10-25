'use client';

import { useState, useCallback } from 'react';
import useSWR from 'swr';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Spinner } from '@/components/ui/spinner';
import { BloodSmearImage } from '@/components/blood-smear-image';
import { ClassificationButtons } from '@/components/classification-buttons';
import { ResultsDisplay } from '@/components/results-display';
import { getRandomImage, evaluateAnswer } from '@/lib/api';
import { ArrowLeft, ArrowRight, RotateCcw } from 'lucide-react';

interface PracticeModeProps {
  onBack?: () => void;
}

export function PracticeMode({ onBack }: PracticeModeProps) {
  const [difficulty, setDifficulty] = useState<'easy' | 'hard'>('easy');

  const [selectedAnswer, setSelectedAnswer] = useState<'ALL' | 'Normal' | null>(null);
  const [result, setResult] = useState<any>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [isEvaluating, setIsEvaluating] = useState(false);

  const { data, isLoading } = useSWR(
    ['random-image', refreshKey, difficulty],
    () => getRandomImage(difficulty),
    { revalidateOnFocus: false }
  );

  const handleEvaluate = useCallback(async () => {
    if (!selectedAnswer || !data) return;

    setIsEvaluating(true);

    try {
      const res = await evaluateAnswer(
        data.image_path,
        selectedAnswer,
        difficulty
      );
      setResult(res);
    } catch (err) {
      console.error('Error evaluating:', err);
    } finally {
      setIsEvaluating(false);
    }
  }, [selectedAnswer, data, difficulty]);

  const next = () => {
    setResult(null);
    setSelectedAnswer(null);
    setRefreshKey(k => k + 1);
  };

  const reset = () => {
    setResult(null);
    setSelectedAnswer(null);
    setRefreshKey(k => k + 1);
  };

  return (
    <div className="space-y-6">

      {/* HEADER */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          {onBack && (
            <Button variant="outline" size="sm" onClick={onBack} className="gap-2">
              <ArrowLeft className="h-4 w-4" />
              Volver
            </Button>
          )}
          <h2 className="text-lg font-semibold">Modo Práctica</h2>
        </div>

        {/* SELECTOR */}
        <select
          value={difficulty}
          onChange={(e) => setDifficulty(e.target.value as 'easy' | 'hard')}
          className="border p-2 rounded"
        >
          <option value="easy">Fácil</option>
          <option value="hard">Difícil</option>
        </select>
      </div>

      {/* CONTENIDO */}
      <div className="grid gap-6 lg:grid-cols-2">

        {/* IMAGEN */}
        <Card className="overflow-hidden">
          <CardHeader>
            <CardTitle>Muestra microscópica</CardTitle>
          </CardHeader>
          <CardContent className="p-4">

            {isLoading || !data ? (
              <div className="flex h-[420px] items-center justify-center">
                <Spinner />
              </div>
            ) : (
              <BloodSmearImage
                imageBase64={data.image_base64}
                imageId={data.image_id}
                difficulty={difficulty}
                className="w-full h-[420px]"
              />
            )}

          </CardContent>
        </Card>

        {/* CLASIFICACIÓN */}
        <div className="space-y-6">

          <Card>
            <CardHeader>
              <CardTitle>Clasificación Celular</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">

              <ClassificationButtons
                selectedAnswer={selectedAnswer}
                onSelect={setSelectedAnswer}
                disabled={!!result || isLoading || isEvaluating}
              />

              <div className="flex gap-3">
                <Button
                  onClick={handleEvaluate}
                  disabled={!selectedAnswer || !!result || isEvaluating}
                  className="flex-1"
                >
                  {isEvaluating ? 'Evaluando...' : 'Evaluar'}
                </Button>

                <Button
                  variant="outline"
                  onClick={reset}
                  className="gap-2"
                >
                  <RotateCcw className="h-4 w-4" />
                  Reiniciar
                </Button>
              </div>

            </CardContent>
          </Card>

          {/* RESULTADOS */}
          {result && (
            <div className="space-y-4">
              <ResultsDisplay result={result} />

              <Button
                onClick={next}
                className="w-full gap-2"
              >
                Siguiente
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          )}

        </div>

      </div>
    </div>
  );
}