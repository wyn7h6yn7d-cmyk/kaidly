import { SiteHeader } from "@/components/marketing/site-header";

/** Authentication pages share the public header (with the language selector). */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-svh flex-col">
      <SiteHeader />
      <main className="k-container flex-1 pb-16 pt-8 sm:pt-14">
        <div className="mx-auto w-full max-w-md">{children}</div>
      </main>
    </div>
  );
}
