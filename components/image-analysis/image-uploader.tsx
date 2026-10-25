"use client"

import type React from "react"

import { useCallback, useState } from "react"
import { Upload, X, ImageIcon, AlertCircle } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface ImageUploaderProps {
  onImageUpload: (file: File, previewUrl: string) => void
  onImageRemove: () => void
  uploadedImage: string | null
}

export function ImageUploader({ onImageUpload, onImageRemove, uploadedImage }: ImageUploaderProps) {
  const [isDragOver, setIsDragOver] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const validateFile = (file: File): boolean => {
    const validTypes = ["image/png", "image/jpeg", "image/jpg"]
    if (!validTypes.includes(file.type)) {
      setError("Por favor, sube la imagen en PNG o JPG")
      return false
    }
    if (file.size > 10 * 1024 * 1024) {
      setError("File size must be less than 10MB")
      return false
    }
    setError(null)
    return true
  }

  const handleFile = (file: File) => {
    if (validateFile(file)) {
      const previewUrl = URL.createObjectURL(file)
      onImageUpload(file, previewUrl)
    }
  }

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }, [])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
  }, [])

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) handleFile(file)
  }

  return (
    <Card className="shadow-sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ImageIcon className="h-5 w-5 text-primary" />
          Subir imagen de frotis de sangre
        </CardTitle>
        <CardDescription>Arrastra y suelta o haz clic para cargar una imagen de frotis de sangre para su análisis.</CardDescription>
      </CardHeader>
      <CardContent>
        {uploadedImage ? (
          <div className="relative rounded-lg overflow-hidden border bg-muted/50">
            <img src={uploadedImage} alt="Uploaded blood smear" className="w-full h-64 object-contain" />
            <Button
              variant="destructive"
              size="icon"
              className="absolute top-2 right-2"
              onClick={onImageRemove}
              aria-label="Remove uploaded image"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        ) : (
          <div
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            className={cn(
              "border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer",
              isDragOver ? "border-primary bg-primary/5" : "border-border hover:border-primary/50 hover:bg-muted/50",
            )}
          >
            <input
              type="file"
              accept=".png,.jpg,.jpeg"
              onChange={handleFileInput}
              className="hidden"
              id="image-upload"
              aria-label="Upload blood smear image"
            />
            <label htmlFor="image-upload" className="cursor-pointer">
              <div className="flex flex-col items-center gap-4">
                <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
                  <Upload className="h-8 w-8 text-primary" />
                </div>
                <div>
                  <p className="font-medium text-foreground mb-1">Arrastra tu imagen aquí o haz clic para explorar.</p>
                  <p className="text-sm text-muted-foreground">Admite formatos PNG y JPG.</p>
                </div>
              </div>
            </label>
          </div>
        )}

        {error && (
          <div className="flex items-center gap-2 mt-4 p-3 rounded-lg bg-destructive/10 text-destructive">
            <AlertCircle className="h-4 w-4 flex-shrink-0" />
            <span className="text-sm">{error}</span>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
