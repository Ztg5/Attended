import { LogOut } from "lucide-react";
import { signOut } from "@/auth";

/** Sign out. Lives in the top-right of your own profile page. */
export function SignOutButton() {
  return (
    <form
      action={async () => {
        "use server";
        await signOut({ redirectTo: "/sign-in" });
      }}
    >
      <button
        type="submit"
        title="Sign out"
        aria-label="Sign out"
        className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-2.5 py-1.5 text-sm text-muted transition-colors hover:text-ink"
      >
        <LogOut size={15} />
        <span className="hidden sm:inline">Sign out</span>
      </button>
    </form>
  );
}
