"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { ANALYSIS_NOTES_MAX_LENGTH, ANALYSIS_TITLE_MAX_LENGTH } from "@/lib/api"

interface AnalysisDetailsProps {
  title: string
  notes: string
  onTitleChange: (value: string) => void
  onNotesChange: (value: string) => void
  // Nombre del archivo subido: se usa como título si el usuario no escribe ninguno.
  fileName?: string
  disabled?: boolean
}

export function AnalysisDetails({
  title,
  notes,
  onTitleChange,
  onNotesChange,
  fileName,
  disabled,
}: AnalysisDetailsProps) {
  return (
    <Card className="shadow-sm">
      <CardHeader>
        <CardTitle>Datos del análisis (opcional)</CardTitle>
        <CardDescription>
          Agrega un título y notas para reconocer este análisis más adelante en el historial.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="analysis-title">Título</Label>
            <span className="text-xs text-muted-foreground">
              {title.length}/{ANALYSIS_TITLE_MAX_LENGTH}
            </span>
          </div>
          <Input
            id="analysis-title"
            value={title}
            onChange={(e) => onTitleChange(e.target.value)}
            maxLength={ANALYSIS_TITLE_MAX_LENGTH}
            placeholder={fileName || "Ej.: Muestra 014 – control"}
            disabled={disabled}
          />
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="analysis-notes">Notas</Label>
            <span className="text-xs text-muted-foreground">
              {notes.length}/{ANALYSIS_NOTES_MAX_LENGTH}
            </span>
          </div>
          <Textarea
            id="analysis-notes"
            value={notes}
            onChange={(e) => onNotesChange(e.target.value)}
            maxLength={ANALYSIS_NOTES_MAX_LENGTH}
            placeholder="Escribe aquí cualquier observación sobre esta muestra."
            disabled={disabled}
          />
        </div>
      </CardContent>
    </Card>
  )
}
