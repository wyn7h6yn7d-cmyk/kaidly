import type { Metadata, Viewport } from "next";
import { Inter, Manrope } from "next/font/google";
import { Suspense } from "react";
import { LocaleBoundary } from "@/components/app/locale-boundary";
import { DEFAULT_LOCALE, LOCALE_COOKIE } from "@/lib/i18n";
import { getT } from "@/lib/i18n/server";
import { isIndexable, siteUrl } from "@/lib/site";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return {
    metadataBase: siteUrl(),
    // Only production on the custom domain may be indexed (lib/site.ts); the application
    // routes are additionally excluded by robots.txt and an X-Robots-Tag header.
    robots: isIndexable() ? undefined : { index: false, follow: false },
    title: {
      default: t.landing.metaTitle,
      template: `%s | ${t.brand.name}`,
    },
    description: t.meta.description,
    openGraph: {
      title: t.landing.metaTitle,
      description: t.meta.description,
      siteName: t.brand.name,
      type: "website",
      locale: { et: "et_EE", en: "en_GB", ru: "ru_RU" }[t.locale],
    },
  };
}

export const viewport: Viewport = {
  themeColor: "#0F3D32",
};

// Fonts: only the basic Latin subset is preloaded (covers Estonian õ ä ö ü); Latin Extended
// (š ž) and Cyrillic stay declared via unicode-range and download only on pages that use
// them. Manrope is loaded as one variable font instead of three static weights.
const inter = Inter({
  variable: "--font-inter",
  display: "swap",
  subsets: ["latin"],
});

const manrope = Manrope({
  variable: "--font-manrope",
  display: "swap",
  subsets: ["latin"],
});

// The language comes from a cookie. Reading it here would block every route, so <html lang>
// starts as the default and this script corrects it before hydration (Next.js guide
// "Preventing flash before hydration"); content is also wrapped in a server-rendered lang.
const langScript = `try{var m=document.cookie.match(/(?:^|; )${LOCALE_COOKIE}=(et|en|ru)(?:;|$)/);if(m)document.documentElement.lang=m[1]}catch(e){}`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang={DEFAULT_LOCALE} className={`${inter.variable} ${manrope.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: langScript }} />
      </head>
      <body className="min-h-svh font-sans">
        <Suspense>
          <LocaleBoundary>{children}</LocaleBoundary>
        </Suspense>
      </body>
    </html>
  );
}
