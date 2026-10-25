'use client';

import { useEffect, useState } from 'react';
import { REGEXP_ONLY_DIGITS } from 'input-otp';
import { Button } from '@/components/ui/button';
import { CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Spinner } from '@/components/ui/spinner';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import { resendVerificationCode, verifyEmail, type User } from '@/lib/api';

const CODE_LENGTH = 6;
const RESEND_SECONDS = 60;

interface EmailVerificationProps {
  email: string;
  onVerified: (user: User) => void;
  onBack: () => void;
}

export function EmailVerification({ email, onVerified, onBack }: EmailVerificationProps) {
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [cooldown, setCooldown] = useState(RESEND_SECONDS);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((value) => value - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  const submit = async (value: string) => {
    if (value.length !== CODE_LENGTH || loading) return;
    setLoading(true);
    setError(null);
    setNotice(null);

    try {
      const auth = await verifyEmail(email, value);
      onVerified(auth.user);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo verificar el código');
      setCode('');
    } finally {
      setLoading(false);
    }
  };

  const resend = async () => {
    setResending(true);
    setError(null);
    setNotice(null);

    try {
      await resendVerificationCode(email);
      setNotice('Te enviamos un código nuevo.');
      setCode('');
      setCooldown(RESEND_SECONDS);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo reenviar el código');
    } finally {
      setResending(false);
    }
  };

  return (
    <>
      <CardHeader className="text-center">
        <CardTitle>Verifica tu correo</CardTitle>
        <CardDescription>
          Enviamos un código de {CODE_LENGTH} dígitos a{' '}
          <span className="font-medium text-foreground">{email}</span>. Si no lo ves, revisa la carpeta de spam.
        </CardDescription>
      </CardHeader>

      <CardContent>
        <form
          className="space-y-5"
          onSubmit={(event) => {
            event.preventDefault();
            submit(code);
          }}
        >
          <div className="flex justify-center">
            <InputOTP
              maxLength={CODE_LENGTH}
              pattern={REGEXP_ONLY_DIGITS}
              value={code}
              onChange={setCode}
              onComplete={submit}
              autoFocus
              aria-label="Código de verificación"
            >
              <InputOTPGroup>
                {Array.from({ length: CODE_LENGTH }, (_, index) => (
                  <InputOTPSlot key={index} index={index} className="h-11 w-11 text-lg" />
                ))}
              </InputOTPGroup>
            </InputOTP>
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          {notice && <p className="text-center text-sm text-green-700 dark:text-green-400">{notice}</p>}

          <Button type="submit" className="w-full" disabled={loading || code.length !== CODE_LENGTH}>
            {loading && <Spinner className="mr-2 h-4 w-4" />}
            Verificar
          </Button>
        </form>

        <div className="mt-4 space-y-2 text-center text-sm text-muted-foreground">
          <p>
            ¿No te llegó el código?{' '}
            {cooldown > 0 ? (
              <span>Puedes pedir otro en {cooldown} s.</span>
            ) : (
              <button
                type="button"
                className="font-medium text-primary underline-offset-4 hover:underline disabled:opacity-60"
                onClick={resend}
                disabled={resending}
              >
                {resending ? 'Enviando...' : 'Reenviar código'}
              </button>
            )}
          </p>
          <button
            type="button"
            className="text-muted-foreground underline-offset-4 hover:underline"
            onClick={onBack}
          >
            Volver a iniciar sesión
          </button>
        </div>
      </CardContent>
    </>
  );
}
