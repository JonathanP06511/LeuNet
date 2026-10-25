const AVATAR_SIZE = 256;
export const AVATAR_MAX_FILE_MB = 5;
const AVATAR_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

// Devuelve el mensaje de error si el archivo no sirve como foto de perfil.
export function avatarFileError(file: File): string | null {
  if (!AVATAR_TYPES.includes(file.type)) {
    return 'La foto de perfil debe ser una imagen JPG, PNG o WEBP.';
  }
  if (file.size > AVATAR_MAX_FILE_MB * 1024 * 1024) {
    return `La foto de perfil no debe superar los ${AVATAR_MAX_FILE_MB} MB.`;
  }
  return null;
}

// Recorta la foto al centro en un cuadrado y la reduce a 256x256 para que pese poco.
export function resizeAvatar(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const side = Math.min(img.naturalWidth, img.naturalHeight);
      const canvas = document.createElement('canvas');
      canvas.width = AVATAR_SIZE;
      canvas.height = AVATAR_SIZE;
      const ctx = canvas.getContext('2d');
      URL.revokeObjectURL(url);
      if (!ctx) return reject(new Error('No se pudo procesar la imagen'));
      ctx.drawImage(
        img,
        (img.naturalWidth - side) / 2,
        (img.naturalHeight - side) / 2,
        side,
        side,
        0,
        0,
        AVATAR_SIZE,
        AVATAR_SIZE,
      );
      resolve(canvas.toDataURL('image/jpeg', 0.85));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('No se pudo leer la imagen'));
    };
    img.src = url;
  });
}
