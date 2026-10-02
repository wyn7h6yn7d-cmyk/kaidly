import { getSupabaseEnv } from "@/lib/env";

/**
 * Public health check for uptime monitoring: whether the app runs and can reach Supabase
 * Auth and Storage. Reports only ok/error and the deployed commit — no keys, URLs, project
 * refs or error details.
 */
export async function GET() {
  const check = async (path: string) => {
    try {
      const { url, publishableKey } = getSupabaseEnv();
      const response = await fetch(new URL(path, url), {
        headers: { apikey: publishableKey },
        cache: "no-store",
        signal: AbortSignal.timeout(4000),
      });
      return response.ok ? "ok" : "error";
    } catch {
      return "error";
    }
  };
  const [auth, storage] = await Promise.all([check("/auth/v1/health"), check("/storage/v1/version")]);
  const ok = auth === "ok" && storage === "ok";
  return Response.json(
    { app: "ok", auth, storage, version: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 12) ?? "local" },
    { status: ok ? 200 : 503, headers: { "Cache-Control": "no-store" } },
  );
}
