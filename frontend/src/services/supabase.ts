import { createClient } from '@supabase/supabase-js';

export const SUPABASE_PROJECT_URL =
  process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://hnbvhkvxtxyzlzohyeik.supabase.co';

export const SUPABASE_ANON_KEY =
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhuYnZoa3Z4dHh5emx6b2h5ZWlrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzA5Nzg0MDAsImV4cCI6MjA0NjU1NDQwMH0.dummy_public_anon_key';

export const BUCKET_NAME = 'post-images';

export const supabase = createClient(SUPABASE_PROJECT_URL, SUPABASE_ANON_KEY);

/**
 * Pure JS Base64 to Uint8Array converter safe for React Native (Hermes & JSC)
 */
function decodeBase64ToUint8Array(base64String: string): Uint8Array {
  const clean = base64String.replace(/^data:image\/\w+;base64,/, '').replace(/\s/g, '');

  if (typeof atob === 'function') {
    const binary = atob(clean);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  }

  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  let bufferLength = Math.floor(clean.length * 0.75);
  if (clean.endsWith('==')) bufferLength -= 2;
  else if (clean.endsWith('=')) bufferLength -= 1;

  const bytes = new Uint8Array(bufferLength);
  let p = 0;
  for (let i = 0; i < clean.length; i += 4) {
    const enc1 = chars.indexOf(clean[i]);
    const enc2 = chars.indexOf(clean[i + 1]);
    const enc3 = chars.indexOf(clean[i + 2]);
    const enc4 = chars.indexOf(clean[i + 3]);

    if (enc1 >= 0 && enc2 >= 0) {
      bytes[p++] = (enc1 << 2) | (enc2 >> 4);
      if (enc3 >= 0 && p < bufferLength) {
        bytes[p++] = ((enc2 & 15) << 4) | (enc3 >> 2);
        if (enc4 >= 0 && p < bufferLength) {
          bytes[p++] = ((enc3 & 3) << 6) | enc4;
        }
      }
    }
  }
  return bytes;
}

/**
 * Uploads an image to Supabase Storage bucket 'post-images' and returns the public CDN URL.
 * Gracefully falls back to formatted data URL if storage upload encounters an issue.
 */
export async function uploadPostImageToSupabase(
  imageUri: string,
  imageBase64?: string | null
): Promise<string> {
  const fileExt = imageUri.toLowerCase().endsWith('.png') ? 'png' : 'jpg';
  const fileName = `drops/${Date.now()}_${Math.random().toString(36).substring(2, 9)}.${fileExt}`;

  try {
    let fileBody: Uint8Array | Blob;

    if (imageBase64) {
      fileBody = decodeBase64ToUint8Array(imageBase64);
    } else {
      // In React Native / Web fetch URI to Blob
      const response = await fetch(imageUri);
      fileBody = await response.blob();
    }

    const { data, error } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(fileName, fileBody, {
        contentType: fileExt === 'png' ? 'image/png' : 'image/jpeg',
        upsert: true,
      });

    if (error) {
      console.warn('[Supabase Storage] Notice during upload:', error.message);
      // Fallback: return data URI or imageUri so publishing proceeds seamlessly
      if (imageBase64) {
        return `data:image/${fileExt};base64,${imageBase64}`;
      }
      return imageUri;
    }

    // Retrieve public CDN URL
    const { data: publicData } = supabase.storage
      .from(BUCKET_NAME)
      .getPublicUrl(data?.path || fileName);

    if (publicData?.publicUrl) {
      return publicData.publicUrl;
    }
  } catch (uploadErr) {
    console.warn('[Supabase Storage] Upload fallback engaged:', uploadErr);
  }

  // Graceful fallback
  if (imageBase64) {
    return `data:image/${fileExt};base64,${imageBase64}`;
  }
  return imageUri;
}

