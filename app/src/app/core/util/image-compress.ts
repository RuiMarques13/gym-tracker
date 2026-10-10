/**
 * Reduz uma foto para caber numa linha da base e no sync: lado maior 900 px, JPEG qualidade 0,62
 * (≈ 60–90 KB). Respeita a orientação EXIF (createImageBitmap com imageOrientation 'from-image').
 */
export async function compressImage(file: Blob, maxSide = 900, quality = 0.62): Promise<string> {
  const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' });
  try {
    const scale = Math.min(1, maxSide / Math.max(bmp.width, bmp.height));
    const w = Math.max(1, Math.round(bmp.width * scale));
    const h = Math.max(1, Math.round(bmp.height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Não foi possível processar a imagem.');
    ctx.drawImage(bmp, 0, 0, w, h);
    return canvas.toDataURL('image/jpeg', quality);
  } finally {
    bmp.close();
  }
}
