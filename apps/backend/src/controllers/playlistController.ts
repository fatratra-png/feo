import { Response, NextFunction } from 'express';
import { playlistRepository } from '../repositories/playlistRepository';
import { AuthRequest } from '../middleware/auth';
import { AppError } from '../middleware/errorHandler';

export const playlistController = {
  async getAll(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const result = await playlistRepository.findAll(page, limit);
      res.json(result);
    } catch (err) {
      next(err);
    }
  },

  async getById(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const id = req.params.id as string;
      const playlist = await playlistRepository.findById(id);
      if (!playlist) return res.status(404).json({ message: 'Playlist not found' });
      const tracks = await playlistRepository.getTracks(id);
      res.json({ ...playlist, tracks });
    } catch (err) {
      next(err);
    }
  },

  async getMyPlaylists(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const playlists = await playlistRepository.findByUser(req.userId!);
      res.json(playlists);
    } catch (err) {
      next(err);
    }
  },

  async create(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { name, description, isPublic } = req.body;
      if (!name) throw new AppError(400, 'Name is required');
      const playlist = await playlistRepository.create(name, description || null, req.userId!, isPublic ?? true);
      res.status(201).json(playlist);
    } catch (err) {
      next(err);
    }
  },

  async update(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const id = req.params.id as string;
      const playlist = await playlistRepository.findById(id);
      if (!playlist) return res.status(404).json({ message: 'Playlist not found' });
      if (playlist.user_id !== req.userId) {
        return res.status(403).json({ message: 'Not authorized' });
      }
      const { name, description, cover_url, is_public } = req.body;
      const updated = await playlistRepository.update(id, { name, description, cover_url, is_public });
      res.json(updated);
    } catch (err) {
      next(err);
    }
  },

  async delete(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const id = req.params.id as string;
      const playlist = await playlistRepository.findById(id);
      if (!playlist) return res.status(404).json({ message: 'Playlist not found' });
      if (playlist.user_id !== req.userId) {
        return res.status(403).json({ message: 'Not authorized' });
      }
      await playlistRepository.delete(id);
      res.json({ message: 'Playlist deleted' });
    } catch (err) {
      next(err);
    }
  },

  async addTrack(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const id = req.params.id as string;
      const { trackId } = req.body;
      const playlist = await playlistRepository.findById(id);
      if (!playlist) return res.status(404).json({ message: 'Playlist not found' });
      if (playlist.user_id !== req.userId) {
        return res.status(403).json({ message: 'Not authorized' });
      }
      await playlistRepository.addTrack(id, trackId);
      res.json({ message: 'Track added' });
    } catch (err) {
      next(err);
    }
  },

  async removeTrack(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const id = req.params.id as string;
      const trackId = req.params.trackId as string;
      const playlist = await playlistRepository.findById(id);
      if (!playlist) return res.status(404).json({ message: 'Playlist not found' });
      if (playlist.user_id !== req.userId) {
        return res.status(403).json({ message: 'Not authorized' });
      }
      await playlistRepository.removeTrack(id, trackId);
      res.json({ message: 'Track removed' });
    } catch (err) {
      next(err);
    }
  },

  async reorderTracks(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const id = req.params.id as string;
      const { trackIds } = req.body;
      const playlist = await playlistRepository.findById(id);
      if (!playlist) return res.status(404).json({ message: 'Playlist not found' });
      if (playlist.user_id !== req.userId) {
        return res.status(403).json({ message: 'Not authorized' });
      }
      await playlistRepository.reorderTracks(id, trackIds);
      res.json({ message: 'Tracks reordered' });
    } catch (err) {
      next(err);
    }
  },
};