import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { userRepository } from '../repositories/userRepository';
import { AppError } from '../middleware/errorHandler';

export const authService = {
  async register(email: string, password: string, displayName: string) {
    const existing = await userRepository.findByEmail(email);
    if (existing) {
      throw new AppError(409, 'Email already registered');
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await userRepository.create(email, passwordHash, displayName);
    const tokens = this.generateTokens(user.id);
    return { user, ...tokens };
  },

  async login(email: string, password: string) {
    const user = await userRepository.findByEmail(email);
    if (!user) {
      throw new AppError(401, 'Invalid email or password');
    }

    const isValid = await bcrypt.compare(password, user.password_hash);
    if (!isValid) {
      throw new AppError(401, 'Invalid email or password');
    }

    const tokens = this.generateTokens(user.id);
    const { password_hash, ...safeUser } = user;
    return { user: safeUser, ...tokens };
  },

  async refresh(refreshToken: string) {
    const stored = await userRepository.findRefreshToken(refreshToken);
    if (!stored) {
      throw new AppError(401, 'Invalid refresh token');
    }

    try {
      const decoded = jwt.verify(refreshToken, config.jwt.refreshSecret) as { userId: string };
      await userRepository.deleteRefreshToken(refreshToken);
      const tokens = this.generateTokens(decoded.userId);
      return tokens;
    } catch {
      throw new AppError(401, 'Invalid refresh token');
    }
  },

  async logout(userId: string) {
    await userRepository.deleteUserRefreshTokens(userId);
  },

  generateTokens(userId: string) {
    const accessToken = jwt.sign(
      { userId } as object,
      config.jwt.secret,
      { expiresIn: '15m' as const }
    );

    const refreshToken = jwt.sign(
      { userId } as object,
      config.jwt.refreshSecret,
      { expiresIn: '7d' as const }
    );

    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    userRepository.saveRefreshToken(userId, refreshToken, expiresAt);

    return { accessToken, refreshToken };
  },
};