import { getSessionUser } from "@/lib/session";
import { prisma } from "@/lib/db";
import { UsernameForm } from "./UsernameForm";

export const dynamic = "force-dynamic";

export default async function ChooseUsernamePage() {
  const me = await getSessionUser();
  const user = await prisma.user.findUnique({
    where: { id: me.id },
    select: { username: true, name: true },
  });
  const current = user?.username ?? null;

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-4 py-10">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {current ? "Your username" : "Pick a username"}
          </h1>
          <p className="mt-1 text-sm text-muted">
            {current
              ? "This is how friends find and follow you."
              : `Welcome${user?.name ? `, ${user.name.split(" ")[0]}` : ""} — choose a handle so friends can find you.`}
          </p>
        </div>
      </div>

      <div className="rounded-lg border border-border bg-surface p-5">
        <UsernameForm current={current} />
      </div>
    </main>
  );
}
