import { supabase } from '../supabase.js';

// Compress to JPEG, return a Blob
export function compressImage(file, maxDim = 1200, quality = 0.78) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
        const c = document.createElement('canvas');
        c.width  = Math.round(img.width  * scale);
        c.height = Math.round(img.height * scale);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        c.toBlob(b => (b ? resolve(b) : reject(new Error('Compression failed'))), 'image/jpeg', quality);
      };
      img.onerror = reject;
      img.src = e.target.result;
    };
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

// Upload to Supabase Storage and return the public URL
export async function uploadImage(file, prefix = 'recipes') {
  if (!file) return null;
  const blob = file instanceof Blob && file.type.startsWith('image/') ? await compressImage(file) : file;
  if (!(blob instanceof Blob)) {
    console.error('uploadImage: not a Blob', blob);
    throw new Error('Invalid image data');
  }

  const ext = 'jpg';
  const path = `${prefix}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

  const { error } = await supabase.storage
    .from('recipe-images')
    .upload(path, blob, { contentType: 'image/jpeg', upsert: false });
  if (error) throw error;

  const { data } = supabase.storage.from('recipe-images').getPublicUrl(path);
  return data.publicUrl;
}

// Resolve an image value to a public URL string.
// Accepts:
//   - null/undefined   → null
//   - string           → returned as-is (already a URL)
//   - File/Blob        → upload, return URL
//   - {file, preview}  → upload file, return URL (this is what ImageUpload produces)
export async function resolveImage(src, prefix) {
  if (!src) return null;
  if (typeof src === 'string') return src;
  if (src instanceof Blob) return await uploadImage(src, prefix);
  if (src && typeof src === 'object' && src.file instanceof Blob) {
    return await uploadImage(src.file, prefix);
  }
  console.warn('resolveImage: unknown image format', src);
  return null;
}
