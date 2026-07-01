type MarkTone = "dark" | "light";

/**
 * The constellation mark: a query node linked to the sources it retrieves,
 * the literal shape of vector search. "dark" renders for a navy tile,
 * "light" renders navy-on-white for inline use.
 */
export function NuraMark({
  tone = "dark",
  className,
}: {
  tone?: MarkTone;
  className?: string;
}) {
  const node = tone === "dark" ? "#ffffff" : "#102a43";
  const focal = tone === "dark" ? "#6fa4ff" : "#2f6fed";
  const line = tone === "dark" ? "#6fa4ff" : "#2f6fed";

  return (
    <svg
      viewBox="0 0 64 64"
      fill="none"
      className={className}
      role="img"
      aria-label="Nura"
    >
      <path
        d="M32 32 L18 18 M32 32 L48 16 M32 32 L46 44 M32 32 L18 46"
        stroke={line}
        strokeWidth={2.6}
        strokeLinecap="round"
        opacity={0.5}
      />
      <circle cx="32" cy="32" r="6" fill={focal} />
      <circle cx="18" cy="18" r="3.6" fill={node} />
      <circle cx="48" cy="16" r="3.6" fill={node} />
      <circle cx="46" cy="44" r="3.6" fill={node} />
      <circle cx="18" cy="46" r="3.6" fill={node} />
    </svg>
  );
}

/** Mark on a navy tile plus the wordmark. Used in the sidebar and header. */
export function NuraLogo({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <span className="grid size-9 shrink-0 place-items-center rounded-[11px] bg-brand shadow-sm">
        <NuraMark tone="dark" className="size-6" />
      </span>
      {!compact ? (
        <span className="flex min-w-0 flex-col leading-none">
          <span className="text-[15px] font-semibold tracking-[-0.01em] text-ink">
            Nura
          </span>
          <span className="mt-1 text-[11px] font-medium uppercase tracking-[0.14em] text-ink-faint">
            RAG Copilot
          </span>
        </span>
      ) : null}
    </div>
  );
}
