"use client";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
      <h1 className="text-lg font-semibold text-ink">Something went wrong</h1>
      <p className="max-w-md text-sm text-ink-muted">
        {error.message || "The workspace hit an unexpected error. Try again."}
      </p>
      <button className="btn btn-primary h-10 px-4 text-sm" onClick={reset} type="button">
        Try again
      </button>
    </div>
  );
}
