/**
 * Resize an image file to a square JPEG data URL using a canvas.
 *
 *  - Center-crops the image to a square (so portrait/landscape both work)
 *  - Resizes down to `size` x `size` pixels (default 256)
 *  - Re-encodes as JPEG at the given quality
 *
 * Returns a Promise<string> resolving to `data:image/jpeg;base64,...`.
 *
 * Throws if the file isn't a recognizable image. Does *not* upload — the
 * caller is responsible for sending the resulting data URL to the API.
 */
export async function resizeImageToSquareDataUrl(file, { size = 256, quality = 0.85 } = {}) {
  if (!file) throw new Error('No file provided');
  if (!/^image\//.test(file.type)) {
    throw new Error('Please choose an image file (PNG, JPG, GIF, or WEBP).');
  }

  // Read the file into an HTMLImageElement via an object URL. This works
  // across browsers without needing the (still flaky) createImageBitmap fall
  // through path.
  const objectUrl = URL.createObjectURL(file);
  try {
    const img = await new Promise((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('Could not decode image. Try a different file.'));
      el.src = objectUrl;
    });

    const minSide = Math.min(img.naturalWidth, img.naturalHeight);
    const sx = (img.naturalWidth - minSide) / 2;
    const sy = (img.naturalHeight - minSide) / 2;

    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas not supported in this browser');
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, sx, sy, minSide, minSide, 0, 0, size, size);

    return canvas.toDataURL('image/jpeg', quality);
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}
