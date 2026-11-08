import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { NextFunction, Response } from 'express';
import { config } from '../config';
import { one, query } from '../db';
import { AppError, AuthRequest } from '../lib/http';

export interface PublicUser {
  id: string;
  email: string;
  displayName: string;
  avatarUrl: string | null;
  createdAt: string;
}

const USER_COLS = `id, email, display_name AS "displayName", avatar_url AS "avatarUrl", created_at AS "createdAt"`;
const hash = (token: string) => crypto.createHash('sha256').update(token).digest('hex');

async function issueTokens(userId: string) {
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
    const row = await one<PublicUser & { password_hash: string }>(
      `SELECT ${USER_COLS}, password_hash FROM users WHERE email = $1`,
      [email.trim().toLowerCase()],
    );
    if (!row || !(await bcrypt.compare(password, row.password_hash))) {
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

  async me(userId: string) {
    const user = await one<PublicUser>(`SELECT ${USER_COLS} FROM users WHERE id = $1`, [userId]);
    if (!user) throw new AppError(404, 'Utilisateur introuvable');
    return user;
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
