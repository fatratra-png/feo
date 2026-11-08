import { NextFunction, Request, Response, RequestHandler } from 'express';
import { ZodError, ZodSchema } from 'zod';

export class AppError extends Error {
  constructor(public status: number, message: string, public code?: string) {
    super(message);
  }
}

export interface AuthRequest extends Request {
  userId?: string;
}

/** Wraps async handlers so rejections reach the error middleware. */
export const handler =
  (fn: (req: AuthRequest, res: Response) => Promise<unknown>): RequestHandler =>
  (req, res, next) => {
    fn(req as AuthRequest, res).catch(next);
  };

export function parse<T>(schema: ZodSchema<T>, data: unknown): T {
  return schema.parse(data);
}

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof ZodError) {
    const first = err.issues[0];
    return res.status(400).json({
      message: first ? `${first.path.join('.') || 'input'}: ${first.message}` : 'Invalid input',
      issues: err.issues,
    });
  }
  if (err instanceof AppError) {
    return res.status(err.status).json({ message: err.message, code: err.code });
  }
  console.error('[api] unhandled error:', err);
  res.status(500).json({ message: 'Erreur interne du serveur' });
}
