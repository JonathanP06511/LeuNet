'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Spinner } from '@/components/ui/spinner';
import { AuthForm } from '@/components/auth-form';
import { DashboardMenu, type DashboardAction } from '@/components/dashboard-menu';
import { LaboratoryMenu } from '@/components/laboratory-menu';
import { PracticeMode } from '@/components/practice-mode';
import { ExamMode } from '@/components/exam-mode';
import { ImageAnalysisSection } from '@/components/image-analysis/image-analysis-section';
import { HistoryPanel } from '@/components/history-panel';
import { AdminPanel } from '@/components/admin-panel';
import { ProfilePanel } from '@/components/profile-panel';
import { UserGuide } from '@/components/user-guide';
import { ThemeToggle } from '@/components/theme-toggle';
import { UserAvatar } from '@/components/user-avatar';
import {
  checkHealth,
  clearSession,
  getCurrentUser,
  getStoredUser,
  type HealthResponse,
  type User,
} from '@/lib/api';
import {
  AlertCircle,
  Brain,
  CheckCircle2,
  Database,
  Eye,
  FileText,
  HelpCircle,
  FlaskConical,
  Info,
  LogIn,
  Microscope,
  ScanSearch,
  Server,
  Upload,
  XCircle,
} from 'lucide-react';

type PublicView = 'home' | 'about' | 'guide' | 'login';
type AppView = DashboardAction | 'practice' | 'exam' | 'guide' | null;

function PublicHeader({ currentView, onChangeView }: { currentView: PublicView; onChangeView: (view: PublicView) => void }) {
  return (
    <header className="border-b bg-card px-4 py-3">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4">
        <button className="flex items-center gap-2 font-semibold" onClick={() => onChangeView('home')}>
          <Microscope className="h-5 w-5 text-primary" />
          LeuNet
        </button>
        <nav className="flex items-center gap-2">
          <Button variant={currentView === 'home' ? 'default' : 'ghost'} size="sm" onClick={() => onChangeView('home')}>
            Inicio
          </Button>
          <Button variant={currentView === 'about' ? 'default' : 'ghost'} size="sm" onClick={() => onChangeView('about')}>
            Acerca de
          </Button>
          <Button variant={currentView === 'guide' ? 'default' : 'ghost'} size="sm" onClick={() => onChangeView('guide')}>
            Guía
          </Button>
          <ThemeToggle />

        </nav>
      </div>
    </header>
  );
}

function PublicHome({ onLogin }: { onLogin: () => void }) {
  return (
    <>
      <section
        className="relative overflow-hidden border-b bg-cover bg-center bg-no-repeat px-4 py-16 sm:py-20"
        style={{
          backgroundImage:
            "linear-gradient(var(--hero-overlay), var(--hero-overlay)), var(--hero-image)",
        }}
      >
        <div className="mx-auto grid max-w-6xl gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
          <div>
            <Badge variant="outline" className="mb-4">Prototipo Académico</Badge>
            <h1 className="text-balance text-4xl font-bold tracking-tight sm:text-5xl">
              LeuNet
            </h1>
            <p className="mt-5 max-w-2xl text-pretty text-lg text-muted-foreground">
              Sistema de apoyo para el análisis y la clasificación de imágenes microscópicas, orientado a la identificación de leucemia linfoblástica aguda mediante el procesamiento y la evaluación de imágenes.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button size="lg" onClick={onLogin}>Iniciar sesión</Button>
            </div>
          </div>

          <Card className="border-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Brain className="h-5 w-5 text-primary" />
                Análisis inteligente de imágenes
              </CardTitle>
              <CardDescription>Clasificación con EfficientNet-B3 y visualización Grad-CAM.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 text-sm text-muted-foreground">
              <div className="flex items-start gap-3 rounded-lg border p-4">
                <div className="rounded-md bg-primary/10 p-2">
                  <Upload className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="font-medium text-foreground">1. Subir imagen</p>
                  <p>El usuario carga una imagen microscópica.</p>
                </div>
              </div>
              <div className="flex items-start gap-3 rounded-lg border p-4">
                <div className="rounded-md bg-primary/10 p-2">
                  <ScanSearch className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="font-medium text-foreground">2. Obtener predicción</p>
                  <p>El sistema clasifica la imagen como sana o con leucemia.</p>
                </div>
              </div>
              <div className="flex items-start gap-3 rounded-lg border p-4">
                <div className="rounded-md bg-primary/10 p-2">
                  <Eye className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="font-medium text-foreground">3. Interpretar con Grad-CAM</p>
                  <p>Se muestra un mapa visual de las zonas que influyeron en el resultado.</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      <section id="modulos" className="px-4 py-14">
        <div className="mx-auto max-w-6xl">
          <div className="mb-8 text-center">
            <h2 className="text-2xl font-bold">Módulos del sistema</h2>
          </div>
          <div className="grid gap-6 md:grid-cols-3">
            <Card>
              <CardHeader>
                <Brain className="mb-2 h-8 w-8 text-primary" />
                <CardTitle>Análisis de imágenes</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                Módulo principal del prototipo, diseñado para clasificar imágenes microscópicas de células mediante EfficientNet-B3.
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <FlaskConical className="mb-2 h-8 w-8 text-primary" />
                <CardTitle>Visualización Grad-CAM.</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                Mapa visual que resalta las zonas de la imagen que más influyeron en la predicción del modelo.
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <FileText className="mb-2 h-8 w-8 text-primary" />
                <CardTitle>Reportes en PDF</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                Genera un reporte descargable con el resultado, el nivel de confianza y las imágenes Grad-CAM de cada análisis.
              </CardContent>
            </Card>
          </div>
        </div>
      </section>
    </>
  );
}

function PublicAbout() {
  return (
    <section
      className="px-4 py-14 min-h-screen bg-cover bg-center bg-no-repeat"
      style={{
        backgroundImage:
          "linear-gradient(var(--about-overlay), var(--about-overlay)), var(--hero-image)",
      }}
    >
      <div className="mx-auto max-w-4xl space-y-6">
        <div className="text-center">
          <Badge variant="outline" className="mb-4">Sobre el Prototipo</Badge>
          <h1 className="text-3xl font-bold tracking-tight">LeuNet</h1>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Info className="h-5 w-5 text-primary" />
                Contexto del Prototipo
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              <p>
                LeuNet es un prototipo desarrollado como parte de un trabajo de tesis, orientado al análisis de imágenes
                microscópicas de células sanguíneas relacionadas con la leucemia linfoblástica aguda (LLA).
              </p>
              <p>
                Para ello, LeuNet utiliza un modelo de aprendizaje profundo basado en EfficientNet-B3 que
                clasifica las imágenes, y aplica Grad-CAM para mostrar qué regiones de la imagen influyeron en cada
                predicción, de modo que el resultado no sea una caja negra y pueda ser revisado por el usuario.
              </p>
              <p>
                El código fuente y el documento de la tesis están disponibles en el{' '}
                <a
                  href="https://github.com/JonathanP06511/LeuNet"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-primary underline-offset-4 hover:underline"
                >
                  repositorio de GitHub
                </a>
                .
              </p>
              <p className="font-medium text-foreground">
                El sistema no reemplaza el diagnóstico médico profesional. Los resultados deben interpretarse como apoyo.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Microscope className="h-5 w-5 text-primary" />
                Alcance
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              <p>Plataforma web que reúne en un solo lugar:</p>
              <ul className="space-y-2">
                {[
                  ['Análisis de imágenes', 'clasifica imágenes microscópicas de células sanguíneas como compatibles o no con LLA, con su nivel de confianza, mediante EfficientNet-B3.'],
                  ['Interpretabilidad con Grad-CAM', 'muestra un mapa de calor y la región de la imagen que más influyó en la predicción.'],
                  ['Reportes en PDF', 'genera un reporte descargable con el resultado, la confianza y las imágenes de cada análisis.'],
                  ['Historial', 'permite consultar los análisis anteriores, revisar sus imágenes y descargar su reporte.'],
                  ['Cuentas de usuario', 'registro con verificación por correo electrónico y foto de perfil.'],
                  ['Panel administrativo', 'gestión de roles y cuentas, actividad del sistema por día y hora, e historial general.'],
                ].map(([title, description]) => (
                  <li key={title} className="flex gap-2">
                    <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-primary" aria-hidden="true" />
                    <span>
                      <span className="font-medium text-foreground">{title}:</span> {description}
                    </span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </div>
      </div>
    </section>
  );
}

function SystemStatus({ health, healthError, isCheckingHealth }: { health: HealthResponse | null; healthError: string | null; isCheckingHealth: boolean }) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Server className="h-5 w-5" />
          Estado del sistema
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isCheckingHealth ? (
          <div className="flex items-center gap-3">
            <Spinner className="h-5 w-5" />
            <span className="text-muted-foreground">Verificando conexión...</span>
          </div>
        ) : healthError ? (
          <div className="space-y-4">
            <div className="flex items-center gap-3 text-destructive">
              <XCircle className="h-5 w-5" />
              <span>{healthError}</span>
            </div>
            <Card className="border-[oklch(0.75_0.15_85)] bg-[oklch(0.75_0.15_85/0.1)]">
              <CardContent className="p-4">
                <p className="mb-2 font-medium text-[oklch(0.4_0.1_85)]">
                  <AlertCircle className="mr-2 inline h-4 w-4" />
                  Instrucciones para iniciar el backend:
                </p>
                <ol className="list-inside list-decimal space-y-1 text-sm text-muted-foreground">
                  <li>Abre una terminal en la carpeta del backend.</li>
                  <li>Ejecuta: <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">cd backend</code></li>
                  <li>Ejecuta: <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">uv run uvicorn main:app --reload</code></li>
                  <li>El servidor estará disponible en http://localhost:8000.</li>
                </ol>
              </CardContent>
            </Card>
          </div>
        ) : health ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="flex items-center gap-3 rounded-lg border p-3">
              <CheckCircle2 className="h-5 w-5 text-[oklch(0.55_0.18_150)]" />
              <div>
                <p className="text-sm text-muted-foreground">Servidor backend</p>
                <p className="font-medium">Conectado</p>
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-lg border p-3">
              {health.uploaded_model_exists ? (
                <CheckCircle2 className="h-5 w-5 text-[oklch(0.55_0.18_150)]" />
              ) : (
                <Badge variant="outline">Pendiente</Badge>
              )}
              <div>
                <p className="text-sm text-muted-foreground">Grad-CAM</p>
                <p className="font-medium">{health.gradcam_enabled ? 'Activo' : 'Por cargar'}</p>
              </div>
            </div>

          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

export default function Home() {
  const [publicView, setPublicView] = useState<PublicView>('home');
  const [view, setView] = useState<AppView>(null);
  const [user, setUser] = useState<User | null>(null);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [healthError, setHealthError] = useState<string | null>(null);
  const [isCheckingHealth, setIsCheckingHealth] = useState(true);

  useEffect(() => {
    const validateSession = async () => {
      const storedUser = getStoredUser();
      if (!storedUser) {
        setIsCheckingAuth(false);
        return;
      }

      setUser(storedUser);

      try {
        const currentUser = await getCurrentUser();
        setUser(currentUser);
      } catch {
        setUser(null);
      } finally {
        setIsCheckingAuth(false);
      }
    };

    validateSession();
  }, []);

  useEffect(() => {
    const checkBackendHealth = async () => {
      setIsCheckingHealth(true);
      try {
        const healthData = await checkHealth();
        setHealth(healthData);
        setHealthError(null);
      } catch (error) {
        setHealthError('No se puede conectar con el servidor backend');
        console.error('Health check failed:', error);
      } finally {
        setIsCheckingHealth(false);
      }
    };

    checkBackendHealth();
    const interval = setInterval(checkBackendHealth, 30000);
    return () => clearInterval(interval);
  }, []);

  const handleLogout = () => {
    clearSession();
    setUser(null);
    setView(null);
    setPublicView('home');
  };

  if (isCheckingAuth) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex items-center gap-3 text-muted-foreground">
          <Spinner className="h-5 w-5" />
          <span>Verificando sesión...</span>
        </div>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="min-h-screen bg-background">
        <PublicHeader currentView={publicView} onChangeView={setPublicView} />
        {publicView === 'home' && <PublicHome onLogin={() => setPublicView('login')} />}
        {publicView === 'about' && <PublicAbout />}
        {publicView === 'guide' && (
          <section
            className="min-h-screen bg-cover bg-center bg-no-repeat px-4 py-14"
            style={{
              backgroundImage:
                "linear-gradient(var(--about-overlay), var(--about-overlay)), var(--hero-image)",
            }}
          >
            <div className="mx-auto max-w-5xl">
              <UserGuide />
            </div>
          </section>
        )}
        {publicView === 'login' && <AuthForm onAuthenticated={(authenticatedUser) => { setUser(authenticatedUser); setView(null); }} />}
        <footer className="border-t px-4 py-6 text-center text-sm text-muted-foreground">
          <p>© 2026 Universidad Central del Ecuador. Todos los derechos reservados.</p>
        </footer>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background">
      <div className="border-b bg-card px-4 py-3">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4">
          <button className="flex items-center gap-2 text-sm font-medium" onClick={() => setView(null)}>
            <Microscope className="h-5 w-5 text-primary" />
            LeuNet
          </button>
          <div className="flex items-center gap-3">
            <UserAvatar name={user.name} avatar={user.avatar} />
            <div className="hidden text-sm text-muted-foreground sm:block">
              Bienvenido: <span className="font-medium text-foreground">{user.name}</span>
            </div>
            {user.role === 'ADMIN' && <Badge variant="outline">{user.role}</Badge>}
            <Button
              variant={view === 'guide' ? 'default' : 'ghost'}
              size="icon"
              aria-label="Guía de uso"
              title="Guía de uso"
              onClick={() => setView('guide')}
            >
              <HelpCircle className="h-5 w-5" />
            </Button>
            <ThemeToggle />
            <Button variant="outline" size="sm" onClick={handleLogout}>Cerrar sesión</Button>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-4 py-8">
        {view === 'image-analysis' && <ImageAnalysisSection onBack={() => setView(null)} />}
        {view === 'laboratory' && <LaboratoryMenu onBack={() => setView(null)} onSelectMode={(mode) => setView(mode)} />}
        {view === 'practice' && <PracticeMode onBack={() => setView('laboratory')} />}
        {view === 'exam' && <ExamMode onBack={() => setView('laboratory')} />}
        {view === 'history' && <HistoryPanel onBack={() => setView(null)} />}
        {view === 'admin' && user.role === 'ADMIN' && <AdminPanel onBack={() => setView(null)} />}
        {view === 'profile' && <ProfilePanel onBack={() => setView(null)} onUserUpdated={setUser} />}
        {view === 'guide' && <UserGuide onBack={() => setView(null)} />}

        {!view && (
          <div className="space-y-8">
            <DashboardMenu user={user} onSelect={setView} />
            {/*
            <SystemStatus health={health} healthError={healthError} isCheckingHealth={isCheckingHealth} />
             */}
          </div>
        )}
      </div>
    </main>
  );
}
