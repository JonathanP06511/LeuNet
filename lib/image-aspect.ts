import { useEffect, useState } from 'react';

// Proporción (ancho / alto) de una imagen. Las imágenes de Grad-CAM se generan a 300x300
// (la foto estirada a un cuadrado); mostrarlas con la proporción de la foto original
// devuelve las células a su forma real y las alinea con la imagen analizada.
export function loadImageAspectRatio(src: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img.naturalWidth / img.naturalHeight || 1);
    img.onerror = () => reject(new Error('No se pudo leer la imagen'));
    img.src = src;
  });
}

export function useImageAspectRatio(src: string | null | undefined): number | null {
  const [ratio, setRatio] = useState<number | null>(null);

  useEffect(() => {
    setRatio(null);
    if (!src) return;

    let cancelled = false;
    loadImageAspectRatio(src)
      .then((value) => {
        if (!cancelled) setRatio(value);
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, [src]);

  return ratio;
}
