"use client"

import { Play, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"

interface PredictionButtonProps {
  onRunPrediction: () => void
  isLoading: boolean
  disabled: boolean
}

export function PredictionButton({ onRunPrediction, isLoading, disabled }: PredictionButtonProps) {
  return (
    <div className="flex justify-center">
      <Button size="lg" onClick={onRunPrediction} disabled={disabled || isLoading} className="gap-2 px-8 min-w-[200px]">
        {isLoading ? (
          <>
            <Loader2 className="h-5 w-5 animate-spin" />
            Analizando...
          </>
        ) : (
          <>
            <Play className="h-5 w-5" />
            Empezar
          </>
        )}
      </Button>
    </div>
  )
}
