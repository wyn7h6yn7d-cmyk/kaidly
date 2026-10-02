import type { MetadataRoute } from "next";
import { isIndexable, siteUrl } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  if (!isIndexable()) return { rules: { userAgent: "*", disallow: "/" } };
  return {
    rules: {
      userAgent: "*",
      allow: ["/", "/privaatsus", "/kasutustingimused"],
      disallow: ["/o", "/admin", "/konto", "/auth", "/invite", "/otsing", "/teavitused", "/api"],
    },
    sitemap: new URL("/sitemap.xml", siteUrl()).toString(),
  };
}
