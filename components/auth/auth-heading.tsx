export function AuthHeading({ title, description }: { title: string; description?: string }) {
  return (
    <div className="mb-8">
      <h1 className="text-3xl font-extrabold">{title}</h1>
      {description && <p className="mt-2 text-k-muted">{description}</p>}
    </div>
  );
}

export function FormError({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p
      role="alert"
      className="border-l-4 border-k-danger bg-k-surface px-3 py-2 text-sm text-k-ink"
    >
      {message}
    </p>
  );
}
