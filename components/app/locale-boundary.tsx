import { I18nProvider } from "@/lib/i18n/client";
import { getLocale } from "@/lib/i18n/server";

/**
 * Resolves the request's language once and provides it to client components. The `lang`
 * attribute on the wrapper is server-rendered, so assistive technology reads every page in
 * the right language even before the inline script updates <html lang>.
 */
export async function LocaleBoundary({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();
  return (
    <I18nProvider locale={locale}>
      <div lang={locale} className="contents">
        {children}
      </div>
    </I18nProvider>
  );
}
