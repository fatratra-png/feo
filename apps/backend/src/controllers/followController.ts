import { Response, NextFunction } from 'express';
import { followRepository } from '../repositories/followRepository';
import { AuthRequest } from '../middleware/auth';

export const followController = {
  async toggle(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const followed = await followRepository.toggle(req.userId!, req.params.artistId as string);
      res.json({ followed });
    } catch (err) {
      next(err);
    }
  },

  async getFollowedArtists(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const artists = await followRepository.getUserFollowedArtists(req.userId!);
      res.json(artists);
    } catch (err) {
      next(err);
    }
  },
};