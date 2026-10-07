import { createClient } from "@/lib/supabase/client";
import { getSupabaseEnv } from "@/lib/env";

// Browser-only helpers for the upload flow. The bytes go straight from the browser to
// Supabase Storage with the user's own session (RLS applies); no secret keys involved.

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
