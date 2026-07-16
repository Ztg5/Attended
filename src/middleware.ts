import NextAuth from "next-auth";
import { authConfig } from "./auth.config";

// Edge middleware: uses the adapter-free config so it can verify the JWT session
// without Prisma. Unauthenticated requests are redirected to /sign-in.
export default NextAuth(authConfig).auth;

export const config = {
  // Protect everything except the auth API, the sign-in page, and static assets.
  matcher: ["/((?!api/auth|sign-in|_next/static|_next/image|favicon.ico).*)"],
};
