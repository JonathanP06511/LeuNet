import { AlertTriangle } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"

export function MedicalDisclaimer() {
  return (
    <Alert variant="default" className="border-warning/50 bg-warning/5">
      <AlertTriangle className="h-4 w-4 text-warning" />
      <AlertTitle className="text-warning">Advertencia</AlertTitle>
      <AlertDescription className="text-muted-foreground">
        Esta herramienta está destinada exclusivamente a fines de investigación y apoyo clínico, y no reemplaza
        el juicio, la valoración ni el diagnóstico médico profesional. Los resultados obtenidos deben ser revisados
        por un profesional de salud capacitado y complementados con la valoración clínica, el historial médico del 
        paciente y las pruebas necesarias.
      </AlertDescription>
    </Alert>
  )
}
