'use client';

import type { ReactNode } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Eye,
  FileDown,
  HelpCircle,
  ImageIcon,
  ScanSearch,
  Upload,
  XCircle,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';

const STEPS = [
  {
    icon: Upload,
    title: 'Subir la imagen',
    text: 'En "Análisis de imágenes", carga una imagen microscópica de frotis sanguíneo en formato PNG o JPG.',
  },
  {
    icon: ScanSearch,
    title: 'Obtener la predicción',
    text: 'El modelo clasifica la imagen como compatible con LLA o sin indicios de LLA, con su nivel de confianza.',
  },
  {
    icon: Eye,
    title: 'Revisar Grad-CAM',
    text: 'Observa el mapa de calor y la región que más influyó en la decisión del modelo.',
  },
  {
    icon: FileDown,
    title: 'Descargar el reporte',
    text: 'Genera el reporte en PDF. El análisis queda guardado en tu historial para consultarlo después.',
  },
];

const FAQ = [
  {
    question: 'No me llegó el código de verificación, ¿qué hago?',
    answer:
      'Revisa la carpeta de spam o la pestaña Promociones de tu correo. Si no aparece, en la pantalla de verificación pulsa "Reenviar código" (disponible cada 60 segundos). El código vence a los 15 minutos.',
  },
  {
    question: '¿Por qué el sistema rechazó mi imagen?',
    answer:
      'Antes de analizarla, el sistema comprueba que la imagen tenga la apariencia de un frotis sanguíneo teñido. Se rechazan fotografías comunes, documentos, capturas de pantalla, imágenes muy pequeñas (menos de 80 × 80 píxeles) o sin suficiente información visual.',
  },
  {
    question: '¿Dónde veo mis análisis anteriores?',
    answer:
      'En "Historial", desde el Panel Principal. Ahí puedes abrir cada análisis con "Ver análisis" y descargar su reporte con "Descargar".',
  },
  {
    question: '¿Por qué algunos análisis antiguos no muestran las imágenes?',
    answer:
      'Las imágenes de cada análisis se guardan desde una versión reciente del sistema. En los análisis anteriores a ese cambio solo se conservaron el resultado y la confianza, por lo que su reporte se genera sin la sección Grad-CAM.',
  },
  {
    question: '¿Quién puede ver mis imágenes y resultados?',
    answer:
      'Solo tú y los administradores del sistema. Evita subir imágenes o datos que permitan identificar a un paciente.',
  },
  {
    question: '¿Cómo cambio mi foto, mi nombre o mi contraseña?',
    answer:
      'En "Mi perfil", desde el Panel Principal. Para cambiar la contraseña se te pedirá la contraseña actual. El correo no se puede modificar.',
  },
];

function GuideSection({
  icon: Icon,
  title,
  description,
  children,
}: {
  icon: typeof Upload;
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Icon className="h-5 w-5 text-primary" />
          {title}
        </CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent className="text-sm text-muted-foreground">{children}</CardContent>
    </Card>
  );
}

function CheckList({ items, good }: { items: string[]; good: boolean }) {
  const Icon = good ? CheckCircle2 : XCircle;
  return (
    <ul className="space-y-2">
      {items.map((item) => (
        <li key={item} className="flex gap-2">
          <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${good ? 'text-green-600' : 'text-destructive'}`} aria-hidden="true" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

// Guía de uso. Con onBack muestra el botón "Volver" (vista con sesión iniciada).
export function UserGuide({ onBack }: { onBack?: () => void }) {
  return (
    <div className="space-y-6">
      {onBack ? (
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={onBack} className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            Volver
          </Button>
          <h2 className="text-xl font-semibold">Guía de uso</h2>
        </div>
      ) : (
        <div className="text-center">
          <Badge variant="outline" className="mb-4">Ayuda</Badge>
          <h1 className="text-3xl font-bold tracking-tight">Guía de uso</h1>
        </div>
      )}

      <GuideSection icon={ScanSearch} title="Cómo realizar un análisis">
        <ol className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map(({ icon: Icon, title, text }, index) => (
            <li key={title} className="rounded-lg border p-4">
              <div className="mb-3 flex items-center gap-3">
                <span className="rounded-md bg-primary/10 p-2">
                  <Icon className="h-5 w-5 text-primary" />
                </span>
                <span className="font-medium text-foreground">
                  {index + 1}. {title}
                </span>
              </div>
              <p>{text}</p>
            </li>
          ))}
        </ol>
      </GuideSection>

      <GuideSection
        icon={ImageIcon}
        title="Qué imagen subir"
        description="El modelo fue entrenado con el conjunto de datos público Frotis sanguíneo ALL y HEM, compuesto por imágenes de frotis sanguíneo con tinción May-Grünwald-Giemsa (MGG)."
      >
        <div className="grid gap-6 md:grid-cols-2">
          <div className="space-y-3">
            <p className="font-medium text-foreground">Recomendado</p>
            <CheckList
              good
              items={[
                'Imagen microscópica de frotis sanguíneo con tinción May-Grünwald-Giemsa (MGG).',
                'Bien enfocada, con buena iluminación y fondo claro.',
                'Formato PNG o JPG, de hasta 10 MB.',
                'Al menos 80 × 80 píxeles. El sistema la ajusta a 300 × 300 píxeles para el análisis.',
              ]}
            />
          </div>
          <div className="space-y-3">
            <p className="font-medium text-foreground">Evitar</p>
            <CheckList
              good={false}
              items={[
                'Otras tinciones o técnicas distintas a MGG: el resultado puede ser menos confiable.',
                'Imágenes borrosas, oscuras, sobreexpuestas o muy recortadas.',
                'Fotografías comunes, documentos o capturas de pantalla: el sistema las rechaza.',
                'Imágenes que contengan nombres u otros datos que identifiquen al paciente.',
              ]}
            />
          </div>
        </div>
      </GuideSection>

      <GuideSection icon={Eye} title="Cómo interpretar el resultado">
        <div className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-4">
              <p className="mb-1 font-medium text-destructive">Resultado compatible con LLA</p>
              <p>El modelo identificó patrones visuales asociados a células con leucemia linfoblástica aguda.</p>
            </div>
            <div className="rounded-lg border border-primary/20 bg-primary/5 p-4">
              <p className="mb-1 font-medium text-primary">Resultado sin indicios de LLA</p>
              <p>El modelo no encontró patrones relevantes asociados a LLA en la imagen analizada.</p>
            </div>
          </div>

          <p>
            <span className="font-medium text-foreground">Nivel de confianza:</span> es la probabilidad que el modelo
            asigna al resultado elegido.
          </p>

          <div>
            <p className="mb-2 font-medium text-foreground">Visualización Grad-CAM</p>
            <ul className="space-y-1.5">
              <li>
                <span className="font-medium text-foreground">Imagen analizada:</span> la imagen original que subiste.
              </li>
              <li>
                <span className="font-medium text-foreground">Mapa de calor:</span> las zonas en rojo y amarillo
                influyeron más en la predicción; las zonas en azul, menos.
              </li>
              <li>
                <span className="font-medium text-foreground">Región de mayor influencia:</span> un círculo rojo marca el
                área más determinante. Solo aparece cuando el resultado es compatible con LLA.
              </li>
            </ul>
          </div>
        </div>
      </GuideSection>

      <GuideSection icon={AlertTriangle} title="Limitaciones">
        <ul className="list-disc space-y-1.5 pl-5">
          <li>LeuNet es un prototipo académico de apoyo y puede equivocarse, con falsos positivos o falsos negativos.</li>
          <li>La calidad del resultado depende de la calidad de la imagen y de que la tinción sea similar a la del entrenamiento.</li>
        </ul>
      </GuideSection>

      <GuideSection icon={HelpCircle} title="Preguntas frecuentes">
        <Accordion type="single" collapsible className="w-full">
          {FAQ.map(({ question, answer }) => (
            <AccordionItem key={question} value={question}>
              <AccordionTrigger className="text-left text-foreground">{question}</AccordionTrigger>
              <AccordionContent className="text-muted-foreground">{answer}</AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </GuideSection>

      <p className="rounded-lg border border-warning/50 bg-warning/5 p-4 text-sm font-medium text-foreground">
        LeuNet es una herramienta de apoyo. Los resultados deben ser revisados y confirmados por un profesional de salud
        capacitado.
      </p>
    </div>
  );
}
