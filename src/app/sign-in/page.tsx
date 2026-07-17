import { AlertTriangle } from "lucide-react";
import { signIn } from "@/auth";
import { Button } from "@/components/Button";

export const dynamic = "force-dynamic";

async function googleSignIn() {
  "use server";
  await signIn("google", { redirectTo: "/" });
}

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const sp = await searchParams;

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-4 py-10">
      <div className="mb-6">
        <h1 className="nameplate text-[2.75rem] leading-none">Attended</h1>
        <hr className="rule-ledger mt-3" />
        <p className="standfirst mt-3 text-[15px] leading-snug text-muted">
          A personal almanac of every game you&apos;ve been to. Sign in to start yours.
        </p>
      </div>

      <div className="flex flex-col gap-4 rounded-lg border border-border bg-surface p-5">
        {sp.error && (
          <p className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm" style={{ background: "var(--loss)", color: "var(--on-loss)" }}>
            <AlertTriangle size={15} /> Something went wrong signing in. Please try again.
          </p>
        )}

        <form action={googleSignIn}>
          <Button variant="primary" size="lg" type="submit" className="w-full justify-center">
            Continue with Google
          </Button>
        </form>
      </div>

      <p className="mt-4 text-center text-xs text-faint">
        Sign in with any Google account to create your log.
      </p>
    </main>
  );
}
