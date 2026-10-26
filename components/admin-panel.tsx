'use client';

import { useEffect, useState } from 'react';
import { ArrowLeft, ShieldCheck, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Spinner } from '@/components/ui/spinner';
import { HistoryResultsTable } from '@/components/history-panel';
import { AdminUsersTable } from '@/components/admin-users-table';
import { ActivityHeatmap } from '@/components/activity-heatmap';
import {
  getAdminActivity,
  getAdminHistory,
  getAdminUsers,
  getStoredUser,
  type ActivityItem,
  type AdminHistoryItem,
  type AdminUser,
} from '@/lib/api';

interface AdminPanelProps {
  onBack: () => void;
}

export function AdminPanel({ onBack }: AdminPanelProps) {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [history, setHistory] = useState<AdminHistoryItem[]>([]);
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<number | null>(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      setCurrentUserId(getStoredUser()?.id ?? null);

      try {
        const [adminUsers, adminHistory, adminActivity] = await Promise.all([
          getAdminUsers(),
          getAdminHistory(),
          // Si la actividad no se puede cargar, el resto del panel sigue funcionando.
          getAdminActivity().catch(() => []),
        ]);

        setUsers(adminUsers);
        setHistory(adminHistory);
        setActivity(adminActivity);
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : 'No se pudo cargar el panel administrativo'
        );
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="outline" size="sm" onClick={onBack} className="gap-2">
          <ArrowLeft className="h-4 w-4" />
          Volver
        </Button>

        <div>
          <h2 className="text-xl font-semibold">Panel administrativo</h2>
        </div>
      </div>

      {loading ? (
        <Card>
          <CardContent className="flex items-center gap-3 py-8 text-muted-foreground">
            <Spinner className="h-5 w-5" />
            Cargando panel administrativo...
          </CardContent>
        </Card>
      ) : error ? (
        <Card>
          <CardContent className="py-6 text-sm text-destructive">
            {error}
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Users className="h-4 w-4 text-primary" />
                  Usuarios
                </CardTitle>
              </CardHeader>

              <CardContent className="text-3xl font-bold">
                {users.length}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <ShieldCheck className="h-4 w-4 text-primary" />
                  Administradores
                </CardTitle>
              </CardHeader>

              <CardContent className="text-3xl font-bold">
                {users.filter((u) => u.role === 'ADMIN').length}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Registros</CardTitle>
              </CardHeader>

              <CardContent className="text-3xl font-bold">
                {history.length}
              </CardContent>
            </Card>
          </div>

          <ActivityHeatmap items={activity} users={users} />

          <AdminUsersTable
            users={users}
            currentUserId={currentUserId}
            onUserUpdated={(updated) =>
              setUsers((current) => current.map((u) => (u.id === updated.id ? updated : u)))
            }
          />

          <Card>
            <CardHeader>
              <CardTitle>Historial general</CardTitle>
              <CardDescription>
                Últimos registros de todos los usuarios.
              </CardDescription>
            </CardHeader>

            <CardContent>
              <HistoryResultsTable
                items={history}
                showDeletedLabel
                getUser={(item) => ({
                  id: item.user_id,
                  name: item.user_name,
                  email: item.user_email,
                  role: users.find((u) => u.id === item.user_id)?.role ?? '',
                })}
              />
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}