"use client";

import { useState } from "react";
import { Check, Share2 } from "lucide-react";
import { createShareLink } from "@/app/u/[username]/share-actions";

/**
 * Compact share control for your own profile header.
 *
 * Uses the Web Share API so phones open the native share sheet (Messages,
 * WhatsApp, AirDrop, socials). Desktop browsers mostly lack it, so those fall
 * back to copying the link.
 *
 * Note on the first tap: iOS Safari only allows navigator.share() while the
 * user gesture is still "active", and minting a token first costs an await.
 * If that trips, we fall back to the clipboard — and because the token now
 * exists, every later tap opens the sheet natively with no await at all.
 */
export function ShareLink({
  initialToken,
  displayName,
}: {
  initialToken: string | null;
  displayName: string;
}) {
  const [token, setToken] = useState(initialToken);
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);

  async function share() {
    if (busy) return;
    setBusy(true);
    try {
      let t = token;
      if (!t) {
        t = (await createShareLink()).token;
        setToken(t);
      }
      const url = `${window.location.origin}/s/${t}`;
      const data = {
        title: `${displayName} on Attended`,
        text: `Every game ${displayName} has been to.`,
        url,
      };

      if (typeof navigator !== "undefined" && navigator.share) {
        try {
          await navigator.share(data);
          return;
        } catch (err) {
          // The user dismissing the sheet is not an error worth reacting to.
          if ((err as Error)?.name === "AbortError") return;
        }
      }

      try {
        await navigator.clipboard.writeText(url);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch {
        /* clipboard blocked — nothing useful left to try */
      }
    } finally {
      setBusy(false);
    }
  }

  const btn =
    "inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-2.5 py-1.5 text-sm text-muted transition-colors hover:text-ink disabled:opacity-50";

  return (
    <button
      onClick={share}
      disabled={busy}
      title="Share your log"
      aria-label="Share your log"
      className={`shrink-0 ${btn}`}
    >
      {copied ? <Check size={15} /> : <Share2 size={15} />}
      <span className="hidden sm:inline">{copied ? "Copied" : "Share"}</span>
    </button>
  );
}
