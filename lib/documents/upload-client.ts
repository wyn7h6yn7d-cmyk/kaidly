import { createClient } from "@/lib/supabase/client";
import { getSupabaseEnv } from "@/lib/env";
import { extensionOf, isAllowedMimeType } from "./rules";

// Browser-only helpers for the upload flow. The bytes go straight from the browser to
// Supabase Storage with the user's own session (RLS applies); no secret keys involved.

const MAX_IMAGE_EDGE = 2048;
const JPEG_QUALITY = 0.82;
const RESIZE_ABOVE_BYTES = 1.5 * 1024 * 1024;

/**
 * Prepares a photo for upload: scales it to at most 2048 px on the long edge and
 * re-encodes as JPEG (PNG stays PNG, so diagrams and screenshots stay sharp). Images the
 * browser can decode but we don't accept as-is (e.g. HEIC on Safari) become JPEG. Returns
 * null when the image can't be decoded.
 */
export async function prepareImage(file: File): Promise<File | null> {
  const isPng = file.type === "image/png";
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    return null;
  }
  try {
    const longEdge = Math.max(bitmap.width, bitmap.height);
    const needsResize = longEdge > MAX_IMAGE_EDGE;
    const needsReencode = !isAllowedMimeType(file.type) || (!isPng && file.size > RESIZE_ABOVE_BYTES);
    if (!needsResize && !needsReencode) return file;

    const scale = needsResize ? MAX_IMAGE_EDGE / longEdge : 1;
    const width = Math.round(bitmap.width * scale);
    const height = Math.round(bitmap.height * scale);
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) return null;
    context.drawImage(bitmap, 0, 0, width, height);
    const type = isPng ? "image/png" : "image/jpeg";
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, type, isPng ? undefined : JPEG_QUALITY),
    );
    if (!blob) return null;
    const extension = isPng ? "png" : "jpg";
    const stem = extensionOf(file.name) ? file.name.slice(0, file.name.lastIndexOf(".")) : file.name;
    return new File([blob], `${stem || "foto"}.${extension}`, { type, lastModified: file.lastModified });
  } finally {
    bitmap.close();
  }
}

/** True for images the browser might be able to convert (photos from phone cameras). */
export function isConvertibleImage(file: File): boolean {
  return file.type.startsWith("image/") && file.type !== "image/svg+xml";
}

/**
 * Uploads to the exact registered path. `x-upsert: false` — an existing object is never
 * overwritten (and the storage policies allow no update anyway).
 */
export async function uploadObject(
  path: string,
  file: File,
  onProgress: (fraction: number) => void,
  signal?: AbortSignal,
): Promise<boolean> {
  const supabase = createClient();
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) return false;
  const { url, publishableKey } = getSupabaseEnv();
  const endpoint = `${url}/storage/v1/object/documents/${path.split("/").map(encodeURIComponent).join("/")}`;

  return new Promise((resolve) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", endpoint);
    xhr.setRequestHeader("Authorization", `Bearer ${token}`);
    xhr.setRequestHeader("apikey", publishableKey);
    xhr.setRequestHeader("x-upsert", "false");
    xhr.setRequestHeader("Content-Type", file.type);
    xhr.setRequestHeader("Cache-Control", "max-age=3600");
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress(event.loaded / event.total);
    };
    xhr.onload = () => resolve(xhr.status >= 200 && xhr.status < 300);
    xhr.onerror = () => resolve(false);
    xhr.onabort = () => resolve(false);
    signal?.addEventListener("abort", () => xhr.abort());
    xhr.send(file);
  });
}
