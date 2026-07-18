import NextAuth from "next-auth";
import { authConfig } from "./auth.config";

// Edge middleware: uses the adapter-free config so it can verify the JWT session
// without Prisma. Unauthenticated requests are redirected to /sign-in.
export default NextAuth(authConfig).auth;

export const config = {
  // Protect everything except the auth API, the sign-in page, public share links,
  // and static assets.
  //
  // `s/` is the ONLY unauthenticated data surface: /s/<token> renders a share
  // view for whoever holds an unguessable token. It is deliberately narrow —
  // it exposes dashboard highlights and never private notes (see lib/share.ts),
  // and a profile is unreachable until its owner opts in by generating a token.
  matcher: ["/((?!api/auth|sign-in|s/|_next/static|_next/image|favicon.ico).*)"],
};
