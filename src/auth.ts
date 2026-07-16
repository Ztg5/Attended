import NextAuth from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/db";
import { authConfig } from "./auth.config";

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  // The adapter persists User/Account rows in Postgres even under the JWT session
  // strategy, so User.id is a stable DB id that Attendance rows key to. JWT sessions
  // let the edge middleware authorize without a database round-trip.
  adapter: PrismaAdapter(prisma),
  session: { strategy: "jwt" },
  callbacks: {
    ...authConfig.callbacks,
    // Open sign-up: anyone with a Google account can sign in (no invite gate).
    async jwt({ token, user }) {
      if (user) token.sub = user.id; // adapter user id on first sign-in
      return token;
    },
    async session({ session, token }) {
      if (session.user && token.sub) session.user.id = token.sub;
      return session;
    },
  },
});
