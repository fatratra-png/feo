/**
 * "Continue with Google / GitHub" (OAuth 2.0 authorization code flow).
 *
 * 1. /auth/oauth/:provider/start redirects to the provider with a signed
 *    `state` (provider, target app, nonce) and sets the nonce in a cookie,
 *    which blocks login CSRF: a callback only completes in the browser that
 *    started it.
 * 2. The provider redirects to /auth/oauth/:provider/callback with a code; we
 *    exchange it, read the verified email, and find/link/create the account.
 * 3. We never put tokens in a URL: the app gets a one-time code (60 s) that it
 *    trades for tokens with POST /auth/oauth/exchange.
 */
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { TTLCache } from '../lib/cache';
import { AppError } from '../lib/http';
import { auth, issueTokens } from './auth';
import { one } from '../db';

export type Provider = 'google' | 'github';
export type Target = 'web' | 'mobile';

export const PROVIDERS: Provider[] = ['google', 'github'];
export const NONCE_COOKIE = 'feo_oauth_nonce';

export const providerEnabled = (p: Provider) => Boolean(config.oauth[p].clientId && config.oauth[p].clientSecret);
export const enabledProviders = () => PROVIDERS.filter(providerEnabled);

export const callbackUrl = (p: Provider) => `${config.publicApiUrl}/auth/oauth/${p}/callback`;

interface ExternalIdentity {
  providerUserId: string;
  email: string;
  emailVerified: boolean;
  name: string;
  avatarUrl: string | null;
}

/* ---------------- provider specifics ---------------- */

const endpoints: Record<Provider, { authorize: string; scope: string }> = {
  google: { authorize: 'https://accounts.google.com/o/oauth2/v2/auth', scope: 'openid email profile' },
  github: { authorize: 'https://github.com/login/oauth/authorize', scope: 'read:user user:email' },
};

async function json(r: Response, what: string) {
  if (!r.ok) throw new Error(`${what}: HTTP ${r.status}`);
  return r.json() as Promise<any>;
}

async function fetchIdentity(provider: Provider, code: string): Promise<ExternalIdentity> {
  const { clientId, clientSecret } = config.oauth[provider];
  const timeout = () => AbortSignal.timeout(10000);

  if (provider === 'google') {
    const token = await json(await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ code, client_id: clientId, client_secret: clientSecret, redirect_uri: callbackUrl('google'), grant_type: 'authorization_code' }),
      signal: timeout(),
    }), 'Google token');
    const info = await json(await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
      headers: { Authorization: `Bearer ${token.access_token}` },
      signal: timeout(),
    }), 'Google userinfo');
    return { providerUserId: String(info.sub), email: info.email ?? '', emailVerified: info.email_verified === true, name: info.name ?? '', avatarUrl: info.picture ?? null };
  }

  const token = await json(await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify({ code, client_id: clientId, client_secret: clientSecret, redirect_uri: callbackUrl('github') }),
    signal: timeout(),
  }), 'GitHub token');
  if (!token.access_token) throw new Error(`GitHub token: ${token.error ?? 'no access_token'}`);
  const headers = { Authorization: `Bearer ${token.access_token}`, Accept: 'application/vnd.github+json', 'User-Agent': 'FEO' };
  const [user, emails] = await Promise.all([
    json(await fetch('https://api.github.com/user', { headers, signal: timeout() }), 'GitHub user'),
    json(await fetch('https://api.github.com/user/emails', { headers, signal: timeout() }), 'GitHub emails'),
  ]);
  // GitHub profiles often hide their email: use the primary *verified* address.
  const primary = (emails as { email: string; primary: boolean; verified: boolean }[]).find((e) => e.primary && e.verified)
    ?? (emails as { email: string; verified: boolean }[]).find((e) => e.verified);
  return { providerUserId: String(user.id), email: primary?.email ?? '', emailVerified: Boolean(primary), name: user.name || user.login || '', avatarUrl: user.avatar_url ?? null };
}

/* ---------------- flow ---------------- */

interface State { p: Provider; t: Target; n: string }

export function startLogin(provider: Provider, target: Target): { url: string; nonce: string } {
  if (!providerEnabled(provider)) throw new AppError(404, 'Connexion indisponible pour ce fournisseur');
  const nonce = crypto.randomBytes(16).toString('base64url');
  const state = jwt.sign({ p: provider, t: target, n: nonce } satisfies State, config.jwt.secret, { expiresIn: '10m' });
  const params = new URLSearchParams({
    client_id: config.oauth[provider].clientId,
    redirect_uri: callbackUrl(provider),
    response_type: 'code',
    scope: endpoints[provider].scope,
    state,
    ...(provider === 'google' ? { prompt: 'select_account' } : { allow_signup: 'true' }),
  });
  return { url: `${endpoints[provider].authorize}?${params}`, nonce };
}

/** One-time codes handed to the app after a successful login: code → user id. */
const loginCodes = new TTLCache<string>(60 * 1000, 1000);

/** Where to send the browser back to, for a given target app. */
export function appRedirect(target: Target, params: Record<string, string>) {
  const base = target === 'mobile' ? config.oauth.mobileRedirect : `${config.frontendUrl}/auth/callback`;
  return `${base}${base.includes('?') ? '&' : '?'}${new URLSearchParams(params)}`;
}

/** Reads the target from a state without trusting it for anything but the error redirect. */
export function targetOf(state: string | undefined): Target {
  const decoded = state ? (jwt.decode(state) as Partial<State> | null) : null;
  return decoded?.t === 'mobile' ? 'mobile' : 'web';
}

export async function finishLogin(provider: Provider, code: string, state: string, cookieNonce: string | undefined) {
  let decoded: State;
  try {
    decoded = jwt.verify(state, config.jwt.secret) as State;
  } catch {
    throw new AppError(400, 'La connexion a expiré, réessaie.', 'OAUTH_STATE');
  }
  if (decoded.p !== provider || !cookieNonce || decoded.n !== cookieNonce) {
    throw new AppError(400, 'La connexion a expiré, réessaie.', 'OAUTH_STATE');
  }
  let identity: ExternalIdentity;
  try {
    identity = await fetchIdentity(provider, code);
  } catch (err) {
    console.warn(`[oauth] ${provider} exchange failed:`, (err as Error).message);
    throw new AppError(502, `Connexion avec ${provider === 'google' ? 'Google' : 'GitHub'} impossible pour le moment.`, 'OAUTH_PROVIDER');
  }
  if (!identity.email) throw new AppError(400, `Ton compte ${provider === 'google' ? 'Google' : 'GitHub'} n'a pas d'email vérifié.`, 'EMAIL_NOT_VERIFIED');
  const userId = await auth.loginWithIdentity({ provider, ...identity });
  const oneTime = crypto.randomBytes(24).toString('base64url');
  loginCodes.set(oneTime, userId);
  return { code: oneTime, target: decoded.t };
}

/** Trades a one-time code for a session. */
export async function exchangeCode(code: string) {
  const userId = loginCodes.get(code);
  if (!userId) throw new AppError(400, 'La connexion a expiré, réessaie.', 'OAUTH_CODE');
  loginCodes.delete(code);
  const user = await one(
    `SELECT id, email, display_name AS "displayName", avatar_url AS "avatarUrl", created_at AS "createdAt" FROM users WHERE id = $1`,
    [userId],
  );
  if (!user) throw new AppError(400, 'La connexion a expiré, réessaie.', 'OAUTH_CODE');
  return { user, ...(await issueTokens(userId)) };
}
