"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AtSign, Check } from "lucide-react";
import { Button } from "@/components/Button";
import { setUsername } from "./actions";

export function UsernameForm({ current }: { current: string | null }) {
  const [value, setValue] = useState(current ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();

  function submit() {
    setError(null);
    start(async () => {
      const r = await setUsername(value);
      if (r.ok) router.push(r.next ?? "/");
      else setError(r.message);
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <label className="flex items-center gap-2 rounded-lg border border-border bg-bg px-3 py-2.5 focus-within:border-primary">
        <AtSign size={16} className="text-faint" />
        <input
          value={value}
          onChange={(e) => setValue(e.target.value.toLowerCase())}
          onKeyDown={(e) => e.key === "Enter" && value && submit()}
          placeholder="username"
          autoFocus
          maxLength={20}
          className="w-full bg-transparent text-sm outline-none"
        />
      </label>
      {error && (
        <p className="text-xs" style={{ color: "var(--loss)" }}>
          {error}
        </p>
      )}
      <Button variant="primary" size="lg" onClick={submit} disabled={pending || !value} className="w-full">
        <Check size={16} /> {pending ? "Saving…" : current ? "Save username" : "Continue"}
      </Button>
    </div>
  );
}
