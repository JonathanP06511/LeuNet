'use client';

import { useState, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { PAGE_SIZE, TablePagination } from '@/components/table-pagination';
import { UserAvatar } from '@/components/user-avatar';
import { updateUserActive, updateUserRole, type AdminUser } from '@/lib/api';

type UserAction = 'role' | 'active';

interface AdminUsersTableProps {
  users: AdminUser[];
  currentUserId: number | null;
  onUserUpdated: (user: AdminUser) => void;
}

function formatDate(value: string | null) {
  if (!value) return null;
  return new Date(value).toLocaleDateString('es-EC', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function RoleBadge({ role }: { role: string }) {
  return (
    <span className="inline-flex rounded-md border-[0.5px] border-foreground/25 px-2 py-0.5 text-xs font-medium text-foreground">
      {role}
    </span>
  );
}

function StatusBadge({ active }: { active: boolean }) {
  return active ? (
    <span className="inline-flex rounded-md bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800 dark:bg-green-500/15 dark:text-green-400">
      Activo
    </span>
  ) : (
    <span className="inline-flex rounded-md bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
      Inactivo
    </span>
  );
}

function DetailBlock({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-[12px] border-[0.5px] border-border p-4">
      <h3 className="mb-3 text-sm font-medium text-foreground">{title}</h3>
      {children}
    </section>
  );
}

function DetailRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 py-1.5 text-sm">
      <span className="text-muted-foreground">{label}</span>
      {children}
    </div>
  );
}

export function AdminUsersTable({ users, currentUserId, onUserUpdated }: AdminUsersTableProps) {
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [pendingAction, setPendingAction] = useState<UserAction | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const pageUsers = users.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  // Se busca en la lista para que el panel refleje los cambios de rol o estado al instante.
  const selectedUser = users.find((user) => user.id === selectedId) ?? null;
  const isOwnAccount = selectedUser?.id === currentUserId;

  const openDetails = (user: AdminUser) => {
    setSelectedId(user.id);
    setPendingAction(null);
    setMessage(null);
  };

  const closeDetails = () => {
    setSelectedId(null);
    setPendingAction(null);
    setMessage(null);
  };

  const runAction = async (user: AdminUser, action: UserAction) => {
    setSaving(true);
    setMessage(null);

    try {
      if (action === 'role') {
        const role = user.role === 'ADMIN' ? 'USER' : 'ADMIN';
        await updateUserRole(user.id, role);
        onUserUpdated({ ...user, role });
        setMessage({ type: 'success', text: `Rol cambiado a ${role}.` });
      } else {
        const active = !user.active;
        await updateUserActive(user.id, active);
        onUserUpdated({ ...user, active: active ? 1 : 0 });
        setMessage({ type: 'success', text: active ? 'Cuenta activada.' : 'Cuenta desactivada.' });
      }
    } catch (err) {
      setMessage({ type: 'error', text: err instanceof Error ? err.message : 'No se pudo completar la acción' });
    } finally {
      setSaving(false);
      setPendingAction(null);
    }
  };

  return (
    <div className="rounded-[12px] border-[0.5px] border-border bg-card p-6 text-card-foreground">
      <div className="mb-4">
        <h2 className="font-semibold">Usuarios</h2>
        <p className="mt-1 text-sm text-muted-foreground">Listado de cuentas registradas.</p>
      </div>

      <table className="w-full table-fixed text-sm">
        <colgroup>
          <col className="w-[19%]" />
          <col className="w-[25%]" />
          <col className="w-[10%]" />
          <col className="w-[11%]" />
          <col className="w-[9%]" />
          <col className="w-[14%]" />
          <col className="w-[12%]" />
        </colgroup>
        <thead className="border-b border-border text-left">
          <tr className="font-medium text-muted-foreground">
            <th className="py-3 pr-4 font-medium">Nombre</th>
            <th className="py-3 pr-4 font-medium">Correo</th>
            <th className="py-3 pr-4 font-medium">Rol</th>
            <th className="py-3 pr-4 font-medium">Estado</th>
            <th className="py-3 pr-4 font-medium">Análisis</th>
            <th className="py-3 pr-4 font-medium">Última actividad</th>
            <th className="py-3 font-medium">Acción</th>
          </tr>
        </thead>

        <tbody>
          {pageUsers.map((user) => (
            <tr key={user.id} className="border-b border-border last:border-0">
              <td className="truncate py-3 pr-4 font-medium" title={user.name}>
                {user.name}
              </td>
              <td className="truncate py-3 pr-4" title={user.email}>
                {user.email}
              </td>
              <td className="py-3 pr-4">
                <RoleBadge role={user.role} />
              </td>
              <td className="py-3 pr-4">
                <StatusBadge active={Boolean(user.active)} />
              </td>
              <td className="py-3 pr-4">{user.analysis_count}</td>
              <td className="truncate py-3 pr-4 text-muted-foreground">
                {formatDate(user.last_analysis_at) ?? 'Sin actividad'}
              </td>
              <td className="py-3">
                <button
                  type="button"
                  className="whitespace-nowrap text-primary underline-offset-4 hover:underline"
                  onClick={() => openDetails(user)}
                >
                  Ver detalles →
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <TablePagination page={page} totalItems={users.length} onPageChange={setPage} />

      <Sheet open={selectedUser !== null} onOpenChange={(open) => !open && closeDetails()}>
        <SheetContent side="right" className="w-full gap-0 sm:max-w-md">
          {selectedUser && (
            <>
              <SheetHeader className="flex-row items-center gap-3 border-b border-border p-6 pr-12">
                <UserAvatar name={selectedUser.name} avatar={selectedUser.avatar} className="h-12 w-12 text-sm" />
                <div className="min-w-0 space-y-1">
                  <SheetTitle className="truncate">{selectedUser.name}</SheetTitle>
                  <SheetDescription className="truncate">{selectedUser.email}</SheetDescription>
                </div>
              </SheetHeader>

              <div className="flex-1 space-y-4 overflow-y-auto p-6">
                <DetailBlock title="Cuenta">
                  <DetailRow label="Rol">
                    <RoleBadge role={selectedUser.role} />
                  </DetailRow>
                  <DetailRow label="Estado">
                    <StatusBadge active={Boolean(selectedUser.active)} />
                  </DetailRow>
                  <DetailRow label="Correo">
                    {selectedUser.email_verified === 0 ? (
                      <span className="inline-flex rounded-md bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-500/15 dark:text-amber-400">
                        Sin verificar
                      </span>
                    ) : (
                      <span className="text-sm">Verificado</span>
                    )}
                  </DetailRow>
                  <DetailRow label="Fecha de creación">
                    <span>{formatDate(selectedUser.created_at)}</span>
                  </DetailRow>
                </DetailBlock>

                <DetailBlock title="Resultados">
                  {selectedUser.analysis_count > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      <span className="inline-flex rounded-md border-[0.5px] border-destructive/30 bg-destructive/5 px-2 py-0.5 text-xs font-medium text-destructive">
                        {selectedUser.leukemia_count} con LLA
                      </span>
                      <span className="inline-flex rounded-md border-[0.5px] border-primary/30 bg-primary/5 px-2 py-0.5 text-xs font-medium text-primary">
                        {selectedUser.benign_count} sin indicios
                      </span>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">Sin análisis registrados.</p>
                  )}
                </DetailBlock>

                {message && (
                  <p className={`text-sm ${message.type === 'error' ? 'text-destructive' : 'text-green-700 dark:text-green-400'}`}>
                    {message.text}
                  </p>
                )}
              </div>

              <SheetFooter className="border-t border-border p-6">
                {isOwnAccount ? (
                  <p className="text-sm text-muted-foreground">No puedes modificar tu propia cuenta.</p>
                ) : pendingAction ? (
                  <div className="space-y-3">
                    <p className="text-sm">
                      {pendingAction === 'role'
                        ? `¿Cambiar el rol de ${selectedUser.name} a ${selectedUser.role === 'ADMIN' ? 'USER' : 'ADMIN'}?`
                        : selectedUser.active
                          ? `¿Desactivar la cuenta de ${selectedUser.name}? No podrá iniciar sesión.`
                          : `¿Activar la cuenta de ${selectedUser.name}?`}
                    </p>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant={pendingAction === 'active' && selectedUser.active ? 'destructive' : 'default'}
                        disabled={saving}
                        onClick={() => runAction(selectedUser, pendingAction)}
                        className="gap-2"
                      >
                        {saving && <Spinner className="h-3.5 w-3.5" />}
                        Confirmar
                      </Button>
                      <Button size="sm" variant="ghost" disabled={saving} onClick={() => setPendingAction(null)}>
                        Cancelar
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    <Button variant="outline" size="sm" onClick={() => setPendingAction('role')}>
                      Cambiar rol
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className={selectedUser.active ? 'text-destructive hover:text-destructive' : undefined}
                      onClick={() => setPendingAction('active')}
                    >
                      {selectedUser.active ? 'Desactivar cuenta' : 'Activar cuenta'}
                    </Button>
                  </div>
                )}
              </SheetFooter>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
