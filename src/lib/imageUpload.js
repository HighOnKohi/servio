import { supabase } from './supabaseClient';

export const MENU_IMAGES_BUCKET = 'menu-items';

/**
 * Compresses an image file using an HTML5 Canvas.
 * Resizes the image to fit within maxWidth / maxHeight while maintaining aspect ratio,
 * and encodes it as JPEG or WebP to keep payloads small and fast.
 *
 * @param {File|Blob} file The image file to compress
 * @param {number} maxWidth Maximum width (default 800px)
 * @param {number} maxHeight Maximum height (default 800px)
 * @param {number} quality Compression quality 0.0 - 1.0 (default 0.82)
 * @returns {Promise<{ blob: Blob, dataUrl: string }>}
 */
export async function compressImage(file, maxWidth = 800, maxHeight = 800, quality = 0.82) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (readerEvent) => {
      const img = new Image();
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);

        const mimeType = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
        const dataUrl = canvas.toDataURL(mimeType, quality);

        canvas.toBlob(
          (blob) => {
            if (blob) {
              resolve({ blob, dataUrl });
            } else {
              resolve({ blob: file, dataUrl });
            }
          },
          mimeType,
          quality
        );
      };
      img.onerror = (err) => reject(err);
      img.src = readerEvent.target.result;
    };
    reader.onerror = (err) => reject(err);
    reader.readAsDataURL(file);
  });
}

/**
 * Uploads a menu item image.
 *
 * 1. Optimizes/compresses the image client-side.
 * 2. Attempts to upload the compressed blob to the Supabase Storage bucket ('menu-items').
 * 3. On success, retrieves and returns the public URL.
 * 4. On failure (e.g. storage bucket not created or RLS policy not set), automatically
 *    falls back to the compressed base64 Data URL, ensuring images are stored and viewable immediately.
 *
 * @param {File|Blob|string} imageFile The image to upload
 * @returns {Promise<string>} The public URL or base64 data URL
 */
export async function uploadMenuItemImage(imageFile) {
  if (!imageFile) return null;

  // If already a URL string, return directly
  if (typeof imageFile === 'string') {
    return imageFile;
  }

  // Compress first for fast rendering and minimal bandwidth
  let compressedBlob = imageFile;
  let fallbackDataUrl = '';
  try {
    const compressed = await compressImage(imageFile, 800, 800, 0.82);
    compressedBlob = compressed.blob;
    fallbackDataUrl = compressed.dataUrl;
  } catch (err) {
    console.warn('Image compression failed, using original file:', err);
  }

  // Try uploading to Supabase Storage
  try {
    const rawExt = imageFile.name ? imageFile.name.split('.').pop().toLowerCase() : 'jpg';
    const ext = ['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(rawExt) ? rawExt : 'jpg';
    const uniqueId = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 9);
    const fileName = `item_${Date.now()}_${uniqueId}.${ext}`;

    const { data: uploadData, error: uploadError } = await supabase.storage
      .from(MENU_IMAGES_BUCKET)
      .upload(fileName, compressedBlob, {
        contentType: compressedBlob.type || 'image/jpeg',
        upsert: true,
      });

    if (uploadError) {
      console.warn(
        `Supabase storage upload failed (${uploadError.message}). Falling back to compressed Data URL.`
      );
      return fallbackDataUrl || null;
    }

    // Get public URL
    const { data: publicUrlData } = supabase.storage
      .from(MENU_IMAGES_BUCKET)
      .getPublicUrl(uploadData.path || fileName);

    if (publicUrlData?.publicUrl) {
      return publicUrlData.publicUrl;
    }

    return fallbackDataUrl || null;
  } catch (err) {
    console.warn('Supabase storage unexpected error, using Data URL fallback:', err);
    return fallbackDataUrl || null;
  }
}
