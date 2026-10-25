'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { GraduationCap, FlaskConical } from 'lucide-react';

export type Mode = 'practice' | 'exam' | null;

interface ModeSelectorProps {
  onSelectMode: (mode: Mode) => void;
}

export function ModeSelector({ onSelectMode }: ModeSelectorProps) {
  return (
    <div className="grid gap-6 md:grid-cols-2">
      <Card 
        className="cursor-pointer border-2 transition-all hover:border-primary hover:shadow-lg"
        onClick={() => onSelectMode('practice')}
      >
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
            <FlaskConical className="h-8 w-8 text-primary" />
          </div>
          <CardTitle className="text-xl">Modo Practica</CardTitle>
          <CardDescription>Imagenes ilimitadas sin presion</CardDescription>
        </CardHeader>
        <CardContent className="text-center">
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li>Practica a tu propio ritmo</li>
            <li>Retroalimentacion inmediata</li>
            <li>Compara con la IA</li>
            <li>Sin limite de tiempo</li>
          </ul>
          <Button className="mt-6 w-full" size="lg">
            Iniciar Practica
          </Button>
        </CardContent>
      </Card>

      <Card 
        className="cursor-pointer border-2 transition-all hover:border-primary hover:shadow-lg"
        onClick={() => onSelectMode('exam')}
      >
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[oklch(0.55_0.18_150/0.1)]">
            <GraduationCap className="h-8 w-8 text-[oklch(0.55_0.18_150)]" />
          </div>
          <CardTitle className="text-xl">Modo Examen</CardTitle>
          <CardDescription>Evalua tus conocimientos</CardDescription>
        </CardHeader>
        <CardContent className="text-center">
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li>10 preguntas por examen</li>
            <li>Puntaje final al terminar</li>
            <li>Mide tu precision</li>
            <li>Desafia tus habilidades</li>
          </ul>
          <Button 
            className="mt-6 w-full bg-[oklch(0.55_0.18_150)] hover:bg-[oklch(0.45_0.18_150)]" 
            size="lg"
          >
            Iniciar Examen
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
