"use client";

import { useState, useTransition } from "react";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/Button";
import { refreshPending } from "@/app/log/actions";

/** Shown on the dashboard when pending games exist — re-fetches and finalizes them. */
export function PendingRefresh({ count }: { count: number }) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  return (
    <div className="mt-6 flex flex-wrap items-center gap-3 rounded-lg border border-border bg-surface px-4 py-3 text-sm">
      <span className="inline-flex items-center gap-1.5" style={{ color: "var(--live)" }}>
        <span className="inline-block h-2 w-2 rounded-full" style={{ background: "var(--live)" }} />
        <span className="tnum font-medium">{count}</span> pending game{count === 1 ? "" : "s"}
      </span>
      <Button variant="secondary" size="sm" onClick={() => start(async () => setMsg((await refreshPending()).message))} disabled={pending}>
        <RefreshCw size={14} className={pending ? "animate-spin" : ""} /> Refresh
      </Button>
      {msg && <span className="text-muted">{msg}</span>}
    </div>
  );
}
