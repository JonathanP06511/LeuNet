'use client';

import { useMemo, useState } from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { ActivityItem, AdminUser } from '@/lib/api';

const DAYS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
const DAY_SHORT = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
const HOURS = Array.from({ length: 24 }, (_, hour) => hour);

// Rampa secuencial de un solo tono (azul), validada en claro y oscuro.
// En modo oscuro se invierte: los tonos oscuros se funden con la superficie y los claros indican más actividad.
const LEVEL_CLASSES = [
  'bg-muted',
  'bg-[#86b6ef] dark:bg-[#184f95]',
  'bg-[#3987e5] dark:bg-[#256abf]',
  'bg-[#256abf] dark:bg-[#3987e5]',
  'bg-[#104281] dark:bg-[#86b6ef]',
];

const PERIODS = [
  { value: 'all', label: 'Todo el tiempo' },
  { value: '7', label: 'Últimos 7 días' },
  { value: '30', label: 'Últimos 30 días' },
  { value: '90', label: 'Últimos 90 días' },
  { value: 'year', label: 'Este año' },
] as const;

type Period = (typeof PERIODS)[number]['value'];

function periodStart(period: Period): Date | null {
  const now = new Date();
  if (period === 'all') return null;
  if (period === 'year') return new Date(now.getFullYear(), 0, 1);
  const start = new Date(now);
  start.setDate(start.getDate() - Number(period));
  return start;
}

interface ActivityHeatmapProps {
  items: ActivityItem[];
  users: AdminUser[];
}

function formatHourRange(hour: number) {
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${pad(hour)}:00–${pad((hour + 1) % 24)}:00`;
}

function countLabel(count: number) {
  return `${count} análisis`;
}

export function ActivityHeatmap({ items, users }: ActivityHeatmapProps) {
  const [hovered, setHovered] = useState<{ day: number; hour: number; x: number; y: number } | null>(null);
  const [period, setPeriod] = useState<Period>('all');
  const [userId, setUserId] = useState('all');

  const { grid, max, total, peakDay, peakHour } = useMemo(() => {
    const start = periodStart(period);
    const counts = DAYS.map(() => HOURS.map(() => 0));
    let total = 0;
    for (const item of items) {
      if (userId !== 'all' && String(item.user_id) !== userId) continue;
      const date = new Date(item.created_at);
      if (Number.isNaN(date.getTime())) continue;
      if (start && date < start) continue;
      total += 1;
      // getDay() empieza en domingo; se reordena para que la semana empiece en lunes.
      counts[(date.getDay() + 6) % 7][date.getHours()] += 1;
    }

    const dayTotals = counts.map((row) => row.reduce((sum, count) => sum + count, 0));
    const hourTotals = HOURS.map((hour) => counts.reduce((sum, row) => sum + row[hour], 0));

    return {
      grid: counts,
      total,
      max: Math.max(0, ...counts.flat()),
      peakDay: dayTotals.indexOf(Math.max(...dayTotals)),
      peakHour: hourTotals.indexOf(Math.max(...hourTotals)),
    };
  }, [items, period, userId]);

  const isFiltered = period !== 'all' || userId !== 'all';

  // Escala logarítmica: una hora con muchos análisis no aplana al resto, y se distingue 1 de 5 o de 10.
  const levelFor = (count: number) =>
    count === 0 || max === 0 ? 0 : Math.min(4, Math.max(1, Math.ceil((Math.log(count + 1) / Math.log(max + 1)) * 4)));

  return (
    <div className="rounded-[12px] border-[0.5px] border-border bg-card p-6 text-card-foreground">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-semibold">Actividad por día y hora</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Análisis de imágenes según el día de la semana y la hora en que se realizaron.
          </p>
        </div>
        {max > 0 && (
          <p className="text-sm text-muted-foreground">
            <span className="font-medium text-foreground">{countLabel(total)}</span>
            {' · '}
            Día con más actividad: <span className="font-medium text-foreground">{DAYS[peakDay]}</span>
            {' · '}
            Hora pico: <span className="font-medium text-foreground">{formatHourRange(peakHour)}</span>
          </p>
        )}
      </div>

      <div className="mb-5 flex flex-wrap items-center gap-3">
        <Select value={period} onValueChange={(value) => setPeriod(value as Period)}>
          <SelectTrigger size="sm" aria-label="Periodo" className="min-w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PERIODS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={userId} onValueChange={setUserId}>
          <SelectTrigger size="sm" aria-label="Usuario" className="min-w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los usuarios</SelectItem>
            {users.map((user) => (
              <SelectItem key={user.id} value={String(user.id)}>
                {user.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {isFiltered && (
          <button
            type="button"
            className="text-sm text-primary underline-offset-4 hover:underline"
            onClick={() => {
              setPeriod('all');
              setUserId('all');
            }}
          >
            Quitar filtros
          </button>
        )}
      </div>

      {max === 0 ? (
        <p className="text-sm text-muted-foreground">
          {isFiltered ? 'No hay análisis con estos filtros.' : 'Todavía no hay análisis registrados.'}
        </p>
      ) : (
        <div className="relative" onMouseLeave={() => setHovered(null)}>
          <div
            role="grid"
            aria-label="Mapa de calor de análisis por día de la semana y hora"
            className="grid gap-[2px]"
            style={{ gridTemplateColumns: '2.5rem repeat(24, minmax(0, 1fr))' }}
          >
            {grid.map((row, day) => (
              <div key={DAYS[day]} role="row" className="contents">
                <div role="rowheader" className="flex items-center pr-2 text-xs text-muted-foreground">
                  {DAY_SHORT[day]}
                </div>
                {row.map((count, hour) => (
                  <div
                    key={hour}
                    role="gridcell"
                    aria-label={`${DAYS[day]}, ${formatHourRange(hour)}: ${countLabel(count)}`}
                    className={`h-5 rounded-[3px] ${LEVEL_CLASSES[levelFor(count)]} ${
                      hovered?.day === day && hovered.hour === hour ? 'ring-2 ring-foreground/60' : ''
                    }`}
                    onMouseEnter={(event) => {
                      const cell = event.currentTarget.getBoundingClientRect();
                      const parent = event.currentTarget.closest('.relative')!.getBoundingClientRect();
                      setHovered({ day, hour, x: cell.left - parent.left + cell.width / 2, y: cell.top - parent.top });
                    }}
                  />
                ))}
              </div>
            ))}

            <div />
            {HOURS.map((hour) => (
              <div key={hour} className="pt-1 text-center text-[11px] text-muted-foreground">
                {hour % 3 === 0 ? String(hour).padStart(2, '0') : ''}
              </div>
            ))}
          </div>

          {hovered && (
            <div
              className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-md border-[0.5px] border-border bg-popover px-2.5 py-1.5 text-xs text-popover-foreground shadow-sm"
              style={{ left: hovered.x, top: hovered.y - 6 }}
            >
              <p className="font-medium">
                {DAYS[hovered.day]}, {formatHourRange(hovered.hour)}
              </p>
              <p className="text-muted-foreground">{countLabel(grid[hovered.day][hovered.hour])}</p>
            </div>
          )}

          <div className="mt-4 flex items-center justify-end gap-1.5 text-xs text-muted-foreground">
            <span className="mr-1">Menos</span>
            {LEVEL_CLASSES.map((classes) => (
              <span key={classes} className={`h-3 w-3 rounded-[3px] ${classes}`} />
            ))}
            <span className="ml-1">Más</span>
          </div>
        </div>
      )}
    </div>
  );
}
