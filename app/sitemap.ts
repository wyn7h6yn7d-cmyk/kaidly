import type { MetadataRoute } from "next";
import { isIndexable, PUBLIC_PAGES, siteUrl } from "@/lib/site";

export default function sitemap(): MetadataRoute.Sitemap {
  if (!isIndexable()) return [];
  return PUBLIC_PAGES.map((path) => ({ url: new URL(path, siteUrl()).toString() }));
}
