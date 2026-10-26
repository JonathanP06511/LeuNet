import type { jsPDF as JsPDF } from "jspdf"
import type { ImageAnalysisResult, User } from "@/lib/api"
import { loadImageAspectRatio } from "@/lib/image-aspect"

const PAGE_WIDTH = 210
const PAGE_HEIGHT = 297
const MARGIN = 15
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2

const PRIMARY: [number, number, number] = [37, 99, 235]
const DESTRUCTIVE: [number, number, number] = [220, 38, 38]
const TEXT: [number, number, number] = [30, 35, 45]
const MUTED: [number, number, number] = [100, 110, 125]
const BORDER: [number, number, number] = [220, 225, 232]

const DISCLAIMER_TEXT =
  "Esta herramienta está destinada exclusivamente a fines de investigación y apoyo clínico, y no reemplaza el juicio, la valoración ni el diagnóstico médico profesional. Los resultados obtenidos deben ser complementados con la valoración clínica, el historial médico del paciente y las pruebas necesarias."

interface ReportOptions {
  result: ImageAnalysisResult
  uploadedImage?: string | null
  analyst: User | null
}

// Carga cualquier src (blob:, data:, url) y la dibuja completa con la proporción indicada.
// Las imágenes de Grad-CAM (300x300) vuelven así a la forma de la foto original, sin recortes.
function toJpeg(src: string, ratio: number, width = 600): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = "anonymous"
    img.onload = () => {
      const canvas = document.createElement("canvas")
      canvas.width = width
      canvas.height = Math.round(width / ratio)
      const ctx = canvas.getContext("2d")
      if (!ctx) return reject(new Error("No se pudo procesar la imagen"))
      ctx.fillStyle = "#ffffff"
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
      resolve(canvas.toDataURL("image/jpeg", 0.92))
    }
    img.onerror = () => reject(new Error("No se pudo cargar la imagen"))
    img.src = src
  })
}

function pad(value: number) {
  return String(value).padStart(2, "0")
}

export async function downloadAnalysisReport({ result, uploadedImage, analyst }: ReportOptions) {
  // Se carga la versión de navegador de jsPDF solo al generar el reporte;
  // la versión de Node rompe el renderizado del servidor en Next.js.
  const { jsPDF } = (await import("jspdf/dist/jspdf.es.min.js")) as { jsPDF: typeof JsPDF }
  const doc = new jsPDF({ unit: "mm", format: "a4" })
  const now = new Date()
  let y = 0

  const ensureSpace = (height: number) => {
    if (y + height > PAGE_HEIGHT - MARGIN - 8) {
      doc.addPage()
      y = MARGIN
    }
  }

  const writeParagraph = (text: string, size = 10, color = MUTED, style: "normal" | "bold" = "normal") => {
    doc.setFont("helvetica", style)
    doc.setFontSize(size)
    doc.setTextColor(...color)
    const lines = doc.splitTextToSize(text, CONTENT_WIDTH) as string[]
    const lineHeight = size * 0.45
    ensureSpace(lines.length * lineHeight)
    doc.text(lines, MARGIN, y)
    y += lines.length * lineHeight
  }

  const writeHeading = (text: string) => {
    ensureSpace(12)
    doc.setFont("helvetica", "bold")
    doc.setFontSize(12)
    doc.setTextColor(...TEXT)
    doc.text(text, MARGIN, y)
    y += 6
  }

  // ===== Encabezado =====
  doc.setFillColor(...PRIMARY)
  doc.rect(0, 0, PAGE_WIDTH, 26, "F")
  doc.setTextColor(255, 255, 255)
  doc.setFont("helvetica", "bold")
  doc.setFontSize(22)
  doc.text("LeuNet", MARGIN, 14)
  doc.setFont("helvetica", "normal")
  doc.setFontSize(10)
  doc.text("Reporte de Diagnóstico Automatizado de Frotis Sanguíneo", MARGIN, 20.5)

  const dateText = now.toLocaleDateString("es-EC", { day: "2-digit", month: "long", year: "numeric" })
  const timeText = now.toLocaleTimeString("es-EC", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false })

  y = 34
  const infoRows: [string, string][] = [
    ["Usuario", analyst?.name || "No disponible"],
    ["Correo", analyst?.email || "No disponible"],
    ["Rol", analyst?.role || "No disponible"],
    ["Fecha del reporte", dateText],
    ["Hora del reporte", timeText],
  ]

  doc.setDrawColor(...BORDER)
  doc.roundedRect(MARGIN, y - 5, CONTENT_WIDTH, infoRows.length * 6 + 4, 2, 2, "S")
  doc.setFontSize(10)
  infoRows.forEach(([label, value]) => {
    doc.setFont("helvetica", "bold")
    doc.setTextColor(...TEXT)
    doc.text(`${label}:`, MARGIN + 4, y)
    doc.setFont("helvetica", "normal")
    doc.setTextColor(...MUTED)
    doc.text(value, MARGIN + 42, y)
    y += 6
  })
  y += 6

  // ===== Resultado =====
  const isLeukemia = result.predicted_class === "Leukemia"
  const predictionLabel = isLeukemia ? "Resultado compatible con LLA" : "Resultado sin indicios de LLA"
  const resultColor = isLeukemia ? DESTRUCTIVE : PRIMARY
  const probability = isLeukemia ? result.probabilities.Leukemia : result.probabilities.Benign

  writeHeading("Resultados del análisis")
  writeParagraph(`Predicción generada usando ${result.model_name || "EfficientNet-B3"}`, 9)
  y += 4

  ensureSpace(10)
  doc.setFont("helvetica", "bold")
  doc.setFontSize(16)
  doc.setTextColor(...resultColor)
  doc.text(predictionLabel, MARGIN, y)
  const labelWidth = doc.getTextWidth(predictionLabel)

  const badgeText = `${result.confidence.toFixed(2)}% de confianza`
  doc.setFontSize(9)
  const badgeWidth = doc.getTextWidth(badgeText) + 6
  doc.setFillColor(...resultColor)
  doc.roundedRect(MARGIN + labelWidth + 4, y - 4.5, badgeWidth, 6, 1.5, 1.5, "F")
  doc.setTextColor(255, 255, 255)
  doc.text(badgeText, MARGIN + labelWidth + 7, y - 0.3)
  y += 7

  writeParagraph(
    isLeukemia
      ? "El modelo identificó patrones visuales asociados a células con leucemia en la imagen analizada. Este resultado debe interpretarse como apoyo experimental y no como diagnóstico clínico definitivo."
      : "La predicción del modelo sugiere que la imagen analizada no presenta indicios relevantes asociados a LLA. Este resultado debe interpretarse como apoyo experimental y no como diagnóstico clínico definitivo."
  )
  y += 6

  // ===== Probabilidad =====
  writeHeading("Probabilidad del resultado")
  ensureSpace(10)
  doc.setFont("helvetica", "normal")
  doc.setFontSize(10)
  doc.setTextColor(...MUTED)
  doc.text(predictionLabel, MARGIN, y)
  doc.setFont("helvetica", "bold")
  doc.setTextColor(...TEXT)
  doc.text(`${probability.toFixed(2)}%`, MARGIN + CONTENT_WIDTH, y, { align: "right" })
  y += 3
  doc.setFillColor(...BORDER)
  doc.roundedRect(MARGIN, y, CONTENT_WIDTH, 2.5, 1.25, 1.25, "F")
  doc.setFillColor(...PRIMARY)
  doc.roundedRect(MARGIN, y, (CONTENT_WIDTH * Math.min(Math.max(probability, 0), 100)) / 100, 2.5, 1.25, 1.25, "F")
  y += 10

  // ===== Grad-CAM =====
  if (result.gradcam_image) {
    const focusImage = isLeukemia ? result.gradcam_focus_image : null
    const panels: { title: string; src: string }[] = []
    if (uploadedImage) panels.push({ title: "Imagen analizada", src: uploadedImage })
    if (result.gradcam_heatmap) {
      panels.push({ title: "Mapa de calor Grad-CAM", src: `data:image/png;base64,${result.gradcam_heatmap}` })
    }
    panels.push(
      focusImage
        ? { title: "Región de mayor influencia", src: `data:image/png;base64,${focusImage}` }
        : { title: "Grad-CAM sobre la imagen", src: `data:image/png;base64,${result.gradcam_image}` }
    )

    // Las tres imágenes usan la proporción de la foto original para que coincidan entre sí.
    const ratio = uploadedImage ? await loadImageAspectRatio(uploadedImage).catch(() => 1) : 1
    const gap = 5
    const imageWidth = (CONTENT_WIDTH - gap * 2) / 3
    const imageHeight = imageWidth / ratio
    ensureSpace(20 + imageHeight + 8)

    doc.setDrawColor(...BORDER)
    doc.line(MARGIN, y - 4, MARGIN + CONTENT_WIDTH, y - 4)
    y += 2
    writeHeading("Interpretabilidad visual mediante Grad-CAM")
    writeParagraph("El mapa de calor resalta las regiones de la imagen que tuvieron influencia en la predicción del modelo.", 9)
    y += 5

    const images = await Promise.all(panels.map((panel) => toJpeg(panel.src, ratio).catch(() => null)))

    panels.forEach((panel, index) => {
      const x = MARGIN + index * (imageWidth + gap)
      doc.setFont("helvetica", "bold")
      doc.setFontSize(9)
      doc.setTextColor(...TEXT)
      doc.text(panel.title, x, y)
      const data = images[index]
      if (data) {
        doc.addImage(data, "JPEG", x, y + 2, imageWidth, imageHeight)
      }
      doc.setDrawColor(...BORDER)
      doc.roundedRect(x, y + 2, imageWidth, imageHeight, 1.5, 1.5, "S")
    })
    y += imageHeight + 10

    if (focusImage) {
      const note =
        "La región marcada representa el área con mayor influencia en la decisión del modelo para clasificar la imagen como compatible con LLA."
      doc.setFontSize(9)
      const lines = doc.splitTextToSize(note, CONTENT_WIDTH - 8) as string[]
      const boxHeight = lines.length * 4 + 5
      ensureSpace(boxHeight + 4)
      doc.setFillColor(253, 242, 242)
      doc.setDrawColor(245, 200, 200)
      doc.roundedRect(MARGIN, y - 4, CONTENT_WIDTH, boxHeight, 2, 2, "FD")
      doc.setFont("helvetica", "normal")
      doc.setTextColor(...MUTED)
      doc.text(lines, MARGIN + 4, y + 1)
      y += boxHeight + 4
    }
  }

  // ===== Advertencia =====
  doc.setFontSize(9)
  const disclaimerLines = doc.splitTextToSize(DISCLAIMER_TEXT, CONTENT_WIDTH - 8) as string[]
  const disclaimerHeight = disclaimerLines.length * 4 + 11
  ensureSpace(disclaimerHeight + 2)
  doc.setFillColor(254, 249, 236)
  doc.setDrawColor(240, 200, 120)
  doc.roundedRect(MARGIN, y - 4, CONTENT_WIDTH, disclaimerHeight, 2, 2, "FD")
  doc.setFont("helvetica", "bold")
  doc.setTextColor(180, 110, 0)
  doc.text("Advertencia", MARGIN + 4, y + 1.5)
  doc.setFont("helvetica", "normal")
  doc.setTextColor(...MUTED)
  doc.text(disclaimerLines, MARGIN + 4, y + 7)

  // ===== Pie de página =====
  const totalPages = doc.getNumberOfPages()
  for (let page = 1; page <= totalPages; page++) {
    doc.setPage(page)
    doc.setFont("helvetica", "normal")
    doc.setFontSize(8)
    doc.setTextColor(...MUTED)
    doc.text(`LeuNet - Reporte generado el ${dateText}, ${timeText}`, MARGIN, PAGE_HEIGHT - 8)
    doc.text(`Página ${page} de ${totalPages}`, PAGE_WIDTH - MARGIN, PAGE_HEIGHT - 8, { align: "right" })
  }

  const stamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`
  doc.save(`reporte-leunet-${stamp}.pdf`)
}
