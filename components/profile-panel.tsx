'use client';

import { useEffect, useRef, useState } from 'react';
import { Activity, ArrowLeft, CalendarClock, Camera, FileImage, KeyRound, UserRound } from 'lucide-react';
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
import { Spinner } from '@/components/ui/spinner';
import { UserAvatar } from '@/components/user-avatar';
import { AVATAR_MAX_FILE_MB, avatarFileError, resizeAvatar } from '@/lib/avatar';
import {
  changePassword,
  getProfile,
  updateProfile,
  type ProfileData,
  type User,
} from '@/lib/api';

interface ProfilePanelProps {
  onBack: () => void;
  onUserUpdated: (user: User) => void;
}

type Message = { type: 'success' | 'error'; text: string } | null;

function formatDate(value: string | null) {
  if (!value) return null;
  return new Date(value).toLocaleDateString('es-EC', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function FormMessage({ message }: { message: Message }) {
  if (!message) return null;
  return (
    <p className={`text-sm ${message.type === 'error' ? 'text-destructive' : 'text-green-700 dark:text-green-400'}`}>
      {message.text}
    </p>
  );
}

export function ProfilePanel({ onBack, onUserUpdated }: ProfilePanelProps) {
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Datos personales
  const [name, setName] = useState('');
  const [avatar, setAvatar] = useState<string | null>(null);
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileMessage, setProfileMessage] = useState<Message>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  // Contraseña
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState<Message>(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);

      try {
        const data = await getProfile();
        setProfile(data);
        setName(data.name);
        setAvatar(data.avatar ?? null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'No se pudo cargar el perfil');
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  const profileChanged = profile !== null && (name.trim() !== profile.name || avatar !== (profile.avatar ?? null));

  const handleAvatarChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    const fileError = avatarFileError(file);
    if (fileError) {
      setProfileMessage({ type: 'error', text: fileError });
      return;
    }

    try {
      setAvatar(await resizeAvatar(file));
      setProfileMessage(null);
    } catch (err) {
      setProfileMessage({ type: 'error', text: err instanceof Error ? err.message : 'No se pudo cargar la foto' });
    }
  };

  const handleSaveProfile = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!profile) return;
    setSavingProfile(true);
    setProfileMessage(null);

    try {
      const user = await updateProfile(name.trim(), avatar);
      setProfile({ ...profile, ...user });
      setName(user.name);
      setAvatar(user.avatar ?? null);
      onUserUpdated(user);
      setProfileMessage({ type: 'success', text: 'Los cambios se guardaron correctamente.' });
    } catch (err) {
      setProfileMessage({ type: 'error', text: err instanceof Error ? err.message : 'No se pudieron guardar los cambios' });
    } finally {
      setSavingProfile(false);
    }
  };

  const handleChangePassword = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPasswordMessage(null);

    if (newPassword.length < 6) {
      setPasswordMessage({ type: 'error', text: 'La nueva contraseña debe tener mínimo 6 caracteres.' });
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordMessage({ type: 'error', text: 'Las contraseñas nuevas no coinciden.' });
      return;
    }

    setSavingPassword(true);

    try {
      await changePassword(currentPassword, newPassword);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setPasswordMessage({ type: 'success', text: 'Tu contraseña se cambió correctamente.' });
    } catch (err) {
      setPasswordMessage({ type: 'error', text: err instanceof Error ? err.message : 'No se pudo cambiar la contraseña' });
    } finally {
      setSavingPassword(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="outline" size="sm" onClick={onBack} className="gap-2">
          <ArrowLeft className="h-4 w-4" />
          Volver
        </Button>

        <div>
          <h2 className="text-xl font-semibold">Mi perfil</h2>
        </div>
      </div>

      {loading ? (
        <Card>
          <CardContent className="flex items-center gap-3 py-8 text-muted-foreground">
            <Spinner className="h-5 w-5" />
            Cargando perfil...
          </CardContent>
        </Card>
      ) : error || !profile ? (
        <Card>
          <CardContent className="py-6 text-sm text-destructive">
            {error ?? 'No se pudo cargar el perfil'}
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Resumen de actividad */}
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <FileImage className="h-4 w-4 text-primary" />
                  Análisis realizados
                </CardTitle>
              </CardHeader>
              <CardContent className="text-3xl font-bold">
                {profile.analysis_count}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Activity className="h-4 w-4 text-primary" />
                  Resultados
                </CardTitle>
              </CardHeader>
              <CardContent>
                {profile.analysis_count > 0 ? (
                  <div className="flex flex-wrap gap-2 pt-1.5">
                    <span className="inline-flex rounded-md border-[0.5px] border-destructive/30 bg-destructive/5 px-2 py-1 text-sm font-medium text-destructive">
                      {profile.leukemia_count} con LLA
                    </span>
                    <span className="inline-flex rounded-md border-[0.5px] border-primary/30 bg-primary/5 px-2 py-1 text-sm font-medium text-primary">
                      {profile.benign_count} sin indicios
                    </span>
                  </div>
                ) : (
                  <p className="pt-1.5 text-sm text-muted-foreground">Todavía no tienes análisis.</p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <CalendarClock className="h-4 w-4 text-primary" />
                  Última actividad
                </CardTitle>
              </CardHeader>
              <CardContent className="text-3xl font-bold">
                {formatDate(profile.last_analysis_at) ?? (
                  <span className="text-base font-normal text-muted-foreground">Sin actividad</span>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            {/* Datos personales */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <UserRound className="h-5 w-5 text-primary" />
                  Datos personales
                </CardTitle>
                <CardDescription>
                  Cuenta creada el {formatDate(profile.created_at)}.
                </CardDescription>
              </CardHeader>

              <CardContent>
                <form onSubmit={handleSaveProfile} className="space-y-5">
                  <div className="flex items-center gap-4">
                    <button
                      type="button"
                      onClick={() => avatarInputRef.current?.click()}
                      className="group relative h-20 w-20 shrink-0 overflow-hidden rounded-full"
                      aria-label={avatar ? 'Cambiar foto de perfil' : 'Subir foto de perfil'}
                    >
                      <UserAvatar name={name || profile.name} avatar={avatar} className="h-20 w-20 text-xl" />
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

                  <div className="space-y-2">
                    <Label htmlFor="profile-name">Nombre y apellido</Label>
                    <Input
                      id="profile-name"
                      value={name}
                      onChange={(event) => setName(event.target.value)}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="profile-email">Correo</Label>
                    <Input id="profile-email" value={profile.email} disabled readOnly />
                  </div>

                  <FormMessage message={profileMessage} />

                  <Button type="submit" disabled={savingProfile || !profileChanged || !name.trim()} className="gap-2">
                    {savingProfile && <Spinner className="h-4 w-4" />}
                    Guardar cambios
                  </Button>
                </form>
              </CardContent>
            </Card>

            {/* Contraseña */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <KeyRound className="h-5 w-5 text-primary" />
                  Contraseña
                </CardTitle>
                <CardDescription>
                  Para cambiarla, primero confirma tu contraseña actual.
                </CardDescription>
              </CardHeader>

              <CardContent>
                <form onSubmit={handleChangePassword} className="space-y-5">
                  <div className="space-y-2">
                    <Label htmlFor="current-password">Contraseña actual</Label>
                    <Input
                      id="current-password"
                      type="password"
                      autoComplete="current-password"
                      value={currentPassword}
                      onChange={(event) => setCurrentPassword(event.target.value)}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="new-password">Nueva contraseña</Label>
                    <Input
                      id="new-password"
                      type="password"
                      autoComplete="new-password"
                      placeholder="Mínimo 6 caracteres"
                      value={newPassword}
                      onChange={(event) => setNewPassword(event.target.value)}
                      minLength={6}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="confirm-new-password">Confirmar nueva contraseña</Label>
                    <Input
                      id="confirm-new-password"
                      type="password"
                      autoComplete="new-password"
                      placeholder="Repita la nueva contraseña"
                      value={confirmPassword}
                      onChange={(event) => setConfirmPassword(event.target.value)}
                      minLength={6}
                      required
                    />
                  </div>

                  <FormMessage message={passwordMessage} />

                  <Button type="submit" disabled={savingPassword} className="gap-2">
                    {savingPassword && <Spinner className="h-4 w-4" />}
                    Cambiar contraseña
                  </Button>
                </form>
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
