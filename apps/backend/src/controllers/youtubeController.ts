import { Request, Response, NextFunction } from 'express';
import { youtubeService } from '../services/youtubeService';

export const youtubeController = {
  search(req: Request, res: Response, next: NextFunction) {
    try {
      const q = req.query.q as string;
      if (!q || q.trim().length === 0) {
        return res.json({ tracks: [] });
      }
      const tracks = youtubeService.search(q);
      res.json({ tracks });
    } catch (err) { next(err); }
  },

  trending(req: Request, res: Response, next: NextFunction) {
    try {
      const category = req.query.cat as string;
      const query = category || 'trending music';
      const tracks = youtubeService.search(query, 12);
      res.json({ tracks, category });
    } catch (err) { next(err); }
  },

  related(req: Request, res: Response, next: NextFunction) {
    try {
      const title = req.query.title as string;
      const artist = req.query.artist as string;
      const q = req.query.q as string;
      const searchQuery = (title && artist) ? `${title} ${artist}` : (q || '');
      if (!searchQuery.trim()) return res.json({ tracks: [] });
      const tracks = youtubeService.related(searchQuery, 12);
      res.json({ tracks });
    } catch (err) { next(err); }
  },

  categories(_req: Request, res: Response) {
    res.json({
      categories: [
        { id: 'pop', label: 'Pop', query: 'pop hits 2024' },
        { id: 'hiphop', label: 'Hip Hop', query: 'hip hop rap' },
        { id: 'rnb', label: 'R&B', query: 'rnb soul' },
        { id: 'rock', label: 'Rock', query: 'rock classics' },
        { id: 'electronic', label: 'Electronic', query: 'electronic dance music' },
        { id: 'jazz', label: 'Jazz', query: 'jazz relaxing' },
        { id: 'classical', label: 'Classical', query: 'classical music' },
        { id: 'afro', label: 'Afro', query: 'afrobeat african music' },
        { id: 'reggae', label: 'Reggae', query: 'reggae dancehall' },
        { id: 'latino', label: 'Latino', query: 'latin music salsa' },
      ],
    });
  },

  async getAudioUrl(req: Request, res: Response, next: NextFunction) {
    try {
      const youtubeId = req.params.youtubeId as string;
      const audioUrl = youtubeService.getAudioUrl(youtubeId);
      if (!audioUrl) return res.status(404).json({ message: 'Could not extract audio URL' });
      res.json({ audioUrl, youtubeId });
    } catch (err) { next(err); }
  },

  async getDetails(req: Request, res: Response, next: NextFunction) {
    try {
      const youtubeId = req.params.youtubeId as string;
      const details = youtubeService.getDetails(youtubeId);
      if (!details) return res.status(404).json({ message: 'Video not found' });
      res.json(details);
    } catch (err) { next(err); }
  },
};