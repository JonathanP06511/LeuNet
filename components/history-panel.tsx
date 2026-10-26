'use client';

import { useEffect, useState } from 'react';
import { ArrowLeft, History, RotateCcw, Target, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Spinner } from '@/components/ui/spinner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  deleteHistoryItem,
  getHistory,
  getHistoryImages,
  restoreHistoryItem,
  getStoredUser,
  type HistoryImages,
  type HistoryItem,
  type User,
} from '@/lib/api';
import { downloadAnalysisReport } from '@/lib/report-pdf';
import { useImageAspectRatio } from '@/lib/image-aspect';
import { PAGE_SIZE, TablePagination } from '@/components/table-pagination';

interface HistoryPanelProps {
  onBack: () => void;
}

function formatLabel(value: string | null | undefined) {
  if (!value) return 'No aplica';
  if (value === 'ALL' || value === 'Leukemia') return 'Célula con leucemia';
  if (value === 'Normal' || value === 'Benign') return 'Célula sana';
  return value;
}

function AnalysisImagesDialog({ item, onClose }: { item: HistoryItem | null; onClose: () => void }) {
  const [images, setImages] = useState<HistoryImages | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const imageRatio = useImageAspectRatio(images?.original_image);

  useEffect(() => {
    if (!item) return;

    let cancelled = false;
    setImages(null);
    setError(null);
    setLoading(true);

    getHistoryImages(item.id)
      .then((data) => {
        if (!cancelled) setImages(data);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'No se pudieron cargar las imágenes');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [item]);

  const isLeukemia = images?.model_prediction === 'Leukemia' || images?.model_prediction === 'ALL';
  const focusImage = isLeukemia ? images?.gradcam_focus_image : null;

  const panels = images
    ? [
        { title: 'Imagen analizada', src: images.original_image, focus: false },
        images.gradcam_heatmap && {
          title: 'Mapa de calor Grad-CAM',
          src: `data:image/png;base64,${images.gradcam_heatmap}`,
          focus: false,
        },
        focusImage
          ? { title: 'Región de mayor influencia', src: `data:image/png;base64,${focusImage}`, focus: true }
          : images.gradcam_image && {
              title: 'Grad-CAM sobre la imagen',
              src: `data:image/png;base64,${images.gradcam_image}`,
              focus: false,
            },
      ].filter((panel): panel is { title: string; src: string; focus: boolean } => Boolean(panel))
    : [];

  return (
    <Dialog open={item !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="inset-0 flex h-dvh w-screen max-w-none translate-x-0 translate-y-0 flex-col overflow-y-auto rounded-none border-0 sm:max-w-none sm:p-10">
        <DialogHeader>
          <DialogTitle>Resultado del análisis</DialogTitle>
          {item && (
            <DialogDescription>
              {new Date(item.created_at).toLocaleString()} · {formatLabel(item.model_prediction)} ·{' '}
              {Number(item.model_confidence || 0).toFixed(1)}% de confianza
            </DialogDescription>
          )}
        </DialogHeader>

        {loading ? (
          <div className="flex items-center gap-3 py-8 text-muted-foreground">
            <Spinner className="h-5 w-5" />
            Cargando imágenes...
          </div>
        ) : error ? (
          <p className="py-4 text-sm text-destructive">{error}</p>
        ) : (
          <div
            className="mx-auto my-auto grid w-full gap-6 md:grid-cols-3"
            style={{ maxWidth: `calc((100dvh - 14rem) * 3 * ${imageRatio ?? 1})` }}
          >
            {panels.map((panel) => (
              <div key={panel.title} className="space-y-2">
                <p className="flex items-center gap-1 text-sm font-medium text-foreground">
                  {panel.focus && <Target className="h-4 w-4 text-destructive" />}
                  {panel.title}
                </p>
                <img
                  src={panel.src}
                  alt={panel.title}
                  className="w-full rounded-lg border bg-background object-fill"
                  style={{ aspectRatio: imageRatio ?? 1 }}
                />
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

interface HistoryResultsTableProps<T extends HistoryItem> {
  items: T[];
  // Usuario que realizó cada análisis: se muestra en la columna "Usuario" y en el reporte PDF.
  getUser: (item: T) => User | null;
  // En el historial personal todos los análisis son del mismo usuario, así que la columna sobra.
  showUserColumn?: boolean;
  // Acción por fila del historial personal: eliminar (con confirmación) o restaurar.
  rowAction?: 'delete' | 'restore';
  onRowAction?: (item: T) => Promise<void>;
  // Historial general: marca los análisis que el usuario eliminó de su historial.
  showDeletedLabel?: boolean;
  emptyMessage?: string;
}

export function HistoryResultsTable<T extends HistoryItem>({
  items,
  getUser,
  showUserColumn = true,
  rowAction,
  onRowAction,
  showDeletedLabel = false,
  emptyMessage = 'Todavía no existen resultados guardados.',
}: HistoryResultsTableProps<T>) {
  const [selectedItem, setSelectedItem] = useState<HistoryItem | null>(null);
  const [confirmingId, setConfirmingId] = useState<number | null>(null);
  const [actingId, setActingId] = useState<number | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<number | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  useEffect(() => {
    setPage(1);
  }, [items]);

  const pageItems = items.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const handleDownload = async (item: T) => {
    setDownloadingId(item.id);
    setDownloadError(null);

    try {
      // Si el análisis es antiguo y no tiene imágenes guardadas, el reporte se genera sin la sección Grad-CAM.
      const images = await getHistoryImages(item.id).catch(() => null);
      const isLeukemia = item.model_prediction === 'Leukemia' || item.model_prediction === 'ALL';

      await downloadAnalysisReport({
        result: {
          predicted_class: isLeukemia ? 'Leukemia' : 'Benign',
          confidence: Number(item.model_confidence || 0),
          probabilities: {
            Benign: Number(item.probability_normal || 0),
            Leukemia: Number(item.probability_all || 0),
          },
          model_name: 'EfficientNet-B3',
          input_size: '',
          gradcam_heatmap: images?.gradcam_heatmap ?? null,
          gradcam_image: images?.gradcam_image ?? null,
          gradcam_focus_image: images?.gradcam_focus_image ?? null,
        },
        uploadedImage: images?.original_image ?? null,
        analyst: getUser(item),
      });
    } catch {
      setDownloadError('No se pudo generar el reporte. Intente nuevamente.');
    } finally {
      setDownloadingId(null);
    }
  };

  const runRowAction = async (item: T) => {
    if (!onRowAction) return;
    setActingId(item.id);
    setActionError(null);

    try {
      await onRowAction(item);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'No se pudo completar la acción');
    } finally {
      setActingId(null);
      setConfirmingId(null);
    }
  };

  if (items.length === 0) {
    return <p className="text-sm text-muted-foreground">{emptyMessage}</p>;
  }

  return (
    <div className="overflow-x-auto">
      {(downloadError || actionError) && (
        <p className="mb-3 text-sm text-destructive">{downloadError || actionError}</p>
      )}
      <table className="w-full min-w-[620px] text-sm">
        <thead className="border-b text-left text-muted-foreground">
          <tr>
            <th className="py-3 pr-4">Fecha</th>
            {showUserColumn && <th className="py-3 pr-4">Usuario</th>}
            <th className="py-3 pr-4">Predicción IA</th>
            <th className="py-3 pr-4">Confianza</th>
            <th className="py-3 pr-4">Resultado</th>
            {rowAction && (
              <th className="w-12 py-3">
                <span className="sr-only">Acciones</span>
              </th>
            )}
          </tr>
        </thead>

        <tbody>
          {pageItems.map((item) => (
            <tr key={item.id} className="border-b last:border-0">
              <td className="py-3 pr-4">
                {new Date(item.created_at).toLocaleString()}
              </td>

              {showUserColumn && (
                <td className="py-3 pr-4">
                  {getUser(item)?.name}
                </td>
              )}

              <td className="py-3 pr-4 font-medium">
                {formatLabel(item.model_prediction)}
              </td>

              <td className="py-3 pr-4">
                {Number(item.model_confidence || 0).toFixed(1)}%
              </td>

              <td className="py-3 pr-4">
                {confirmingId === item.id ? (
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="text-foreground">¿Eliminar este análisis?</span>
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 font-medium text-destructive underline-offset-4 hover:underline disabled:opacity-60"
                      onClick={() => runRowAction(item)}
                      disabled={actingId !== null}
                    >
                      {actingId === item.id && <Spinner className="h-3.5 w-3.5" />}
                      Confirmar
                    </button>
                    <button
                      type="button"
                      className="text-muted-foreground underline-offset-4 hover:underline"
                      onClick={() => setConfirmingId(null)}
                      disabled={actingId !== null}
                    >
                      Cancelar
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-wrap items-center gap-4">
                    {item.difficulty === 'uploaded' ? (
                      <>
                        <button
                          type="button"
                          className="font-medium text-primary underline-offset-4 hover:underline"
                          onClick={() => setSelectedItem(item)}
                        >
                          Ver análisis
                        </button>
                        <button
                          type="button"
                          className="inline-flex items-center gap-1 font-medium text-primary underline-offset-4 hover:underline disabled:opacity-60"
                          onClick={() => handleDownload(item)}
                          disabled={downloadingId !== null}
                        >
                          {downloadingId === item.id && <Spinner className="h-3.5 w-3.5" />}
                          Descargar
                        </button>
                      </>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}

                    {showDeletedLabel && item.deleted_at && (
                      <span className="inline-flex rounded-md bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                        Eliminado por el usuario
                      </span>
                    )}
                  </div>
                )}
              </td>

              {rowAction && (
                <td className="py-3 text-right">
                  {confirmingId !== item.id &&
                    (actingId === item.id ? (
                      <Spinner className="ml-auto h-4 w-4" />
                    ) : rowAction === 'delete' ? (
                      <button
                        type="button"
                        title="Eliminar"
                        aria-label="Eliminar análisis"
                        className="rounded-md p-1.5 text-muted-foreground/60 transition-colors hover:bg-destructive/10 hover:text-destructive disabled:opacity-40"
                        onClick={() => setConfirmingId(item.id)}
                        disabled={actingId !== null}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    ) : (
                      <button
                        type="button"
                        title="Restaurar"
                        aria-label="Restaurar análisis"
                        className="rounded-md p-1.5 text-muted-foreground/60 transition-colors hover:bg-primary/10 hover:text-primary disabled:opacity-40"
                        onClick={() => runRowAction(item)}
                        disabled={actingId !== null}
                      >
                        <RotateCcw className="h-4 w-4" />
                      </button>
                    ))}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>

      <TablePagination page={page} totalItems={items.length} onPageChange={setPage} />

      <AnalysisImagesDialog item={selectedItem} onClose={() => setSelectedItem(null)} />
    </div>
  );
}

export function HistoryPanel({ onBack }: HistoryPanelProps) {
  const [items, setItems] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [tab, setTab] = useState<'active' | 'deleted'>('active');
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      setCurrentUser(getStoredUser());

      try {
        setItems(await getHistory(tab === 'deleted'));
      } catch (err) {
        setError(err instanceof Error ? err.message : 'No se pudo cargar el historial');
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [tab]);

  const changeTab = (next: 'active' | 'deleted') => {
    setNotice(null);
    setTab(next);
  };

  const handleRowAction = async (item: HistoryItem) => {
    if (tab === 'active') {
      await deleteHistoryItem(item.id);
      setNotice('El análisis se eliminó de tu historial. Puedes restaurarlo desde "Eliminados".');
    } else {
      await restoreHistoryItem(item.id);
      setNotice('El análisis se restauró en tu historial.');
    }
    setItems((current) => current.filter((entry) => entry.id !== item.id));
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="outline" size="sm" onClick={onBack} className="gap-2">
          <ArrowLeft className="h-4 w-4" />
          Volver
        </Button>

        <div>
          <h2 className="text-xl font-semibold">Historial</h2>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="h-5 w-5 text-primary" />
            Resultados recientes
          </CardTitle>

          <CardDescription>
            Historial de análisis hematológico.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="inline-flex rounded-lg border p-1 text-sm" role="tablist">
            {([
              ['active', 'Mis análisis'],
              ['deleted', 'Eliminados'],
            ] as const).map(([value, label]) => (
              <button
                key={value}
                type="button"
                role="tab"
                aria-selected={tab === value}
                onClick={() => changeTab(value)}
                className={`rounded-md px-3 py-1.5 font-medium transition-colors ${
                  tab === value ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {notice && <p className="text-sm text-green-700 dark:text-green-400">{notice}</p>}

          {loading ? (
            <div className="flex items-center gap-3 py-8 text-muted-foreground">
              <Spinner className="h-5 w-5" />
              Cargando historial...
            </div>
          ) : error ? (
            <p className="text-sm text-destructive">{error}</p>
          ) : (
            <HistoryResultsTable
              items={items}
              getUser={() => currentUser}
              showUserColumn={false}
              rowAction={tab === 'active' ? 'delete' : 'restore'}
              onRowAction={handleRowAction}
              emptyMessage={tab === 'active' ? 'Todavía no existen resultados guardados.' : 'No tienes análisis eliminados.'}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
