import NextAuth, { NextAuthOptions } from 'next-auth';
import GithubProvider from 'next-auth/providers/github';

/**
 * Env that must stay consistent or you get broken sessions / redirect loops:
 * - NEXTAUTH_URL: exact origin you use in the browser (scheme + host + port). Must match `npm run dev` port
 *   (default 3000). If another process steals :3000, Next may use 3001 — then set NEXTAUTH_URL to that port.
 * - GitHub OAuth app "Authorization callback URL" must include: {NEXTAUTH_URL}/api/auth/callback/github
 *   (separate from Flask’s GITHUB_OAUTH_REDIRECT_URI on :5000).
 */
export const authOptions: NextAuthOptions = {
  providers: [
    GithubProvider({
      clientId: process.env.GITHUB_ID!,
      clientSecret: process.env.GITHUB_SECRET!,
      authorization: {
        params: {
          scope: 'repo read:user user:email',
        },
      },
    }),
  ],
  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  callbacks: {
    async jwt({ token, account }) {
      // Persist the OAuth access_token to the token right after signin
      if (account) {
        token.accessToken = account.access_token;
        token.id = account.providerAccountId;
      }
      return token;
    },
    async session({ session, token }) {
      // Send properties to the client
      if (token) {
        session.accessToken = token.accessToken as string;
        if (session.user) {
          session.user.id = token.id as string;
        }
      }
      return session;
    },
  },
  pages: {
    signIn: '/login',
    // Must not be the same route as signIn — that produced /login?error=undefined loops and noisy /api/auth/error traffic.
    error: '/auth-error',
  },
  secret: process.env.NEXTAUTH_SECRET,
  /** Set NEXTAUTH_DEBUG=true to enable NextAuth server debug (noisy POST /api/auth/_log in dev). */
  debug: process.env.NEXTAUTH_DEBUG === 'true',
  events: {
    signIn: async ({ account }) => {
      if (process.env.NODE_ENV === 'development' && account?.provider === 'github') {
        console.info('[next-auth] GitHub sign-in completed');
      }
    },
  },
};

export default NextAuth(authOptions);
