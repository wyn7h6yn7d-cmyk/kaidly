import { AuthBackdrop } from "@/components/auth/auth-backdrop";
import { AuthHeader } from "@/components/auth/auth-header";

/**
 * Authentication pages: a simplified public header, the quiet technical background and
 * one compact card, placed a little above the visual centre of the remaining viewport.
 */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative isolate flex min-h-svh flex-col">
      <AuthBackdrop />
      <AuthHeader />
      <main className="flex flex-1 flex-col items-center px-4 pb-12 pt-6 sm:justify-center sm:px-6 sm:pb-[14vh] sm:pt-10 max-[359px]:px-0">
        <div
          data-testid="auth-card"
          className="w-full max-w-[27rem] rounded-md border border-k-line bg-k-surface px-5 py-7 shadow-[0_1px_2px_rgba(17,24,39,0.04)] sm:px-9 sm:py-9 max-[359px]:rounded-none max-[359px]:border-x-0"
        >
          {children}
        </div>
      </main>
    </div>
  );
}
