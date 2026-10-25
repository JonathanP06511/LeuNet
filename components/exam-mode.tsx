'use client';

import { useState, useCallback, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Spinner } from '@/components/ui/spinner';
import { BloodSmearImage } from '@/components/blood-smear-image';
import { ClassificationButtons } from '@/components/classification-buttons';
import { startExam, evaluateAnswer, type ExamQuestion } from '@/lib/api';
import { ArrowLeft } from 'lucide-react';

interface ExamModeProps {
  onBack: () => void;
}

export function ExamMode({ onBack }: ExamModeProps) {
  const [difficulty, setDifficulty] = useState<'easy' | 'hard'>('easy');

  const [questions, setQuestions] = useState<ExamQuestion[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<'ALL' | 'Normal' | null>(null);
  const [results, setResults] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [examCompleted, setExamCompleted] = useState(false);

  const loadExam = useCallback(async () => {
    setIsLoading(true);
    try {
      const examData = await startExam(10, difficulty);
      setQuestions(examData.questions);
      setCurrentIndex(0);
      setResults([]);
      setExamCompleted(false);
      setSelectedAnswer(null);
    } catch (err) {
      console.error('Error loading exam:', err);
    } finally {
      setIsLoading(false);
    }
  }, [difficulty]);

  useEffect(() => {
    loadExam();
  }, [loadExam]);

  const handleSubmitAnswer = useCallback(async () => {
    if (!selectedAnswer || !questions[currentIndex]) return;

    setIsEvaluating(true);

    try {
      const evaluation = await evaluateAnswer(
        questions[currentIndex].image_path,
        selectedAnswer,
        difficulty
      );

      const newResult = {
        question: questions[currentIndex],
        userAnswer: selectedAnswer,
        evaluation
      };

      setResults(prev => [...prev, newResult]);

      if (currentIndex === questions.length - 1) {
        setExamCompleted(true);
      } else {
        setCurrentIndex(prev => prev + 1);
        setSelectedAnswer(null);
      }
    } catch (err) {
      console.error('Error evaluating:', err);
    } finally {
      setIsEvaluating(false);
    }
  }, [selectedAnswer, questions, currentIndex, difficulty]);

  const correctCount = results.filter(r => r.evaluation.user_correct).length;
  const accuracy =
    results.length > 0
      ? ((correctCount / results.length) * 100).toFixed(1)
      : '0';

  // ========================
  // LOADING
  // ========================
  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex justify-center py-16">
          <Spinner />
        </CardContent>
      </Card>
    );
  }

  // ========================
  // RESULTADOS
  // ========================
  if (examCompleted) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Examen completado</CardTitle>
          <CardDescription>Dificultad: {difficulty}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-lg font-semibold">Precisión: {accuracy}%</p>
          <Button onClick={loadExam}>Nuevo Examen</Button>
        </CardContent>
      </Card>
    );
  }

  const currentQuestion = questions[currentIndex];

  // ========================
  // MAIN UI
  // ========================
  return (
    <div className="space-y-6">

      {/* HEADER */}
      <div className="flex items-center justify-between">
        <Button variant="outline" onClick={onBack} className="gap-2">
          <ArrowLeft className="h-4 w-4" />
          Volver
        </Button>

        {/* SELECTOR DIFICULTAD */}
        <select
          value={difficulty}
          onChange={(e) => setDifficulty(e.target.value as 'easy' | 'hard')}
          className="border p-2 rounded"
        >
          <option value="easy">Fácil</option>
          <option value="hard">Difícil</option>
        </select>
      </div>

      {/* PROGRESO */}
      <Card>
        <CardContent className="py-4">
          <p className="text-sm text-muted-foreground">
            Pregunta {currentIndex + 1} de {questions.length}
          </p>
        </CardContent>
      </Card>

      {/* CONTENIDO */}
      <div className="grid gap-6 lg:grid-cols-2">

        {/* IMAGEN */}
        <Card className="overflow-hidden">
          <CardHeader>
            <CardTitle>Imagen</CardTitle>
          </CardHeader>
          <CardContent className="p-4">

            {/* 🔥 ALTURA CORREGIDA */}
            {currentQuestion ? (
              <BloodSmearImage
                imageBase64={currentQuestion.image_base64}
                imageId={currentQuestion.image_id}
                difficulty={difficulty}
                className="w-full h-[420px]"
              />
            ) : (
              <div className="flex h-[420px] items-center justify-center">
                <Spinner />
              </div>
            )}

          </CardContent>
        </Card>

        {/* CLASIFICACIÓN */}
        <Card>
          <CardHeader>
            <CardTitle>Diagnóstico</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">

            <ClassificationButtons
              selectedAnswer={selectedAnswer}
              onSelect={setSelectedAnswer}
              disabled={isEvaluating}
            />

            <Button
              size="lg"
              onClick={handleSubmitAnswer}
              disabled={!selectedAnswer || isEvaluating}
              className="w-full"
            >
              {isEvaluating ? 'Evaluando...' : 'Siguiente'}
            </Button>

          </CardContent>
        </Card>

      </div>
    </div>
  );
}