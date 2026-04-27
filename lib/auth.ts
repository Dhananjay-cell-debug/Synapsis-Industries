// ─── SHARED AUTH OPTIONS ────────────────────────────────────────────────────
// Single source of truth for NextAuth config. Import this into API routes that
// need getServerSession(authOptions).

import type { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";

export const authOptions: NextAuthOptions = {
    providers: [
        GoogleProvider({
            clientId: process.env.GOOGLE_CLIENT_ID!,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
        }),
    ],
    pages: {
        signIn: "/auth/signin",
    },
    callbacks: {
        async session({ session, token }) {
            if (session.user && token.sub) {
                (session.user as { id?: string; role?: string }).id = token.sub;
                (session.user as { id?: string; role?: string }).role = token.role as string;
            }
            return session;
        },
        async jwt({ token, account }) {
            if (account) {
                token.accessToken = account.access_token;
                token.role = token.email === process.env.ADMIN_EMAIL ? "admin" : "visitor";
            }
            return token;
        },
    },
};

export function isAdmin(email: string | null | undefined): boolean {
    if (!email) return false;
    const admin = process.env.ADMIN_EMAIL;
    return !!admin && email.toLowerCase() === admin.toLowerCase();
}
