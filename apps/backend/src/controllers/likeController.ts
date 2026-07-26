import { Response, NextFunction } from 'express';
import { likeRepository } from '../repositories/likeRepository';
import { AuthRequest } from '../middleware/auth';

export const likeController = {
  async toggleTrack(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const liked = await likeRepository.toggleTrack(req.userId!, req.params.trackId as string);
      res.json({ liked });
    } catch (err) {
      next(err);
    }
  },

  async toggleAlbum(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const liked = await likeRepository.toggleAlbum(req.userId!, req.params.albumId as string);
      res.json({ liked });
    } catch (err) {
      next(err);
    }
  },

  async getLikedTracks(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const tracks = await likeRepository.getUserLikedTracks(req.userId!);
      res.json(tracks);
    } catch (err) {
      next(err);
    }
  },

  async getLikedAlbums(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const albums = await likeRepository.getUserLikedAlbums(req.userId!);
      res.json(albums);
    } catch (err) {
      next(err);
    }
  },
};