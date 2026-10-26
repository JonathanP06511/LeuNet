"use client"

import { useState } from "react"
import { Activity, CheckCircle, AlertTriangle, Target, Download } from "lucide-react"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import { Progress } from "@/components/ui/progress"
import { Skeleton } from "@/components/ui/skeleton"
import { getStoredUser, type ImageAnalysisResult } from "@/lib/api"
import { downloadAnalysisReport } from "@/lib/report-pdf"
import { useImageAspectRatio } from "@/lib/image-aspect"
import { MedicalDisclaimer } from "./medical-disclaimer"

interface ImageAnalysisResultsProps {
  result: ImageAnalysisResult | null
  isLoading: boolean
  error?: string | null
  uploadedImage?: string | null
}

export function ImageAnalysisResults({
  result,
  isLoading,
  error,
  uploadedImage,
}: ImageAnalysisResultsProps) {
  const [isGeneratingReport, setIsGeneratingReport] = useState(false)
  const [reportError, setReportError] = useState<string | null>(null)
  // Las tres imágenes se muestran con la proporción de la foto original para que coincidan.
  const imageRatio = useImageAspectRatio(uploadedImage)

  if (isLoading) {
    return (
      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5 animate-pulse text-primary" />
            Analizando imagen...
          </CardTitle>
          <CardDescription>
            Por favor, espere mientras el modelo procesa su imagen.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          <div className="flex items-center gap-4">
            <Skeleton className="h-16 w-16 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-6 w-32" />
              <Skeleton className="h-4 w-48" />
            </div>
          </div>

          <div className="space-y-3">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
          </div>
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card className="border-destructive/30 shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            Imagen no válida
          </CardTitle>
          <CardDescription>
            No se pudo analizar la imagen cargada.
          </CardDescription>
        </CardHeader>

        <CardContent>
          <p className="text-sm text-muted-foreground">{error}</p>
        </CardContent>
      </Card>
    )
  }

  if (!result) return null

  const isLeukemia = result.predicted_class === "Leukemia"

  const predictionLabel = isLeukemia
    ? "Resultado compatible con LLA"
    : "Resultado sin indicios de LLA"

  const focusImage = isLeukemia ? result.gradcam_focus_image : null
  const hasFocusImage = Boolean(focusImage)

  const handleDownloadReport = async () => {
    setIsGeneratingReport(true)
    setReportError(null)

    try {
      await downloadAnalysisReport({ result, uploadedImage, analyst: getStoredUser() })
    } catch {
      setReportError("No se pudo generar el reporte. Intente nuevamente.")
    } finally {
      setIsGeneratingReport(false)
    }
  }

  return (
    <Card className="shadow-sm">
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-4">
        <div className="space-y-1.5">
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-primary" />
            Resultados del análisis
          </CardTitle>
          <CardDescription>
            Predicción generada usando {result.model_name || "EfficientNet-B3"}
          </CardDescription>
          {reportError && (
            <p className="text-sm text-destructive">{reportError}</p>
          )}
        </div>

        <Button onClick={handleDownloadReport} disabled={isGeneratingReport} className="gap-2">
          {isGeneratingReport ? (
            <Spinner className="h-4 w-4" />
          ) : (
            <Download className="h-4 w-4" />
          )}
          Descargar Reporte
        </Button>
      </CardHeader>

      <CardContent className="space-y-6">
        <div className="flex items-center gap-4">
          <div
            className={`flex h-16 w-16 items-center justify-center rounded-full ${isLeukemia ? "bg-destructive/10" : "bg-primary/10"
              }`}
          >
            {isLeukemia ? (
              <AlertTriangle className="h-8 w-8 text-destructive" />
            ) : (
              <CheckCircle className="h-8 w-8 text-primary" />
            )}
          </div>

          <div>
            <div className="mb-1 flex flex-wrap items-center gap-2">
              <span className="text-2xl font-bold text-foreground">
                {predictionLabel}
              </span>

              <Badge variant={isLeukemia ? "destructive" : "secondary"}>
                {result.confidence.toFixed(2)}% de confianza
              </Badge>
            </div>

            <p className="text-muted-foreground">
              {isLeukemia
                ? "El modelo identificó patrones visuales asociados a células con leucemia en la imagen analizada. Este resultado debe interpretarse como apoyo experimental y no como diagnóstico clínico definitivo."
                : "La predicción del modelo sugiere que la imagen analizada no presenta indicios relevantes asociados a LLA. Este resultado debe interpretarse como apoyo experimental y no como diagnóstico clínico definitivo."}
            </p>
          </div>
        </div>

        <div className="space-y-4">
          <h4 className="font-medium text-foreground">
            Probabilidad del resultado
          </h4>

          <div>
            <div className="mb-1 flex justify-between text-sm">
              <span className="text-muted-foreground">
                {isLeukemia
                  ? "Resultado compatible con LLA"
                  : "Resultado sin indicios de LLA"}
              </span>

              <span className="font-medium text-foreground">
                {isLeukemia
                  ? result.probabilities.Leukemia.toFixed(2)
                  : result.probabilities.Benign.toFixed(2)}
                %
              </span>
            </div>

            <Progress
              value={
                isLeukemia
                  ? result.probabilities.Leukemia
                  : result.probabilities.Benign
              }
              className="h-2"
            />
          </div>
        </div>



        {result.gradcam_image && (
          <div className="space-y-4 border-t pt-6">
            <div>
              <h4 className="font-medium text-foreground">
                Interpretabilidad visual mediante Grad-CAM
              </h4>

              <p className="mt-1 text-sm text-muted-foreground">
                El mapa de calor resalta las regiones de la imagen que tuvieron
                influencia en la predicción del modelo.
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              {uploadedImage && (
                <div className="space-y-2">
                  <p className="text-sm font-medium text-foreground">
                    Imagen analizada
                  </p>

                  <img
                    src={uploadedImage}
                    alt="Imagen analizada"
                    className="w-full rounded-lg border bg-background object-fill"
                    style={{ aspectRatio: imageRatio ?? 1 }}
                  />
                </div>
              )}

              {result.gradcam_heatmap && (
                <div className="space-y-2">
                  <p className="text-sm font-medium text-foreground">
                    Mapa de calor Grad-CAM
                  </p>

                  <img
                    src={`data:image/png;base64,${result.gradcam_heatmap}`}
                    alt="Mapa de calor Grad-CAM"
                    className="w-full rounded-lg border bg-background object-fill"
                    style={{ aspectRatio: imageRatio ?? 1 }}
                  />
                </div>
              )}

              {isLeukemia && focusImage ? (
                <div className="space-y-2">
                  <p className="flex items-center gap-1 text-sm font-medium text-foreground">
                    <Target className="h-4 w-4 text-destructive" />
                    Región de mayor influencia
                  </p>

                  <img
                    src={`data:image/png;base64,${focusImage}`}
                    alt="Región de mayor influencia"
                    className="w-full rounded-lg border bg-background object-fill"
                    style={{ aspectRatio: imageRatio ?? 1 }}
                  />
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="text-sm font-medium text-foreground">
                    Grad-CAM sobre la imagen
                  </p>

                  <img
                    src={`data:image/png;base64,${result.gradcam_image}`}
                    alt="Grad-CAM sobre la imagen"
                    className="w-full rounded-lg border bg-background object-fill"
                    style={{ aspectRatio: imageRatio ?? 1 }}
                  />
                </div>
              )}
            </div>

            {isLeukemia && hasFocusImage && (
              <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-3">
                <p className="text-sm text-muted-foreground">
                  La región marcada representa el área con mayor influencia en
                  la decisión del modelo para clasificar la imagen como
                  compatible con LLA.
                </p>
              </div>
            )}

            <p className="text-xs leading-relaxed text-muted-foreground">
            </p>
          </div>
        )}
        <MedicalDisclaimer />
      </CardContent>
    </Card>
  )
}