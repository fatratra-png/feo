import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { NextFunction, Response } from 'express';
import { config } from '../config';
import { one, query } from '../db';
import { AppError, AuthRequest } from '../lib/http';
import { resetPasswordMail, sendMail } from './mail';

export interface PublicUser {
  id: string;
  email: string;
  displayName: string;
  avatarUrl: string | null;
  createdAt: string;
}

/** What the account page needs on top of the public profile. */
export interface Account extends PublicUser {
  hasPassword: boolean;
  providers: string[];
}

export const PASSWORD_MIN = 8;
const RESET_TTL_MINUTES = 60;
const RESETS_PER_HOUR = 3;

const USER_COLS = `id, email, display_name AS "displayName", avatar_url AS "avatarUrl", created_at AS "createdAt"`;
const hash = (token: string) => crypto.createHash('sha256').update(token).digest('hex');

export async function issueTokens(userId: string) {
  const accessToken = jwt.sign({ userId }, config.jwt.secret, { expiresIn: config.jwt.accessExpiry as any });
  const refreshToken = jwt.sign({ userId, jti: crypto.randomUUID() }, config.jwt.refreshSecret, {
    expiresIn: `${config.jwt.refreshDays}d` as any,
  });
  await query(
    `INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES ($1, $2, NOW() + make_interval(days => $3))`,
    [userId, hash(refreshToken), config.jwt.refreshDays],
  );
  return { accessToken, refreshToken };
}

export const auth = {
  async register(email: string, password: string, displayName: string) {
    const normalized = email.trim().toLowerCase();
    if (await one(`SELECT 1 FROM users WHERE email = $1`, [normalized])) {
      throw new AppError(409, 'Cet email est déjà utilisé');
    }
    const passwordHash = await bcrypt.hash(password, 11);
    const user = (await one<PublicUser>(
      `INSERT INTO users (email, password_hash, display_name) VALUES ($1, $2, $3) RETURNING ${USER_COLS}`,
      [normalized, passwordHash, displayName.trim()],
    ))!;
    return { user, ...(await issueTokens(user.id)) };
  },

  async login(email: string, password: string) {
    const row = await one<PublicUser & { password_hash: string | null }>(
      `SELECT ${USER_COLS}, password_hash FROM users WHERE email = $1`,
      [email.trim().toLowerCase()],
    );
    if (row && !row.password_hash) {
      throw new AppError(401, 'Ce compte se connecte avec Google ou GitHub. Utilise ce bouton, ou « Mot de passe oublié » pour créer un mot de passe.', 'NO_PASSWORD');
    }
    if (!row || !(await bcrypt.compare(password, row.password_hash!))) {
      throw new AppError(401, 'Email ou mot de passe incorrect');
    }
    const { password_hash, ...user } = row;
    return { user, ...(await issueTokens(user.id)) };
  },

  /** Rotates the refresh token: the old one can never be reused. */
  async refresh(refreshToken: string) {
    let userId: string;
    try {
      ({ userId } = jwt.verify(refreshToken, config.jwt.refreshSecret) as { userId: string });
    } catch {
      throw new AppError(401, 'Session expirée');
    }
    const deleted = await query(`DELETE FROM refresh_tokens WHERE token = $1 AND expires_at > NOW() RETURNING id`, [hash(refreshToken)]);
    if (!deleted.length) throw new AppError(401, 'Session expirée');
    return issueTokens(userId);
  },

  async logout(userId: string, refreshToken?: string) {
    if (refreshToken) await query(`DELETE FROM refresh_tokens WHERE token = $1`, [hash(refreshToken)]);
    else await query(`DELETE FROM refresh_tokens WHERE user_id = $1`, [userId]);
    await query(`DELETE FROM refresh_tokens WHERE expires_at < NOW()`);
  },

  async me(userId: string): Promise<Account> {
    const user = await one<Account>(
      `SELECT ${USER_COLS}, password_hash IS NOT NULL AS "hasPassword",
              COALESCE((SELECT ARRAY_AGG(provider ORDER BY provider) FROM user_identities WHERE user_id = users.id), '{}') AS providers
       FROM users WHERE id = $1`,
      [userId],
    );
    if (!user) throw new AppError(404, 'Utilisateur introuvable');
    return user;
  },

  /**
   * Changes (or, for Google/GitHub accounts, creates) the password. Every
   * other session is signed out; the caller gets fresh tokens.
   */
  async changePassword(userId: string, currentPassword: string | undefined, newPassword: string) {
    const row = await one<{ password_hash: string | null }>(`SELECT password_hash FROM users WHERE id = $1`, [userId]);
    if (!row) throw new AppError(404, 'Utilisateur introuvable');
    if (row.password_hash) {
      if (!currentPassword || !(await bcrypt.compare(currentPassword, row.password_hash))) {
        throw new AppError(400, 'Mot de passe actuel incorrect', 'WRONG_PASSWORD');
      }
      if (await bcrypt.compare(newPassword, row.password_hash)) {
        throw new AppError(400, "Le nouveau mot de passe doit être différent de l'actuel");
      }
    }
    await query(`UPDATE users SET password_hash = $2, updated_at = NOW() WHERE id = $1`, [userId, await bcrypt.hash(newPassword, 11)]);
    await query(`DELETE FROM refresh_tokens WHERE user_id = $1`, [userId]);
    return issueTokens(userId);
  },

  /**
   * Emails a single-use reset link. Answers the same way whether or not the
   * email has an account, so it cannot be used to find out who is registered.
   */
  async forgotPassword(email: string, resetUrl: string) {
    const user = await one<{ id: string; display_name: string; email: string }>(
      `SELECT id, display_name, email FROM users WHERE email = $1`,
      [email.trim().toLowerCase()],
    );
    if (!user) return;
    const recent = await one<{ n: number }>(
      `SELECT COUNT(*)::int AS n FROM password_resets WHERE user_id = $1 AND created_at > NOW() - INTERVAL '1 hour'`,
      [user.id],
    );
    if ((recent?.n ?? 0) >= RESETS_PER_HOUR) return; // silently: no mailbox flooding
    const token = crypto.randomBytes(32).toString('base64url');
    await query(
      `INSERT INTO password_resets (token_hash, user_id, expires_at) VALUES ($1, $2, NOW() + make_interval(mins => $3))`,
      [hash(token), user.id, RESET_TTL_MINUTES],
    );
    const link = `${resetUrl}?token=${encodeURIComponent(token)}`;
    await sendMail(resetPasswordMail(user.email, user.display_name, link));
  },

  /** Sets a new password from a reset link, signs every session out and signs this one in. */
  async resetPassword(token: string, newPassword: string) {
    const reset = await one<{ user_id: string }>(
      `UPDATE password_resets SET used_at = NOW()
       WHERE token_hash = $1 AND used_at IS NULL AND expires_at > NOW()
       RETURNING user_id`,
      [hash(token)],
    );
    if (!reset) throw new AppError(400, 'Ce lien a expiré ou a déjà servi. Demande un nouveau lien.', 'RESET_INVALID');
    await query(`UPDATE users SET password_hash = $2, updated_at = NOW() WHERE id = $1`, [reset.user_id, await bcrypt.hash(newPassword, 11)]);
    // Other pending links and every open session die with the old password.
    await query(`DELETE FROM password_resets WHERE user_id = $1 AND used_at IS NULL`, [reset.user_id]);
    await query(`DELETE FROM refresh_tokens WHERE user_id = $1`, [reset.user_id]);
    const user = (await one<PublicUser>(`SELECT ${USER_COLS} FROM users WHERE id = $1`, [reset.user_id]))!;
    return { user, ...(await issueTokens(reset.user_id)) };
  },

  /** Finds the account behind an external login, linking or creating it as needed. */
  async loginWithIdentity(identity: { provider: string; providerUserId: string; email: string; emailVerified: boolean; name: string; avatarUrl?: string | null }) {
    const linked = await one<{ user_id: string }>(
      `SELECT user_id FROM user_identities WHERE provider = $1 AND provider_user_id = $2`,
      [identity.provider, identity.providerUserId],
    );
    let userId = linked?.user_id;
    if (!userId) {
      if (!identity.emailVerified) throw new AppError(400, `Ton email ${identity.provider} n'est pas vérifié.`, 'EMAIL_NOT_VERIFIED');
      const email = identity.email.trim().toLowerCase();
      // Same verified email as an existing account: it is the same person, link it.
      const existing = await one<{ id: string }>(`SELECT id FROM users WHERE email = $1`, [email]);
      userId = existing?.id ?? (await one<{ id: string }>(
        `INSERT INTO users (email, password_hash, display_name, avatar_url) VALUES ($1, NULL, $2, $3) RETURNING id`,
        [email, (identity.name || email.split('@')[0]).trim().slice(0, 100), identity.avatarUrl ?? null],
      ))!.id;
      await query(
        `INSERT INTO user_identities (provider, provider_user_id, user_id, email) VALUES ($1, $2, $3, $4) ON CONFLICT DO NOTHING`,
        [identity.provider, identity.providerUserId, userId, email],
      );
      if (existing && identity.avatarUrl) await query(`UPDATE users SET avatar_url = COALESCE(avatar_url, $2) WHERE id = $1`, [userId, identity.avatarUrl]);
    }
    return userId;
  },
};

export function authenticate(req: AuthRequest, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return res.status(401).json({ message: 'Authentification requise' });
  try {
    const decoded = jwt.verify(header.slice(7), config.jwt.secret) as { userId: string };
    req.userId = decoded.userId;
    next();
  } catch {
    res.status(401).json({ message: 'Session expirée' });
  }
}
