"use client";

import { useEffect, useState, useTransition } from "react";
import { Check, Copy, Link2 } from "lucide-react";
import { Button } from "@/components/Button";
import { createShareLink, revokeShareLink } from "@/app/u/[username]/share-actions";

/**
 * Share-link control, shown only on your own profile.
 *
 * The link is an unguessable token, so anyone holding it can see this profile's
 * highlights — the copy says so plainly rather than implying it's private.
 */
export function ShareLink({ initialToken }: { initialToken: string | null }) {
  const [token, setToken] = useState(initialToken);
  const [origin, setOrigin] = useState("");
  const [copied, setCopied] = useState(false);
  const [pending, start] = useTransition();

  // Built client-side so the link matches whatever host they're actually on
  // (localhost in dev, the real domain in production).
  useEffect(() => setOrigin(window.location.origin), []);

  const url = token ? `${origin}/s/${token}` : "";

  function create() {
    start(async () => setToken((await createShareLink()).token));
  }
  function revoke() {
    start(async () => {
      await revokeShareLink();
      setToken(null);
      setCopied(false);
    });
  }
  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard blocked — the input is selectable as a fallback */
    }
  }

  if (!token) {
    return (
      <div className="rounded-lg border border-border bg-surface px-4 py-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-muted">
            Share a read-only view of your log — stats, teams and recent games. Your notes stay
            private.
          </p>
          <Button variant="secondary" onClick={create} disabled={pending}>
            <Link2 size={15} /> {pending ? "Creating…" : "Create share link"}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border bg-surface px-4 py-4">
      <div className="flex flex-wrap items-center gap-2">
        <input
          readOnly
          value={url}
          onFocus={(e) => e.currentTarget.select()}
          aria-label="Your share link"
          className="min-w-0 flex-1 rounded border border-border bg-bg px-2.5 py-1.5 text-sm text-muted outline-none focus:border-primary"
        />
        <Button variant="secondary" onClick={copy}>
          {copied ? <Check size={15} /> : <Copy size={15} />}
          {copied ? "Copied" : "Copy"}
        </Button>
        <Button variant="ghost" onClick={revoke} disabled={pending}>
          {pending ? "Revoking…" : "Revoke"}
        </Button>
      </div>
      <p className="mt-2 text-xs text-faint">
        Anyone with this link can see your stats and recent games — but never your notes.
        Revoking it breaks every copy you&apos;ve sent.
      </p>
    </div>
  );
}
