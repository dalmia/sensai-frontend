import Bugsnag from '@bugsnag/js';

const apiKey =
  process.env.BUGSNAG_API_KEY ?? process.env.NEXT_PUBLIC_BUGSNAG_API_KEY;

export async function register() {
  // Only initialize on the Node.js runtime (not edge) and only in production
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;
  if (process.env.NODE_ENV !== 'production') return;
  if (!apiKey) return;

  // Prevent double-initialization in case Next calls register more than once
  const g = globalThis as typeof globalThis & { __bugsnagStarted?: boolean };
  if (g.__bugsnagStarted) return;
  g.__bugsnagStarted = true;

  Bugsnag.start({ apiKey });
}


