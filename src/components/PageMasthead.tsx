import type { ReactNode } from "react";

/**
 * A sub-page's masthead — the publication nameplate, a serif-italic standfirst,
 * and the signature ledger rule. Gives every screen the same authored, sports-
 * section front-page feel instead of a plain bold h1.
 */
export function PageMasthead({
  title,
  subtitle,
  action,
  className = "mb-6",
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <header className={className}>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="nameplate text-[2rem] leading-none">{title}</h1>
        {action}
      </div>
      {subtitle && (
        <p className="standfirst mt-2 max-w-[60ch] text-[15px] leading-snug text-muted">{subtitle}</p>
      )}
      <hr className="rule-ledger mt-5" />
    </header>
  );
}
