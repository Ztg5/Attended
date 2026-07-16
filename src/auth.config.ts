import type { NextAuthConfig } from "next-auth";
import Google from "next-auth/providers/google";

/**
 * Edge-safe base config. Imported by BOTH the middleware (runs on the edge, so it
 * must not pull in Prisma/Node APIs) and the full server config in `auth.ts`.
 * Google reads AUTH_GOOGLE_ID / AUTH_GOOGLE_SECRET from the environment.
 *
 * allowDangerousEmailAccountLinking: the owner's User row is pre-created (by the
 * migration) with no linked Account. Google verifies email ownership and signup is
 * invite-gated, so linking the Google login to that existing row by email is safe.
 */
export const authConfig = {
  pages: { signIn: "/sign-in" },
  providers: [Google({ allowDangerousEmailAccountLinking: true })],
  callbacks: {
    // Gate every route behind a session. The matcher already excludes /sign-in,
    // the auth API, and static assets, so anything reaching here needs a user.
    authorized({ auth }) {
      return !!auth?.user;
    },
  },
} satisfies NextAuthConfig;
