import type { ReactNode } from "react";

/**
 * The app's editorial section header — a Title Case ink label, an optional
 * serif-italic standfirst (the writer's voice), a hairline rule that runs out
 * to the row's action, and the action itself. Replaces the old
 * `uppercase tracking-wide text-muted` eyebrow that read as generic dashboard.
 */
export function SectionHeader({
  title,
  hint,
  action,
  className = "",
}: {
  title: ReactNode;
  hint?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={`section-head mb-3 ${className}`}>
      <h2 className="shrink-0 text-[15px] font-semibold tracking-tight text-ink">{title}</h2>
      {hint && <span className="standfirst hidden shrink-0 text-sm text-muted sm:inline">{hint}</span>}
      <span className="rule" />
      {action && <span className="shrink-0">{action}</span>}
    </div>
  );
}
