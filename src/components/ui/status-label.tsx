import type { ReactNode } from "react";

export type StatusTone = "neutral" | "success" | "warning" | "danger";

export function StatusLabel({
  children,
  tone,
}: {
  children: ReactNode;
  tone: StatusTone;
}) {
  const toneClass =
    tone === "success"
      ? "border-success/25 bg-success-soft text-success"
      : tone === "warning"
        ? "border-warning/25 bg-warning-soft text-warning"
        : tone === "danger"
          ? "border-danger/25 bg-danger-soft text-danger"
          : "border-border bg-canvas text-ink-muted";

  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${toneClass}`}
    >
      {children}
    </span>
  );
}
