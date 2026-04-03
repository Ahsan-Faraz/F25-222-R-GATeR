import React from 'react';
import Link from 'next/link';
import { SiteLogoMark } from '@/components/ui/SiteLogo';
import { useRouter } from 'next/router';
import type { GetServerSideProps } from 'next';

const ERROR_MESSAGES: Record<string, string> = {
  Configuration:
    'NextAuth configuration failed — check NEXTAUTH_SECRET and that GITHUB_ID / GITHUB_SECRET match your GitHub OAuth app.',
  AccessDenied: 'You cancelled the request or GitHub denied access.',
  Verification: 'The sign-in link expired or was already used.',
  OAuthSignin: 'Could not start GitHub sign-in — check Client ID and that the app is an OAuth App (not only a GitHub App).',
  OAuthCallback:
    'GitHub redirected back but the callback failed — almost always a redirect URI mismatch. Add the exact callback URL below to your GitHub OAuth app.',
  Callback: 'OAuth callback failed — verify callback URL and Client Secret.',
  OAuthAccountNotLinked: 'This account is not linked to an existing user.',
  Default: 'Sign-in failed. Use the callback URL below in your GitHub OAuth app settings.',
};

export type AuthErrorPageProps = {
  githubCallbackUrl: string;
  nextAuthOrigin: string;
  errorCode: string | null;
};

export default function AuthErrorPage({
  githubCallbackUrl,
  nextAuthOrigin,
  errorCode: errorCodeProp,
}: AuthErrorPageProps) {
  const router = useRouter();
  const raw = router.query.error;
  const fromRouter = typeof raw === 'string' ? raw : Array.isArray(raw) ? raw[0] : undefined;
  const code =
    (fromRouter && fromRouter !== 'undefined' ? fromRouter : null) ?? errorCodeProp ?? undefined;
  const isUnknown = !code || code === 'undefined';
  const message = isUnknown
    ? ERROR_MESSAGES.Default
    : ERROR_MESSAGES[code] ?? `${ERROR_MESSAGES.Default} (code: ${code})`;

  return (
    <div className="min-h-screen bg-surface-container-lowest flex flex-col items-center justify-center p-8 text-center">
      <div className="mb-6">
        <SiteLogoMark size={80} priority />
      </div>
      <h1 className="text-xl font-headline font-bold text-on-surface mb-2">Authentication error</h1>
      <p className="text-sm text-on-surface-variant max-w-md mb-6">{message}</p>

      <div className="w-full max-w-lg rounded-lg border border-outline-variant/20 bg-surface-container/50 p-6 text-left space-y-4 mb-8">
        <p className="text-xs font-mono uppercase tracking-wider text-on-surface-variant/80">
          Fix (GitHub OAuth App)
        </p>
        <ol className="text-sm text-on-surface-variant list-decimal list-inside space-y-2">
          <li>
            Open{' '}
            <a
              href="https://github.com/settings/developers"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              GitHub → Settings → Developer settings → OAuth Apps
            </a>{' '}
            and select the app whose Client ID matches <code className="font-mono text-xs">GITHUB_ID</code> in{' '}
            <code className="font-mono text-xs">frontend/.env</code>.
          </li>
          <li>
            Under <strong>Authorization callback URL</strong>, add <strong>exactly</strong> this URL (one line, no
            trailing slash):
          </li>
        </ol>
        <div className="rounded bg-surface-container-high px-3 py-2 border border-outline-variant/15">
          <code className="font-mono text-xs text-primary break-all select-all">{githubCallbackUrl}</code>
        </div>
        <p className="text-xs text-on-surface-variant/90">
          NextAuth is configured with <code className="font-mono">NEXTAUTH_URL={nextAuthOrigin}</code>. You must open
          this same origin in the browser (e.g. do not mix <code className="font-mono">localhost</code> and{' '}
          <code className="font-mono">127.0.0.1</code>).
        </p>
        <p className="text-xs text-on-surface-variant/70">
          Flask&apos;s redirect on port 5000 is unrelated — Next.js uses the URL above for &quot;Sign in with
          GitHub&quot;.
        </p>
      </div>

      <Link href="/login" className="text-primary font-medium hover:underline">
        Back to sign in
      </Link>
    </div>
  );
}

export const getServerSideProps: GetServerSideProps<AuthErrorPageProps> = async (context) => {
  const raw = process.env.NEXTAUTH_URL || 'http://localhost:3000';
  const base = raw.replace(/\/$/, '');
  const q = context.query.error;
  const errorCode =
    typeof q === 'string' ? q : Array.isArray(q) && q[0] ? q[0] : null;

  return {
    props: {
      githubCallbackUrl: `${base}/api/auth/callback/github`,
      nextAuthOrigin: base,
      errorCode: errorCode && errorCode !== 'undefined' ? errorCode : null,
    },
  };
};
