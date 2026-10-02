import type { MetadataRoute } from "next";
import { legalReady } from "@/lib/legal/operator";
import { isIndexable, PUBLIC_PAGES, siteUrl } from "@/lib/site";

export default function sitemap(): MetadataRoute.Sitemap {
  if (!isIndexable()) return [];
  // Draft legal pages stay out until approved.
  const pages = legalReady() ? PUBLIC_PAGES : PUBLIC_PAGES.filter((p) => p === "/");
  return pages.map((path) => ({ url: new URL(path, siteUrl()).toString() }));
}
