'use client';

import type { ReactNode } from 'react';
import { Search, X } from 'lucide-react';
import { Input } from '@/components/ui/input';

// Normaliza el texto para buscar sin distinguir mayúsculas ni tildes.
export function normalizeSearch(value: string | null | undefined) {
  return (value ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();
}

// Verdadero si todas las palabras de la búsqueda aparecen en alguno de los textos indicados.
export function matchesSearch(query: string, fields: (string | null | undefined)[]) {
  const words = normalizeSearch(query).split(/\s+/).filter(Boolean);
  if (words.length === 0) return true;

  const haystack = fields.map(normalizeSearch).join(' ');
  return words.every((word) => haystack.includes(word));
}

interface TableSearchProps {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  // Controles extra al lado de la búsqueda, por ejemplo un filtro de estado.
  children?: ReactNode;
}

export function TableSearch({
  value,
  onChange,
  placeholder,
  children,
}: TableSearchProps) {
  return (
    <div className="mb-4 flex flex-wrap items-center gap-3">
      <div className="relative w-full sm:w-80">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="search"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          aria-label={placeholder}
          className="pl-9 pr-9 [&::-webkit-search-cancel-button]:hidden"
        />
        {value && (
          <button
            type="button"
            onClick={() => onChange('')}
            aria-label="Limpiar búsqueda"
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {children}
    </div>
  );
}
