"use client"

import { useState } from "react"
import { ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ImageUploader } from "./image-uploader"
import { PredictionButton } from "./prediction-button"
import { ImageAnalysisResults } from "./image-analysis-results"
import { MedicalDisclaimer } from "./medical-disclaimer"
import { analyzeUploadedImage, type ImageAnalysisResult } from "@/lib/api"

interface ImageAnalysisSectionProps {
  onBack?: () => void
}

export function ImageAnalysisSection({ onBack }: ImageAnalysisSectionProps) {
  const [uploadedImage, setUploadedImage] = useState<string | null>(null)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [result, setResult] = useState<ImageAnalysisResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleImageUpload = (file: File, imageUrl: string) => {
    setUploadedImage(imageUrl)
    setSelectedFile(file)
    setResult(null)
    setError(null)
  }

  const handleImageRemove = () => {
    if (uploadedImage?.startsWith("blob:")) {
      URL.revokeObjectURL(uploadedImage)
    }
    setUploadedImage(null)
    setSelectedFile(null)
    setResult(null)
    setError(null)
  }

  const handleRunPrediction = async () => {
    if (!selectedFile) return

    setIsLoading(true)
    setResult(null)
    setError(null)

    try {
      const data = await analyzeUploadedImage(selectedFile)
      setResult(data)
    } catch (err) {
      const message = err instanceof Error ? err.message : "Error inesperado durante la predicción."
      setError(message)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          {onBack && (
            <Button variant="outline" size="sm" onClick={onBack} className="gap-2">
              <ArrowLeft className="h-4 w-4" />
              Volver
            </Button>
          )}
          <div>
            <h2 className="text-xl font-semibold">Análisis de imágenes</h2>
          </div>
        </div>
      </div>

      <div className="space-y-8">
        <ImageUploader
          onImageUpload={handleImageUpload}
          onImageRemove={handleImageRemove}
          uploadedImage={uploadedImage}
        />

        <PredictionButton onRunPrediction={handleRunPrediction} isLoading={isLoading} disabled={!selectedFile} />

        {(result || isLoading || error) && (
          <ImageAnalysisResults
            result={result}
            isLoading={isLoading}
            error={error}
            uploadedImage={uploadedImage}
          />
        )}

      </div>
    </div>
  )
}
