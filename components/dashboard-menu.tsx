'use client';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Brain, History, ShieldCheck, UserRound } from 'lucide-react';
import type { User } from '@/lib/api';

export type DashboardAction = 'image-analysis' | 'laboratory' | 'history' | 'admin' | 'profile';

interface DashboardMenuProps {
  user: User;
  onSelect: (action: DashboardAction) => void;
}

export function DashboardMenu({ user, onSelect }: DashboardMenuProps) {
  const isAdmin = user.role === 'ADMIN';

  return (
    <div className="space-y-8">
      <div className="text-center">
        <h2 className="text-3xl font-bold tracking-tight">Panel Principal</h2>
        <p className="mx-auto mt-2 max-w-2xl text-muted-foreground">
          Selecciona el módulo que deseas utilizar.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card
          className="cursor-pointer border-2 transition-all hover:border-primary hover:shadow-lg"
          onClick={() => onSelect('image-analysis')}
        >
          <CardHeader>
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
              <Brain className="h-7 w-7 text-primary" />
            </div>

            <CardTitle>Análisis de imágenes</CardTitle>
            <CardDescription>
              Módulo principal del sistema para analizar imágenes microscópicas
              asociadas a LLA.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">
            <div className="overflow-hidden rounded-xl border">
              <img
                src="/analisis-imagenes.png"
                alt="Análisis de imágenes microscópicas"
                className="h-40 w-full object-cover"
              />
            </div>

            <Button
              className="w-full"
              onClick={(e) => {
                e.stopPropagation();
                onSelect('image-analysis');
              }}
            >
              Analizar imagen
            </Button>
          </CardContent>
        </Card>

        {/*
        <Card
          className="cursor-pointer border-2 transition-all hover:border-primary hover:shadow-lg"
          onClick={() => onSelect('laboratory')}
        >
          <CardHeader>
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
              <FlaskConical className="h-7 w-7 text-primary" />
            </div>
            <CardTitle>Laboratorio virtual</CardTitle>
            <CardDescription>
              Espacio educativo para practicar y evaluar la clasificación de células mediante imágenes del sistema.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="overflow-hidden rounded-xl border">
              <img
                src="/laboratorio.png"
                alt="Laboratorio virtual"
                className="h-40 w-full object-cover"
              />
            </div>

            <Button
              variant="outline"
              className="w-full"
              onClick={() => onSelect('laboratory')}
            >
              Entrar al laboratorio
            </Button>
          </CardContent>
        </Card>
        */}

        <Card
          className="cursor-pointer border-2 transition-all hover:border-primary hover:shadow-lg"
          onClick={() => onSelect('history')}
        >
          <CardHeader>
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-muted">
              <History className="h-7 w-7 text-primary" />
            </div>

            <CardTitle>Historial</CardTitle>
            <CardDescription>
            Consulta los resultados anteriores de los análisis realizados en el
            sistema de forma organizada.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">
            <div className="overflow-hidden rounded-xl border">
              <img
                src="/historial.png"
                alt="Historial de resultados"
                className="h-40 w-full object-cover"
              />
            </div>

            <Button
              variant="outline"
              className="w-full"
              onClick={(e) => {
                e.stopPropagation();
                onSelect('history');
              }}
            >
              Ver historial
            </Button>
          </CardContent>
        </Card>

        {isAdmin && (
          <Card
            className="cursor-pointer border-2 transition-all hover:border-primary hover:shadow-lg"
            onClick={() => onSelect('admin')}
          >
            <CardHeader>
              <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-muted">
                <ShieldCheck className="h-7 w-7 text-primary" />
              </div>

              <CardTitle>Panel administrativo</CardTitle>
              <CardDescription>
                Gestiona las cuentas y roles de los usuarios, consulta la actividad del
                sistema y revisa el historial completo de análisis.
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-4">
              <div className="overflow-hidden rounded-xl border bg-[#eef1f6]">
                <img
                  src="/administracion.png"
                  alt="Panel administrativo"
                  className="h-40 w-full object-contain"
                />
              </div>

              <Button
                variant="outline"
                className="w-full"
                onClick={(e) => {
                  e.stopPropagation();
                  onSelect('admin');
                }}
              >
                Abrir panel admin
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Usuario normal: ocupa el ancho de dos tarjetas. Administrador: al lado del panel administrativo. */}
        <Card
          className={`cursor-pointer border-2 transition-all hover:border-primary hover:shadow-lg ${isAdmin ? '' : 'lg:col-span-2'}`}
          onClick={() => onSelect('profile')}
        >
          <CardHeader>
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-muted">
              <UserRound className="h-7 w-7 text-primary" />
            </div>

            <CardTitle>Mi perfil</CardTitle>
            <CardDescription>
              Actualiza tu foto, tu nombre y tu contraseña, y revisa un resumen de tu actividad en el sistema.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">
            <div className="overflow-hidden rounded-xl border bg-[#eef1f6]">
              <img
                src="/perfil.png"
                alt="Mi perfil"
                className="h-40 w-full object-contain"
              />
            </div>

            <Button
              variant="outline"
              className="w-full"
              onClick={(e) => {
                e.stopPropagation();
                onSelect('profile');
              }}
            >
              Editar perfil
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}