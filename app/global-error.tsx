"use client";

/**
 * Last resort when the root layout itself fails (no translations or styles available):
 * a plain trilingual message. Details are only in the server log.
 */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="et">
      <body style={{ fontFamily: "system-ui, sans-serif", maxWidth: "32rem", margin: "4rem auto", padding: "0 1rem", color: "#111827" }}>
        <h1>KAIDLY</h1>
        <p lang="et">Midagi läks valesti. Sinu andmed on alles. Proovi uuesti.</p>
        <p lang="en">Something went wrong. Your data is safe. Please try again.</p>
        <p lang="ru">Что-то пошло не так. Ваши данные сохранены. Попробуйте ещё раз.</p>
        {error.digest && <p style={{ fontFamily: "monospace", fontSize: "0.75rem", color: "#4B5563" }}>#{error.digest}</p>}
        <button type="button" onClick={reset} style={{ minHeight: "44px", padding: "0 1.25rem", fontSize: "1rem" }}>
          Proovi uuesti / Try again / Повторить
        </button>
      </body>
    </html>
  );
}
