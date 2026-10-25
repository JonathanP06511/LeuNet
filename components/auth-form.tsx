'use client';

import { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Spinner } from '@/components/ui/spinner';
import { EmailNotVerifiedError, loginUser, registerUser, resendVerificationCode, type User } from '@/lib/api';
import { EmailVerification } from '@/components/email-verification';
import { AVATAR_MAX_FILE_MB, avatarFileError, resizeAvatar } from '@/lib/avatar';
import { Camera, LogIn, UserRound } from 'lucide-react';

interface AuthFormProps {
  onAuthenticated: (user: User) => void;
}

export function AuthForm({ onAuthenticated }: AuthFormProps) {
  const [isRegister, setIsRegister] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const [confirmPassword, setConfirmPassword] = useState('');
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [avatar, setAvatar] = useState<string | null>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  // Correo pendiente de verificación: mientras exista, se muestra la pantalla del código.
  const [pendingEmail, setPendingEmail] = useState<string | null>(null);

  const handleAvatarChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    const fileError = avatarFileError(file);
    if (fileError) {
      setError(fileError);
      return;
    }

    try {
      setAvatar(await resizeAvatar(file));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cargar la foto');
    }
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    if (isRegister) {
      if (password !== confirmPassword) {
        setError('Las contraseñas no coinciden.');
        return;
      }

      if (!acceptedTerms) {
        setError('Debe aceptar el aviso académico para continuar.');
        return;
      }
    }

    setLoading(true);

    try {
      if (isRegister) {
        const result = await registerUser(name, email, password, avatar);
        setPendingEmail(result.email);
      } else {
        const auth = await loginUser(email, password);
        onAuthenticated(auth.user);
      }
    } catch (err) {
      if (err instanceof EmailNotVerifiedError) {
        // La cuenta existe pero no se verificó: se envía un código nuevo y se pide ingresarlo.
        await resendVerificationCode(email).catch(() => undefined);
        setPendingEmail(email.trim().toLowerCase());
      } else {
        setError(err instanceof Error ? err.message : 'Ocurrió un error inesperado');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <section
      className="flex min-h-[75vh] items-center justify-center bg-cover bg-center bg-no-repeat px-4 py-12"
      style={{
        backgroundImage:
          "linear-gradient(var(--hero-overlay), var(--hero-overlay)), var(--hero-image)",
      }}
    >
      <div className="w-full max-w-md">
        <Card className="w-full border bg-background/95 shadow-xl backdrop-blur-sm">
          {pendingEmail ? (
            <EmailVerification
              email={pendingEmail}
              onVerified={onAuthenticated}
              onBack={() => {
                setPendingEmail(null);
                setIsRegister(false);
                setPassword('');
                setConfirmPassword('');
                setError(null);
              }}
            />
          ) : (
          <>
          <CardHeader className="text-center">
            {!isRegister && (
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
                <LogIn className="h-6 w-6 text-primary" />
              </div>
            )}

            <CardTitle>
              {isRegister ? 'Crear cuenta' : 'Iniciar sesión'}
            </CardTitle>

            {!isRegister && (
              <CardDescription>Ingresa tus credenciales para continuar.</CardDescription>
            )}
          </CardHeader>

          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {isRegister && (
                <div className="flex items-center gap-4">
                  <button
                    type="button"
                    onClick={() => avatarInputRef.current?.click()}
                    className="group relative h-16 w-16 shrink-0 overflow-hidden rounded-full border bg-muted"
                    aria-label={avatar ? 'Cambiar foto de perfil' : 'Subir foto de perfil'}
                  >
                    {avatar ? (
                      <img src={avatar} alt="Vista previa de la foto de perfil" className="h-full w-full object-cover" />
                    ) : (
                      <UserRound className="mx-auto h-8 w-8 text-muted-foreground" />
                    )}
                    <span className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
                      <Camera className="h-5 w-5 text-white" />
                    </span>
                  </button>

                  <div className="space-y-1.5">
                    <p className="text-sm font-medium">Foto de perfil</p>
                    <div className="flex items-center gap-3 text-sm">
                      <button
                        type="button"
                        className="font-medium text-primary underline-offset-4 hover:underline"
                        onClick={() => avatarInputRef.current?.click()}
                      >
                        {avatar ? 'Cambiar foto' : 'Subir foto'}
                      </button>
                      {avatar && (
                        <button
                          type="button"
                          className="text-muted-foreground underline-offset-4 hover:underline"
                          onClick={() => setAvatar(null)}
                        >
                          Quitar
                        </button>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">JPG, PNG o WEBP, hasta {AVATAR_MAX_FILE_MB} MB.</p>
                  </div>

                  <input
                    ref={avatarInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="hidden"
                    onChange={handleAvatarChange}
                  />
                </div>
              )}

              {isRegister && (
                <div className="space-y-2">
                  <Label htmlFor="name">Ingrese su nombre y apellido</Label>
                  <Input
                    id="name"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    placeholder="Ej. Juan Pérez"
                    required
                  />
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="email">Correo</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="usuario@correo.com"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Contraseña</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Mínimo 6 caracteres"
                  minLength={6}
                  required
                />
              </div>

              {isRegister && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="confirmPassword">Confirmar contraseña</Label>
                    <Input
                      id="confirmPassword"
                      type="password"
                      value={confirmPassword}
                      onChange={(event) => setConfirmPassword(event.target.value)}
                      placeholder="Repita la contraseña"
                      minLength={6}
                      required
                    />
                  </div>

                  <div className="rounded-lg border bg-muted/30 p-3">
                    <label className="flex items-start gap-2 text-sm text-muted-foreground">
                      <input
                        type="checkbox"
                        checked={acceptedTerms}
                        onChange={(event) => setAcceptedTerms(event.target.checked)}
                        className="mt-1"
                      />
                      <span>
                        Entiendo que LeuNet es una herramienta de apoyo y que no
                        reemplaza el diagnóstico médico profesional.
                      </span>
                    </label>
                  </div>
                </>
              )}

              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <Button type="submit" className="w-full" disabled={loading}>
                {loading && <Spinner className="mr-2 h-4 w-4" />}
                {isRegister ? 'Registrarme' : 'Ingresar'}
              </Button>
            </form>

            <div className="mt-4 text-center text-sm text-muted-foreground">
              {isRegister ? '¿Ya tienes cuenta?' : '¿No tienes cuenta?'}{' '}
              <button
                type="button"
                className="font-medium text-primary underline-offset-4 hover:underline"
                onClick={() => {
                  setIsRegister(!isRegister);
                  setError(null);
                  setConfirmPassword('');
                  setAcceptedTerms(false);
                  setAvatar(null);
                }}
              >
                {isRegister ? 'Inicia sesión' : 'Crear cuenta'}
              </button>
            </div>
          </CardContent>
          </>
          )}
        </Card>
      </div>
    </section>
  );
}