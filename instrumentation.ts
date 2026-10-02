import type { Instrumentation } from "next";

/**
 * Structured server error log line (one JSON object per error, visible in Vercel runtime
 * logs). Route and method for context; the message is truncated and no request headers,
 * cookies, bodies or query strings are logged, so tokens and passwords never reach logs.
 */
export const onRequestError: Instrumentation.onRequestError = (error, request, context) => {
  const err = error as Error & { digest?: string };
  console.error(
    JSON.stringify({
      level: "error",
      event: "request_error",
      digest: err.digest,
      name: err.name,
      message: String(err.message ?? "").slice(0, 300),
      method: request.method,
      path: request.path.split("?")[0],
      routePath: context.routePath,
      routeType: context.routeType,
      deployment: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 12),
      environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV,
    }),
  );
};
