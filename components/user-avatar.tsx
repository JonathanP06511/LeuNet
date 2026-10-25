import { cn } from '@/lib/utils';

interface UserAvatarProps {
  name: string;
  avatar?: string | null;
  className?: string;
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? '') + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase() || '?';
}

// Foto de perfil del usuario; si no tiene, muestra sus iniciales.
export function UserAvatar({ name, avatar, className }: UserAvatarProps) {
  return avatar ? (
    <img
      src={avatar}
      alt={`Foto de perfil de ${name}`}
      className={cn('h-8 w-8 shrink-0 rounded-full border-[0.5px] border-border object-cover', className)}
    />
  ) : (
    <span
      aria-hidden="true"
      className={cn(
        'flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary',
        className,
      )}
    >
      {initials(name)}
    </span>
  );
}
